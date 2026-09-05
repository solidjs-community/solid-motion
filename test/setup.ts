/*
jsdom implements neither IntersectionObserver nor the Web Animations API that
Motion drives its animations with. These are minimal stubs so the unit tests
can exercise the library's own state machine.

`inView` behavior and real animation interpolation are covered by the
Playwright suite in `e2e/`, which runs against a real browser.
*/

/* eslint-disable @typescript-eslint/no-empty-function -- the stub does nothing by design */
class IntersectionObserverStub implements IntersectionObserver {
	readonly root = null
	readonly rootMargin = ""
	readonly thresholds: readonly number[] = []
	observe(): void {}
	unobserve(): void {}
	disconnect(): void {}
	takeRecords(): IntersectionObserverEntry[] {
		return []
	}
}

if (typeof globalThis.IntersectionObserver === "undefined") {
	globalThis.IntersectionObserver =
		IntersectionObserverStub as unknown as typeof IntersectionObserver
}
