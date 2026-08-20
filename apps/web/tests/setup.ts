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

// Polyfill scrollIntoView
if (globalThis.HTMLElement && !globalThis.HTMLElement.prototype.scrollIntoView) {
  globalThis.HTMLElement.prototype.scrollIntoView = () => {};
}

// Mock navigator.clipboard
Object.defineProperty(globalThis.navigator, 'clipboard', {
  value: {
    writeText: async (_text: string) => Promise.resolve(),
    readText: async () => Promise.resolve(''),
  },
  writable: true,
});

// Mock localStorage
const storageStore = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storageStore.get(key) ?? null,
  setItem: (key: string, value: string) => storageStore.set(key, String(value)),
  removeItem: (key: string) => storageStore.delete(key),
  clear: () => storageStore.clear(),
  get length() {
    return storageStore.size;
  },
  key: (index: number) => Array.from(storageStore.keys())[index] ?? null,
};
Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});
Object.defineProperty(globalThis.window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});
