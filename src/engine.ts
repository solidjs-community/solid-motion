import {inView} from "framer-motion/dom"
import {
	hover,
	press,
	animateMotionValue,
	isSVGElement,
	motionValue,
	styleEffect,
	svgEffect,
	type MotionValue,
	hasReducedMotionListener,
	initPrefersReducedMotion,
	positionalKeys,
	prefersReducedMotion,
	buildHTMLStyles,
	buildSVGAttrs,
	isSVGTag,
	transformProps,
	defaultTransformValue,
	camelToDash,
} from "motion-dom"
import {SVGElements} from "@solidjs/web"
import type {AnimationOptions} from "motion-dom"

import {bindDrag} from "./drag.js"
import {registerLayout, scheduleLayoutCheck} from "./layout.js"
import type {Options, Target, VariantDefinition} from "./types.js"

/** @internal */
export const mountedStates = new WeakMap<Element, MotionState>()

/**
 * The animation state bound to a single element. Returned by `createMotion`,
 * so it is nameable by consumers — but everything on it apart from
 * `getTarget`/`getOptions` is driven by this library's own components and
 * primitives, not intended to be called by hand.
 */
export interface MotionState {
	/** @internal binds the state to an element, returning its teardown */
	mount(el: Element): () => void
	/** @internal applies a new set of options, animating if the target changed */
	update(options: Options): void
	/**
	 * @internal Begins the exit animation, returning a promise that settles once
	 * it has actually finished — or `null` when `exit` resolves to nothing
	 * animatable, so the caller can unmount synchronously instead of waiting a
	 * microtask on an already-resolved promise.
	 */
	startExit(): Promise<void> | null
	/** The style this element renders with before anything animates. */
	getTarget(): Target
	/** The options currently in effect. */
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
/** @internal exported for tests: this compat shim is easier to check directly */
export function normalizeTransition(transition: unknown): AnimationOptions | undefined {
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

/** @internal what a target renders as statically, before anything animates */
export interface StartStyles {
	style: Record<string, string>
	/** SVG geometry, which is carried by attributes rather than by style */
	attrs: Record<string, string>
}

/**
 * @internal
 * @param tag the element's tag name, which decides whether the target is built
 * as HTML styles or as SVG attributes
 */
export function createStyles(target: Target, tag = "div"): StartStyles {
	const renderState = {transform: {}, transformOrigin: {}, vars: {}, style: {}, attrs: {}}
	// a static (non-animated) style can't represent a keyframe list — use its first value
	const staticValues: Record<string, unknown> = {}
	for (const [key, value] of Object.entries(targetValues(target))) {
		staticValues[key] = Array.isArray(value) ? value[0] : value
	}
	/*
	SVG geometry (`height`, `cx`, `r`, ...) is animated by Motion as an
	attribute, not as a style. Emitting the starting value as an inline style
	instead would outrank the animated attribute in the cascade and pin the
	element to its `initial` forever, so SVG elements are built through
	`buildSVGAttrs`, which splits geometry into `attrs` and leaves the rest
	(opacity, fill, the `<svg>` root's own transform) in `style`.
	*/
	if (SVGElements.has(tag)) buildSVGAttrs(renderState, staticValues as any, isSVGTag(tag))
	else buildHTMLStyles(renderState, staticValues as any)

	return {
		style: {...(renderState.vars as any), ...(renderState.style as any)},
		attrs: renderState.attrs,
	}
}

/** @internal */
export const style = {
	set(el: Element, key: string, value: unknown): void {
		if (key.startsWith("--")) (el as HTMLElement).style.setProperty(key, String(value))
		else (el as HTMLElement).style[key as any] = value as string
	},
}

function applyStylesDirect(el: Element, target: Target): void {
	const {style: styles, attrs} = createStyles(target, el.tagName.toLowerCase())
	for (const key in styles) style.set(el, key, styles[key])
	for (const key in attrs) el.setAttribute(key, String(attrs[key]))
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
const LAYERS = ["animate", "inView", "focus", "hover", "press", "dragging"] as const
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

/*
Motion exposes no `focus` binder, so this is the same shape as `hover`/`press`
built on the platform's own focus events.

`:focus-visible` is the browser's own judgement of whether focus deserves to be
shown — keyboard navigation, not a mouse click on a button. Gating on it keeps
the animation aligned with the focus ring the user already sees, instead of
firing on every click. Browsers that can't parse the selector fall back to
animating on any focus, which is the more useful failure.
*/
const focus: GestureBinder = (el, onStart) => {
	let onEnd: ((event: unknown) => void) | void

	const handleFocus = (event: Event): void => {
		let visible = true
		try {
			visible = el.matches(":focus-visible")
		} catch {
			/* selector unsupported — treat every focus as visible */
		}
		if (visible) onEnd = onStart(el, event)
	}
	const handleBlur = (event: Event): void => {
		if (typeof onEnd === "function") onEnd(event)
		onEnd = undefined
	}

	el.addEventListener("focus", handleFocus)
	el.addEventListener("blur", handleBlur)
	return () => {
		el.removeEventListener("focus", handleFocus)
		el.removeEventListener("blur", handleBlur)
	}
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
		layer: "focus",
		bind: focus,
		enter: "focusstart",
		leave: "focusend",
		detail: event => ({originalEvent: event}),
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
		prev.inViewOptions !== next.inViewOptions ||
		prev.drag !== next.drag
	)
}

/* -------------------------------------------------------------------------- */
/*                                    State                                   */
/* -------------------------------------------------------------------------- */

interface MountContext {
	element: Element
	/*
	One MotionValue per animated property, created on first use and bound to
	the element for the life of the mount. Holding the properties separately is
	what lets them animate independently: retargeting `x` no longer has to stop
	and replace a single element-wide animation, so an `opacity` mid-flight
	carries on to its own target instead of freezing wherever it had reached.
	*/
	values: Map<string, MotionValue>
	/** unbinds each MotionValue from the element, keyed by property */
	unbindValues: Map<string, () => void>
	/** everything currently animating, so a dispose can stop all of it */
	running: Set<{stop: () => void}>
	unbindGestures?: () => void
	unregisterLayout?: () => void
	/** resolves the latch handed out by `startExit()` — see there for why it isn't the animation's own promise */
	resolveExit?: () => void
}

/** @internal */
export function createMotionState(initialOptions: Options, parent?: MotionState): MotionState {
	let options = initialOptions

	/** which layers currently contribute to the target; `animate` is always on */
	const active: Record<Layer, boolean> = {
		animate: true,
		inView: false,
		focus: false,
		hover: false,
		press: false,
		dragging: false,
	}
	/** `exit` replaces the layer stack outright rather than merging on top of it */
	let exiting = false

	/** the target most recently animated to — the baseline `update()` diffs against */
	let lastTarget: Target | undefined

	/*
	What the element looked like before a gesture layer first introduced a key
	that no other layer sets. Turning that layer off resolves to a target which
	simply omits the key, and an omitted key is not an instruction to animate
	back — without a remembered base value, a `hover` used with no `animate`
	prop would leave the element stuck on its hover values forever.
	*/
	const baseValues: Record<string, unknown> = {}

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
		// bring back the pre-gesture value of anything no active layer drives now
		const values = target as Record<string, unknown>
		for (const key in baseValues) {
			if (!(key in values)) values[key] = baseValues[key]
		}
		return target
	}

	/*
	Mirrors Motion's own reduced-motion semantics: when active, *positional*
	values — every transform, plus width/height/top/left/right/bottom — are
	applied instantly, while everything else keeps animating. Movement is what
	triggers vestibular discomfort; a fade or a colour change does not, and
	suppressing those too would strip the meaning the animation carries.
	*/
	function shouldReduceMotion(): boolean {
		switch (options.reducedMotion) {
			case "always":
				return true
			case "user":
				// the media-query listener is only attached when it's actually consulted
				if (!hasReducedMotionListener.current) initPrefersReducedMotion()
				return prefersReducedMotion.current ?? false
			case "never":
			case undefined:
			default:
				return false
		}
	}

	function withReducedMotion(
		transition: AnimationOptions | undefined,
		values: Record<string, unknown>,
	): AnimationOptions | undefined {
		if (!shouldReduceMotion()) return transition

		// `{type: false}` is Motion's own "apply this value without animating"
		const reduced: Record<string, unknown> = {...transition}
		for (const key in values) {
			if (positionalKeys.has(key)) reduced[key] = {type: false}
		}
		return reduced as AnimationOptions
	}

	/** The MotionValue driving `key`, created and bound to the element on first use. */
	function valueFor(ctx: MountContext, key: string): MotionValue {
		const existing = ctx.values.get(key)
		if (existing) return existing

		const value: MotionValue = motionValue<any>(readBaseValue(ctx.element, key))
		ctx.values.set(key, value)
		/*
		Bound one key at a time. Motion caches the binding state per element, so
		adding a key later still composes with the ones already bound — a `scale`
		added after `x` joins the same `transform` rather than replacing it.
		*/
		bindValue(ctx, key, value)
		return value
	}

	function bindValue(ctx: MountContext, key: string, value: MotionValue): void {
		ctx.unbindValues.get(key)?.()
		ctx.values.set(key, value)
		/*
		Bound one key at a time. Motion caches the binding state per element, so
		adding a key later still composes with the ones already bound — a `scale`
		added after `x` joins the same `transform` rather than replacing it.
		*/
		const bind = isSVGElement(ctx.element) ? svgEffect : styleEffect
		ctx.unbindValues.set(key, bind(ctx.element, {[key]: value}))
	}

	/*
	MotionValues the caller created and handed over through `style`. Bound
	before anything animates, so a target naming the same property retargets
	the caller's own value rather than shadowing it with a private one.
	*/
	function bindExternalValues(ctx: MountContext): void {
		for (const [key, value] of Object.entries(options.values ?? {})) {
			if (ctx.values.get(key) === value) continue
			bindValue(ctx, key, value)
		}
	}

	function applyTarget(target: Target, isExit = false): Promise<void> {
		lastTarget = target

		const ctx = current
		if (!ctx) return Promise.resolve()
		const values = targetValues(target)
		/*
		Nothing to animate, so no lifecycle events either — an empty target is a
		no-op for `animate` and for `exit` alike. An `exit` that resolves to no
		values used to have to fake a motionstart/motioncomplete pair here so the
		waiters in presence.tsx/primitives.ts wouldn't hang; `startExit()` now
		answers that question directly by returning `null`, so the pretence is
		no longer needed.
		*/
		if (Object.keys(values).length === 0) return Promise.resolve()

		// merge, then normalize once — normalizing an already-normalized base
		// transition again would re-merge its own per-value overrides against a
		// *new* base and let stale, already-baked-in override values win
		const transition = withReducedMotion(
			normalizeTransition({...options.transition, ...target.transition}),
			values,
		)
		dispatch(ctx.element, "motionstart", {target})

		/*
		One animation per property. Only the properties this target names are
		retargeted; anything else already in flight is left to finish, which is
		the whole point of holding the values separately.
		*/
		const running = Object.entries(values).map(([key, keyframes]) => {
			const value = valueFor(ctx, key)
			/*
			Driven by name rather than through `animateSingleValue`, which passes
			an empty one. The name is what lets Motion pick the per-value
			override out of the transition and fall back to the right default for
			that property — a spring for physical values like `x` and `scale`, a
			tween for `opacity`.
			*/
			value.start(animateMotionValue(key, value, keyframes as any, transition as any))

			/*
			`undefined` when the animation finished synchronously — which is how
			reduced motion's `{type: false}` lands. There is nothing to stop and
			nothing to wait for, so it counts as already complete.
			*/
			const controls = value.animation
			if (!controls) return undefined

			ctx.running.add(controls)
			void controls.finished.then(
				() => ctx.running.delete(controls),
				() => ctx.running.delete(controls),
			)
			return controls
		})

		/*
		Only a *completed* animation settles: Motion leaves `finished`
		permanently pending on one that was stopped or replaced (it neither
		resolves nor rejects), which is exactly why the exit latch below can't
		just be this promise. The rejection arm is kept as a guard against a
		future version choosing to reject instead.
		*/
		return Promise.all(running.map(controls => controls?.finished)).then(
			() => {
				// don't dispatch on behalf of a mount cycle a newer one has superseded
				if (current !== ctx) return
				dispatch(ctx.element, "motioncomplete", {target})
				// only the exit animation itself releases the latch, so a gesture
				// or `animate` change landing while `exiting` is already set can't
				// cut the exit short
				if (isExit) {
					const resolve = ctx.resolveExit
					ctx.resolveExit = undefined
					resolve?.()
				}
			},
			() => undefined,
		)
	}

	/** Reads what the element should return to for a value nothing else drives. */
	function readBaseValue(el: Element, key: string): unknown {
		/*
		`initial` describes the element's resting appearance, so it wins over
		anything read back off the element. That matters most for transforms:
		they can only be recovered from the computed matrix, and inverting one
		is lossy (`scale` and a matching `scaleX`/`scaleY` pair are
		indistinguishable), so the property's identity value is used instead —
		which is simply wrong whenever `initial` set a transform. Without this,
		`initial={{scale: 2}} hover={{scale: 3}}` reverts to `scale(1)`.
		*/
		const start = targetValues(getStartTarget())[key]
		// a keyframe list renders statically as its first frame — see createStyles()
		if (start !== undefined) return Array.isArray(start) ? start[0] : start

		if (transformProps.has(key)) return defaultTransformValue(key)
		const computed = window.getComputedStyle(el)
		const value = key.startsWith("--")
			? computed.getPropertyValue(key)
			: computed.getPropertyValue(camelToDash(key))

		/*
		A computed style is always a string, and `getComputedStyle` reports a
		unitless property like `opacity` as `"1"`. Handing that to a MotionValue
		as a string leaves it unable to interpolate towards a numeric target —
		with no element to consult it can't infer a common value type, so it
		gives up and jumps straight to the end. Anything carrying a unit or a
		colour stays a string; Motion parses those itself.
		*/
		return /^-?\d*\.?\d+$/.test(value.trim()) ? parseFloat(value) : value
	}

	function captureBaseValues(el: Element, layer: GestureLayer): void {
		const introduced = targetValues(resolveTarget(options[layer], options.variants))
		const driven = targetValues(resolveActiveTarget())
		for (const key of Object.keys(introduced)) {
			// anything another layer already sets resolves on its own when this one ends
			if (key in baseValues || key in driven) continue
			baseValues[key] = readBaseValue(el, key)
		}
	}

	/*
	Drop base values for keys no gesture layer introduces any more — a reactive
	`hover` that swaps `scale` for `opacity` would otherwise keep re-asserting
	the captured `scale` on every target for the rest of the mount, fighting
	anything else that legitimately changes it.

	Only ever called *after* the target that reverts those keys has been
	applied, so the element animates back to its base before the key stops
	being asserted.
	*/
	function pruneBaseValues(): void {
		const introduced = new Set<string>()
		for (const gesture of GESTURES) {
			const target = resolveTarget(options[gesture.layer], options.variants)
			if (target) for (const key of Object.keys(targetValues(target))) introduced.add(key)
		}
		for (const key in baseValues) {
			if (!introduced.has(key)) delete baseValues[key]
		}
	}

	function setLayer(el: Element, gesture: Gesture, isActive: boolean, event: unknown): void {
		if (isActive) captureBaseValues(el, gesture.layer)
		active[gesture.layer] = isActive
		dispatch(el, isActive ? gesture.enter : gesture.leave, gesture.detail(event))
		void applyTarget(resolveActiveTarget())
	}

	function bindGestures(ctx: MountContext): () => void {
		const el = ctx.element
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

		/*
		Drag isn't one of the table-driven gestures: it doesn't just switch a
		layer on and off, it writes to `x`/`y` continuously for as long as the
		pointer is down.
		*/
		if (options.drag) {
			unbinds.push(
				bindDrag({
					element: el,
					value: axis => valueFor(ctx, axis) as never,
					options: () => options,
					setDragging: isActive => {
						/*
						`x`/`y` are captured before the layer turns on, so
						releasing the drag resolves back to wherever the element
						was picked up from rather than to an implicit zero.
						*/
						if (isActive) captureBaseValues(el, "dragging")
						active.dragging = isActive
						void applyTarget(resolveActiveTarget())
					},
					dispatch: (type, detail) => dispatch(el, type, detail),
				}),
			)
		}

		return () => unbinds.forEach(unbind => unbind())
	}

	const state: MotionState = {
		mount(el: Element) {
			const stranded = current?.resolveExit

			const ctx: MountContext = {
				element: el,
				values: new Map(),
				unbindValues: new Map(),
				running: new Set(),
			}
			current = ctx

			/*
			Whatever exit the superseded cycle was running can never complete now
			(`applyTarget` only settles the latch while its own context is still
			`current`), so release its waiter rather than leaving the old element
			pinned in the DOM forever.
			*/
			stranded?.()

			/*
			A state object outlives its element: under a <Presence>, a Motion can
			be exit-animated and torn down, then mounted again by the very next
			enter (see primitives.ts's mount-gating effect). Flags left over from
			that previous life would otherwise keep resolving to a stale target —
			a still-set `exiting` in particular pins the element to its exit
			target and blocks every later `animate` update.
			*/
			exiting = false
			active.inView = active.focus = active.hover = active.press = false
			active.dragging = false
			for (const key in baseValues) delete baseValues[key]

			bindExternalValues(ctx)

			const startTarget = getStartTarget()
			applyStylesDirect(el, startTarget)

			/*
			Seed a MotionValue for everything the start target names, even if
			nothing animates it yet. Motion rebuilds the whole `transform` from
			the values it knows about, so a `scale` animated later would silently
			drop an `x` that only `initial` had set, had it never been seeded.
			*/
			for (const key of Object.keys(targetValues(startTarget))) valueFor(ctx, key)

			const target = resolveActiveTarget()
			lastTarget = target
			if (!sameValues(startTarget, target)) void applyTarget(target)

			ctx.unbindGestures = bindGestures(ctx)

			if (options.layout) {
				ctx.unregisterLayout = registerLayout({
					element: el,
					offset: key => (ctx.values.get(key)?.get() as number | undefined) ?? 0,
					transition: () => options.layoutTransition ?? options.transition,
					apply: (key, from, transition) => {
						const value = valueFor(ctx, key)
						value.set(from)
						value.start(animateMotionValue(key, value, 0, transition as never))
					},
				})
			}

			mountedStates.set(el, state)

			/*
			Mounting this element may well have moved others — a new row pushes
			the rest of a list down — so everything tracking its layout gets a
			chance to notice.
			*/
			scheduleLayoutCheck()

			return () => {
				for (const controls of ctx.running) controls.stop()
				ctx.running.clear()
				for (const unbind of ctx.unbindValues.values()) unbind()
				ctx.unbindValues.clear()
				ctx.values.clear()
				ctx.unbindGestures?.()
				ctx.unregisterLayout?.()
				mountedStates.delete(el)
				if (current === ctx) current = undefined
				// and removing it moves whatever was below it back up
				scheduleLayoutCheck()
			}
		},
		update(newOptions: Options) {
			const prevOptions = options
			options = newOptions

			// never while exiting: `startExit()` deliberately unbound them, and
			// re-arming here would let a gesture landing mid-exit cut it short
			if (current && !exiting && gesturesChanged(prevOptions, options)) {
				current.unbindGestures?.()
				current.unbindGestures = bindGestures(current)
			}

			if (current) bindExternalValues(current)

			// an exiting element is on its way out — leave it on its exit target
			if (exiting) return

			const target = resolveActiveTarget()
			if (!sameValues(target, lastTarget)) void applyTarget(target)
			pruneBaseValues()
			scheduleLayoutCheck()
		},
		startExit() {
			exiting = true

			const ctx = current
			/*
			Gestures would otherwise stay bound for the whole exit window (the
			mount disposer only runs once the exit is over), so a `pointerleave`
			or `pressend` landing mid-exit would cancel and restart the exit
			animation, stranding the latch on an animation that can no longer
			complete. Unbind at exit start, and clear the handle so the disposer
			can't unbind a second time.
			*/
			ctx?.unbindGestures?.()
			if (ctx) ctx.unbindGestures = undefined

			const target = resolveActiveTarget()
			// nothing animatable (e.g. `exit="typo"`, or an exit target carrying
			// only a `transition`): say so synchronously so the caller unmounts
			// now instead of waiting on a promise that would never settle
			if (!ctx || Object.keys(targetValues(target)).length === 0) return null

			let resolve!: () => void
			const latch = new Promise<void>(r => (resolve = r))
			ctx.resolveExit = resolve
			void applyTarget(target, true)
			return latch
		},
		getTarget: getStartTarget,
		getOptions: () => options,
		getInitialVariantKey,
	}
	return state
}
