import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  if (typeof window !== "undefined") {
    window.localStorage.clear();
    window.sessionStorage.clear();
  }
});

if (typeof Element !== "undefined") {
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
}

if (typeof window !== "undefined") {
  Object.defineProperty(window, "confirm", {
    configurable: true,
    writable: true,
    value: vi.fn(() => true),
  });
}

Object.defineProperty(URL, "createObjectURL", {
  configurable: true,
  writable: true,
  value: vi.fn(() => "blob:press-here-test-image"),
});

Object.defineProperty(URL, "revokeObjectURL", {
  configurable: true,
  writable: true,
  value: vi.fn(),
});

if (typeof Image !== "undefined") {
  Object.defineProperty(Image.prototype, "decode", {
    configurable: true,
    value: vi.fn(async function decode(this: HTMLImageElement) {
      Object.defineProperty(this, "naturalWidth", {
        configurable: true,
        value: 1200,
      });
      Object.defineProperty(this, "naturalHeight", {
        configurable: true,
        value: 900,
      });
    }),
  });
}

if (typeof HTMLCanvasElement !== "undefined") {
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: vi.fn(() => ({
      fillStyle: "",
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    })),
  });

  Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
    configurable: true,
    value: vi.fn(() => "data:image/jpeg;base64,cHJlc3MtaGVyZQ=="),
  });
}
