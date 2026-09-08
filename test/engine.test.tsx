import {createStyles, createMotionState, mountedStates, normalizeTransition} from "../src/engine.js"
import type {MotionEvent, Target} from "../src/index.jsx"

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

/*
motion-dom filters out non-primary pointers. A PointerEvent built by hand
defaults to an empty `pointerType` with `isPrimary: false`, which that filter
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

	test("A gesture reverts to the initial value, not the property's zero value", async () => {
		const el = mounted()
		const state = createMotionState({
			initial: {scale: 2},
			hover: {scale: 3},
			transition: {duration: 0.001},
		})
		const unmount = state.mount(el)
		expect(el.style.transform).toBe("scale(2)")

		el.dispatchEvent(pointer("pointerenter"))
		await sleep(50)
		expect(el.style.transform).toBe("scale(3)")

		/*
		A transform can only be read back out of a computed matrix, so the base
		value falls back to the property's identity — which would revert this to
		`scale(1)` rather than to the `initial` the element was rendered with.
		*/
		el.dispatchEvent(pointer("pointerleave"))
		await sleep(50)
		expect(el.style.transform).toBe("scale(2)")

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

	test("A base value is released once no gesture layer introduces its key", async () => {
		const el = mounted()
		const state = createMotionState({hover: {scale: 1.2}, transition: {duration: 0.001}})
		const unmount = state.mount(el)

		// capture `scale`'s resting value, then revert to it
		el.dispatchEvent(pointer("pointerenter"))
		await sleep(50)
		el.dispatchEvent(pointer("pointerleave"))
		await sleep(50)

		// `hover` no longer mentions `scale`, so it must stop being asserted
		state.update({hover: {opacity: 0.5}, transition: {duration: 0.001}})
		await sleep(50)

		const targets: Target[] = []
		el.addEventListener("motionstart", e => targets.push((e as MotionEvent).detail.target))

		el.dispatchEvent(pointer("pointerenter"))
		await sleep(50)

		expect(targets).toHaveLength(1)
		expect(targets[0]).toEqual({opacity: 0.5})

		unmount()
	})

	test("A focus gesture layers over animate and reverts on blur", async () => {
		const el = document.createElement("button")
		document.body.appendChild(el)
		const state = createMotionState({
			animate: {opacity: 1},
			focus: {opacity: 0.4},
			transition: {duration: 0.001},
		})
		const unmount = state.mount(el)

		el.focus()
		await sleep(50)
		expect(el.style.opacity).toBe("0.4")

		el.blur()
		await sleep(50)
		expect(el.style.opacity).toBe("1")

		unmount()
		el.remove()
	})

	test("Press layers over focus, matching Motion's own precedence", async () => {
		const el = document.createElement("button")
		document.body.appendChild(el)
		const state = createMotionState({
			animate: {opacity: 1},
			focus: {opacity: 0.4},
			press: {opacity: 0.2},
			transition: {duration: 0.001},
		})
		const unmount = state.mount(el)

		el.focus()
		await sleep(50)
		el.dispatchEvent(pointer("pointerdown"))
		await sleep(50)
		expect(el.style.opacity).toBe("0.2")

		// releasing falls back to the still-active focus layer
		window.dispatchEvent(pointer("pointerup"))
		await sleep(50)
		expect(el.style.opacity).toBe("0.4")

		unmount()
		el.remove()
	})

	test("Retargeting one property leaves another mid-flight animation alone", async () => {
		const el = mounted()
		const state = createMotionState({
			initial: {opacity: 1, x: 0},
			animate: {opacity: 0, x: 100},
			transition: {duration: 0.4},
		})
		const unmount = state.mount(el)

		await sleep(80)
		expect(Number(el.style.opacity)).toBeGreaterThan(0)
		expect(Number(el.style.opacity)).toBeLessThan(1)

		/*
		`opacity` is not mentioned by the new target. Each property is animated
		by its own MotionValue, so retargeting `x` no longer stops and replaces a
		single element-wide animation — which used to strand `opacity` wherever
		it had reached at that instant.
		*/
		state.update({
			initial: {opacity: 1, x: 0},
			animate: {x: 200},
			transition: {duration: 0.4},
		})

		await sleep(500)
		expect(el.style.opacity).toBe("0")
		expect(el.style.transform).toBe("translateX(200px)")

		unmount()
	})

	describe("reducedMotion", () => {
		/*
		Motion's own semantics: positional values (transforms, width/height/inset)
		are applied instantly, everything else keeps animating. A fade still
		conveys meaning without triggering vestibular discomfort.
		*/
		test("Applies positional values instantly and still animates the rest", async () => {
			const el = mounted()
			const state = createMotionState({
				initial: {opacity: 1, x: 0},
				animate: {opacity: 0, x: 100},
				transition: {duration: 1},
				reducedMotion: "always",
			})
			const unmount = state.mount(el)

			await sleep(60)
			// the movement is already done ...
			expect(el.style.transform).toBe("translateX(100px)")
			// ... while the fade is still only a fraction of the way through
			expect(Number(el.style.opacity)).toBeGreaterThan(0.5)

			unmount()
		})

		test("Animates normally when set to never", async () => {
			const el = mounted()
			const state = createMotionState({
				initial: {x: 0},
				animate: {x: 100},
				transition: {duration: 1},
				reducedMotion: "never",
			})
			const unmount = state.mount(el)

			await sleep(60)
			expect(el.style.transform).not.toBe("translateX(100px)")

			unmount()
		})
	})

	test("An exit target with no values reports nothing to wait for", () => {
		const el = mounted()
		const state = createMotionState({animate: {opacity: 1}, exit: "missing"})
		const unmount = state.mount(el)

		let started = false
		el.addEventListener("motionstart", () => (started = true))

		/*
		`null` means the caller can unmount synchronously. An empty target is a
		no-op, so it reports no lifecycle events either — the guarantee that the
		element still leaves the DOM is covered in test/presence.test.tsx.
		*/
		expect(state.startExit()).toBeNull()
		expect(started).toBe(false)

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

		await state.startExit()
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
		await state.startExit()
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

	test("Animating with no element in play is a no-op", () => {
		const state = createMotionState({animate: {opacity: 1}, exit: {opacity: 0}})
		// never mounted, so there is nothing to animate and nothing to wait for
		expect(state.startExit()).toBeNull()
	})

	test("A gesture that fires mid-exit cannot cut the exit short", async () => {
		const el = mounted()
		const state = createMotionState({
			initial: {opacity: 1},
			hover: {opacity: 0.5},
			exit: {opacity: 0, transition: {duration: 0.3}},
		})
		const unmount = state.mount(el)

		el.dispatchEvent(pointer("pointerenter"))
		const exited = state.startExit()
		expect(exited).not.toBeNull()

		let settled = false
		void exited!.then(() => (settled = true))

		// gestures are unbound at exit start, so this must not restart anything
		el.dispatchEvent(pointer("pointerleave"))
		await sleep(150)
		expect(settled).toBe(false)

		await exited
		expect(el.style.opacity).toBe("0")

		unmount()
	})
})

/*
These need a real IntersectionObserver, so they were unreachable while the
suite ran in jsdom. The Playwright suite covers `inView` at the app level.
These cover it at the layer level, where it has to compose with the others.
*/
describe("inView", () => {
	/** A tall filler element, so the box under test starts out of view. */
	function spacer(): HTMLElement {
		const el = document.createElement("div")
		el.style.height = "150vh"
		document.body.appendChild(el)
		return el
	}

	test("Animates when the element scrolls into view", async () => {
		const filler = spacer()
		const el = mounted()
		el.style.height = "80px"

		const state = createMotionState({
			animate: {opacity: 1},
			inView: {opacity: 0.2},
			transition: {duration: 0.05},
		})
		const unmount = state.mount(el)

		let entry: unknown
		el.addEventListener("viewenter", e => {
			entry = (e as CustomEvent).detail.originalEntry
		})

		el.scrollIntoView()
		await sleep(200)

		// the handler is handed the observer entry, not the element
		expect((entry as IntersectionObserverEntry).isIntersecting).toBe(true)
		expect(Number(window.getComputedStyle(el).opacity)).toBeCloseTo(0.2, 1)

		unmount()
		filler.remove()
	})

	test("Reverts when the element leaves the viewport", async () => {
		const filler = spacer()
		const el = mounted()
		el.style.height = "80px"

		const state = createMotionState({
			animate: {opacity: 1},
			inView: {opacity: 0.2},
			transition: {duration: 0.05},
		})
		const unmount = state.mount(el)

		el.scrollIntoView()
		await sleep(200)
		expect(Number(window.getComputedStyle(el).opacity)).toBeCloseTo(0.2, 1)

		window.scrollTo(0, 0)
		await sleep(200)
		expect(Number(window.getComputedStyle(el).opacity)).toBeCloseTo(1, 1)

		unmount()
		filler.remove()
	})

	/*
	inView sits below hover in the layer order, so a hover must merge over it
	rather than replace it.
	*/
	test("Keeps the inView values underneath a hover", async () => {
		const filler = spacer()
		const el = mounted()
		el.style.height = "80px"

		const state = createMotionState({
			animate: {opacity: 1},
			inView: {x: 120},
			hover: {opacity: 0.5},
			transition: {duration: 0.05},
		})
		const unmount = state.mount(el)

		el.scrollIntoView()
		await sleep(200)
		expect(el.style.transform).toContain("120")

		el.dispatchEvent(pointer("pointerenter"))
		await sleep(200)
		expect(Number(window.getComputedStyle(el).opacity)).toBeCloseTo(0.5, 1)
		expect(el.style.transform).toContain("120")

		unmount()
		filler.remove()
	})
})
