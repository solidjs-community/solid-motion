import {createSignal, Show} from "solid-js"
import type {JSX} from "@solidjs/web"
import {Motion, Presence, motion, useScroll} from "../../src/index.jsx"
import type {AnimationOptions} from "../../src/index.jsx"

/*
Every demo the Playwright suite drives, keyed by the `?demo=` id it is
reached at. Each one exposes the state a test needs to assert on as text
inside a `data-testid` node, so assertions do not depend on reading a
half-finished animation's interpolated style.
*/

const box = {
	width: "80px",
	height: "80px",
	"border-radius": "8px",
	background: "royalblue",
} as const

function Status(props: {id: string; value: string}): JSX.Element {
	return (
		<p class="status" data-testid={props.id}>
			{props.value}
		</p>
	)
}

/* -------------------------------- rendering ------------------------------- */

const ProxyTags = (): JSX.Element => (
	<div style={{display: "flex", gap: "16px", "align-items": "center"}}>
		<Motion.span data-testid="span" style={{padding: "8px", background: "seagreen"}}>
			span
		</Motion.span>
		<Motion.button data-testid="button">button</Motion.button>
		<Motion.svg data-testid="svg" width="60" height="60" viewBox="0 0 60 60">
			<Motion.circle data-testid="circle" cx="30" cy="30" r="28" fill="darkorange" />
		</Motion.svg>
		<Motion tag="li" data-testid="li">
			li via tag prop
		</Motion>
		<Motion data-testid="default" style={box} />
	</div>
)

const StyleMerging = (): JSX.Element => (
	<div style={{display: "flex", gap: "16px"}}>
		<Motion.div
			data-testid="object-style"
			style={{width: "80px", height: "80px", background: "teal"}}
			initial={{opacity: 0.3}}
			animate={{opacity: 1}}
			transition={{duration: 0.2}}
		/>
		<Motion.div
			data-testid="string-style"
			style="width: 80px; height: 80px; background: indigo"
			initial={{opacity: 0.3}}
			animate={{opacity: 1}}
			transition={{duration: 0.2}}
		/>
	</div>
)

const SvgAttrs = (): JSX.Element => (
	<svg viewBox="0 0 120 120" width="120" height="120">
		<Motion.rect
			data-testid="rect"
			initial={{height: 20}}
			animate={{height: 80}}
			transition={{duration: 0.3}}
			width="50"
			x="10"
			y="10"
			fill="crimson"
		/>
	</svg>
)

/* --------------------------------- animate -------------------------------- */

const BasicEnter = (): JSX.Element => (
	<Motion.div
		data-testid="box"
		style={box}
		initial={{opacity: 0, scale: 0.5}}
		animate={{opacity: 1, scale: 1}}
		transition={{duration: 1.5}}
	/>
)

const InitialFalse = (): JSX.Element => (
	<Motion.div
		data-testid="box"
		style={box}
		initial={false}
		animate={{opacity: 0.4, x: 100}}
		transition={{duration: 5}}
	/>
)

const NoOpWhenEqual = (): JSX.Element => {
	const [starts, setStarts] = createSignal(0)
	const target = {opacity: 0.6}
	return (
		<div>
			<Status id="starts" value={String(starts())} />
			<Motion.div
				data-testid="box"
				style={box}
				initial={target}
				animate={target}
				onMotionStart={() => setStarts(n => n + 1)}
			/>
		</div>
	)
}

const ReactiveAnimate = (): JSX.Element => {
	const [opacity, setOpacity] = createSignal(0.25)
	return (
		<div>
			<button data-testid="toggle" onClick={() => setOpacity(o => (o === 0.25 ? 1 : 0.25))}>
				Toggle
			</button>
			<Motion.div
				data-testid="box"
				style={box}
				animate={{opacity: opacity()}}
				transition={{duration: 0.2}}
			/>
		</div>
	)
}

/* -------------------------------- gestures -------------------------------- */

const Hover = (): JSX.Element => {
	const [status, setStatus] = createSignal("idle")
	return (
		<div>
			<Status id="hover" value={status()} />
			<Motion.div
				data-testid="box"
				style={box}
				animate={{opacity: 1}}
				hover={{opacity: 0.4}}
				transition={{duration: 0.1}}
				onHoverStart={() => setStatus("active")}
				onHoverEnd={() => setStatus("idle")}
			/>
		</div>
	)
}

const Press = (): JSX.Element => {
	const [status, setStatus] = createSignal("idle")
	return (
		<div>
			<Status id="press" value={status()} />
			<Motion.div
				data-testid="box"
				style={box}
				animate={{opacity: 1}}
				press={{opacity: 0.3}}
				transition={{duration: 0.1}}
				onPressStart={() => setStatus("active")}
				onPressEnd={() => setStatus("idle")}
			/>
		</div>
	)
}

/* Press must win over hover for overlapping keys, since it layers on top. */
const HoverAndPress = (): JSX.Element => {
	const [hover, setHover] = createSignal("idle")
	const [press, setPress] = createSignal("idle")
	return (
		<div>
			<Status id="hover" value={hover()} />
			<Status id="press" value={press()} />
			<Motion.div
				data-testid="box"
				style={box}
				animate={{opacity: 1}}
				hover={{opacity: 0.7}}
				press={{opacity: 0.2}}
				transition={{duration: 0.1}}
				onHoverStart={() => setHover("active")}
				onHoverEnd={() => setHover("idle")}
				onPressStart={() => setPress("active")}
				onPressEnd={() => setPress("idle")}
			/>
		</div>
	)
}

/*
A gesture with no `animate` base: the resolved target on hover-out is empty,
which currently leaves the element stuck on the hover values.
*/
const HoverNoBase = (): JSX.Element => (
	<Motion.div data-testid="box" style={box} hover={{opacity: 0.4}} transition={{duration: 0.1}} />
)

/* --------------------------------- inView --------------------------------- */

const InView = (): JSX.Element => {
	const [status, setStatus] = createSignal("not yet")
	const [entries, setEntries] = createSignal("none")
	return (
		<div>
			<Status id="view" value={status()} />
			<Status id="entry" value={entries()} />
			<div class="spacer" />
			<Motion.div
				data-testid="box"
				style={box}
				animate={{opacity: 1}}
				inView={{opacity: 0.2}}
				transition={{duration: 0.15}}
				onViewEnter={event => {
					setStatus("entered")
					// guards against the handler being handed the element instead
					setEntries(String(event.detail.originalEntry.isIntersecting))
				}}
				onViewLeave={() => setStatus("left")}
			/>
			<div class="spacer" />
		</div>
	)
}

/* inView layered under hover: hovering must not drop the inView values. */
const InViewWithHover = (): JSX.Element => (
	<div>
		<div class="spacer" />
		<Motion.div
			data-testid="box"
			style={box}
			animate={{opacity: 1}}
			inView={{x: 120}}
			hover={{opacity: 0.5}}
			transition={{duration: 0.1}}
		/>
		<div class="spacer" />
	</div>
)

const InViewAmount = (): JSX.Element => {
	const [status, setStatus] = createSignal("not yet")
	return (
		<div>
			<Status id="view" value={status()} />
			<div class="spacer" />
			<Motion.div
				data-testid="box"
				style={{...box, height: "400px"}}
				animate={{opacity: 1}}
				inView={{opacity: 0.2}}
				inViewOptions={{amount: 0.9}}
				transition={{duration: 0.15}}
				onViewEnter={() => setStatus("entered")}
				onViewLeave={() => setStatus("left")}
			/>
			<div class="spacer" />
		</div>
	)
}

/* -------------------------------- presence -------------------------------- */

const PresenceBasic = (): JSX.Element => {
	const [show, setShow] = createSignal(true)
	return (
		<div>
			<button data-testid="toggle" onClick={() => setShow(s => !s)}>
				Toggle
			</button>
			<Presence>
				<Show when={show()}>
					<Motion.div
						data-testid="box"
						style={box}
						initial={{opacity: 0}}
						animate={{opacity: 1}}
						exit={{opacity: 0}}
						transition={{duration: 0.3}}
					/>
				</Show>
			</Presence>
		</div>
	)
}

/* An `exit` that resolves to nothing must still let the element be removed. */
const PresenceEmptyExit = (): JSX.Element => {
	const [show, setShow] = createSignal(true)
	return (
		<div>
			<button data-testid="toggle" onClick={() => setShow(s => !s)}>
				Toggle
			</button>
			<Presence>
				<Show when={show()}>
					<Motion.div
						data-testid="box"
						style={box}
						animate={{opacity: 1}}
						exit="missing"
					/>
				</Show>
			</Presence>
		</div>
	)
}

const PresenceExitBeforeEnter = (): JSX.Element => {
	const [condition, setCondition] = createSignal(true)
	const El = (props: {label: string}): JSX.Element => (
		<Motion.div
			data-testid={`box-${props.label}`}
			style={box}
			initial={{opacity: 0}}
			animate={{opacity: 1}}
			exit={{opacity: 0}}
			transition={{duration: 0.2}}
		/>
	)
	return (
		<div>
			<button data-testid="toggle" onClick={() => setCondition(c => !c)}>
				Swap
			</button>
			<Presence exitBeforeEnter>
				<Show when={condition()} children={<El label="a" />} fallback={<El label="b" />} />
			</Presence>
		</div>
	)
}

/*
The parallel-mode swap: the incoming element is briefly torn down and
remounted while the outgoing one exits, and must not be left pinned to its
exit target afterwards.
*/
const PresenceParallelSwap = (): JSX.Element => {
	const [key, setKey] = createSignal(1)
	const [opacity, setOpacity] = createSignal(0.5)
	return (
		<div>
			<button data-testid="swap" onClick={() => setKey(k => k + 1)}>
				Swap
			</button>
			<button data-testid="fade" onClick={() => setOpacity(0.9)}>
				Fade
			</button>
			<Presence>
				<Show when={key()} keyed>
					{k => (
						<Motion.div
							data-testid={`box-${k}`}
							style={box}
							animate={{opacity: opacity()}}
							exit={{opacity: 0}}
							transition={{duration: 0.15}}
						/>
					)}
				</Show>
			</Presence>
		</div>
	)
}

const PresenceNestedExit = (): JSX.Element => {
	const [show, setShow] = createSignal(true)
	// long enough that a mid-exit assertion cannot race the animation finishing
	const exit = {opacity: 0, transition: {duration: 1}}
	return (
		<div>
			<button data-testid="toggle" onClick={() => setShow(s => !s)}>
				Toggle
			</button>
			<Presence>
				<Show when={show()}>
					<Motion.div data-testid="parent" style={box} exit={exit}>
						<Motion.div
							data-testid="child"
							style={{width: "40px", height: "40px", background: "crimson"}}
							exit={exit}
						/>
					</Motion.div>
				</Show>
			</Presence>
		</div>
	)
}

/* `initial={false}` suppresses only the children present on the first render. */
const PresenceInitialFalse = (): JSX.Element => {
	const [show, setShow] = createSignal(false)
	return (
		<div>
			<button data-testid="toggle" onClick={() => setShow(true)}>
				Show
			</button>
			<Presence initial={false}>
				<Show
					when={show()}
					fallback={
						<Motion.div
							data-testid="first"
							style={box}
							initial={{opacity: 0}}
							animate={{opacity: 1}}
							transition={{duration: 5}}
						/>
					}
				>
					<Motion.div
						data-testid="late"
						style={box}
						initial={{opacity: 0}}
						animate={{opacity: 1}}
						transition={{duration: 5}}
					/>
				</Show>
			</Presence>
		</div>
	)
}

/* -------------------------------- variants -------------------------------- */

const Variants = (): JSX.Element => (
	<Motion.div
		data-testid="box"
		style={{width: "80px", height: "80px"}}
		initial="hidden"
		animate="visible"
		variants={{
			hidden: {opacity: 0, backgroundColor: "rgb(65, 105, 225)"},
			visible: {
				opacity: 1,
				backgroundColor: "rgb(65, 105, 225)",
				transition: {duration: 0.2},
			},
		}}
	/>
)

/* A descendant with no `initial` inherits the ancestor's variant key. */
const VariantInheritance = (): JSX.Element => (
	<Motion.div
		data-testid="parent"
		initial="hidden"
		animate="visible"
		variants={{
			hidden: {opacity: 0},
			visible: {opacity: 1, transition: {duration: 0.2}},
		}}
	>
		<Motion.div
			data-testid="child"
			style={box}
			animate="visible"
			variants={{
				hidden: {x: 60},
				visible: {x: 0, transition: {duration: 1.5}},
			}}
		/>
	</Motion.div>
)

/* Swapping the variants map under an unchanged `animate` key must re-animate. */
const ReactiveVariants = (): JSX.Element => {
	const [variants, setVariants] = createSignal({on: {opacity: 0.3}})
	return (
		<div>
			<button data-testid="swap" onClick={() => setVariants({on: {opacity: 0.9}})}>
				Swap variants
			</button>
			<Motion.div
				data-testid="box"
				style={box}
				variants={variants()}
				animate="on"
				transition={{duration: 0.15}}
			/>
		</div>
	)
}

/* ------------------------------- transitions ------------------------------ */

/* `easing` is Motion One's spelling, translated internally to `ease`. */
const LegacyEasing = (): JSX.Element => (
	<Motion.div
		data-testid="box"
		style={box}
		initial={{opacity: 0}}
		animate={{opacity: 1}}
		// `easing` is accepted at runtime but absent from motion-dom's own types
		transition={{duration: 0.3, easing: "ease-in-out"} as AnimationOptions}
	/>
)

/* A per-value override inherits what it does not restate from the base. */
const PerValueOverride = (): JSX.Element => (
	<Motion.div
		data-testid="box"
		style={box}
		initial={{opacity: 0, x: 0}}
		animate={{opacity: 1, x: 120}}
		transition={{duration: 0.2, x: {duration: 1.5}}}
	/>
)

/* A target's own `transition` wins over the component-level one. */
const PerTargetOverride = (): JSX.Element => (
	<Motion.div
		data-testid="box"
		style={box}
		initial={{opacity: 0}}
		animate={{opacity: 1, transition: {duration: 1.5}}}
		transition={{duration: 0.05}}
	/>
)

const Keyframes = (): JSX.Element => (
	<Motion.div
		data-testid="box"
		style={box}
		animate={{x: [0, 150, 40]}}
		transition={{duration: 0.4}}
	/>
)

/* ------------------------------- primitives ------------------------------- */

const RefFactory = (): JSX.Element => (
	<div
		data-testid="box"
		class="box"
		ref={motion(() => ({
			initial: {opacity: 0, y: -20},
			animate: {opacity: 1, y: 0},
			transition: {duration: 0.2},
		}))}
	/>
)

const UseScroll = (): JSX.Element => {
	const {scrollY} = useScroll()
	return (
		<div>
			<p class="status" data-testid="progress">
				{scrollY().progress.toFixed(2)}
			</p>
			<div style={{height: "3000px"}}>Scroll</div>
		</div>
	)
}

export const DEMOS: Record<string, () => JSX.Element> = {
	"proxy-tags": ProxyTags,
	"style-merging": StyleMerging,
	"svg-attrs": SvgAttrs,
	"basic-enter": BasicEnter,
	"initial-false": InitialFalse,
	"no-op-when-equal": NoOpWhenEqual,
	"reactive-animate": ReactiveAnimate,
	hover: Hover,
	press: Press,
	"hover-and-press": HoverAndPress,
	"hover-no-base": HoverNoBase,
	"in-view": InView,
	"in-view-with-hover": InViewWithHover,
	"in-view-amount": InViewAmount,
	"presence-basic": PresenceBasic,
	"presence-empty-exit": PresenceEmptyExit,
	"presence-exit-before-enter": PresenceExitBeforeEnter,
	"presence-parallel-swap": PresenceParallelSwap,
	"presence-nested-exit": PresenceNestedExit,
	"presence-initial-false": PresenceInitialFalse,
	variants: Variants,
	"variant-inheritance": VariantInheritance,
	"reactive-variants": ReactiveVariants,
	"legacy-easing": LegacyEasing,
	"per-value-override": PerValueOverride,
	"per-target-override": PerTargetOverride,
	keyframes: Keyframes,
	"ref-factory": RefFactory,
	"use-scroll": UseScroll,
}
