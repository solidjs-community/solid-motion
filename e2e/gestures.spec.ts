import {expect, test} from "@playwright/test"
import {opacity, openDemo, settled, translateX} from "./helpers.js"

test.describe("gestures", () => {
	test("hover animates in and back out", async ({page}) => {
		await openDemo(page, "hover")

		const box = page.getByTestId("box")
		await expect(page.getByTestId("hover")).toHaveText("idle")

		await box.hover()
		await expect(page.getByTestId("hover")).toHaveText("active")
		expect(Number(await settled(box))).toBeCloseTo(0.4, 1)

		await page.mouse.move(0, 0)
		await expect(page.getByTestId("hover")).toHaveText("idle")
		expect(Number(await settled(box))).toBeCloseTo(1, 1)
	})

	test("press animates in and back out", async ({page}) => {
		await openDemo(page, "press")

		const box = page.getByTestId("box")
		await box.hover()
		await page.mouse.down()

		await expect(page.getByTestId("press")).toHaveText("active")
		expect(Number(await settled(box))).toBeCloseTo(0.3, 1)

		await page.mouse.up()
		await expect(page.getByTestId("press")).toHaveText("idle")
		expect(Number(await settled(box))).toBeCloseTo(1, 1)
	})

	test("press layers on top of hover and reverts to it on release", async ({page}) => {
		await openDemo(page, "hover-and-press")

		const box = page.getByTestId("box")
		await box.hover()
		await expect(page.getByTestId("hover")).toHaveText("active")
		expect(Number(await settled(box))).toBeCloseTo(0.7, 1)

		await page.mouse.down()
		await expect(page.getByTestId("press")).toHaveText("active")
		// press wins over hover for the shared key
		expect(Number(await settled(box))).toBeCloseTo(0.2, 1)

		await page.mouse.up()
		// still hovering, so it falls back to the hover target rather than base
		await expect(page.getByTestId("press")).toHaveText("idle")
		await expect(page.getByTestId("hover")).toHaveText("active")
		expect(Number(await settled(box))).toBeCloseTo(0.7, 1)
	})

	/*
	Known gap, kept as a failing expectation so it reports as soon as it is
	fixed: with no `animate` prop the target resolved on hover-out is empty,
	and an empty target is a no-op, so the element stays on the hover values
	instead of reverting. Reverting would need the engine to remember the
	pre-gesture base style.
	*/
	test.fail("a gesture with no animate base reverts on leave", async ({page}) => {
		await openDemo(page, "hover-no-base")

		const box = page.getByTestId("box")
		await box.hover()
		expect(Number(await settled(box))).toBeCloseTo(0.4, 1)

		await page.mouse.move(0, 0)
		expect(Number(await settled(box))).toBeCloseTo(1, 1)
	})
})

test.describe("inView", () => {
	test("entering the viewport triggers the inView target", async ({page}) => {
		await openDemo(page, "in-view")

		const box = page.getByTestId("box")
		await expect(page.getByTestId("view")).toHaveText("not yet")

		await box.scrollIntoViewIfNeeded()
		await expect(page.getByTestId("view")).toHaveText("entered")
		expect(Number(await settled(box))).toBeCloseTo(0.2, 1)
	})

	/*
	Motion's `inView` hands its callback `(element, entry)`. Reading the first
	argument as the entry would put the element into `originalEntry`, and this
	assertion would see "undefined" instead of a boolean.
	*/
	test("onViewEnter receives the IntersectionObserverEntry", async ({page}) => {
		await openDemo(page, "in-view")

		await page.getByTestId("box").scrollIntoViewIfNeeded()
		await expect(page.getByTestId("entry")).toHaveText("true")
	})

	test("leaving the viewport reverses the inView target", async ({page}) => {
		await openDemo(page, "in-view")

		const box = page.getByTestId("box")
		await box.scrollIntoViewIfNeeded()
		await expect(page.getByTestId("view")).toHaveText("entered")

		await page.evaluate(() => window.scrollTo(0, 0))
		await expect(page.getByTestId("view")).toHaveText("left")
		expect(Number(await settled(box))).toBeCloseTo(1, 1)
	})

	/*
	inView is a layer under hover, so hovering must not discard its values.
	Before inView had its own active flag, the recompute triggered by the
	hover dropped the inView target entirely.
	*/
	test("hovering does not discard the inView target", async ({page}) => {
		await openDemo(page, "in-view-with-hover")

		const box = page.getByTestId("box")
		await box.scrollIntoViewIfNeeded()
		await settled(box, "transform")
		expect(await translateX(box)).toBeCloseTo(120, 0)

		await box.hover()
		expect(Number(await settled(box))).toBeCloseTo(0.5, 1)
		// the inView translation is still applied underneath the hover
		expect(await translateX(box)).toBeCloseTo(120, 0)
	})

	test("inViewOptions.amount holds the trigger until enough is visible", async ({page}) => {
		await openDemo(page, "in-view-amount")

		// scroll just far enough to reveal the top sliver of the tall box
		await page.evaluate(() => {
			const el = document.querySelector('[data-testid="box"]')!
			window.scrollTo(
				0,
				el.getBoundingClientRect().top + window.scrollY - window.innerHeight + 40,
			)
		})
		await page.waitForTimeout(300)
		await expect(page.getByTestId("view")).toHaveText("not yet")

		await page.getByTestId("box").scrollIntoViewIfNeeded()
		await expect(page.getByTestId("view")).toHaveText("entered")
		await expect.poll(() => opacity(page.getByTestId("box"))).toBeLessThan(1)
	})
})

test.describe("useScroll", () => {
	test("reports scroll progress reactively", async ({page}) => {
		await openDemo(page, "use-scroll")

		await expect(page.getByTestId("progress")).toHaveText("0.00")

		await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
		await expect.poll(() => page.getByTestId("progress").textContent()).toBe("1.00")

		await page.evaluate(() => window.scrollTo(0, 0))
		await expect.poll(() => page.getByTestId("progress").textContent()).toBe("0.00")
	})
})

test.describe("primitives", () => {
	test("the motion ref factory animates a plain element", async ({page}) => {
		await openDemo(page, "ref-factory")

		const box = page.getByTestId("box")
		expect(Number(await settled(box))).toBeCloseTo(1, 1)
		expect(await translateX(box)).toBeCloseTo(0, 1)
	})
})
