import { afterEach, beforeEach, jest } from "@jest/globals";
import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

beforeEach(() => {
  if (!global.fetch) {
    global.fetch = jest.fn();
  }
  jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    headers: { get: () => "test-request-id" },
    json: async () => ({
      status: "ok",
      inference_mode: "mock",
      generate_mode: "simulation",
    }),
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});
