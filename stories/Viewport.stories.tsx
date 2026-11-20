import type {Meta, StoryObj} from "storybook-solidjs-vite"
import {Motion, useScroll} from "../src/index.jsx"
import {box} from "./shared.js"

const meta = {
	title: "Motion/Viewport",
} satisfies Meta

export default meta
type Story = StoryObj

const spacer = {height: "600px", display: "grid", "place-items": "center", color: "#888"} as const

/** `inView` applies its target once the element scrolls into the viewport. */
export const InView: Story = {
	render: () => (
		<div>
			<div style={spacer}>scroll down</div>
			<Motion.div
				style={box}
				initial={{opacity: 1}}
				inView={{opacity: 0.2, scale: 1.4}}
				transition={{duration: 0.4}}
			/>
			<div style={spacer} />
		</div>
	),
}

/*
`inViewOptions.amount` sets how much of the element has to be visible before
the target applies — 0.9 means it will not fire until it is nearly all on
screen.
*/
export const InViewAmount: Story = {
	render: () => (
		<div>
			<div style={spacer}>scroll down slowly</div>
			<Motion.div
				style={{...box, height: "300px"}}
				inView={{opacity: 0.2}}
				inViewOptions={{amount: 0.9}}
				transition={{duration: 0.4}}
			/>
			<div style={spacer} />
		</div>
	),
}

/** `useScroll` exposes scroll offset and progress as motion values. */
export const Scroll: Story = {
	render: () => {
		const {scrollY} = useScroll()
		return (
			<div>
				<p style={{position: "sticky", top: "0", background: "white", margin: "0 0 8px"}}>
					progress: {scrollY().progress.toFixed(2)}
				</p>
				<div style={{height: "3000px"}}>scroll</div>
			</div>
		)
	},
}
