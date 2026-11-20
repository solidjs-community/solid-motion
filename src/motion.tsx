import {isMotionValue, type MotionValue} from "motion-dom"
import {Dynamic} from "@solidjs/web"
import type {JSX} from "@solidjs/web"
import {merge, omit, untrack, createContext} from "solid-js"
import {combineStyle} from "@solid-primitives/props"
import {MotionState} from "./engine.js"

import type {
	MotionComponentFactory,
	Options,
	MotionStyle,
	MotionComponentProps,
	MotionProxy,
	MotionProxyComponent,
} from "./types.js"
import {createAndBindMotionState} from "./primitives.js"
import {PresenceContext, tryUseContext} from "./presence.jsx"

const OPTION_KEYS = [
	"initial",
	"animate",
	"inView",
	"inViewOptions",
	"hover",
	"press",
	"focus",
	"drag",
	"dragging",
	"dragConstraints",
	"dragElastic",
	"dragMomentum",
	"dragTransition",
	"layout",
	"layoutTransition",
	"values",
	"variants",
	"transition",
	"exit",
	"reducedMotion",
] as const

const ATTR_KEYS = ["tag"] as const

export const ParentContext = createContext<MotionState | undefined>(undefined)

/*
A `style` prop may carry MotionValues alongside ordinary CSS. They are pulled
out and handed to the engine, which binds them to the element directly — Solid
would otherwise stringify the object into the style attribute.
*/
function splitStyle(style: MotionStyle | undefined): {
	css: JSX.CSSProperties | string | undefined
	values: Record<string, MotionValue> | undefined
} {
	if (!style || typeof style === "string") return {css: style, values: undefined}

	let values: Record<string, MotionValue> | undefined
	const css: Record<string, unknown> = {}
	for (const [key, value] of Object.entries(style)) {
		if (isMotionValue(value)) (values ??= {})[key] = value
		else css[key] = value
	}
	return {css: css as JSX.CSSProperties, values}
}

/*
Built from OPTION_KEYS rather than written out by hand: the two component
factories below would otherwise each carry their own copy of this list, and a
newly added option silently reaches only one of them.

A fresh snapshot on every read, deliberately: `update()` decides whether
anything changed by comparing the options it was handed last time against the
new ones, which a single object with live getters could never express — every
read would report the current value as both.
*/
function motionOptions(props: MotionComponentProps & {style?: MotionStyle}): () => Options {
	return () => {
		const options = {} as Record<string, unknown>
		for (const key of OPTION_KEYS) options[key] = props[key]

		/*
		Values found in `style` are merged over any passed as `values` directly,
		rather than replacing them — both are legitimate ways to hand a
		MotionValue over, and `style` is the more specific of the two.
		*/
		const styleValues = splitStyle(props.style).values
		if (styleValues) options["values"] = {...props.values, ...styleValues}
		return options
	}
}

/** @internal */
export const MotionComponent = (
	props: MotionComponentProps & {
		tag?: string
		ref?: any
		style?: MotionStyle
	},
): JSX.Element => {
	const attrs = omit(props, ...OPTION_KEYS, ...ATTR_KEYS)
	/*
	Read once, untracked. The rendered tag decides how the *start* target is
	built (SVG geometry as attributes vs. HTML styles), which is a one-shot
	decision made before anything is mounted — and swapping an element's tag
	mid-life would mean replacing the node, not updating it. Reading it
	reactively here would only earn a STRICT_READ_UNTRACKED warning for a
	subscription nothing can act on.
	*/
	const tag = untrack(() => props.tag) || "div"

	const [state, startStyles] = createAndBindMotionState(
		() => root,
		motionOptions(props),
		tryUseContext(PresenceContext),
		tryUseContext(ParentContext),
		tag,
	)

	/*
	Folded into one object rather than spread separately: an extra prop source
	shifts Solid's hydration key numbering and adds a stray separator to the
	rendered markup, so an element with no SVG geometry keeps exactly the props
	it had before. The start target goes last so its geometry wins over a
	same-named prop, matching how the computed style layers over `props.style`.
	*/
	const renderedAttrs = Object.keys(startStyles.attrs).length
		? merge(attrs, startStyles.attrs)
		: attrs

	let root!: Element
	return (
		<ParentContext value={state}>
			<Dynamic
				{...renderedAttrs}
				ref={(el: Element) => {
					root = el
					props.ref?.(el)
				}}
				component={tag}
				style={combineStyle(splitStyle(props.style).css, startStyles.style)}
			/>
		</ParentContext>
	)
}

/**
 * Wraps a component of your own so it accepts the animation props, the way
 * `Motion.div` does for an intrinsic element.
 *
 * The wrapped component has to forward its `ref` to a real DOM element — that
 * element is what gets animated — and should apply the `style` it is handed,
 * which carries the resolved `initial` styles.
 *
 * SVG geometry in `initial` (`height`, `cx`, …) is not resolved here: without a
 * tag to inspect, the start target is built as HTML styles. Use `Motion.rect`
 * and friends for SVG.
 *
 * @example
 * ```tsx
 * const MotionCard = Motion.create(Card)
 * <MotionCard animate={{opacity: 1}} title="Hello" />
 * ```
 */
export const createMotionComponent: MotionComponentFactory = (component, options = {}) => {
	const Component = component as (props: Record<string, unknown>) => JSX.Element

	return props => {
		/*
		The animation props are consumed here, so by default they are stripped
		before the rest reach the wrapped component — it has no use for an
		`animate` object, and passing one to a component that spreads its props
		onto a DOM node would emit a junk attribute.
		*/
		const attrs = options.forwardMotionProps
			? omit(props as Record<string, unknown>, ...ATTR_KEYS)
			: omit(props as Record<string, unknown>, ...OPTION_KEYS, ...ATTR_KEYS)

		const [state, startStyles] = createAndBindMotionState(
			() => root,
			motionOptions(props),
			tryUseContext(PresenceContext),
			tryUseContext(ParentContext),
		)

		let root!: Element
		return (
			<ParentContext value={state}>
				<Component
					{...attrs}
					ref={(el: Element) => {
						root = el
						props.ref?.(el)
					}}
					style={combineStyle(splitStyle(props.style).css, startStyles.style)}
				/>
			</ParentContext>
		)
	}
}

/** one memoised component per tag — see the `get` trap below */
const tagComponents = new Map<string, MotionProxyComponent<any>>()

/**
 * Renders an animatable HTML or SVG element.
 *
 * @component
 * Animation props:
 * - `animate` a target of values to animate to. Accepts all the same values and keyframes as Motion One's [animate function](https://motion.dev/dom/animate). This prop is **reactive** – changing it will animate the transition element to the new state.
 * - `transition` for changing type of animation
 * - `initial` a target of values to animate from when the element is first rendered.
 * - `exit` a target of values to animate to when the element is removed. Requires a `<Presence>` ancestor — the element can sit anywhere inside the subtree `Presence` transitions, not just at its root.
 *
 * @example
 * ```tsx
 * <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}/>
 * ```
 *
 * Interaction animation props:
 *
 * - `inView` animation target for when the element is in view
 * - `hover` animate when hovered
 * - `press` animate when pressed
 *
 * @example
 * ```tsx
 * <Motion.div hover={{ scale: 1.2 }} press={{ scale: 0.9 }}/>
 * ```
 */
export const Motion = new Proxy(MotionComponent, {
	/*
	Only keys the component function doesn't already answer to are treated as tag
	names. Without that fallback every access returns a component — including
	`Motion.then`, which makes `Motion` look like a thenable and hangs anything
	that awaits it or resolves it as a lazily-imported component. `then` is
	excluded explicitly because it isn't a property of `Function.prototype`.
	*/
	get(target, key, receiver) {
		if (typeof key !== "string" || key === "then" || Reflect.has(target, key))
			return Reflect.get(target, key, receiver)

		/*
		Matches Motion's own `motion.create(...)`. Without this the trap below
		would happily hand back a component for a `<create>` element, which is
		a silent and very confusing failure for anyone arriving from Motion.
		*/
		if (key === "create") return createMotionComponent

		/*
		Memoised so `Motion.div === Motion.div`. Handing back a fresh component
		on every property access makes the identity of `<Motion.div/>`'s
		component change between renders, which is enough for Solid to treat it
		as a different component and tear the element down instead of updating it.
		*/
		let component = tagComponents.get(key)
		if (!component) {
			component = props => <MotionComponent {...props} tag={key} />
			tagComponents.set(key, component)
		}
		return component
	},
}) as MotionProxy
