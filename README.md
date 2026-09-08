<p>
  <img width="100%" src="https://assets.solidjs.com/banner?project=solid-motion&color=fff312&integration=https%3A%2F%2Fraw.githubusercontent.com%2Fsolidjs-community%2Fsolid-motion%2Fmain%2Fmotion.svg" alt="solid-motion">
</p>

# Solid Motion

[![pnpm](https://img.shields.io/badge/maintained%20with-pnpm-cc00ff.svg?style=for-the-badge&logo=pnpm)](https://pnpm.io/)
[![npm](https://img.shields.io/npm/v/solid-motion?style=for-the-badge)](https://www.npmjs.com/package/solid-motion)
[![downloads](https://img.shields.io/npm/dw/solid-motion?color=blue&style=for-the-badge)](https://www.npmjs.com/package/solid-motion)
[![size](https://img.shields.io/bundlephobia/minzip/solid-motion?style=for-the-badge)](https://bundlephobia.com/package/solid-motion)

**A tiny, performant animation library for Solid 2.0. Powered by [Motion](https://motion.dev/).**

## Introduction

Motion for Solid is a small animation library for Solid 2.0. It takes advantage of Solid's excellent performance and simple declarative syntax. This package supplies springs, gestures, scroll-triggered animations, variants, and hardware accelerated animations.

## Contents

- [Installation](#installation)
- [Create an animation](#create-an-animation)
- [Props reference](#props-reference)
- [Enter animations](#enter-animations)
- [Exit animations](#exit-animations)
- [`Presence` props](#presence-props)
- [`MotionConfig` and reduced motion](#motionconfig-and-reduced-motion)
- [Transition options](#transition-options)
- [Keyframes](#keyframes)
- [Variants](#variants)
- [Gestures: hover, press and focus](#gestures-hover-press-and-focus)
- [Scroll-triggered animations](#scroll-triggered-animations)
- [Event handlers](#event-handlers)
- [Drag](#drag)
- [Layout animation](#layout-animation)
- [Motion values](#motion-values)
- [Custom components](#custom-components)
- [Low-level primitives](#low-level-primitives)
- [Scroll-linked animations](#scroll-linked-animations)
- [TypeScript](#typescript)
- [Examples](#examples)
- [Testing](#testing)

## Installation

Solid Motion can be installed via npm. It requires `solid-js@^2.0.0-rc.0` (Solid 2.0 is currently in beta/RC).

```bash
npm install solid-motion
# or
pnpm add solid-motion
# or
yarn add solid-motion
```

## Create an animation

Import the `Motion` component and use it anywhere in your Solid components:

```tsx
import {Motion} from "solid-motion"

function MyComponent() {
  return <Motion>Hello world</Motion>
}
```

The `Motion` component can be used to create an animatable HTML or SVG element. By default, it will render a `div` element:

```tsx
import {Motion} from "solid-motion"

function App() {
  return (
    <Motion.div
      animate={{opacity: [0, 1]}}
      transition={{duration: 1, easing: "ease-in-out"}}
    />
  )
}
```

But any HTML or SVG element can be rendered, by defining it like this: `<Motion.button>`, `<Motion.svg>`, `<Motion.rect>`, etc.

Or like this: `<Motion tag="button">`

All non-animation props (`id`, `class`, `onClick`, SVG attributes like `viewBox`, event listeners, etc.) pass straight through to the rendered element, same as any other Solid component.

## Props reference

Every animation-related prop below accepts either a direct target object (`{opacity: 1}`) or a string key that's looked up in the [`variants`](#variants) prop.

| Prop            | Type                            | Description                                                                                                                                                                                         |
| --------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `initial`       | target \| string \| `false`     | The style to render _before_ any animation runs. Defaults to the element's current computed style. Set to `false` to skip the enter animation entirely — see [Enter animations](#enter-animations). |
| `animate`       | target \| string                | The style to animate to. Reactive — changing it (e.g. via a signal) re-triggers an animation to the new target.                                                                                     |
| `exit`          | target \| string                | The style to animate to when the element is removed. Only takes effect anywhere inside a [`Presence`](#exit-animations) ancestor's subtree; without one, the element unmounts immediately.          |
| `hover`         | target \| string                | The style to animate to while the pointer is hovering the element. See [Gestures](#gestures-hover-press-and-focus).                                                                                 |
| `press`         | target \| string                | The style to animate to while the element is being pressed. Layers on top of `hover` if both are active.                                                                                            |
| `focus`         | target \| string                | The style to animate to while the element has visible (keyboard) focus. See [Gestures](#gestures-hover-press-and-focus).                                                                            |
| `inView`        | target \| string                | The style to animate to when the element scrolls into view. See [Scroll-triggered animations](#scroll-triggered-animations).                                                                        |
| `inViewOptions` | `{root?, margin?, amount?}`     | Options controlling when `inView` triggers — see [Scroll-triggered animations](#scroll-triggered-animations).                                                                                       |
| `dragging`      | target \| string                | The style to animate to while the element is being dragged. See [Drag](#drag).                                                                                                                      |
| `variants`      | `Record<string, target>`        | A map of named targets that any of the props above can reference by string key. See [Variants](#variants).                                                                                          |
| `transition`    | object                          | Controls duration, easing, delay, and per-value overrides for the animation. See [Transition options](#transition-options).                                                                         |
| `tag`           | string                          | Explicitly sets the rendered element tag, as an alternative to `Motion.tag` proxy access.                                                                                                           |
| `style`         | CSS \| `MotionValue`s           | Ordinary CSS, plus transform shorthands (`x`, `scale`, …) and [motion values](#motion-values) bound straight to the element.                                                                        |
| `reducedMotion` | `"never"`\|`"user"`\|`"always"` | Normally set for a subtree with [`MotionConfig`](#motionconfig-and-reduced-motion) instead.                                                                                                         |

Dragging and layout have their own props — [`drag`, `dragConstraints`, `dragElastic`, `dragMomentum`, `dragTransition`](#drag) and [`layout`, `layoutTransition`](#layout-animation) — documented in their own sections.

A target object accepts any CSS property (camelCase or kebab-case), the shorthand transform values (`x`, `y`, `scale`, `rotate`, etc.), CSS custom properties (`"--my-var"`), and can optionally carry its own `transition` override (see [Transition options](#transition-options)).

## Enter animations

Elements will automatically `animate` to the values defined in `animate` when they're created — animating from whatever `initial` describes (or the element's current/default style, if `initial` isn't set) to the `animate` target.

This can be disabled by setting the `initial` prop to `false`. The styles defined in `animate` will be applied immediately when the element is first created, with no animation.

```tsx
<Motion initial={false} animate={{x: 100}} />
```

If `initial` and `animate` already describe the same values, no animation runs at all.

## Exit animations

When an element is removed with `<Show>` it can be animated out with the `Presence` component and the `exit` prop. `Presence` keeps the element mounted until its exit animation finishes, then removes it:

```tsx
import {createSignal, Show} from "solid-js"
import {Motion, Presence} from "solid-motion"

function App() {
  const [isShown, setShow] = createSignal(true)

  return (
    <div>
      <Presence exitBeforeEnter>
        <Show when={isShown()}>
          <Motion
            initial={{opacity: 0, scale: 0.6}}
            animate={{opacity: 1, scale: 1}}
            exit={{opacity: 0, scale: 0.6}}
            transition={{duration: 0.3}}
          />
        </Show>
      </Presence>
      <button onClick={() => setShow(p => !p)}>Toggle</button>
    </div>
  )
}
```

`exit` can be provided a `transition` of its own, that overrides the component's `transition`:

```tsx
<Presence>
  <Show when={isShown()}>
    <Motion
      animate={{opacity: 1}}
      exit={{opacity: 0, transition: {duration: 0.8}}}
    />
  </Show>
</Presence>
```

Every `Motion` in the exiting subtree takes part, not just the top one: when descendants have their own `exit` props — with their own durations — `Presence` waits for all of them to finish before removing anything. The element being transitioned doesn't have to be a `Motion` itself either, so a plain wrapper around animated children works:

```tsx
<Presence>
  <Show when={isShown()}>
    <div class="card">
      <Motion.h2 exit={{opacity: 0, transition: {duration: 0.15}}}>
        Title
      </Motion.h2>
      <Motion.p exit={{opacity: 0, transition: {duration: 0.6}}}>Body</Motion.p>
    </div>
  </Show>
</Presence>
```

`Presence` handles any number of children, each entering and leaving on its own schedule. Removing one item from a list animates just that item out, in place, while its siblings stay put:

```tsx
<Presence>
  <For each={items()}>
    {item => <Motion.li exit={{opacity: 0, height: 0}}>{item.label}</Motion.li>}
  </For>
</Presence>
```

The one exception is [`exitBeforeEnter`](#presence-props), which by definition transitions a single element at a time: it has to keep the incoming element out of the DOM until the outgoing one is done, so it resolves only the first child. A `Motion` that ends up as a later sibling of an `exitBeforeEnter` `Presence` is never rendered, and warns to the console saying so.

```tsx
// ✗ under exitBeforeEnter, only the first is ever rendered
<Presence exitBeforeEnter>
  <Motion.div exit={{opacity: 0}} />
  <Motion.div exit={{opacity: 0}} />
</Presence>

// ✓ one transitioning element, whose descendants all animate out
<Presence exitBeforeEnter>
  <Show when={isShown()}>
    <div>
      <Motion.div exit={{opacity: 0}} />
      <Motion.div exit={{opacity: 0}} />
    </div>
  </Show>
</Presence>
```

## `Presence` props

| Prop              | Type    | Default | Description                                                                                                                                                                          |
| ----------------- | ------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `initial`         | boolean | `true`  | If `false`, disables the enter animation for every child `Motion` element the _first_ time `Presence` itself is rendered. Subsequent elements entering later still animate normally. |
| `exitBeforeEnter` | boolean | `false` | If `true`, waits for the outgoing element's exit animation to finish before starting the incoming element's enter animation, instead of running both at once.                        |

```tsx
<Presence initial={false}>
  <Motion.div animate={{opacity: 1}} />
</Presence>
```

## `MotionConfig` and reduced motion

`MotionConfig` sets defaults for every `Motion` beneath it.

```tsx
import {MotionConfig} from "solid-motion"
;<MotionConfig reducedMotion="user" transition={{duration: 0.4}}>
  <App />
</MotionConfig>
```

| Prop            | Type                                | Default   | Description                                                                                    |
| --------------- | ----------------------------------- | --------- | ---------------------------------------------------------------------------------------------- |
| `reducedMotion` | `"never"` \| `"user"` \| `"always"` | `"never"` | How to treat the user's `prefers-reduced-motion` setting.                                      |
| `transition`    | object                              | —         | A default [`transition`](#transition-options) for descendants that don't set one of their own. |

Both are inherited, and a nested `MotionConfig` only overrides the props it sets. An element's own `transition` always wins over the config's.

### Reduced motion

Set `reducedMotion="user"` to respect the operating system's "reduce motion" accessibility setting. When it's active, _positional_ values — every transform, plus `width`, `height`, `top`, `left`, `right` and `bottom` — are applied instantly, while everything else keeps animating.

That split is deliberate, and matches Motion's own behaviour: movement across the screen is what triggers vestibular discomfort, whereas a fade or a colour change does not. Suppressing every animation would instead strip out the meaning the animation was carrying.

```tsx
// with reduced motion active, this lands at its new position immediately
// but still fades in over 0.4s
<MotionConfig reducedMotion="user">
  <Motion.div
    initial={{opacity: 0, y: 40}}
    animate={{opacity: 1, y: 0}}
    transition={{duration: 0.4}}
  />
</MotionConfig>
```

`reducedMotion` can also be set on a single element, though the config is the usual place for it.

## Transition options

We can change the type of animation used by passing a `transition` prop.

```tsx
<Motion
  animate={{rotate: 90, backgroundColor: "yellow"}}
  transition={{duration: 1, easing: "ease-in-out"}}
/>
```

By default transition options are applied to all values, but we can also override on a per-value basis — any option not specified in the override is inherited from the base transition:

```tsx
<Motion
  animate={{rotate: 90, backgroundColor: "yellow"}}
  transition={{
    duration: 1,
    rotate: {duration: 2},
  }}
/>
```

`transition` also accepts spring physics options (`{type: "spring", stiffness, damping, mass}`), `delay`, and `repeat`/`repeatType` — anything supported by Motion's own `animate()` options at [motion.dev](https://motion.dev/).

Taking advantage of Solid's reactivity is just as easy. Simply provide any of the Motion properties as accessors to have them change reactively:

```tsx
const [bg, setBg] = createSignal("red")

return (
  <Motion.button
    onClick={() => setBg("blue")}
    animate={{backgroundColor: bg()}}
    transition={{duration: 3}}
  >
    Click Me
  </Motion.button>
)
```

The result is a button that begins red and upon being pressed transitions to blue. `animate` doesn't accept an accessor function. For reactive properties simply place signals in the object similar to using the `style` prop.

## Keyframes

Values can also be set as arrays, to define a series of keyframes.

```tsx
<Motion animate={{x: [0, 100, 50]}} />
```

By default, keyframes are spaced evenly throughout `duration`, but this can be adjusted by providing progress values (`0` to `1`) to `offset`:

```tsx
<Motion
  animate={{x: [0, 100, 50]}}
  transition={{duration: 2, x: {offset: [0, 0.25, 1]}}}
/>
```

## Variants

Instead of passing target objects directly, you can define a `variants` map and reference entries by name. This is useful for reusing the same named states across `initial`, `animate`, `exit`, `hover`, `press`, and `inView`:

```tsx
<Motion.div
  initial="hidden"
  animate="visible"
  variants={{
    hidden: {opacity: 0, y: -20},
    visible: {opacity: 1, y: 0, transition: {duration: 0.6}},
  }}
/>
```

**Variant key inheritance:** a nested `Motion` element with no `initial` of its own inherits the _key_ (e.g. `"hidden"`) from its closest ancestor that has one, and resolves that key against its **own** `variants` map. This lets a parent set `initial="hidden"` once and have descendants each define what "hidden" means for themselves, without repeating `initial` at every level:

```tsx
<Motion.div
  initial="hidden"
  animate="visible"
  variants={{hidden: {opacity: 0}, visible: {opacity: 1}}}
>
  <Motion.ul animate="visible" variants={{hidden: {y: 30}, visible: {y: 0}}}>
    <Motion.li
      animate="visible"
      variants={{hidden: {scale: 0.8}, visible: {scale: 1}}}
    />
  </Motion.ul>
</Motion.div>
```

Note that only `initial` is inherited this way — `animate`/`exit`/`hover`/`press`/`inView` must be set on each element that should react to them.

## Gestures: hover, press and focus

`hover`, `press` and `focus` animate an element in response to interaction, without needing to write your own event handlers:

```tsx
<Motion.div
  hover={{scale: 1.1}}
  press={{scale: 0.95}}
  transition={{duration: 0.15}}
/>
```

Overlapping properties are layered `animate` → `inView` → `focus` → `hover` → `press` (the same order Motion uses), so pressing while already hovering applies `press`, and releasing falls back to `hover`.

`focus` only fires for _visible_ focus — it is gated on `:focus-visible`, which is the browser's own judgement of whether focus deserves a ring. Clicking a button focuses it without triggering `focus`; tabbing to it does.

```tsx
<Motion.button focus={{scale: 1.05}} press={{scale: 0.95}} />
```

Neither prop needs an `animate` alongside it. When a gesture ends, every property it introduced animates back to a resting value — taken from `animate` or `initial` if either defines it, and otherwise read off the element itself.

## Scroll-triggered animations

`inView` animates an element when it scrolls into (and back out of) the viewport, using an `IntersectionObserver` under the hood:

```tsx
<Motion.div
  initial={{opacity: 0}}
  inView={{opacity: 1}}
  inViewOptions={{amount: 0.5}}
/>
```

`inViewOptions` accepts:

| Option   | Type                          | Description                                                                                                                 |
| -------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `root`   | `Element \| Document`         | The scrolling container to observe within. Defaults to the browser viewport.                                                |
| `margin` | string                        | A CSS margin-like string (e.g. `"-100px"`) that grows or shrinks the root's bounding box before intersection is calculated. |
| `amount` | `"some"` \| `"all"` \| number | How much of the element must be visible to trigger — a fraction (`0`–`1`), or `"some"`/`"all"`.                             |

## Event handlers

Every `Motion` component also accepts these optional event handler props:

| Handler                                | Fires when                                                                  | `event.detail`                                                           |
| -------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `onMotionStart`                        | An animation (from any of `animate`/`exit`/`hover`/`press`/`inView`) begins | `{target}` — the resolved target being animated to                       |
| `onMotionComplete`                     | That animation finishes                                                     | `{target}`                                                               |
| `onHoverStart` / `onHoverEnd`          | Pointer enters / leaves the element                                         | `{originalEvent}` — the underlying `PointerEvent`                        |
| `onPressStart` / `onPressEnd`          | Pointer is pressed / released on the element                                | `{originalEvent}`                                                        |
| `onFocusStart` / `onFocusEnd`          | Element gains / loses visible focus (per `focus`)                           | `{originalEvent}` — the underlying `FocusEvent`                          |
| `onDragStart` / `onDrag` / `onDragEnd` | A drag begins, moves or ends                                                | `{originalEvent, offset}` — the pointer event and the `{x, y}` travelled |
| `onViewEnter` / `onViewLeave`          | Element enters / leaves the viewport (per `inView`/`inViewOptions`)         | `{originalEntry}` — the underlying `IntersectionObserverEntry`           |

`onMotionStart`/`onMotionComplete` only fire when an animation actually runs. A target that resolves to no animatable values — a `variants` key with no match, or a target carrying nothing but a `transition` — is a no-op and reports neither event.

```tsx
<Motion.div
  animate={{opacity: 1}}
  onMotionComplete={({detail}) => console.log("animated to", detail.target)}
/>
```

## Drag

`drag` makes an element draggable, writing straight to its `x`/`y` motion values:

```tsx
<Motion.div drag />
<Motion.div drag="x" />
```

| Prop              | Type                             | Default | Description                                                                           |
| ----------------- | -------------------------------- | ------- | ------------------------------------------------------------------------------------- |
| `drag`            | boolean \| `"x"` \| `"y"`        | `false` | Enables dragging, optionally on one axis only.                                        |
| `dragging`        | target \| string                 | —       | The style to animate to while a drag is in progress.                                  |
| `dragConstraints` | `{top?, left?, right?, bottom?}` | —       | Bounds in pixels, relative to where the element started.                              |
| `dragElastic`     | boolean \| number                | `0.5`   | How far past a bound the element still follows the pointer. `0` pins it to the bound. |
| `dragMomentum`    | boolean                          | `true`  | Whether releasing carries the element on with the velocity it was thrown at.          |
| `dragTransition`  | object                           | —       | Overrides the inertia settings applied on release.                                    |

```tsx
<Motion.div
  drag="x"
  dragConstraints={{left: 0, right: 300}}
  dragElastic={0.2}
  dragging={{scale: 1.05}}
/>
```

A press that never moves more than a few pixels stays a press, so a button inside a draggable still clicks. Only one element drags at a time, so a draggable nested inside another doesn't move both. `onDragStart`, `onDrag` and `onDragEnd` report `{originalEvent, offset}`.

## Layout animation

`layout` animates an element to its new position whenever the layout moves it — a list reordering, a sibling appearing above it, a container resizing:

```tsx
<For each={items()}>{item => <Motion.li layout>{item.label}</Motion.li>}</For>
```

It works by [FLIP](https://aerotwist.com/blog/flip-your-animations/): the element is already at its new position, held back by a transform that then animates away. `layoutTransition` overrides the transition used; without one it uses a spring.

**Position only.** A change in _size_ is not animated. Animating size means scaling the element, which stretches its text and every child inside it, and undoing that distortion needs a full projection tree that counter-scales each descendant and corrects border radii. This is the behaviour Motion calls `layout="position"`; the size half is not implemented.

Layout offsets use the `translateX`/`translateY` transform slots, so they compose with — rather than fight — an `x` or `y` you animate yourself.

## Motion values

Every animated property is held in its own `MotionValue`. That's mostly an implementation detail — it's what lets properties animate independently, so retargeting `x` mid-flight leaves a running `opacity` animation to finish rather than stranding it — but you can create and drive values yourself.

A `MotionValue` is deliberately **not** a signal: writing to one schedules no render, and reading one subscribes to nothing. A value driven at 60fps by scroll or a spring would otherwise re-run every computation that touched it, once per frame. Motion writes it to the DOM on its own frame loop instead.

Bind one by putting it in a `style` prop:

```tsx
import {Motion, createMotionValue} from "solid-motion"

function Example() {
  const x = createMotionValue(0)
  return <Motion.div style={{x}} onClick={() => x.set(100)} />
}
```

`style` also accepts Motion's transform shorthands (`x`, `y`, `scale`, `rotate`, …) alongside ordinary CSS.

### Deriving values

| Function                                          | Motion equivalent | Description                                              |
| ------------------------------------------------- | ----------------- | -------------------------------------------------------- |
| `createMotionValue(initial)`                      | `useMotionValue`  | A new value.                                             |
| `createTransform(value, inputRange, outputRange)` | `useTransform`    | Maps one value from an input range onto an output range. |
| `createTransform(() => …)`                        | `useTransform`    | Computes a value from any others it reads.               |
| `createSpring(source, options)`                   | `useSpring`       | Follows another value with spring physics.               |

```tsx
const x = createMotionValue(0)
const opacity = createTransform(x, [0, 200], [1, 0.2])
const label = createTransform(() => `${Math.round(x.get())}px`)
const smooth = createSpring(x, {stiffness: 200, damping: 30})

;<Motion.div style={{x, opacity}} />
```

Derived values recompute on Motion's frame loop rather than on the write, so a burst of updates in one frame costs one recomputation. Each is torn down with the owner that created it, so call these inside a component.

Animating a property that has a value bound to it retargets **that** value rather than shadowing it, so `x.get()` keeps reporting the truth while an `animate` prop drives it.

`createMotion` has no `style` prop to read, so pass values through the `values` option instead:

```tsx
createMotion(el, () => ({values: {x}, animate: {opacity: 1}}))
```

## Custom components

`Motion.create` wraps a component of your own so it accepts the animation props, the way `Motion.div` does for a plain element:

```tsx
import {Motion} from "solid-motion"

function Card(props) {
  return (
    <article ref={props.ref} style={props.style} class="card">
      {props.children}
    </article>
  )
}

const MotionCard = Motion.create(Card)

;<MotionCard initial={{opacity: 0}} animate={{opacity: 1}}>
  Hello
</MotionCard>
```

The wrapped component has to do two things: **forward its `ref`** to a real DOM element — that element is what gets animated — and **apply the `style`** it is handed, which carries the resolved `initial` styles.

The animation props are consumed by `Motion` and are not passed on. Pass `{forwardMotionProps: true}` if the wrapped component wants them too:

```tsx
const MotionCard = Motion.create(Card, {forwardMotionProps: true})
```

SVG geometry in `initial` (`height`, `cx`, …) isn't resolved for custom components — without a tag to inspect, the start target is built as HTML styles. Use `Motion.rect` and friends for SVG.

## Low-level primitives

For cases where you don't want to render a `<Motion>` component — e.g. animating an element you don't otherwise control — two lower-level primitives are also exported:

**`motion`** — a ref factory. Pass its return value to any element's `ref`:

```tsx
import {motion} from "solid-motion"
;<div
  ref={motion(() => ({
    initial: {opacity: 0},
    animate: {opacity: 1},
    transition: {duration: 0.6},
  }))}
/>
```

The options accessor is reactive, the same as a `<Motion>` component's props. It can be composed with other refs using Solid's array-ref syntax: `ref={[otherRef, motion(() => ({...}))]}`.

Call `motion()` from inside a component (or another owned scope). It creates its effects there, which ties the animation's lifetime to that component: the element is unregistered, its gestures unbound and any running animation cancelled when the component is disposed. The same applies to `createMotion` and `useScroll` — called outside an owned scope, Solid warns (`NO_OWNER_EFFECT` / `NO_OWNER_CLEANUP`) and there is nothing to clean them up.

**`createMotion`** — the imperative form, for when you already have an `Element` reference:

```tsx
import {createMotion} from "solid-motion"

createMotion(myElement, () => ({animate: {opacity: 1}}))
```

It returns a [`MotionState`](#typescript) and, like `motion`, must be called from an owned scope.

## Scroll-linked animations

While `inView` (see [Scroll-triggered animations](#scroll-triggered-animations)) animates _to_ a target once an element crosses into view, `useScroll` instead gives you a continuously-updating scroll progress value to drive your own animations directly from — e.g. a progress bar, or a value passed into `animate`:

```tsx
import {useScroll} from "solid-motion"

function App() {
  const {scrollY} = useScroll()

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        height: "4px",
        background: "royalblue",
        "transform-origin": "0% 50%",
        transform: `scaleX(${scrollY().progress})`,
      }}
    />
  )
}
```

`useScroll(options?)` returns:

| Value                 | Type                                                                                                         | Description                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `time`                | `Accessor<number>`                                                                                           | The current scroll-tracking timestamp.                                       |
| `scrollX` / `scrollY` | `Accessor<{current, offset, progress, scrollLength, velocity, targetOffset, targetLength, containerLength}>` | Per-axis scroll info — `progress` (`0`–`1`) is the most commonly used field. |

`options` accepts `container`/`target` (to track a scrollable element instead of the page), `axis`, and `offset` — see Motion's [`scroll` docs](https://motion.dev/docs/scroll) for the full set, which this passes straight through to.

## TypeScript

The following types are exported for typing your own components and helpers:

- `Options` — the full prop shape accepted by `Motion`/`motion`/`createMotion` (everything in the [props reference](#props-reference) except `tag`).
- `Target` — a single style target object (what `animate`, `initial`, etc. accept directly).
- `VariantDefinition` — `Target | string`, what each animation prop actually accepts.
- `MotionEvent`, `CustomPointerEvent`, `ViewEvent` — the `CustomEvent` subtypes passed to the [event handlers](#event-handlers).
- `ViewportOptions` — the shape of `inViewOptions`.
- `MotionComponentProps` — the full props type for the `<Motion>` component, including children and event handlers.
- `ReducedMotion` — `"never" | "user" | "always"`, the `reducedMotion` prop's type.
- `MotionConfigState` — the value carried by `MotionConfigContext`.
- `MotionComponentOptions` / `AnimatableProps` — the options `Motion.create` accepts, and the props a wrapped component must accept.
- `DragAxis`, `DragConstraints` — the `drag` and `dragConstraints` prop types.
- `CustomDragEvent`, `CustomFocusEvent` — the event types passed to the drag and focus handlers.
- `MotionValue` — re-exported from Motion; what `createMotionValue` and friends return.
- `MotionStyle` — the `style` prop's type, widened to accept `MotionValue`s and transform shorthands.
- `MotionState` — what `createMotion` returns. `getTarget()` and `getOptions()` read the element's start target and current options; the rest is driven by this library.
- `PresenceContextState` — the value carried by `PresenceContext`, and the type of `createMotion`'s optional third argument.
- `PresenceExitRegistry` — how an exiting element hands itself to its enclosing `Presence`; reachable through `PresenceContextState["exits"]`.

`PresenceContext` itself is exported too, for reading the enclosing `Presence` from a component of your own. Note that Solid 2's `useContext` throws when there is no provider, so guard the read if the component can render outside a `Presence`.

## Examples

Every feature documented above has a live example in this repo's playground. Run it locally with:

```bash
pnpm install
pnpm run dev
```

That serves an index of every demo; each one is also reachable directly at `?demo=<id>`. The playground doubles as the app the Playwright suite drives, so the demos are kept working by the tests rather than by hand.

## Testing

```bash
pnpm test         # Vitest: the state machine, in Chromium and in SSR
pnpm run test:coverage
pnpm run test:e2e  # Playwright: the app, across Chromium, Firefox and WebKit
```

Both suites need a browser. Install them once with `pnpm exec playwright install chromium firefox webkit`.

The e2e suite serves the playground on port 5173. If that port is already taken — Vite's default, so it often is — set `PLAYWRIGHT_PORT` to something free, otherwise Playwright reuses whatever is already listening there and every test times out:

```bash
PLAYWRIGHT_PORT=5199 pnpm run test:e2e
```

Vitest runs the unit tests in a real Chromium through browser mode, so they get real animation interpolation, a real `IntersectionObserver` and real computed styles. Playwright drives the whole playground app instead, across three engines.
