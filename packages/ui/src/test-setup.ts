import '@testing-library/jest-dom';

// jsdom does not implement ResizeObserver — cmdk and several Radix primitives
// (Tabs, Popover, etc.) call it on mount. Polyfill with a no-op implementation
// so the components render in tests.
class ResizeObserverPolyfill {
  observe(): void {
    /* no-op */
  }
  unobserve(): void {
    /* no-op */
  }
  disconnect(): void {
    /* no-op */
  }
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverPolyfill as unknown as typeof ResizeObserver;
}

// jsdom does not implement Element.scrollIntoView — cmdk calls it when items
// mount inside <CommandList>. Polyfill with a no-op so tests can render.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView(): void {
    /* no-op */
  };
}
