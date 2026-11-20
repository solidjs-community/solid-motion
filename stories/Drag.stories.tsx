import type {Meta, StoryObj} from "storybook-solidjs-vite"
import {Motion} from "../src/index.jsx"
import {box} from "./shared.js"

const meta = {
	title: "Motion/Drag",
} satisfies Meta

export default meta
type Story = StoryObj

/** Free dragging on both axes, with a `dragging` layer while the pointer is down. */
export const Free: Story = {
	render: () => <Motion.div style={box} drag dragging={{opacity: 0.5}} dragMomentum={false} />,
}

/** Constrained to one axis and a pixel range, with elastic resistance past the bound. */
export const Constrained: StoryObj<{elastic: number}> = {
	args: {elastic: 0.4},
	argTypes: {
		elastic: {control: {type: "range", min: 0, max: 1, step: 0.05}},
	},
	render: args => (
		<Motion.div
			style={box}
			drag="x"
			dragConstraints={{left: 0, right: 240}}
			dragElastic={args.elastic}
			dragMomentum={false}
		/>
	),
}

/** With momentum left on, releasing with velocity carries the element onward. */
export const Momentum: Story = {
	render: () => <Motion.div style={box} drag="x" dragConstraints={{left: 0, right: 240}} />,
}
