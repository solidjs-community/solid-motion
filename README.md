<p>
  <img width="100%" src="https://assets.solidjs.com/banner?project=solid-motion&color=fff312&integration=https%3A%2F%2Fraw.githubusercontent.com%2Fsolidjs-community%2Fsolid-motion%2Fmain%2Fmotion.svg" alt="solid-motion">
</p>

# Solid Motion

[![pnpm](https://img.shields.io/badge/maintained%20with-pnpm-cc00ff.svg?style=for-the-badge&logo=pnpm)](https://pnpm.io/)
[![npm](https://img.shields.io/npm/v/solid-motion?style=for-the-badge)](https://www.npmjs.com/package/solid-motion)
[![downloads](https://img.shields.io/npm/dw/solid-motion?color=blue&style=for-the-badge)](https://www.npmjs.com/package/solid-motion)
[![size](https://img.shields.io/bundlephobia/minzip/solid-motion?style=for-the-badge)](https://bundlephobia.com/package/solid-motion)

**A tiny, performant animation library for Solid 2.0. Powered by [Motion](https://motion.dev/).**

It gives you springs, gestures, scroll-triggered animations, variants, drag, layout animation and hardware accelerated animations, in Solid's declarative syntax.

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

Requires `solid-js@^2.0.0-rc.0`.

```bash
npm install solid-motion
# or
pnpm add solid-motion
# or
yarn add solid-motion
```

## Create an animation

`Motion` renders an animatable HTML or SVG element. It renders a `div` by default.

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

Pick another element with `<Motion.button>`, `<Motion.svg>`, `<Motion.rect>`, or with `<Motion tag="button">`.

Non-animation props pass straight through to the rendered element. That includes `id`, `class`, `onClick`, event listeners and SVG attributes like `viewBox`.

## Props reference

Every animation prop below takes either a target object (`{opacity: 1}`) or a string key looked up in [`variants`](#variants).

| Prop            | Type                            | Description                                                                                                                       |
| --------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `initial`       | target \| string \| `false`     | The style to render before any animation runs. Defaults to the element's computed style. Set `false` to skip the enter animation. |
| `animate`       | target \| string                | The style to animate to. Reactive, so changing it animates to the new target.                                                     |
| `exit`          | target \| string                | The style to animate to when the element is removed. Needs a [`Presence`](#exit-animations) ancestor, otherwise it is ignored.    |
| `hover`         | target \| string                | The style to animate to while the pointer is over the element.                                                                    |
| `press`         | target \| string                | The style to animate to while the element is pressed.                                                                             |
| `focus`         | target \| string                | The style to animate to while the element has visible focus.                                                                      |
| `inView`        | target \| string                | The style to animate to when the element scrolls into view.                                                                       |
| `inViewOptions` | `{root?, margin?, amount?}`     | Controls when `inView` triggers. See [Scroll-triggered animations](#scroll-triggered-animations).                                 |
| `dragging`      | target \| string                | The style to animate to while the element is dragged. See [Drag](#drag).                                                          |
| `variants`      | `Record<string, target>`        | Named targets that any prop above can reference by key. See [Variants](#variants).                                                |
| `transition`    | object                          | Duration, easing, delay and per-value overrides. See [Transition options](#transition-options).                                   |
| `tag`           | string                          | Sets the rendered tag, as an alternative to `Motion.tag`.                                                                         |
| `style`         | CSS \| `MotionValue`s           | Ordinary CSS, transform shorthands like `x` and `scale`, and [motion values](#motion-values).                                     |
| `reducedMotion` | `"never"`\|`"user"`\|`"always"` | Usually set for a whole subtree with [`MotionConfig`](#motionconfig-and-reduced-motion) instead.                                  |

Drag and layout have their own props. See [Drag](#drag) and [Layout animation](#layout-animation).

A target object accepts:

- Any CSS property, in camelCase or kebab-case.
- Transform shorthands such as `x`, `y`, `scale` and `rotate`.
- CSS custom properties such as `"--my-var"`.
- Its own `transition`, which overrides the component's.

## Enter animations

An element animates to `animate` when it is created. It starts from `initial`, or from its current style if `initial` is not set.

Set `initial={false}` to apply `animate` immediately with no animation.

```tsx
<Motion initial={false} animate={{x: 100}} />
```

If `initial` and `animate` describe the same values, no animation runs.

## Exit animations

`Presence` keeps a removed element mounted until its `exit` animation finishes.

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

`exit` can carry its own `transition`, which overrides the component's.

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

Every `Motion` in the exiting subtree takes part, not just the top one. `Presence` waits for all of them before removing anything, so descendants can use different durations. The transitioning element does not have to be a `Motion` itself.

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

`Presence` handles any number of children, each on its own schedule. Removing one list item animates just that item out, in place.

```tsx
<Presence>
  <For each={items()}>
    {item => <Motion.li exit={{opacity: 0, height: 0}}>{item.label}</Motion.li>}
  </For>
</Presence>
```

[`exitBeforeEnter`](#presence-props) is the exception. It transitions one element at a time, so it resolves only the first child. A later sibling is never rendered, and warns to the console.

```tsx
// ✗ only the first is ever rendered
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

| Prop              | Type    | Default | Description                                                                                                                     |
| ----------------- | ------- | ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `initial`         | boolean | `true`  | If `false`, disables the enter animation for every child the first time `Presence` renders. Children added later still animate. |
| `exitBeforeEnter` | boolean | `false` | If `true`, waits for the outgoing element to finish before the incoming one enters, instead of running both at once.            |

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

| Prop            | Type                                | Default   | Description                                                    |
| --------------- | ----------------------------------- | --------- | -------------------------------------------------------------- |
| `reducedMotion` | `"never"` \| `"user"` \| `"always"` | `"never"` | How to treat the user's `prefers-reduced-motion` setting.      |
| `transition`    | object                              | none      | A default [`transition`](#transition-options) for descendants. |

Both are inherited. A nested `MotionConfig` overrides only the props it sets, and an element's own `transition` always wins.

### Reduced motion

`reducedMotion="user"` respects the operating system's reduce motion setting. When it is active, positional values are applied instantly and everything else still animates. Positional means every transform, plus `width`, `height`, `top`, `left`, `right` and `bottom`.

The split matches Motion's own behaviour. Movement across the screen is what causes discomfort, while a fade or a colour change does not.

```tsx
// with reduced motion active this lands at its new position immediately,
// but still fades in over 0.4s
<MotionConfig reducedMotion="user">
  <Motion.div
    initial={{opacity: 0, y: 40}}
    animate={{opacity: 1, y: 0}}
    transition={{duration: 0.4}}
  />
</MotionConfig>
```

`reducedMotion` also works on a single element.

## Transition options

`transition` controls how a target is animated.

```tsx
<Motion
  animate={{rotate: 90, backgroundColor: "yellow"}}
  transition={{duration: 1, easing: "ease-in-out"}}
/>
```

Options apply to every value by default. Override one value by name. Anything the override leaves out is inherited from the base.

```tsx
<Motion
  animate={{rotate: 90, backgroundColor: "yellow"}}
  transition={{
    duration: 1,
    rotate: {duration: 2},
  }}
/>
```

`transition` also accepts spring options (`{type: "spring", stiffness, damping, mass}`), `delay`, and `repeat`/`repeatType`. Anything Motion's own [`animate()`](https://motion.dev/) accepts works here.

For reactive animations, put signals inside the target object. `animate` does not accept an accessor function.

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

## Keyframes

An array defines a series of keyframes.

```tsx
<Motion animate={{x: [0, 100, 50]}} />
```

Keyframes are spaced evenly across `duration`. Pass progress values from `0` to `1` in `offset` to change that.

```tsx
<Motion
  animate={{x: [0, 100, 50]}}
  transition={{duration: 2, x: {offset: [0, 0.25, 1]}}}
/>
```

## Variants

Define a `variants` map and reference entries by name. This reuses the same named states across `initial`, `animate`, `exit`, `hover`, `press` and `inView`.

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

A nested `Motion` with no `initial` inherits the key from its closest ancestor that has one, then resolves that key against its own `variants`. A parent can set `initial="hidden"` once and let each descendant decide what "hidden" means.

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

Only `initial` is inherited. Set `animate`, `exit`, `hover`, `press` and `inView` on each element that needs them.

## Gestures: hover, press and focus

`hover`, `press` and `focus` animate an element on interaction, with no event handlers of your own.

```tsx
<Motion.div
  hover={{scale: 1.1}}
  press={{scale: 0.95}}
  transition={{duration: 0.15}}
/>
```

Overlapping properties layer in the order `animate`, `inView`, `focus`, `hover`, `press`. This is the same order Motion uses. Pressing while hovering applies `press`, and releasing falls back to `hover`.

`focus` only fires for visible focus, because it is gated on `:focus-visible`. Clicking a button does not trigger it. Tabbing to it does.

```tsx
<Motion.button focus={{scale: 1.05}} press={{scale: 0.95}} />
```

None of these need an `animate` alongside them. When a gesture ends, each property it introduced animates back to a resting value. That value comes from `animate` or `initial` if either defines it, and is otherwise read off the element.

## Scroll-triggered animations

`inView` animates an element when it scrolls into the viewport, and back out again. It uses an `IntersectionObserver`.

```tsx
<Motion.div
  initial={{opacity: 0}}
  inView={{opacity: 1}}
  inViewOptions={{amount: 0.5}}
/>
```

`inViewOptions` accepts:

| Option   | Type                          | Description                                                                               |
| -------- | ----------------------------- | ----------------------------------------------------------------------------------------- |
| `root`   | `Element \| Document`         | The scrolling container to observe within. Defaults to the viewport.                      |
| `margin` | string                        | A CSS margin string such as `"-100px"`, which grows or shrinks the root's bounding box.   |
| `amount` | `"some"` \| `"all"` \| number | How much of the element must be visible. A fraction from `0` to `1`, or `"some"`/`"all"`. |

## Event handlers

Every `Motion` component accepts these optional handlers.

| Handler                                | Fires when                                                                 | `event.detail`                                         |
| -------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------ |
| `onMotionStart`                        | An animation begins, from any of `animate`/`exit`/`hover`/`press`/`inView` | `{target}`, the resolved target being animated to      |
| `onMotionComplete`                     | That animation finishes                                                    | `{target}`                                             |
| `onHoverStart` / `onHoverEnd`          | Pointer enters or leaves the element                                       | `{originalEvent}`, a `PointerEvent`                    |
| `onPressStart` / `onPressEnd`          | Pointer is pressed or released on the element                              | `{originalEvent}`                                      |
| `onFocusStart` / `onFocusEnd`          | Element gains or loses visible focus                                       | `{originalEvent}`, a `FocusEvent`                      |
| `onDragStart` / `onDrag` / `onDragEnd` | A drag begins, moves or ends                                               | `{originalEvent, offset}`, with the `{x, y}` travelled |
| `onViewEnter` / `onViewLeave`          | Element enters or leaves the viewport                                      | `{originalEntry}`, an `IntersectionObserverEntry`      |

`onMotionStart` and `onMotionComplete` fire only when an animation actually runs. A target with no animatable values reports neither. That covers a `variants` key with no match, and a target carrying nothing but a `transition`.

```tsx
<Motion.div
  animate={{opacity: 1}}
  onMotionComplete={({detail}) => console.log("animated to", detail.target)}
/>
```

## Drag

`drag` makes an element draggable by writing to its `x` and `y` motion values.

```tsx
<Motion.div drag />
<Motion.div drag="x" />
```

| Prop              | Type                             | Default | Description                                                                  |
| ----------------- | -------------------------------- | ------- | ---------------------------------------------------------------------------- |
| `drag`            | boolean \| `"x"` \| `"y"`        | `false` | Enables dragging, optionally on one axis.                                    |
| `dragging`        | target \| string                 | none    | The style to animate to while a drag is in progress.                         |
| `dragConstraints` | `{top?, left?, right?, bottom?}` | none    | Bounds in pixels, relative to where the element started.                     |
| `dragElastic`     | boolean \| number                | `0.5`   | How far past a bound the element follows the pointer. `0` pins it.           |
| `dragMomentum`    | boolean                          | `true`  | Whether releasing carries the element on with the velocity it was thrown at. |
| `dragTransition`  | object                           | none    | Overrides the inertia settings applied on release.                           |

```tsx
<Motion.div
  drag="x"
  dragConstraints={{left: 0, right: 300}}
  dragElastic={0.2}
  dragging={{scale: 1.05}}
/>
```

A press that moves only a few pixels stays a press, so a button inside a draggable still clicks. Only one element drags at a time, so a draggable inside another does not move both.

## Layout animation

`layout` animates an element to its new position whenever layout moves it, such as a list reordering or a container resizing.

```tsx
<For each={items()}>{item => <Motion.li layout>{item.label}</Motion.li>}</For>
```

It uses [FLIP](https://aerotwist.com/blog/flip-your-animations/). The element is already at its new position, held back by a transform that animates away. `layoutTransition` overrides the transition, which is a spring by default.

Position only. A change in size is not animated, because that would scale the element and stretch its text and children. This matches Motion's `layout="position"`.

Layout offsets use the `translateX` and `translateY` slots, so they compose with an `x` or `y` you animate yourself.

## Motion values

Every animated property is held in a `MotionValue`. That is what lets properties animate independently, so retargeting `x` mid-flight leaves a running `opacity` animation alone. You can create and drive values yourself.

A `MotionValue` is not a signal. Writing to one schedules no render, and reading one subscribes to nothing. Motion writes it to the DOM on its own frame loop, so a value driven at 60fps does not re-run every computation that touched it.

Bind one through `style`.

```tsx
import {Motion, createMotionValue} from "solid-motion"

function Example() {
  const x = createMotionValue(0)
  return <Motion.div style={{x}} onClick={() => x.set(100)} />
}
```

`style` also accepts transform shorthands such as `x`, `y`, `scale` and `rotate`, alongside ordinary CSS.

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

Derived values recompute on Motion's frame loop, so a burst of updates in one frame costs one recomputation. Each is disposed with the owner that created it, so call these inside a component.

Animating a property that has a value bound to it retargets that value rather than shadowing it, so `x.get()` stays accurate while an `animate` prop drives it.

`createMotion` has no `style` prop, so pass values through `values` instead.

```tsx
createMotion(el, () => ({values: {x}, animate: {opacity: 1}}))
```

## Custom components

`Motion.create` wraps your own component so it accepts the animation props, the way `Motion.div` does for a plain element.

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

The wrapped component must do two things:

- Forward its `ref` to a real DOM element. That element is what gets animated.
- Apply the `style` it is handed, which carries the resolved `initial` styles.

The animation props are consumed by `Motion` and are not passed on. Pass `{forwardMotionProps: true}` if the wrapped component wants them too.

```tsx
const MotionCard = Motion.create(Card, {forwardMotionProps: true})
```

SVG geometry in `initial`, such as `height` and `cx`, is not resolved for custom components. There is no tag to inspect, so the start target is built as HTML styles. Use `Motion.rect` and friends for SVG.

## Low-level primitives

Two primitives animate an element without rendering a `Motion` component. Use them for elements you do not otherwise control.

`motion` is a ref factory. Pass its return value to any element's `ref`.

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

The options accessor is reactive, like a `Motion` component's props. Compose it with other refs using Solid's array-ref syntax: `ref={[otherRef, motion(() => ({...}))]}`.

`createMotion` is the imperative form, for when you already have an element.

```tsx
import {createMotion} from "solid-motion"

createMotion(myElement, () => ({animate: {opacity: 1}}))
```

It returns a [`MotionState`](#typescript).

Call both from inside a component or another owned scope. They create their effects there, which ties the animation's lifetime to that scope. On disposal the element is unregistered, its gestures unbound and any running animation cancelled. The same applies to `useScroll`. Called outside an owned scope, Solid warns with `NO_OWNER_EFFECT` or `NO_OWNER_CLEANUP` and nothing cleans them up.

## Scroll-linked animations

`inView` animates to a target once an element crosses into view. `useScroll` instead gives a continuously updating scroll progress value, for driving your own animations.

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

| Value                 | Type                                                                                                         | Description                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| `time`                | `Accessor<number>`                                                                                           | The current scroll-tracking timestamp.                 |
| `scrollX` / `scrollY` | `Accessor<{current, offset, progress, scrollLength, velocity, targetOffset, targetLength, containerLength}>` | Per-axis scroll info. `progress` runs from `0` to `1`. |

`options` accepts `container` or `target` to track a scrollable element instead of the page, plus `axis` and `offset`. Everything is passed straight through to Motion's [`scroll`](https://motion.dev/docs/scroll).

## TypeScript

These types are exported for typing your own components and helpers.

- `Options` is the full prop shape accepted by `Motion`, `motion` and `createMotion`, minus `tag`.
- `Target` is a single style target object, what `animate` and `initial` accept directly.
- `VariantDefinition` is `Target | string`, what each animation prop accepts.
- `MotionEvent`, `CustomPointerEvent` and `ViewEvent` are the `CustomEvent` subtypes passed to the [event handlers](#event-handlers).
- `ViewportOptions` is the shape of `inViewOptions`.
- `MotionComponentProps` is the full props type for `Motion`, including children and event handlers.
- `ReducedMotion` is `"never" | "user" | "always"`.
- `MotionConfigState` is the value carried by `MotionConfigContext`.
- `MotionComponentOptions` and `AnimatableProps` are the options `Motion.create` accepts, and the props a wrapped component must accept.
- `DragAxis` and `DragConstraints` are the `drag` and `dragConstraints` prop types.
- `CustomDragEvent` and `CustomFocusEvent` are the event types passed to the drag and focus handlers.
- `MotionValue` is re-exported from Motion. It is what `createMotionValue` and friends return.
- `MotionStyle` is the `style` prop's type, widened to accept `MotionValue`s and transform shorthands.
- `MotionState` is what `createMotion` returns. `getTarget()` and `getOptions()` read the start target and current options. The rest is driven by this library.
- `PresenceContextState` is the value carried by `PresenceContext`, and the type of `createMotion`'s optional third argument.
- `PresenceExitRegistry` is how an exiting element hands itself to its enclosing `Presence`, reachable through `PresenceContextState["exits"]`.

`PresenceContext` is exported too, for reading the enclosing `Presence` from your own component. Solid 2's `useContext` throws when there is no provider, so guard the read if the component can render outside a `Presence`.

## Examples

Every feature above has a live example in the playground.

```bash
pnpm install
pnpm run dev
```

That serves an index of every demo. Each one is also reachable at `?demo=<id>`. The playground is the app the Playwright suite drives, so the tests keep the demos working.

The same examples are also available as stories.

```bash
pnpm run storybook
```

## Testing

```bash
pnpm test             # Vitest, in jsdom and in SSR
pnpm run test:coverage
pnpm run test:e2e     # Playwright, across Chromium, Firefox and WebKit
```

Vitest covers the engine's logic. Playwright covers what jsdom cannot reach:

- Real animation interpolation through the Web Animations API.
- Real `IntersectionObserver` for `inView`.
- Real pointer input for `hover` and `press`.
- Real scrolling for `useScroll`.

Install the browsers once.

```bash
pnpm exec playwright install chromium firefox webkit
```

The e2e suite serves the playground on port 5173. Vite's default is the same port, so it is often taken. Set `PLAYWRIGHT_PORT` to something free, otherwise Playwright reuses whatever is already listening and every test times out.

```bash
PLAYWRIGHT_PORT=5199 pnpm run test:e2e
```
