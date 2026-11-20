import type {Meta, StoryObj} from "storybook-solidjs-vite"
import {createSignal} from "solid-js"
import {Motion} from "../src/index.jsx"
import {box, row} from "./shared.js"

const meta = {
	title: "Motion/Animate",
} satisfies Meta

export default meta
type Story = StoryObj

/** The base case: `initial` is the first painted frame, `animate` is the target. */
export const Enter: Story = {
	render: () => (
		<Motion.div
			style={box}
			initial={{opacity: 0, scale: 0.6}}
			animate={{opacity: 1, scale: 1}}
			transition={{duration: 0.5}}
		/>
	),
}

/** `initial={false}` skips the enter animation and paints `animate` directly. */
export const InitialFalse: Story = {
	render: () => (
		<div style={row}>
			<Motion.div
				style={box}
				initial={{opacity: 0}}
				animate={{opacity: 1}}
				transition={{duration: 1}}
			/>
			<Motion.div
				style={box}
				initial={false}
				animate={{opacity: 1}}
				transition={{duration: 1}}
			/>
		</div>
	),
}

/** Changing `animate` retargets a running animation from wherever it currently is. */
export const Retarget: Story = {
	render: () => {
		const [on, setOn] = createSignal(false)
		return (
			<div>
				<button onClick={() => setOn(v => !v)}>Toggle</button>
				<Motion.div style={box} animate={{x: on() ? 200 : 0}} transition={{duration: 1}} />
			</div>
		)
	},
}

/** An array value is played as keyframes rather than as a single from/to pair. */
export const Keyframes: Story = {
	render: () => (
		<Motion.div
			style={box}
			animate={{x: [0, 160, 0], backgroundColor: ["royalblue", "seagreen", "royalblue"]}}
			transition={{duration: 2}}
		/>
	),
}

/*
Tunable from the controls panel, which is the thing the playground cannot do:
`duration` and `scale` are live args, so the same animation can be felt at a
range of settings without editing a file.
*/
export const Tunable: StoryObj<{duration: number; scale: number; bounce: number}> = {
	args: {duration: 0.6, scale: 1.6, bounce: 0.25},
	argTypes: {
		duration: {control: {type: "range", min: 0.05, max: 3, step: 0.05}},
		scale: {control: {type: "range", min: 0.2, max: 3, step: 0.1}},
		bounce: {control: {type: "range", min: 0, max: 1, step: 0.05}},
	},
	render: args => {
		const [on, setOn] = createSignal(false)
		return (
			<div>
				<button onClick={() => setOn(v => !v)}>Toggle</button>
				<Motion.div
					style={box}
					animate={{scale: on() ? args.scale : 1}}
					transition={{type: "spring", duration: args.duration, bounce: args.bounce}}
				/>
			</div>
		)
	},
}
