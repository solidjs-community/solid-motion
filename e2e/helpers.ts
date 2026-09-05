import {expect, type Locator, type Page} from "@playwright/test"

/** Navigates to one playground demo. */
export async function openDemo(page: Page, id: string): Promise<void> {
	await page.goto(`/?demo=${id}`)
	await expect(page.getByTestId("unknown-demo")).toHaveCount(0)
}

/**
 * Reads a resolved style value off an element. Unlike the inline `style`
 * attribute the unit tests assert on, this is what the browser actually
 * computed, so it reflects a running animation.
 */
export function computed(locator: Locator, property: string): Promise<string> {
	return locator.evaluate((el, prop) => getComputedStyle(el).getPropertyValue(prop), property)
}

/** Resolved opacity as a number, for range assertions during an animation. */
export async function opacity(locator: Locator): Promise<number> {
	return Number(await computed(locator, "opacity"))
}

/**
 * Waits until an element's computed property stops changing, i.e. its
 * animation has settled. Avoids sleeping for a fixed duration, which is
 * flaky across the three browser engines.
 */
export async function settled(locator: Locator, property = "opacity"): Promise<string> {
	let previous = await computed(locator, property)
	for (let i = 0; i < 60; i++) {
		await locator.page().waitForTimeout(50)
		const next = await computed(locator, property)
		if (next === previous) return next
		previous = next
	}
	throw new Error(`"${property}" never settled (last value ${previous})`)
}

/** The horizontal translation of an element's computed transform, in pixels. */
export async function translateX(locator: Locator): Promise<number> {
	const transform = await computed(locator, "transform")
	if (transform === "none") return 0
	const values = transform.match(/matrix\(([^)]+)\)/)?.[1]?.split(",")
	return Number(values?.[4] ?? 0)
}
