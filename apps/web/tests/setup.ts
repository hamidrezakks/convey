import { GlobalWindow } from 'happy-dom';

const window = new GlobalWindow();
globalThis.window = window as unknown as Window & typeof globalThis;
globalThis.document = window.document as unknown as Document;
globalThis.navigator = window.navigator as unknown as Navigator;
globalThis.HTMLElement = window.HTMLElement as unknown as typeof HTMLElement;
globalThis.HTMLButtonElement = window.HTMLButtonElement as unknown as typeof HTMLButtonElement;
globalThis.HTMLInputElement = window.HTMLInputElement as unknown as typeof HTMLInputElement;
globalThis.HTMLSelectElement = window.HTMLSelectElement as unknown as typeof HTMLSelectElement;
globalThis.HTMLTextAreaElement = window.HTMLTextAreaElement as unknown as typeof HTMLTextAreaElement;

// Mock window.matchMedia
Object.defineProperty(globalThis.window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock ResizeObserver
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

// Mock navigator.clipboard
Object.defineProperty(globalThis.navigator, 'clipboard', {
  value: {
    writeText: async (_text: string) => Promise.resolve(),
    readText: async () => Promise.resolve(''),
  },
  writable: true,
});
