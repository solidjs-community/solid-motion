import {createSignal, flush} from "solid-js"
import {render, screen} from "@solidjs/testing-library"
import {Motion} from "../src/index.jsx"

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

/** Long enough for Motion's frame loop to run a read pass and then a render. */
const frames = (): Promise<void> => sleep(80)

/*
Stubbing the box per element pins the geometry FLIP reads, so a test can move
an element by an exact amount and assert the exact transform. Otherwise the
numbers would depend on how the test page happens to lay out. Real measurement
is covered by the Playwright suite.
*/
function stubBox(el: Element, box: {left: number; top: number}): void {
	Object.defineProperty(el, "getBoundingClientRect", {
		configurable: true,
		value: () => ({
			left: box.left,
			top: box.top,
			right: box.left + 100,
			bottom: box.top + 100,
			width: 100,
			height: 100,
			x: box.left,
			y: box.top,
			toJSON: () => ({}),
		}),
	})
}

/** The pixel offset the inline transform is currently applying on an axis. */
function offsetOf(el: HTMLElement, axis: "X" | "Y"): number {
	const match = new RegExp(`translate${axis}\\((-?[\\d.]+)px\\)`).exec(el.style.transform)
	return match ? Number(match[1]) : 0
}

/** Nudges the DOM so the layout watcher's MutationObserver schedules a check. */
function touchDom(): void {
	const marker = document.createElement("span")
	document.body.appendChild(marker)
	marker.remove()
}

describe("layout", () => {
	/*
	A long transition, so the offset is sampled while it is still near where it
	started — the animation begins in the same frame the movement is detected.
	*/
	test("Holds the element at its old position, then animates the offset away", async () => {
		render(() => <Motion.div data-testid="box" layout layoutTransition={{duration: 4}} />)
		const box = await screen.findByTestId("box")

		stubBox(box, {left: 0, top: 0})
		await frames()

		// the layout moves it 50px down
		stubBox(box, {left: 0, top: 50})
		touchDom()
		await frames()

		// FLIP: pulled back up by roughly the distance it moved, so it appears not to have
		expect(offsetOf(box, "Y")).toBeLessThan(-40)
		expect(offsetOf(box, "Y")).toBeGreaterThanOrEqual(-50)
	})

	test("Animates a horizontal move too, and lands with no offset left", async () => {
		render(() => <Motion.div data-testid="box" layout layoutTransition={{duration: 0.15}} />)
		const box = await screen.findByTestId("box")

		stubBox(box, {left: 0, top: 0})
		await frames()

		stubBox(box, {left: 30, top: 0})
		touchDom()
		await frames()

		expect(offsetOf(box, "X")).toBeLessThan(0)

		await sleep(400)
		expect(box.style.transform).toBe("none")
	})

	test("Ignores sub-pixel movement", async () => {
		render(() => <Motion.div data-testid="box" layout />)
		const box = await screen.findByTestId("box")

		stubBox(box, {left: 0, top: 0})
		await frames()

		// below the threshold: measurement noise, not a layout change
		stubBox(box, {left: 0.2, top: 0.1})
		touchDom()
		await frames()

		expect(box.style.transform).toBe("")
	})

	test("Leaves an element without `layout` alone", async () => {
		render(() => <Motion.div data-testid="box" />)
		const box = await screen.findByTestId("box")

		stubBox(box, {left: 0, top: 0})
		await frames()

		stubBox(box, {left: 0, top: 120})
		touchDom()
		await frames()

		expect(box.style.transform).toBe("")
	})

	/*
	A hidden element measures as a zero box, which is not a layout change — it
	is the absence of a layout. Treating it as one applies a full-offset
	animation to something invisible, and then a second, very visible one when
	it comes back.
	*/
	test("Ignores an element while it is not rendered", async () => {
		render(() => <Motion.div data-testid="box" layout layoutTransition={{duration: 4}} />)
		const box = await screen.findByTestId("box")

		stubBox(box, {left: 100, top: 200})
		await frames()

		// display: none — every measurement collapses to zero
		Object.defineProperty(box, "getBoundingClientRect", {
			configurable: true,
			value: () => ({
				left: 0,
				top: 0,
				right: 0,
				bottom: 0,
				width: 0,
				height: 0,
				x: 0,
				y: 0,
				toJSON: () => ({}),
			}),
		})
		touchDom()
		await frames()
		expect(box.style.transform).toBe("")

		// and shown again in the same place: still no layout change
		stubBox(box, {left: 100, top: 200})
		touchDom()
		await frames()
		expect(box.style.transform).toBe("")
	})

	test("Stops tracking once the element is gone", async () => {
		const [show, setShow] = createSignal(true)
		render(() => (
			<>
				{show() ? <Motion.div data-testid="box" layout /> : null}
				<Motion.div data-testid="other" layout />
			</>
		))
		const box = await screen.findByTestId("box")
		stubBox(box, {left: 0, top: 0})
		await frames()

		setShow(false)
		flush()
		await frames()

		// the detached element must not be measured or moved any more
		stubBox(box, {left: 0, top: 200})
		touchDom()
		await frames()

		expect(box.style.transform).toBe("")
	})
})
