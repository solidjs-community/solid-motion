import {createContext, type FlowComponent} from "solid-js"

import {tryUseContext} from "./presence.jsx"
import type {AnimationOptions, ReducedMotion} from "./types.js"

/** Defaults applied to every `Motion` below a `<MotionConfig>`. */
export type MotionConfigState = {
	/** See the `reducedMotion` prop on {@link MotionConfig}. */
	readonly reducedMotion?: ReducedMotion
	/** A default `transition` for descendants that don't set their own. */
	readonly transition?: AnimationOptions
}

export const MotionConfigContext = createContext<MotionConfigState | undefined>(undefined)

/**
 * Sets defaults for every `Motion` element beneath it.
 *
 * accepts props:
 * - `reducedMotion` – *(Defaults to `"never"`)* – How to treat the user's
 *   `prefers-reduced-motion` setting. `"user"` follows it, `"always"` reduces
 *   unconditionally, `"never"` ignores it.
 * - `transition` – a default `transition` for descendants that don't set one.
 *
 * Both are inherited: a nested `MotionConfig` only overrides the props it sets.
 *
 * @example
 * ```tsx
 * <MotionConfig reducedMotion="user">
 *   <App />
 * </MotionConfig>
 * ```
 */
export const MotionConfig: FlowComponent<{
	reducedMotion?: ReducedMotion
	transition?: AnimationOptions
}> = props => {
	const outer = tryUseContext(MotionConfigContext)

	/*
	Getters rather than a snapshot: the value is read from descendants' own
	tracking scopes, so `<MotionConfig transition={someSignal()}>` stays
	reactive. Falling back to `outer` is what makes nesting additive — an inner
	config that only sets `transition` keeps the outer `reducedMotion`.
	*/
	const state: MotionConfigState = {
		get reducedMotion() {
			return props.reducedMotion ?? outer?.reducedMotion
		},
		get transition() {
			return props.transition ?? outer?.transition
		},
	}

	return <MotionConfigContext value={state}>{props.children}</MotionConfigContext>
}
