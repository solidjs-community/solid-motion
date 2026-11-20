import type {Meta, StoryObj} from "storybook-solidjs-vite"
import {createSignal} from "solid-js"
import {Motion} from "../src/index.jsx"
import {box, row} from "./shared.js"

const meta = {
	title: "Motion/Variants",
} satisfies Meta

export default meta
type Story = StoryObj

/** `initial` and `animate` as named keys into a `variants` map. */
export const Named: Story = {
	render: () => (
		<Motion.div
			style={box}
			initial="hidden"
			animate="visible"
			variants={{
				hidden: {opacity: 0, scale: 0.5},
				visible: {opacity: 1, scale: 1, transition: {duration: 0.4}},
			}}
		/>
	),
}

/** A descendant with no key of its own inherits the ancestor's active variant. */
export const Inheritance: Story = {
	render: () => (
		<Motion.div
			initial="hidden"
			animate="visible"
			variants={{hidden: {opacity: 0}, visible: {opacity: 1, transition: {duration: 0.3}}}}
			style={row}
		>
			<Motion.div
				style={box}
				variants={{hidden: {x: 60}, visible: {x: 0, transition: {duration: 0.8}}}}
			/>
			<Motion.div
				style={box}
				variants={{hidden: {y: 60}, visible: {y: 0, transition: {duration: 0.8}}}}
			/>
		</Motion.div>
	),
}

/** Swapping the map under an unchanged `animate` key re-animates to the new values. */
export const Reactive: Story = {
	render: () => {
		const [variants, setVariants] = createSignal({on: {opacity: 0.3}})
		return (
			<div>
				<button onClick={() => setVariants({on: {opacity: 0.9}})}>Swap variants</button>
				<Motion.div
					style={box}
					variants={variants()}
					animate="on"
					transition={{duration: 0.3}}
				/>
			</div>
		)
	},
}
