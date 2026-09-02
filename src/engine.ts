import {animate, inView} from "framer-motion/dom"
import {hover, press, buildHTMLStyles} from "motion-dom"
import type {AnimationOptions} from "motion-dom"

import type {Options, Target, VariantDefinition} from "./types.js"

/** @internal */
export const mountedStates = new WeakMap<Element, MotionState>()

/** @internal */
export interface MotionState {
	mount(el: Element): () => void
	update(options: Options): void
	setActive(type: "exit", isActive: boolean): Promise<void>
	getTarget(): Target
	getOptions(): Options
	/** @internal the resolved `initial` variant key, inherited from a parent Motion if unset here */
	getInitialVariantKey(): string | undefined
}

/* -------------------------------------------------------------------------- */
/*                              Targets and styles                            */
/* -------------------------------------------------------------------------- */

function resolveTarget(
	def: VariantDefinition | undefined,
	variants: Record<string, Target> | undefined,
): Target | undefined {
	if (def === undefined) return undefined
	return typeof def === "string" ? variants?.[def] : def
}

function targetValues(target: Target | undefined): Record<string, unknown> {
	if (!target) return {}
	const {transition: _transition, ...values} = target
	return values
}

/*
Order-independent structural compare of two targets' animatable values.
`initial={{opacity: 0, x: 0}}` and `animate={{x: 0, opacity: 0}}` describe the
same thing, but a plain JSON.stringify of each would not agree — and this
comparison is what decides whether an animation runs at all.
*/
function sameValues(a: Target | undefined, b: Target | undefined): boolean {
	const a_values = targetValues(a)
	const b_values = targetValues(b)
	const keys = Object.keys(a_values)
	if (keys.length !== Object.keys(b_values).length) return false
	return keys.every(
		key => key in b_values && JSON.stringify(a_values[key]) === JSON.stringify(b_values[key]),
	)
}

/*
Two compatibility shims for the documented `transition={{duration, key: {...}}}`
per-value override syntax:

1. Motion One used `easing`; modern Motion renamed it to `ease`.
2. Motion One's per-value override only needed to specify what differs from
   the base transition (the rest was inherited). Modern Motion's own
   `resolveTransition` only merges a per-value override with its parent when
   the override explicitly sets `inherit: true` — otherwise the override is
   used standalone and silently falls back to Motion's own defaults for
   anything it didn't specify (e.g. `x: {offset: [...]}` with no `duration`
   of its own completes almost instantly instead of over the base duration).
   Merging here keeps the documented, more ergonomic behavior working.
*/
function normalizeTransition(transition: unknown): AnimationOptions | undefined {
	if (!transition || typeof transition !== "object")
		return transition as AnimationOptions | undefined

	const base: Record<string, unknown> = {}
	const perValue: Record<string, Record<string, unknown>> = {}
	for (const [key, value] of Object.entries(transition)) {
		if (value && typeof value === "object" && !Array.isArray(value)) perValue[key] = value
		else base[key === "easing" ? "ease" : key] = value
	}

	const result: Record<string, unknown> = {...base}
	for (const [key, override] of Object.entries(perValue)) {
		const normalizedOverride = {...base}
		for (const [k, v] of Object.entries(override))
			normalizedOverride[k === "easing" ? "ease" : k] = v
		result[key] = normalizedOverride
	}
	return result as AnimationOptions
}

/** @internal */
export function createStyles(target: Target): Record<string, string> {
	const renderState = {transform: {}, transformOrigin: {}, vars: {}, style: {}}
	// a static (non-animated) style can't represent a keyframe list — use its first value
	const staticValues: Record<string, unknown> = {}
	for (const [key, value] of Object.entries(targetValues(target))) {
		staticValues[key] = Array.isArray(value) ? value[0] : value
	}
	buildHTMLStyles(renderState as any, staticValues as any)
	return {...(renderState.vars as any), ...(renderState.style as any)}
}

/** @internal */
export const style = {
	set(el: Element, key: string, value: unknown): void {
		if (key.startsWith("--")) (el as HTMLElement).style.setProperty(key, String(value))
		else (el as HTMLElement).style[key as any] = value as string
	},
}

function applyStylesDirect(el: Element, target: Target): void {
	const styles = createStyles(target)
	for (const key in styles) style.set(el, key, styles[key])
}

function dispatch(el: Element, type: string, detail: Record<string, unknown>): void {
	el.dispatchEvent(new CustomEvent(type, {detail}))
}

/* -------------------------------------------------------------------------- */
/*                               Layers and gestures                          */
/* -------------------------------------------------------------------------- */

/*
The animated target is the merge of every currently-active layer, lowest
priority first — `press` wins over `hover`, which wins over `inView`, which
wins over the always-active `animate`. Resolving through one ordered list
means mount, update and every gesture all compute the target the same way,
instead of each assembling its own idea of what the element should look like.
*/
const LAYERS = ["animate", "inView", "hover", "press"] as const
type Layer = (typeof LAYERS)[number]
type GestureLayer = Exclude<Layer, "animate">

/*
`hover`, `press` and `inView` all share the same shape: bind to an element with
an `(element, event) => cleanup | void` handler, get an unbind back. That lets
all three be driven by one table instead of three near-identical blocks.
*/
type GestureBinder = (
	el: Element,
	onStart: (el: Element, event: any) => ((event: any) => void) | void,
	options?: any,
) => () => void

interface Gesture {
	layer: GestureLayer
	bind: GestureBinder
	/** event dispatched when the layer switches on / off */
	enter: string
	leave: string
	detail: (event: any) => Record<string, unknown>
	/** per-gesture binding options pulled off the component's props, if any */
	bindOptions?: (options: Options) => unknown
}

const GESTURES: Gesture[] = [
	{
		layer: "inView",
		bind: inView as GestureBinder,
		enter: "viewenter",
		leave: "viewleave",
		detail: entry => ({originalEntry: entry}),
		bindOptions: options => options.inViewOptions,
	},
	{
		layer: "hover",
		bind: hover as GestureBinder,
		enter: "hoverstart",
		leave: "hoverend",
		detail: event => ({originalEvent: event}),
	},
	{
		layer: "press",
		bind: press as GestureBinder,
		enter: "pressstart",
		leave: "pressend",
		detail: event => ({originalEvent: event}),
	},
]

/*
Only rebind when a gesture is added or removed, not whenever its target object
changes identity — the bound handlers read the latest `options` at fire time, so
a new `hover={{...}}` object needs no rebind. Solid re-evaluates inline JSX prop
objects on every read, so comparing those by reference would rebind constantly
and cut off in-progress interactions.
*/
function gesturesChanged(prev: Options, next: Options): boolean {
	return (
		GESTURES.some(gesture => !!prev[gesture.layer] !== !!next[gesture.layer]) ||
		prev.inViewOptions !== next.inViewOptions
	)
}

/* -------------------------------------------------------------------------- */
/*                                    State                                   */
/* -------------------------------------------------------------------------- */

interface MountContext {
	element: Element
	cancelAnimation?: () => void
	unbindGestures?: () => void
}

/** @internal */
export function createMotionState(initialOptions: Options, parent?: MotionState): MotionState {
	let options = initialOptions

	/** which layers currently contribute to the target; `animate` is always on */
	const active: Record<Layer, boolean> = {
		animate: true,
		inView: false,
		hover: false,
		press: false,
	}
	/** `exit` replaces the layer stack outright rather than merging on top of it */
	let exiting = false

	/** the target most recently animated to — the baseline `update()` diffs against */
	let lastTarget: Target | undefined

	/*
	Scoped to whichever mount() call is currently active. A sibling Motion
	component can get constructed — and briefly mounted/unmounted again —
	before its real mount, as a structural side effect of how <Show>/
	createSwitchTransition read reactive sources (see primitives.ts's
	mount-gating effect). That stale cycle's own cleanup must never reach
	into a *newer* mount's in-flight animation or gesture bindings and
	cancel them; keeping this per-mount-context, and only ever pointing
	`current` at the latest one, keeps the two cycles from interfering.
	*/
	let current: MountContext | undefined

	function getInitialVariantKey(): string | undefined {
		if (typeof options.initial === "string") return options.initial
		if (options.initial === undefined) return parent?.getInitialVariantKey()
		return undefined
	}

	/** The style to render *before* anything animates — also what SSR paints. */
	function getStartTarget(): Target {
		if (options.initial === false) {
			return resolveTarget(options.animate, options.variants) ?? {}
		}
		if (options.initial === undefined) {
			/*
			No explicit `initial` and nothing inherited from a parent's variant
			key: leave the starting style empty (browser defaults) rather than
			falling back to the `animate` target. Falling back to `animate` here
			made mount()'s "does the start differ from the target" check always
			see them as equal, silently skipping the enter animation entirely —
			breaking the documented default behavior ("elements automatically
			animate to the values defined in animate when they're created").
			*/
			const inheritedKey = getInitialVariantKey()
			return (inheritedKey && options.variants?.[inheritedKey]) || {}
		}
		return resolveTarget(options.initial, options.variants) ?? {}
	}

	/** The single source of truth for what this element should look like right now. */
	function resolveActiveTarget(): Target {
		if (exiting) return resolveTarget(options.exit, options.variants) ?? {}
		const target: Target = {}
		for (const layer of LAYERS) {
			if (active[layer])
				Object.assign(target, resolveTarget(options[layer], options.variants))
		}
		return target
	}

	function applyTarget(target: Target): Promise<void> {
		lastTarget = target

		const ctx = current
		ctx?.cancelAnimation?.()
		if (!ctx) return Promise.resolve()
		const values = targetValues(target)
		if (Object.keys(values).length === 0) {
			/*
			Nothing to animate. An exit still has to report itself finished: both
			presence.tsx and primitives.ts wait on the motionstart/motioncomplete
			pair before removing the element, so an `exit` that resolves to no
			values (`exit={{}}`, or a variant key with no matching entry) would
			otherwise leave the element in the DOM forever. Deferred by a
			microtask so listeners attached right after this call still catch it.
			*/
			if (!exiting) return Promise.resolve()
			dispatch(ctx.element, "motionstart", {target})
			return Promise.resolve().then(() => {
				if (current === ctx) dispatch(ctx.element, "motioncomplete", {target})
			})
		}

		// merge, then normalize once — normalizing an already-normalized base
		// transition again would re-merge its own per-value overrides against a
		// *new* base and let stale, already-baked-in override values win
		const transition = normalizeTransition({...options.transition, ...target.transition})
		dispatch(ctx.element, "motionstart", {target})
		const controls = animate(ctx.element, values as any, transition as any)
		ctx.cancelAnimation = () => controls.stop()
		return controls.finished.then(
			() => {
				// don't dispatch on behalf of a mount cycle a newer one has superseded
				if (current === ctx) dispatch(ctx.element, "motioncomplete", {target})
			},
			// swallow: `finished` rejects when an in-flight animation is cancelled/replaced
			() => undefined,
		)
	}

	function setLayer(el: Element, gesture: Gesture, isActive: boolean, event: unknown): void {
		active[gesture.layer] = isActive
		dispatch(el, isActive ? gesture.enter : gesture.leave, gesture.detail(event))
		void applyTarget(resolveActiveTarget())
	}

	function bindGestures(el: Element): () => void {
		const unbinds = GESTURES.filter(gesture => options[gesture.layer]).map(gesture =>
			gesture.bind(
				el,
				(_el, startEvent) => {
					setLayer(el, gesture, true, startEvent)
					return endEvent => setLayer(el, gesture, false, endEvent)
				},
				gesture.bindOptions?.(options),
			),
		)
		return () => unbinds.forEach(unbind => unbind())
	}

	const state: MotionState = {
		mount(el: Element) {
			const ctx: MountContext = {element: el}
			current = ctx

			/*
			A state object outlives its element: under a <Presence>, a Motion can
			be exit-animated and torn down, then mounted again by the very next
			enter (see primitives.ts's mount-gating effect). Flags left over from
			that previous life would otherwise keep resolving to a stale target —
			a still-set `exiting` in particular pins the element to its exit
			target and blocks every later `animate` update.
			*/
			exiting = false
			active.inView = active.hover = active.press = false

			const startTarget = getStartTarget()
			applyStylesDirect(el, startTarget)

			const target = resolveActiveTarget()
			lastTarget = target
			if (!sameValues(startTarget, target)) void applyTarget(target)

			ctx.unbindGestures = bindGestures(el)
			mountedStates.set(el, state)

			return () => {
				ctx.cancelAnimation?.()
				ctx.unbindGestures?.()
				mountedStates.delete(el)
				if (current === ctx) current = undefined
			}
		},
		update(newOptions: Options) {
			const prevOptions = options
			options = newOptions

			if (current && gesturesChanged(prevOptions, options)) {
				current.unbindGestures?.()
				current.unbindGestures = bindGestures(current.element)
			}

			// an exiting element is on its way out — leave it on its exit target
			if (exiting) return

			const target = resolveActiveTarget()
			if (!sameValues(target, lastTarget)) void applyTarget(target)
		},
		setActive(_type: "exit", isActive: boolean) {
			exiting = isActive
			return applyTarget(resolveActiveTarget())
		},
		getTarget: getStartTarget,
		getOptions: () => options,
		getInitialVariantKey,
	}
	return state
}
