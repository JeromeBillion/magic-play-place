import { describe, expect, it, jest, beforeEach, afterEach } from "@jest/globals";
import { fetchHealth, submitGenerate, buildRequestHeaders } from "./api";

// We keep global fetch in the environment, we just spy on it
describe("api client", () => {
  let fetchSpy: any;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, "fetch").mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
        headers: new Headers({ "x-request-id": "mock-req-123" }),
      } as any)
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it("builds request headers containing a client UI request ID", () => {
    const headers = buildRequestHeaders();
    expect(headers["X-Request-ID"]).toMatch(/^ui-[a-z0-9]+/);
  });

  it("fetchHealth fetches the admin status endpoint", async () => {
    fetchSpy.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ inference_mode: "mock" }),
        headers: new Headers({ "x-request-id": "mock-req-777" }),
      } as any)
    );

    const result = await fetchHealth();
    expect(result.requestId).toBe("mock-req-777");
    expect(result.payload.inference_mode).toBe("mock");
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining("/admin/status"), expect.any(Object));
  });

  it("submitGenerate handles json formatting correctly", async () => {
    fetchSpy.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ generation_mode: "simulation" }),
        headers: new Headers({ "x-request-id": "mock-req-888" }),
      } as any)
    );

    const payload = { valence: 50, arousal: 50 };
    const result = await submitGenerate(payload);
    
    expect(result.requestId).toBe("mock-req-888");
    expect(result.data.generation_mode).toBe("simulation");
    
    const fetchCallArguments = fetchSpy.mock.calls[0];
    const fetchOptions = fetchCallArguments[1];
    expect(fetchOptions.method).toBe("POST");
    expect(fetchOptions.body).toBe(JSON.stringify(payload));
    expect(fetchOptions.headers["Content-Type"]).toBe("application/json");
  });
});
