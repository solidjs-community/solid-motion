import {createStyles, createMotionState, mountedStates, normalizeTransition} from "../src/engine.js"

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

/*
motion-dom filters out non-primary pointers, and jsdom's PointerEvent
defaults to an empty `pointerType` with `isPrimary: false`, which the filter
rejects. These spell out a plain left-button mouse press.
*/
const pointer = (type: string): PointerEvent =>
	new PointerEvent(type, {bubbles: true, pointerType: "mouse", button: 0, isPrimary: true})

/** An element attached to the document, since Motion reads computed style off it. */
function mounted(): HTMLDivElement {
	const el = document.createElement("div")
	document.body.appendChild(el)
	return el
}

describe("createStyles", () => {
	test("Maps transform shorthands onto a transform declaration", () => {
		expect(createStyles({x: 100, scale: 1.5}).style).toEqual({
			transform: "translateX(100px) scale(1.5)",
		})
	})

	test("Uses the first value of a keyframe list", () => {
		// a static style can't represent a list, so the starting frame is used
		expect(createStyles({opacity: [0.2, 0.9]}).style).toEqual({opacity: 0.2})
	})

	test("Passes CSS custom properties through", () => {
		expect(createStyles({"--brand": "red"}).style).toEqual({"--brand": "red"})
	})

	test("Ignores a target's own transition", () => {
		expect(createStyles({opacity: 1, transition: {duration: 5}}).style).toEqual({opacity: 1})
	})

	test("Returns nothing for an empty target", () => {
		expect(createStyles({})).toEqual({style: {}, attrs: {}})
	})

	/*
	SVG geometry has to come out as an attribute. As an inline style it would
	outrank the attribute Motion animates, and the element would never move.
	*/
	test("Emits SVG geometry as attributes, not styles", () => {
		const {style, attrs} = createStyles({height: 20, opacity: 0.5}, "rect")
		expect(attrs).toEqual({height: "20px"})
		expect(style).toEqual({opacity: 0.5})
	})

	test("Keeps the svg root's own transform in style", () => {
		const {style, attrs} = createStyles({x: 10}, "svg")
		expect(attrs).toEqual({})
		expect(style).toEqual({transform: "translateX(10px)"})
	})
})

describe("normalizeTransition", () => {
	test("Passes a non-object transition straight through", () => {
		expect(normalizeTransition(undefined)).toBeUndefined()
		expect(normalizeTransition(null)).toBeNull()
	})

	test("Renames Motion One's `easing` to `ease`", () => {
		expect(normalizeTransition({duration: 1, easing: "ease-in-out"})).toEqual({
			duration: 1,
			ease: "ease-in-out",
		})
	})

	test("A per-value override inherits what it does not restate", () => {
		expect(normalizeTransition({duration: 1, ease: "linear", rotate: {duration: 2}})).toEqual({
			duration: 1,
			ease: "linear",
			rotate: {duration: 2, ease: "linear"},
		})
	})

	test("Renames `easing` inside a per-value override too", () => {
		expect(normalizeTransition({duration: 1, x: {easing: "linear"}})).toEqual({
			duration: 1,
			x: {duration: 1, ease: "linear"},
		})
	})

	test("Treats an array value as a base option, not an override", () => {
		// `ease` as a cubic bezier is an array, and must not be read as a per-value override
		expect(normalizeTransition({duration: 1, ease: [0.4, 0, 0.2, 1]})).toEqual({
			duration: 1,
			ease: [0.4, 0, 0.2, 1],
		})
	})
})

describe("createMotionState", () => {
	test("Applies the start target on mount and registers the element", () => {
		const el = mounted()
		const state = createMotionState({initial: {opacity: 0.25}})
		const unmount = state.mount(el)

		expect(el.style.opacity).toBe("0.25")
		expect(mountedStates.get(el)).toBe(state)

		unmount()
		expect(mountedStates.has(el)).toBe(false)
	})

	test("Resolves initial through the variants map", () => {
		const state = createMotionState({
			initial: "hidden",
			variants: {hidden: {opacity: 0.1}},
		})
		expect(state.getTarget()).toEqual({opacity: 0.1})
	})

	test("initial={false} starts on the animate target", () => {
		const state = createMotionState({initial: false, animate: {opacity: 0.7}})
		expect(state.getTarget()).toEqual({opacity: 0.7})
	})

	test("An unset initial inherits the parent's variant key", () => {
		const parent = createMotionState({initial: "hidden", variants: {hidden: {opacity: 0}}})
		const child = createMotionState({variants: {hidden: {opacity: 0.4}}}, parent)

		expect(child.getInitialVariantKey()).toBe("hidden")
		// resolved against the child's own variants, not the parent's
		expect(child.getTarget()).toEqual({opacity: 0.4})
	})

	test("An unset initial with no ancestor key starts empty", () => {
		expect(createMotionState({animate: {opacity: 1}}).getTarget()).toEqual({})
	})

	test("getOptions reports the latest options", () => {
		const state = createMotionState({animate: {opacity: 0.2}})
		state.update({animate: {opacity: 0.6}})
		expect(state.getOptions()).toEqual({animate: {opacity: 0.6}})
	})

	test("A press gesture layers over animate, and reverts on release", async () => {
		const el = mounted()
		const state = createMotionState({
			animate: {opacity: 1},
			press: {opacity: 0.3},
			transition: {duration: 0.001},
		})
		const unmount = state.mount(el)

		el.dispatchEvent(pointer("pointerdown"))
		await sleep(50)
		expect(el.style.opacity).toBe("0.3")

		window.dispatchEvent(pointer("pointerup"))
		await sleep(50)
		expect(el.style.opacity).toBe("1")

		unmount()
	})

	test("Gestures are rebound when one is added and unbound on unmount", async () => {
		const el = mounted()
		const state = createMotionState({animate: {opacity: 1}, transition: {duration: 0.001}})
		const unmount = state.mount(el)

		// no press gesture yet, so the pointer event does nothing
		el.dispatchEvent(pointer("pointerdown"))
		await sleep(30)
		expect(el.style.opacity).toBe("1")

		state.update({animate: {opacity: 1}, press: {opacity: 0.2}, transition: {duration: 0.001}})
		el.dispatchEvent(pointer("pointerdown"))
		await sleep(50)
		expect(el.style.opacity).toBe("0.2")

		window.dispatchEvent(pointer("pointerup"))
		await sleep(50)

		unmount()
		// after unmount the gesture is unbound, so this must not animate anything
		el.dispatchEvent(pointer("pointerdown"))
		await sleep(30)
		expect(el.style.opacity).toBe("1")
	})

	test("An exit target with no values still resolves", async () => {
		const el = mounted()
		const state = createMotionState({animate: {opacity: 1}, exit: "missing"})
		const unmount = state.mount(el)

		let completed = false
		el.addEventListener("motioncomplete", () => (completed = true))

		await state.setActive("exit", true)
		expect(completed).toBe(true)

		unmount()
	})

	test("update() is ignored while the element is exiting", async () => {
		const el = mounted()
		const state = createMotionState({
			animate: {opacity: 1},
			exit: {opacity: 0},
			transition: {duration: 0.001},
		})
		const unmount = state.mount(el)

		await state.setActive("exit", true)
		expect(el.style.opacity).toBe("0")

		state.update({
			animate: {opacity: 0.9},
			exit: {opacity: 0},
			transition: {duration: 0.001},
		})
		await sleep(50)
		// still on the exit target rather than the new animate one
		expect(el.style.opacity).toBe("0")

		unmount()
	})

	test("A remount clears the exit flag", async () => {
		const el = mounted()
		const state = createMotionState({
			animate: {opacity: 0.5},
			exit: {opacity: 0},
			transition: {duration: 0.001},
		})

		let unmount = state.mount(el)
		await state.setActive("exit", true)
		unmount()

		unmount = state.mount(el)
		await sleep(50)
		expect(el.style.opacity).toBe("0.5")

		unmount()
	})

	/*
	With no `animate` prop there is nothing for the released gesture to resolve
	back to, so the engine records what the element showed before the gesture
	introduced the key and animates to that instead.
	*/
	test("A gesture with no animate base reverts to the pre-gesture value", async () => {
		const el = mounted()
		el.style.opacity = "1"
		const state = createMotionState({press: {opacity: 0.3}, transition: {duration: 0.001}})
		const unmount = state.mount(el)

		el.dispatchEvent(pointer("pointerdown"))
		await sleep(50)
		expect(el.style.opacity).toBe("0.3")

		window.dispatchEvent(pointer("pointerup"))
		await sleep(50)
		expect(Number(el.style.opacity)).toBeCloseTo(1, 2)

		unmount()
	})

	test("A transform shorthand reverts to its identity value", async () => {
		const el = mounted()
		const state = createMotionState({press: {x: 50}, transition: {duration: 0.001}})
		const unmount = state.mount(el)

		el.dispatchEvent(pointer("pointerdown"))
		await sleep(50)
		expect(el.style.transform).toContain("50px")

		window.dispatchEvent(pointer("pointerup"))
		await sleep(50)
		// back to the identity value, which Motion writes out as "none"
		expect(el.style.transform).toBe("none")

		unmount()
	})

	test("Applies an SVG start target as attributes", () => {
		const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect")
		document.body.appendChild(rect)

		const state = createMotionState({initial: {height: 20, opacity: 0.5}})
		const unmount = state.mount(rect)

		// geometry lands on the attribute, everything else stays a style
		expect(rect.getAttribute("height")).toBe("20px")
		expect(rect.style.opacity).toBe("0.5")
		expect(rect.style.height).toBe("")

		unmount()
	})

	test("Animating with no element in play is a no-op", async () => {
		const state = createMotionState({animate: {opacity: 1}, exit: {opacity: 0}})
		// never mounted, so there is nothing to animate and nothing to throw
		await expect(state.setActive("exit", true)).resolves.toBeUndefined()
	})
})
