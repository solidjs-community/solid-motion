import {createSignal, flush} from "solid-js"
import {render, screen} from "@solidjs/testing-library"
import {Motion} from "../src/index.jsx"
import type {CustomDragEvent} from "../src/index.jsx"

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

/*
motion-dom filters out non-primary pointers. A PointerEvent built by hand
defaults to an empty `pointerType` with `isPrimary: false`, which that filter
rejects. These spell out a plain left-button mouse drag.
*/
function pointer(type: string, x: number, y: number): PointerEvent {
	return new PointerEvent(type, {
		bubbles: true,
		pointerType: "mouse",
		button: 0,
		isPrimary: true,
		pointerId: 1,
		clientX: x,
		clientY: y,
	})
}

/** A full press-move-release, with enough movement to clear the drag threshold. */
async function dragBy(el: Element, dx: number, dy: number): Promise<void> {
	el.dispatchEvent(pointer("pointerdown", 0, 0))
	window.dispatchEvent(pointer("pointermove", dx, dy))
	await sleep(20)
	window.dispatchEvent(pointer("pointerup", dx, dy))
	await sleep(20)
}

describe("drag", () => {
	test("Moves the element with the pointer", async () => {
		render(() => <Motion.div data-testid="box" drag />)
		const box = await screen.findByTestId("box")

		await dragBy(box, 60, 40)
		expect(box.style.transform).toBe("translateX(60px) translateY(40px)")
	})

	test("drag='x' moves only along that axis", async () => {
		render(() => <Motion.div data-testid="box" drag="x" />)
		const box = await screen.findByTestId("box")

		await dragBy(box, 50, 50)
		expect(box.style.transform).toBe("translateX(50px)")
	})

	test("A press that barely moves is not a drag", async () => {
		const events: string[] = []
		render(() => <Motion.div data-testid="box" drag onDragStart={() => events.push("start")} />)
		const box = await screen.findByTestId("box")

		box.dispatchEvent(pointer("pointerdown", 0, 0))
		// under the threshold, so a button inside a draggable still clicks
		window.dispatchEvent(pointer("pointermove", 2, 1))
		window.dispatchEvent(pointer("pointerup", 2, 1))
		await sleep(20)

		expect(events).toEqual([])
		expect(box.style.transform).toBe("")
	})

	test("Constraints resist movement past the bound", async () => {
		render(() => (
			<Motion.div
				data-testid="box"
				drag="x"
				dragConstraints={{left: 0, right: 100}}
				dragElastic={0.5}
			/>
		))
		const box = await screen.findByTestId("box")

		box.dispatchEvent(pointer("pointerdown", 0, 0))
		window.dispatchEvent(pointer("pointermove", 200, 0))
		await sleep(20)

		// 100 past the bound, halved by the elasticity
		expect(box.style.transform).toBe("translateX(150px)")

		window.dispatchEvent(pointer("pointerup", 200, 0))
		await sleep(20)
	})

	test("dragElastic={0} pins the element to the bound", async () => {
		render(() => (
			<Motion.div data-testid="box" drag="x" dragConstraints={{right: 80}} dragElastic={0} />
		))
		const box = await screen.findByTestId("box")

		box.dispatchEvent(pointer("pointerdown", 0, 0))
		window.dispatchEvent(pointer("pointermove", 300, 0))
		await sleep(20)
		expect(box.style.transform).toBe("translateX(80px)")

		window.dispatchEvent(pointer("pointerup", 300, 0))
		await sleep(20)
	})

	test("Reports drag lifecycle events with the offset", async () => {
		const seen: {type: string; offset: {x: number; y: number}}[] = []
		const record =
			(type: string) =>
			({detail}: CustomDragEvent): void => {
				seen.push({type, offset: detail.offset})
			}

		render(() => (
			<Motion.div
				data-testid="box"
				drag
				onDragStart={record("start")}
				onDrag={record("move")}
				onDragEnd={record("end")}
			/>
		))
		const box = await screen.findByTestId("box")

		await dragBy(box, 30, 20)

		expect(seen.map(e => e.type)).toEqual(["start", "move", "end"])
		expect(seen[2]!.offset).toEqual({x: 30, y: 20})
	})

	test("The `dragging` layer applies while dragging and reverts after", async () => {
		render(() => (
			<Motion.div
				data-testid="box"
				drag
				animate={{opacity: 1}}
				dragging={{opacity: 0.4}}
				transition={{duration: 0.001}}
			/>
		))
		const box = await screen.findByTestId("box")

		box.dispatchEvent(pointer("pointerdown", 0, 0))
		window.dispatchEvent(pointer("pointermove", 40, 0))
		await sleep(50)
		expect(box.style.opacity).toBe("0.4")

		window.dispatchEvent(pointer("pointerup", 40, 0))
		await sleep(50)
		expect(box.style.opacity).toBe("1")
	})

	test("dragElastic={true} uses the default resistance", async () => {
		render(() => (
			<Motion.div data-testid="box" drag="x" dragConstraints={{right: 100}} dragElastic />
		))
		const box = await screen.findByTestId("box")

		box.dispatchEvent(pointer("pointerdown", 0, 0))
		window.dispatchEvent(pointer("pointermove", 200, 0))
		await sleep(20)
		expect(box.style.transform).toBe("translateX(150px)")

		window.dispatchEvent(pointer("pointerup", 200, 0))
		await sleep(20)
	})

	test("dragMomentum={false} stops where it was released", async () => {
		render(() => <Motion.div data-testid="box" drag="x" dragMomentum={false} />)
		const box = await screen.findByTestId("box")

		await dragBy(box, 70, 0)
		await sleep(120)
		// no throw, so it stays exactly where the pointer left it
		expect(box.style.transform).toBe("translateX(70px)")
	})

	test("Ignores a non-primary pointer", async () => {
		render(() => <Motion.div data-testid="box" drag />)
		const box = await screen.findByTestId("box")

		box.dispatchEvent(
			new PointerEvent("pointerdown", {
				bubbles: true,
				pointerType: "touch",
				isPrimary: false,
			}),
		)
		window.dispatchEvent(pointer("pointermove", 50, 50))
		await sleep(20)

		expect(box.style.transform).toBe("")
	})

	test("A cancelled pointer ends the drag", async () => {
		render(() => <Motion.div data-testid="box" drag dragMomentum={false} />)
		const box = await screen.findByTestId("box")

		box.dispatchEvent(pointer("pointerdown", 0, 0))
		window.dispatchEvent(pointer("pointermove", 40, 0))
		await sleep(20)
		window.dispatchEvent(pointer("pointercancel", 40, 0))
		await sleep(20)

		// the session is over, so further movement is ignored
		window.dispatchEvent(pointer("pointermove", 200, 0))
		await sleep(20)
		expect(box.style.transform).toBe("translateX(40px)")
	})

	/*
	The drag lock is global to the page. Unmounting mid-drag without releasing
	it would leave every other draggable element permanently stuck.
	*/
	test("Unmounting mid-drag releases the page-wide drag lock", async () => {
		const [show, setShow] = createSignal(true)
		render(() => (
			<>
				{show() ? <Motion.div data-testid="first" drag /> : null}
				<Motion.div data-testid="second" drag />
			</>
		))
		const first = await screen.findByTestId("first")

		first.dispatchEvent(pointer("pointerdown", 0, 0))
		window.dispatchEvent(pointer("pointermove", 30, 0))
		await sleep(20)

		setShow(false)
		flush()
		await sleep(20)

		const second = await screen.findByTestId("second")
		await dragBy(second, 45, 0)
		expect(second.style.transform).toBe("translateX(45px)")
	})

	test("Constraints resist movement past the lower bound too", async () => {
		render(() => (
			<Motion.div
				data-testid="box"
				drag
				dragConstraints={{left: -50, top: -40}}
				dragElastic={0.5}
			/>
		))
		const box = await screen.findByTestId("box")

		box.dispatchEvent(pointer("pointerdown", 0, 0))
		window.dispatchEvent(pointer("pointermove", -150, -140))
		await sleep(20)

		// 100 past each bound, halved by the elasticity
		expect(box.style.transform).toBe("translateX(-100px) translateY(-90px)")

		window.dispatchEvent(pointer("pointerup", -150, -140))
		await sleep(20)
	})

	test("dragElastic={false} pins to the bound as firmly as 0", async () => {
		render(() => (
			<Motion.div
				data-testid="box"
				drag="x"
				dragConstraints={{right: 60}}
				dragElastic={false}
			/>
		))
		const box = await screen.findByTestId("box")

		box.dispatchEvent(pointer("pointerdown", 0, 0))
		window.dispatchEvent(pointer("pointermove", 400, 0))
		await sleep(20)
		expect(box.style.transform).toBe("translateX(60px)")

		window.dispatchEvent(pointer("pointerup", 400, 0))
		await sleep(20)
	})

	/*
	Suppressing the browser default is what stops a drag turning into a native
	drag-and-drop or a text selection — but doing it on a text input would break
	selecting and placing the caret inside it.
	*/
	test("Leaves a text input inside a draggable usable", async () => {
		let prevented = false
		render(() => (
			<Motion.div data-testid="box" drag>
				<input data-testid="field" />
			</Motion.div>
		))
		const field = await screen.findByTestId("field")
		field.addEventListener("pointerdown", e => (prevented = e.defaultPrevented))

		field.dispatchEvent(pointer("pointerdown", 0, 0))
		await sleep(20)
		expect(prevented).toBe(false)

		window.dispatchEvent(pointer("pointerup", 0, 0))
		await sleep(20)
	})

	test("Only one element drags at a time", async () => {
		render(() => (
			<div>
				<Motion.div data-testid="outer" drag>
					<Motion.div data-testid="inner" drag />
				</Motion.div>
			</div>
		))
		const inner = await screen.findByTestId("inner")
		const outer = await screen.findByTestId("outer")

		// the event bubbles to both, but the first to claim the lock wins
		inner.dispatchEvent(pointer("pointerdown", 0, 0))
		window.dispatchEvent(pointer("pointermove", 40, 0))
		await sleep(20)

		expect(inner.style.transform).toBe("translateX(40px)")
		expect(outer.style.transform).toBe("")

		window.dispatchEvent(pointer("pointerup", 40, 0))
		await sleep(20)
	})
})
