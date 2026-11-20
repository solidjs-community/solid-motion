import {renderToString} from "@solidjs/web"
import {Motion, Presence, createMotionValue} from "../src/index.jsx"

describe("ssr", () => {
	test("Renders", () => {
		const html = renderToString(() => <Motion.div />)
		expect(html).toBe('<div _hk=220 style=""></div>')
	})

	test("Renders style", () => {
		const html = renderToString(() => <Motion.div style={{opacity: 1}} />)
		expect(html).toBe(`<div _hk=220 style="opacity:1"></div>`)
	})

	test("Renders initial as style", () => {
		const html = renderToString(() => <Motion.div initial={{scale: 1.2, opacity: 1}} />)
		expect(html).toBe(`<div _hk=220 style=\"opacity:1;transform:scale(1.2)\"></div>`)
	})

	test("Renders initial and style", () => {
		const html1 = renderToString(() => (
			<Motion.div style={{margin: "24px"}} initial={{scale: 1.2, opacity: 1}} />
		))
		expect(html1).toBe(
			`<div _hk=220 style=\"margin:24px;opacity:1;transform:scale(1.2)\"></div>`,
		)

		const html2 = renderToString(() => (
			<Motion.div style={`margin: 24px`} initial={{scale: 1.2, opacity: 1}} />
		))
		expect(html2).toBe(
			`<div _hk=220 style=\"margin:24px;opacity:1;transform:scale(1.2)\"></div>`,
		)
	})

	/*
	SVG geometry renders as an attribute, not as a style. An inline style would
	outrank the attribute Motion animates and pin the element to its `initial`.
	*/
	test("Renders svg with attrs", () => {
		const html = renderToString(() => (
			<Motion.rect initial={{height: 50}} width="50" x="0" y="100" />
		))
		expect(html).toBe(
			`<rect _hk=220 width=\"50\" x=\"0\" y=\"100\" height=\"50px\" style=\"\"></rect>`,
		)
	})

	test("Children render inherited initial", () => {
		const html = renderToString(() => (
			<Motion.div
				initial="hidden"
				variants={{hidden: {opacity: 0, "background-color": "red"}}}
			>
				<Motion.ul variants={{hidden: {y: 100, "background-color": "purple"}}}>
					<Motion.li variants={{hidden: {"background-color": "green"}}} />
				</Motion.ul>
			</Motion.div>
		))
		expect(html).toBe(
			`<div _hk=220 style=\"opacity:0;background-color:red\"><ul _hk=22320 style=\"background-color:purple;transform:translateY(100px)\"><li _hk=2232320 style=\"background-color:green\"></li></ul></div>`,
		)
	})

	test("Renders expected markup from style as keyframes", () => {
		const div = renderToString(() => <Motion.div initial={{opacity: [0, 1]}} />)
		expect(div).toBe(`<div _hk=220 style=\"opacity:0\"></div>`)
	})

	test("Renders expected CSS variables", () => {
		const div = renderToString(() => (
			<Motion.div
				initial={{"--foo": 0, "--bar": 2}}
				style={{"--bar": 1, "--car": 3} as any}
			/>
		))
		expect(div).toBe(`<div _hk=220 style=\"--bar:2;--car:3;--foo:0\"></div>`)
	})

	test("Renders expected transform", () => {
		const div = renderToString(() => <Motion.div initial={{x: 100}} />)
		expect(div).toBe(`<div _hk=220 style=\"transform:translateX(100px)\"></div>`)
	})

	/*
	Every animation prop, not a sample of them: a prop added later that isn't
	stripped would otherwise reach the server-rendered markup as a junk
	attribute, and only a test naming all of them catches that.
	*/
	test("Filters out all props", () => {
		const div = renderToString(() => (
			<Motion.div
				initial={{opacity: 1}}
				animate={{opacity: 1}}
				exit={{opacity: 1}}
				hover={{opacity: 1}}
				press={{opacity: 1}}
				focus={{opacity: 1}}
				inView={{opacity: 1}}
				inViewOptions={{amount: 0.5}}
				drag
				dragging={{opacity: 1}}
				dragConstraints={{left: 0}}
				dragElastic={0.2}
				dragMomentum={false}
				dragTransition={{}}
				layout
				layoutTransition={{duration: 1}}
				reducedMotion="user"
				variants={{}}
				transition={{duration: 1}}
				values={{}}
			/>
		))
		// `initial` is the only one with a rendered consequence
		expect(div).toBe('<div _hk=220 style="opacity:1"></div>')
	})

	test("Leaves a MotionValue out of the server-rendered style", () => {
		const x = createMotionValue(40)
		const div = renderToString(() => <Motion.div style={{x, color: "red"}} />)

		// the value is bound to the element on the client; there is nothing to
		// serialise for it here, and stringifying one would emit junk
		expect(div).toBe('<div _hk=220 style="color:red"></div>')
	})

	test("Renders Presence", () => {
		const html = renderToString(() => (
			<Presence>
				<Motion.div />
			</Presence>
		))
		expect(html).toBe('<div _hk=00220 style=""></div>')
	})

	test("Renders Presence with initial styles", () => {
		const html = renderToString(() => (
			<Presence>
				<Motion.div initial={{opacity: 1}} />
			</Presence>
		))
		expect(html).toBe('<div _hk=00220 style="opacity:1"></div>')
	})

	test("Renders Presence without initial styles", () => {
		const html = renderToString(() => (
			<Presence initial={false}>
				<Motion.div initial={{opacity: 1}} />
			</Presence>
		))
		expect(html).toBe('<div _hk=00220 style=""></div>')
	})
})
