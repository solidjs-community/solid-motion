import {expect, test} from "@playwright/test"
import {opacity, openDemo, settled} from "./helpers.js"

test.describe("Presence", () => {
	test("an element animates out before it is removed", async ({page}) => {
		await openDemo(page, "presence-basic")

		const box = page.getByTestId("box")
		await expect(box).toBeVisible()

		await page.getByTestId("toggle").click()
		// still in the DOM while the exit animation runs
		await expect(box).toBeAttached()
		expect(await opacity(box)).toBeLessThan(1)

		await expect(box).toHaveCount(0)
	})

	/*
	`exit="missing"` resolves to no values at all. The element still has to be
	removed: the exit has to report itself finished even when there is nothing
	to animate, or Presence waits forever.
	*/
	test("an exit that resolves to no values still removes the element", async ({page}) => {
		await openDemo(page, "presence-empty-exit")

		await expect(page.getByTestId("box")).toBeVisible()
		await page.getByTestId("toggle").click()
		await expect(page.getByTestId("box")).toHaveCount(0)
	})

	test("exitBeforeEnter holds the incoming element until the outgoing one leaves", async ({
		page,
	}) => {
		await openDemo(page, "presence-exit-before-enter")

		await expect(page.getByTestId("box-a")).toBeVisible()

		await page.getByTestId("toggle").click()
		// b must not appear while a is still exiting
		await expect(page.getByTestId("box-a")).toBeAttached()
		await expect(page.getByTestId("box-b")).toHaveCount(0)

		await expect(page.getByTestId("box-a")).toHaveCount(0)
		await expect(page.getByTestId("box-b")).toBeVisible()

		// and back again
		await page.getByTestId("toggle").click()
		await expect(page.getByTestId("box-b")).toHaveCount(0)
		await expect(page.getByTestId("box-a")).toBeVisible()
	})

	/*
	In the default parallel mode the incoming element is torn down and
	remounted while the outgoing one exits. If its exit flag survives that
	remount it stays pinned to the exit target and ignores every later update.
	*/
	test("an element that entered during an exit still animates afterwards", async ({page}) => {
		await openDemo(page, "presence-parallel-swap")

		expect(Number(await settled(page.getByTestId("box-1")))).toBeCloseTo(0.5, 1)

		await page.getByTestId("swap").click()
		const second = page.getByTestId("box-2")
		await expect(second).toBeVisible()
		await expect(page.getByTestId("box-1")).toHaveCount(0)
		expect(Number(await settled(second))).toBeCloseTo(0.5, 1)

		await page.getByTestId("fade").click()
		expect(Number(await settled(second))).toBeCloseTo(0.9, 1)
	})

	test("every nested descendant runs its own exit before the subtree goes", async ({page}) => {
		await openDemo(page, "presence-nested-exit")

		await expect(page.getByTestId("parent")).toBeVisible()
		await expect(page.getByTestId("child")).toBeVisible()

		await page.getByTestId("toggle").click()
		// both are still attached and both are fading
		await expect(page.getByTestId("parent")).toBeAttached()
		await expect.poll(() => opacity(page.getByTestId("child"))).toBeLessThan(1)
		await expect.poll(() => opacity(page.getByTestId("parent"))).toBeLessThan(1)

		await expect(page.getByTestId("parent")).toHaveCount(0)
		await expect(page.getByTestId("child")).toHaveCount(0)
	})

	test("initial={false} suppresses only the first render's children", async ({page}) => {
		await openDemo(page, "presence-initial-false")

		// present on the first render: jumps straight to animate despite a 5s transition
		expect(await opacity(page.getByTestId("first"))).toBeCloseTo(1, 1)

		await page.getByTestId("toggle").click()
		// added later: animates in normally, so it starts from its initial
		expect(await opacity(page.getByTestId("late"))).toBeLessThan(0.5)
	})
})
