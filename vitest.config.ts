import {defineConfig} from "vitest/config"
import solid from "@solidjs/vite-plugin"
import {playwright} from "@vitest/browser-playwright"

/*
Two projects, because the library has two compilation targets and the Solid
JSX transform has to be configured differently for each.

- `client` compiles the DOM transform and runs in a real Chromium.
- `ssr` compiles the string-rendering transform and runs in plain node.

The client project used to run in jsdom, which implements neither the Web
Animations API that Motion drives its animations with nor
IntersectionObserver. Both had to be stubbed, so `inView` had no unit test at
all and animated values were never really interpolated. A real browser needs
no stubs, runs in about the same time, and reaches the same coverage.

Only Chromium is used here. The Playwright suite in `e2e/` is what covers
Firefox and WebKit, at the level where engine differences actually matter.
*/
export default defineConfig({
	test: {
		projects: [
			{
				plugins: [solid()],
				test: {
					name: "client",
					include: ["test/**/*.test.{ts,tsx}"],
					exclude: ["test/ssr.test.tsx"],
					globals: true,
					browser: {
						enabled: true,
						headless: true,
						provider: playwright(),
						instances: [{browser: "chromium"}],
					},
				},
			},
			{
				plugins: [solid({solid: {generate: "ssr", hydratable: true}, ssr: true})],
				resolve: {
					conditions: ["node"],
				},
				test: {
					name: "ssr",
					environment: "node",
					include: ["test/ssr.test.tsx"],
					globals: true,
				},
			},
		],
		coverage: {
			provider: "v8",
			include: ["src/**/*.{ts,tsx}"],
			reporter: ["text", "html", "lcov"],
			/*
			`src/index.tsx` is a re-export barrel with no logic of its own, and
			`src/types.ts` is types plus a module augmentation.
			*/
			exclude: ["src/index.tsx", "src/types.ts"],
			thresholds: {
				statements: 96,
				branches: 92,
				functions: 96,
				lines: 97,
			},
		},
	},
})
