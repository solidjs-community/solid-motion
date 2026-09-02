import {createRoot, createSignal, Show} from "solid-js"
import type {JSX} from "@solidjs/web"
import {screen, render} from "@solidjs/testing-library"
import {Presence, VariantDefinition, createMotion, motion, useScroll} from "../src/index.jsx"

const duration = 0.001

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

describe("motion ref factory", () => {
	test("Applies initial as style to DOM node", async () => {
		await render(() => (
			<div
				data-testid="box"
				ref={motion(() => ({
					initial: {opacity: 0.5, x: 100},
				}))}
			/>
		))
		const component = await screen.findByTestId("box")
		expect(component.style.opacity).toBe("0.5")
		expect(component.style.transform).toBe("translateX(100px)")
	})

	test("Animation runs on mount if initial and animate differ", async () => {
		let ref!: HTMLDivElement
		render(() => (
			<div
				ref={[
					el => (ref = el),
					motion(() => ({
						initial: {opacity: 0.4},
						animate: {opacity: [0, 0.8]},
						transition: {duration},
					})),
				]}
			/>
		))
		await new Promise<void>(resolve => setTimeout(() => resolve(), 60))
		expect(ref.style.opacity).toBe("0.8")
	})

	test("Animation runs when target changes", async () => {
		const [opacity, setOpacity] = createSignal(0.5)

		/*
		Rendered into the document rather than built in a bare createRoot:
		Motion reads computed style off the element, and jsdom throws on that
		for a node with no owner document.
		*/
		let ref!: HTMLDivElement
		render(() => (
			<div
				data-testid="box"
				ref={[
					el => (ref = el),
					motion(() => ({
						initial: {opacity: 0},
						animate: {opacity: opacity()},
						transition: {duration},
					})),
				]}
			/>
		))
		const element = ref

		expect(element.style.opacity).toBe("0")

		await sleep(100)

		expect(element.style.opacity).toBe("0.5")

		setOpacity(0.8)

		expect(element.style.opacity).toBe("0.5")

		await sleep(100)

		expect(element.style.opacity).toBe("0.8")
	})

	test("Accepts default transition", async () => {
		const element = await new Promise<HTMLElement>(resolve => {
			let ref!: HTMLDivElement
			render(() => (
				<div
					ref={[
						el => (ref = el),
						motion(() => ({
							initial: {opacity: 0.5},
							animate: {opacity: 0.9},
							transition: {duration: 10},
						})),
					]}
				/>
			))
			setTimeout(() => resolve(ref), 500)
		})
		expect(element.style.opacity).not.toEqual("0.9")
	})

	describe("with Presence", () => {
		const TestComponent = (
			props: {
				initial?: boolean
				show?: boolean
				animate?: VariantDefinition
				exit?: VariantDefinition
			} = {},
		): JSX.Element => {
			return (
				<Presence initial={props.initial ?? true}>
					<Show when={props.show ?? true}>
						<div
							data-testid="child"
							ref={motion(() => ({
								animate: props.animate,
								exit: props.exit,
							}))}
						/>
					</Show>
				</Presence>
			)
		}

		test("Animates element out", () =>
			createRoot(async () => {
				const [show, setShow] = createSignal(true)
				render(() => (
					<TestComponent
						show={show()}
						exit={{opacity: 0, transition: {duration: 0.001}}}
					/>
				))
				const component = await screen.findByTestId("child")
				expect(component.style.opacity).toBe("")
				expect(component.isConnected).toBeTruthy()

				setShow(false)

				expect(component.style.opacity).toBe("")
				expect(component.isConnected).toBeTruthy()

				return new Promise<void>(resolve => {
					setTimeout(() => {
						expect(component.style.opacity).toBe("0")
						expect(component.isConnected).toBeFalsy()
						resolve()
					}, 100)
				})
			}))
	})
})

describe("createMotion", () => {
	test("Applies the start target to an element it is handed", () => {
		const el = document.createElement("div")
		document.body.appendChild(el)

		const dispose = createRoot(dispose => {
			createMotion(el, {initial: {opacity: 0.35, x: 40}})
			return dispose
		})

		expect(el.style.opacity).toBe("0.35")
		expect(el.style.transform).toBe("translateX(40px)")
		dispose()
	})

	test("Accepts an options accessor as well as a plain object", async () => {
		const el = document.createElement("div")
		document.body.appendChild(el)

		const dispose = createRoot(dispose => {
			createMotion(el, () => ({
				initial: {opacity: 0.2},
				animate: {opacity: 0.9},
				transition: {duration},
			}))
			return dispose
		})

		await sleep(60)
		expect(el.style.opacity).toBe("0.9")
		dispose()
	})
})

describe("useScroll", () => {
	test("Starts at zero on both axes", () => {
		const dispose = createRoot(dispose => {
			const {time, scrollX, scrollY} = useScroll()

			expect(time()).toBe(0)
			expect(scrollX().progress).toBe(0)
			expect(scrollY()).toMatchObject({
				current: 0,
				progress: 0,
				scrollLength: 0,
				velocity: 0,
			})
			return dispose
		})

		// unsubscribes without throwing
		expect(() => dispose()).not.toThrow()
	})

	test("Accepts scroll options", () => {
		const container = document.createElement("div")
		document.body.appendChild(container)

		const dispose = createRoot(dispose => {
			const {scrollY} = useScroll({container, axis: "y"})
			expect(scrollY().progress).toBe(0)
			return dispose
		})
		dispose()
	})
})
