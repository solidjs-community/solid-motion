import {expect, test} from "@playwright/test"
import {computed, opacity, openDemo, settled, translateX} from "./helpers.js"

test.describe("animate", () => {
	test("animates from initial to the animate target", async ({page}) => {
		await openDemo(page, "basic-enter")

		const box = page.getByTestId("box")
		// starts at the initial target rather than jumping to animate
		expect(await opacity(box)).toBeLessThan(1)
		expect(Number(await settled(box))).toBeCloseTo(1, 1)
	})

	test("initial={false} applies the animate target with no transition", async ({page}) => {
		await openDemo(page, "initial-false")

		// the demo's transition is 5s, so anything but an instant apply is visible
		const box = page.getByTestId("box")
		expect(await opacity(box)).toBeCloseTo(0.4, 1)
		expect(await computed(box, "transform")).toContain("100")
	})

	test("no animation runs when initial already equals animate", async ({page}) => {
		await openDemo(page, "no-op-when-equal")

		await page.waitForTimeout(300)
		await expect(page.getByTestId("starts")).toHaveText("0")
		expect(await opacity(page.getByTestId("box"))).toBeCloseTo(0.6, 1)
	})

	test("a reactive animate target re-triggers the animation", async ({page}) => {
		await openDemo(page, "reactive-animate")

		const box = page.getByTestId("box")
		expect(Number(await settled(box))).toBeCloseTo(0.25, 1)

		await page.getByTestId("toggle").click()
		expect(Number(await settled(box))).toBeCloseTo(1, 1)

		await page.getByTestId("toggle").click()
		expect(Number(await settled(box))).toBeCloseTo(0.25, 1)
	})
})

test.describe("transitions", () => {
	test("Motion One's `easing` spelling is accepted", async ({page}) => {
		await openDemo(page, "legacy-easing")

		// an unrecognised easing would throw or snap; this should interpolate
		const box = page.getByTestId("box")
		expect(Number(await settled(box))).toBeCloseTo(1, 1)
	})

	/*
	The per-value override sets only `duration`, so it has to inherit the rest
	of the base transition. `x` runs 1.5s against the base 0.2s, so opacity
	must finish well before x does.
	*/
	test("a per-value override inherits the base transition", async ({page}) => {
		await openDemo(page, "per-value-override")

		const box = page.getByTestId("box")
		await expect.poll(() => opacity(box)).toBeGreaterThan(0.95)

		const x = await computed(box, "transform")
		expect(x).not.toContain("120")

		await expect.poll(() => computed(box, "transform"), {timeout: 4000}).toContain("120")
	})

	test("a target's own transition overrides the component transition", async ({page}) => {
		await openDemo(page, "per-target-override")

		// base duration is 0.05s, the target's own is 1.5s: still mid-flight here
		await page.waitForTimeout(300)
		expect(await opacity(page.getByTestId("box"))).toBeLessThan(0.95)
		expect(Number(await settled(page.getByTestId("box")))).toBeCloseTo(1, 1)
	})

	test("keyframe arrays step through every value", async ({page}) => {
		await openDemo(page, "keyframes")

		const box = page.getByTestId("box")
		const seen = new Set<string>()
		for (let i = 0; i < 25; i++) {
			seen.add(await computed(box, "transform"))
			await page.waitForTimeout(20)
		}
		// a single jump to the end would give one or two distinct values
		expect(seen.size).toBeGreaterThan(3)
		await expect.poll(() => computed(box, "transform")).toContain("40")
	})
})

test.describe("variants", () => {
	test("string keys resolve against the variants map", async ({page}) => {
		await openDemo(page, "variants")

		expect(Number(await settled(page.getByTestId("box")))).toBeCloseTo(1, 1)
	})

	test("a descendant inherits the ancestor's initial variant key", async ({page}) => {
		await openDemo(page, "variant-inheritance")

		/*
		The child sets no `initial` of its own, so it inherits the key "hidden"
		from its parent and resolves it against its own variants map, starting
		translated by 60px rather than at rest.
		*/
		const child = page.getByTestId("child")
		expect(await translateX(child)).toBeGreaterThan(40)

		await settled(child, "transform")
		expect(await translateX(child)).toBeCloseTo(0, 1)
	})

	test("swapping the variants map re-animates an unchanged key", async ({page}) => {
		await openDemo(page, "reactive-variants")

		const box = page.getByTestId("box")
		expect(Number(await settled(box))).toBeCloseTo(0.3, 1)

		await page.getByTestId("swap").click()
		expect(Number(await settled(box))).toBeCloseTo(0.9, 1)
	})
})
