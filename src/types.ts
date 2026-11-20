import type {AnimationOptions, DOMKeyframesDefinition, MotionValue} from "motion-dom"
import type {PropertiesHyphen} from "csstype"
import type {ParentProps} from "solid-js"
import type {JSX} from "@solidjs/web"

/** Matches framer-motion/dom's (unexported) `InViewOptions` shape used by `inView()`. */
export interface ViewportOptions {
	root?: Element | Document
	margin?: string
	amount?: "some" | "all" | number
}

declare module "motion-dom" {
	/*
	 Solid style attribute supports only kebab-case properties.
	 While motion-dom supports both camelCase and kebab-case,
	 but provides only camelCase properties in the types.
	*/
	interface CSSStyleDeclarationWithTransform extends Omit<
		PropertiesHyphen,
		"direction" | "transition"
	> {}
}

/** A target of style values to animate to/from, with an optional per-target transition override. */
export type Target = DOMKeyframesDefinition & {transition?: AnimationOptions}

/**
 * A `style` prop for a `Motion` element. On top of ordinary CSS it accepts
 * Motion's transform shorthands (`x`, `scale`, `rotate`, …) and, for any
 * property, a `MotionValue` — which Motion then writes to the element itself,
 * on its own frame loop, without going through Solid's reactive graph.
 */
export type MotionStyle =
	string | (Omit<JSX.CSSProperties, keyof MotionStyleShorthands> & MotionStyleShorthands)

type MotionStyleShorthands = {
	[K in Exclude<keyof Target, "transition">]?: Target[K] | MotionValue
} & {
	[K in keyof JSX.CSSProperties]?: JSX.CSSProperties[K] | MotionValue
}

/** Either a direct target object, or a string key into the `variants` prop. */
export type VariantDefinition = Target | string

export type {AnimationOptions}

/** Which axes a `drag` prop enables — `true` for both. */
export type DragAxis = boolean | "x" | "y"

/**
 * Bounds for a draggable element, in pixels relative to where it started.
 * `left`/`top` are the most negative it may travel, `right`/`bottom` the most
 * positive.
 */
export interface DragConstraints {
	top?: number
	left?: number
	right?: number
	bottom?: number
}

export interface CustomDragEvent extends CustomEvent {
	detail: {originalEvent: PointerEvent; offset: {x: number; y: number}}
}

/**
 * How to treat the user's `prefers-reduced-motion` setting.
 *
 * - `"never"` *(default)* — ignore it.
 * - `"user"` — follow it.
 * - `"always"` — reduce unconditionally.
 */
export type ReducedMotion = "never" | "user" | "always"

export interface Options {
	initial?: VariantDefinition | false
	animate?: VariantDefinition
	exit?: VariantDefinition
	hover?: VariantDefinition
	press?: VariantDefinition
	focus?: VariantDefinition
	inView?: VariantDefinition
	inViewOptions?: ViewportOptions
	/** Makes the element draggable. See {@link DragAxis}. */
	drag?: DragAxis
	/** The style to animate to while the element is being dragged. */
	dragging?: VariantDefinition
	/** Bounds the drag. See {@link DragConstraints}. */
	dragConstraints?: DragConstraints
	/** How far past a constraint the element still follows the pointer, `0`–`1`. Defaults to `0.5`. */
	dragElastic?: boolean | number
	/** Whether releasing a drag carries momentum. Defaults to `true`. */
	dragMomentum?: boolean
	/** Overrides the inertia settings used when a drag is released. */
	dragTransition?: AnimationOptions
	/**
	 * Animates the element to its new position when the layout moves it —
	 * reordering a list, say, or a sibling appearing above it.
	 *
	 * Position only: a size change is not animated. See the README for why.
	 */
	layout?: boolean
	/** Overrides the transition used for layout animations. */
	layoutTransition?: AnimationOptions
	variants?: Record<string, Target>
	transition?: AnimationOptions
	/**
	 * Normally set once for a subtree with `<MotionConfig>` rather than per
	 * element. See {@link ReducedMotion}.
	 */
	reducedMotion?: ReducedMotion
	/**
	 * `MotionValue`s to bind directly to the element, keyed by style property.
	 * A `<Motion>` component fills this in from any `MotionValue` found in its
	 * `style` prop; pass it explicitly when using `createMotion`.
	 */
	values?: Record<string, MotionValue>
}

export interface MotionEvent extends CustomEvent {
	detail: {target: Target}
}

export interface CustomPointerEvent extends CustomEvent {
	detail: {originalEvent: PointerEvent}
}

export interface CustomFocusEvent extends CustomEvent {
	detail: {originalEvent: FocusEvent}
}

export interface ViewEvent extends CustomEvent {
	detail: {originalEntry: IntersectionObserverEntry}
}

export interface MotionEventHandlers {
	onMotionStart?: (event: MotionEvent) => void
	onMotionComplete?: (event: MotionEvent) => void
	onHoverStart?: (event: CustomPointerEvent) => void
	onHoverEnd?: (event: CustomPointerEvent) => void
	onPressStart?: (event: CustomPointerEvent) => void
	onPressEnd?: (event: CustomPointerEvent) => void
	onFocusStart?: (event: CustomFocusEvent) => void
	onFocusEnd?: (event: CustomFocusEvent) => void
	onDragStart?: (event: CustomDragEvent) => void
	onDrag?: (event: CustomDragEvent) => void
	onDragEnd?: (event: CustomDragEvent) => void
	onViewEnter?: (event: ViewEvent) => void
	onViewLeave?: (event: ViewEvent) => void
}

export type MotionComponentProps = ParentProps<
	MotionEventHandlers & Options & {style?: MotionStyle}
>

/*
`style` is widened rather than intersected: an intersection with the element's
own `style?: CSSProperties | string` would require a value satisfying both, so
a `MotionValue` or a transform shorthand would be rejected.
*/
type WithMotionProps<T> = Omit<T, "style" | keyof MotionComponentProps> & MotionComponentProps

export type MotionComponent = {
	// <Motion />
	(props: WithMotionProps<JSX.IntrinsicElements["div"]>): JSX.Element
	// <Motion tag="div" />
	<T extends keyof JSX.IntrinsicElements>(
		props: WithMotionProps<JSX.IntrinsicElements[T]> & {tag: T},
	): JSX.Element
}

export type MotionProxyComponent<T> = (props: WithMotionProps<T>) => JSX.Element

export interface MotionComponentOptions {
	/**
	 * Also pass the animation props (`animate`, `hover`, …) through to the
	 * wrapped component. Off by default: they are consumed by `Motion` and the
	 * wrapped component usually has no use for them.
	 */
	forwardMotionProps?: boolean
}

/** The props a component must accept to be animatable — a forwarded `ref`, and a `style`. */
export interface AnimatableProps {
	ref?: (el: Element) => void
	style?: MotionStyle
}

/** `Motion.create` — wraps a component of your own so it accepts the animation props. */
export type MotionComponentFactory = <P extends AnimatableProps>(
	component: (props: P) => JSX.Element,
	options?: MotionComponentOptions,
) => MotionProxyComponent<P>

export type MotionProxy = MotionComponent & {
	// Motion.create(MyComponent)
	create: MotionComponentFactory
} & {
	// <Motion.div />
	[K in keyof JSX.IntrinsicElements]: MotionProxyComponent<JSX.IntrinsicElements[K]>
}

// export only here so the `JSX` import won't be shaken off the tree:
export type E = JSX.Element
