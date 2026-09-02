import {render} from "@solidjs/web"
import {Show} from "solid-js"
import type {JSX} from "@solidjs/web"
import {DEMOS} from "./demos.jsx"

/*
No router: the demo is picked from `?demo=<id>` so a Playwright test can
navigate straight to one. Without the parameter this renders an index of
every demo, which doubles as the manual replacement for the Storybook
sidebar when running `pnpm dev`.
*/
function App(): JSX.Element {
	const id = new URLSearchParams(window.location.search).get("demo")
	const Demo = id ? DEMOS[id] : undefined

	return (
		<Show
			when={Demo}
			children={Demo?.()}
			fallback={
				<main>
					<h1>solid-motion playground</h1>
					<Show when={id}>
						<p data-testid="unknown-demo">Unknown demo: {id}</p>
					</Show>
					<ul class="index">
						{Object.keys(DEMOS).map(key => (
							<li>
								<a href={`?demo=${key}`}>{key}</a>
							</li>
						))}
					</ul>
				</main>
			}
		/>
	)
}

render(() => <App />, document.getElementById("root")!)
