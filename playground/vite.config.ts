import {defineConfig} from "vite"
import solid from "@solidjs/vite-plugin"
import {fileURLToPath} from "node:url"

/*
The playground is the app the Playwright suite drives. It replaces the old
Storybook setup: every demo is a plain route, so a test can navigate straight
to `?demo=<id>` instead of going through a story runner.
*/
export default defineConfig({
	root: fileURLToPath(new URL(".", import.meta.url)),
	plugins: [solid()],
	server: {port: 5173},
	preview: {port: 5173},
})
