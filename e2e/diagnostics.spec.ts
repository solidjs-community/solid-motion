import {expect, test} from "@playwright/test"

/*
Solid 2 reports reactivity mistakes as dev-mode console diagnostics rather than
as failures — an unowned effect, a flush that is a silent no-op, a top-level
prop read that will never update. None of those surface as an assertion
failure, so this walks every playground demo in a real dev build and fails on
any of them.

The demo list is scraped from the playground's own index page rather than
hard-coded, so a demo added later is covered without touching this file.
*/
test("no reactivity diagnostics in any demo", async ({page}) => {
	// one test that walks every demo and drives each one, so it needs more than
	// a single test's budget — though not by much once it stays out of the
	// demos it has no business dragging
	test.setTimeout(60_000)

	let current = "index"
	const diagnostics: string[] = []

	page.on("console", message => {
		const text = message.text()
		// diagnostics are prefixed with a SCREAMING_SNAKE code in brackets
		if (!/^\[[A-Z_]+]/.test(text) || text.includes("repair guide")) return
		diagnostics.push(`${current} — ${text}`)
	})

	await page.goto("/")
	const demos = await page
		.locator("ul.index a")
		.evaluateAll(links =>
			links.map(link => new URL((link as HTMLAnchorElement).href).searchParams.get("demo")!),
		)
	expect(demos.length).toBeGreaterThan(0)

	for (const demo of demos) {
		current = demo
		await page.goto(`/?demo=${demo}`)
		await expect(page.getByTestId("unknown-demo")).toHaveCount(0)

		// drive whatever controls the demo exposes, so teardown paths run too
		for (const id of [
			"toggle",
			"swap",
			"fade",
			"remove",
			"reorder",
			"move",
			"read",
			"retarget",
		]) {
			const control = page.getByTestId(id)
			if (await control.count()) {
				await control.click()
				await page.waitForTimeout(150)
			}
		}

		/*
		Drag has no button to click, and its whole lifecycle — binding, the
		pointer session, the layer switching on and off — is where a reactive
		mistake would hide. Only the drag demos are driven this way: doing it
		everywhere turns a quick sweep into a multi-minute one for no extra
		coverage.
		*/
		if (demo.startsWith("drag")) {
			const rect = await page.getByTestId("box").boundingBox()
			if (rect) {
				await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2)
				await page.mouse.down()
				await page.mouse.move(rect.x + rect.width / 2 + 40, rect.y + rect.height / 2 + 20, {
					steps: 4,
				})
				await page.mouse.up()
				await page.waitForTimeout(150)
			}
		}
	}

	expect(diagnostics).toEqual([])
})
