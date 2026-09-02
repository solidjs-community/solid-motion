import {mountedStates} from "../src/engine.js"
import {createRoot, createSignal, flush, Show} from "solid-js"
import type {JSX} from "@solidjs/web"
import {screen, render} from "@solidjs/testing-library"
import {Presence, Motion, VariantDefinition} from "../src/index.jsx"
import type {RefProps} from "@solid-primitives/refs"

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
				<Motion.div data-testid="child" animate={props.animate} exit={props.exit} />
			</Show>
		</Presence>
	)
}

describe("Presence", () => {
	test("Renders element", async () => {
		render(TestComponent)
		const component = await screen.findByTestId("child")
		expect(component).toBeTruthy()
	})

	test("On initial Presence render, initial: false applies to children", () => {
		const wrapper = render(() => (
			<TestComponent show initial={false} animate={{opacity: 0.5}} />
		))
		flush()
		expect(wrapper.container.outerHTML).toEqual(
			`<div><div data-testid="child" style="opacity: 0.5;"></div></div>`,
		)
	})

	test("Animates element out", () =>
		createRoot(async () => {
			const [show, setShow] = createSignal(true)
			render(() => (
				<TestComponent show={show()} exit={{opacity: 0, transition: {duration: 0.001}}} />
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

	test("All children run their exit animation", async () => {
		const [show, setShow] = createSignal(true)

		let ref_1!: HTMLDivElement, ref_2!: HTMLDivElement
		let resolve_1: () => void, resolve_2: () => void

		const exit_animation: VariantDefinition = {
			opacity: 0,
			transition: {duration: 0.001},
		}

		const {container} = render(() => (
			<Presence>
				<Show when={show()}>
					<Motion ref={ref_1} exit={exit_animation} onMotionComplete={() => resolve_1()}>
						<Motion
							ref={ref_2}
							exit={exit_animation}
							onMotionComplete={() => resolve_2()}
						/>
					</Motion>
				</Show>
			</Presence>
		))

		expect(container.contains(ref_1)).toBeTruthy()
		expect(ref_1.firstChild).toBe(ref_2)
		expect(ref_1.style.opacity).toBe("")
		expect(ref_2.style.opacity).toBe("")
		expect(mountedStates.has(ref_1)).toBeTruthy()
		expect(mountedStates.has(ref_2)).toBeTruthy()

		setShow(false)
		flush()

		expect(container.contains(ref_1)).toBeTruthy()
		expect(ref_1.style.opacity).toBe("")
		expect(ref_2.style.opacity).toBe("")

		await new Promise<void>(resolve => {
			let count = 0
			resolve_1 = resolve_2 = () => {
				if (++count === 2) resolve()
			}
		})

		expect(container.contains(ref_1)).toBeFalsy()
		expect(ref_1.style.opacity).toBe("0")
		expect(ref_2.style.opacity).toBe("0")
		expect(mountedStates.has(ref_1)).toBeFalsy()
		expect(mountedStates.has(ref_2)).toBeFalsy()
	})

	test("exitBeforeEnter delays enter animation until exit animation is complete", async () => {
		const [condition, setCondition] = createSignal(true)

		let ref_1!: HTMLDivElement, ref_2!: HTMLDivElement
		let resolve_last: (() => void) | undefined

		const El = (props: RefProps<HTMLDivElement>): JSX.Element => (
			<Motion.div
				ref={props.ref}
				initial={{opacity: 0}}
				animate={{opacity: 1}}
				exit={{opacity: 0}}
				transition={{duration: 0.001}}
				onMotionComplete={() => resolve_last?.()}
			/>
		)

		const {container} = render(() => (
			<Presence exitBeforeEnter>
				<Show
					when={condition()}
					children={<El ref={ref_1} />}
					fallback={<El ref={ref_2} />}
				/>
			</Presence>
		))

		expect(container.contains(ref_1)).toBeTruthy()
		expect(ref_1.style.opacity).toBe("0")

		// enter 1
		await new Promise<void>(resolve => (resolve_last = resolve))

		expect(container.contains(ref_1)).toBeTruthy()
		expect(ref_1.style.opacity).toBe("1")

		setCondition(false)
		flush()

		expect(container.contains(ref_1)).toBeTruthy()
		expect(container.contains(ref_2)).toBeFalsy()
		expect(ref_1.style.opacity).toBe("1")
		expect(ref_2.style.opacity).toBe("0")

		// exit 1
		await new Promise<void>(resolve => (resolve_last = resolve))

		expect(container.contains(ref_2)).toBeTruthy()
		expect(container.contains(ref_1)).toBeFalsy()
		expect(ref_1.style.opacity).toBe("0")
		expect(ref_2.style.opacity).toBe("0")

		// enter 2
		await new Promise<void>(resolve => (resolve_last = resolve))

		expect(container.contains(ref_2)).toBeTruthy()
		expect(container.contains(ref_1)).toBeFalsy()
		expect(ref_1.style.opacity).toBe("0")
		expect(ref_2.style.opacity).toBe("1")
	})

	test("Removes the element even when exit resolves to no values", async () => {
		const [show, setShow] = createSignal(true)

		const {container} = render(() => (
			<Presence>
				<Show when={show()}>
					{/* a variant key with no matching entry — resolves to an empty target */}
					<Motion.div data-testid="child" animate={{opacity: 1}} exit="missing" />
				</Show>
			</Presence>
		))
		flush()

		const component = await screen.findByTestId("child")
		expect(component.isConnected).toBeTruthy()

		setShow(false)
		flush()

		await new Promise<void>(resolve => setTimeout(resolve, 50))

		expect(component.isConnected).toBeFalsy()
		expect(container.innerHTML).toBe("")
		expect(mountedStates.has(component)).toBeFalsy()
	})

	test("An element that entered during an exit still animates on later updates", async () => {
		const [condition, setCondition] = createSignal(1)
		const [opacity, setOpacity] = createSignal(0.5)

		const {container} = render(() => (
			<Presence>
				<Show when={condition()} keyed>
					{key => (
						<Motion.div
							data-testid={"child-" + key}
							animate={{opacity: opacity()}}
							exit={{opacity: 0}}
							transition={{duration: 0.001}}
						/>
					)}
				</Show>
			</Presence>
		))
		flush()
		await new Promise<void>(resolve => setTimeout(resolve, 50))

		/*
		In the default "parallel" mode the incoming element is briefly torn down
		and remounted as the outgoing one exits. Its exit flag has to be cleared
		by that remount, or every later `animate` update resolves to the exit
		target instead.
		*/
		setCondition(2)
		flush()
		await new Promise<void>(resolve => setTimeout(resolve, 50))

		const component = container.querySelector<HTMLElement>('[data-testid="child-2"]')!
		expect(component.style.opacity).toBe("0.5")

		setOpacity(0.9)
		flush()
		await new Promise<void>(resolve => setTimeout(resolve, 50))

		expect(component.style.opacity).toBe("0.9")
	})

	test("initial: false only suppresses children present on the first render", async () => {
		const [show, setShow] = createSignal(false)

		const {container} = render(() => (
			<Presence initial={false}>
				<Show when={show()}>
					<Motion.div
						data-testid="late"
						initial={{opacity: 0}}
						animate={{opacity: 1}}
						transition={{duration: 5}}
					/>
				</Show>
			</Presence>
		))
		flush()
		await new Promise<void>(resolve => setTimeout(resolve, 20))

		setShow(true)
		flush()

		// a child added after the first render animates in normally, so it starts
		// at its `initial` rather than jumping straight to `animate`
		const component = container.querySelector<HTMLElement>('[data-testid="late"]')!
		expect(component.style.opacity).toBe("0")
	})
})
