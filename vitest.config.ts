import {defineConfig} from "vitest/config"
import solid from "@solidjs/vite-plugin"

/*
Two projects, because the library has two compilation targets and the Solid
JSX transform has to be configured differently for each:

- `client` compiles the DOM transform and runs in jsdom.
- `ssr` compiles the string-rendering transform and runs in plain node, so
  the server build is never loaded alongside jsdom.

The old jest setup did this with two babel transformers and an `SSR=true`
environment variable that selected between two config objects. Vitest runs
both in one pass instead, so `pnpm test` covers client and server together.
*/
export default defineConfig({
	test: {
		projects: [
			{
				plugins: [solid()],
				resolve: {
					/*
					Picks the "browser" exports condition so @solidjs/web resolves
					its DOM build rather than the server one.
					*/
					conditions: ["browser", "development"],
				},
				test: {
					name: "client",
					environment: "jsdom",
					include: ["test/**/*.test.{ts,tsx}"],
					exclude: ["test/ssr.test.tsx"],
					setupFiles: ["test/setup.ts"],
					globals: true,
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
				statements: 95,
				branches: 92,
				functions: 92,
				lines: 95,
			},
		},
	},
})
