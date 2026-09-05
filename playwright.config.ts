import {defineConfig, devices} from "@playwright/test"

const PORT = 5173
const BASE_URL = `http://localhost:${PORT}`

/*
The Playwright suite covers what jsdom cannot: real animation interpolation
through the Web Animations API, real IntersectionObserver for `inView`, real
pointer input for `hover`/`press`, and real scrolling for `useScroll`. The
Vitest suite covers the state machine itself.

Tests run against the playground app in `playground/`, which exposes one demo
per `?demo=<id>` route.
*/
export default defineConfig({
	testDir: "./e2e",
	fullyParallel: true,
	forbidOnly: !!process.env["CI"],
	retries: process.env["CI"] ? 2 : 0,
	workers: process.env["CI"] ? 1 : undefined,
	reporter: process.env["CI"] ? "github" : "list",
	use: {
		baseURL: BASE_URL,
		trace: "on-first-retry",
	},
	projects: [
		{name: "chromium", use: {...devices["Desktop Chrome"]}},
		{name: "firefox", use: {...devices["Desktop Firefox"]}},
		{name: "webkit", use: {...devices["Desktop Safari"]}},
	],
	webServer: {
		command: `pnpm run dev --port ${PORT}`,
		url: BASE_URL,
		reuseExistingServer: !process.env["CI"],
		stdout: "ignore",
		stderr: "pipe",
	},
})
