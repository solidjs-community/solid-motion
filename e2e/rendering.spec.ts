import {expect, test} from "@playwright/test"
import {computed, openDemo, settled} from "./helpers.js"

test.describe("rendering", () => {
	test("the proxy and the tag prop both pick the rendered element", async ({page}) => {
		await openDemo(page, "proxy-tags")

		await expect(page.getByTestId("span")).toHaveJSProperty("tagName", "SPAN")
		await expect(page.getByTestId("button")).toHaveJSProperty("tagName", "BUTTON")
		await expect(page.getByTestId("li")).toHaveJSProperty("tagName", "LI")
		await expect(page.getByTestId("default")).toHaveJSProperty("tagName", "DIV")
	})

	test("svg elements render and keep their attributes", async ({page}) => {
		await openDemo(page, "proxy-tags")

		const circle = page.getByTestId("circle")
		await expect(circle).toHaveAttribute("r", "28")
		await expect(circle).toHaveAttribute("fill", "darkorange")
	})

	/*
	Known bug, kept as a failing expectation so it reports as soon as it is
	fixed: `createStyles` builds the `initial` target with motion-dom's
	`buildHTMLStyles` and applies it as an inline style, but Motion animates
	SVG geometry via attributes. The inline `height: 20px` therefore outranks
	the animated `height` attribute in the cascade and the rect never moves.
	Fixing it means branching `createStyles` onto `buildSVGAttrs` for SVG
	elements.
	*/
	test.fail("animated svg geometry interpolates", async ({page}) => {
		await openDemo(page, "svg-attrs")

		const rect = page.getByTestId("rect")
		await expect
			.poll(() => rect.evaluate(el => (el as SVGGraphicsElement).getBBox().height))
			.toBeGreaterThan(70)
	})

	test("a user style is merged with the animated one, not replaced", async ({page}) => {
		await openDemo(page, "style-merging")

		for (const id of ["object-style", "string-style"]) {
			const el = page.getByTestId(id)
			// the user's own declarations survive
			expect(await computed(el, "width")).toBe("80px")
			// and the animated value still lands
			expect(Number(await settled(el))).toBeCloseTo(1, 1)
		}
	})
})
