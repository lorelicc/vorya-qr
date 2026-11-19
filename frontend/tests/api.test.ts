import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, errorMessage, fieldErrors } from "@/lib/api";

function respond(status: number, body?: unknown) {
  // A fresh Response per call: a body can only be read once.
  return vi.fn().mockImplementation(
    async () =>
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  );
}

describe("api client", () => {
  const assign = vi.fn();
  beforeEach(() => {
    document.cookie = "vorya_qr_csrf=csrf-token-123";
    vi.stubGlobal("location", { ...window.location, pathname: "/app", assign });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    assign.mockReset();
  });

  it("sends JSON with the CSRF header on mutations only", async () => {
    const fetchMock = respond(201, { id: 1 });
    vi.stubGlobal("fetch", fetchMock);
    await expect(api("qr-codes", "POST", { name: "x" })).resolves.toEqual({ id: 1 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/qr-codes");
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      "X-CSRF-Token": "csrf-token-123",
    });
    expect(init.body).toBe('{"name":"x"}');

    await api("qr-codes");
    expect(fetchMock.mock.calls[1][1].headers).not.toHaveProperty("X-CSRF-Token");
  });

  it("returns undefined for 204", async () => {
    vi.stubGlobal("fetch", respond(204));
    await expect(api("qr-codes/1", "DELETE")).resolves.toBeUndefined();
  });

  it("maps detail, code and field errors", async () => {
    vi.stubGlobal(
      "fetch",
      respond(422, {
        detail: "Controlla i campi evidenziati.",
        errors: [{ field: "target_url", message: "URL non valido" }],
      }),
    );
    const error = await api<never>("qr-codes", "POST", {}).catch((e: ApiError) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(errorMessage(error)).toBe("Controlla i campi evidenziati.");
    expect(fieldErrors(error)).toEqual({ target_url: "URL non valido" });

    vi.stubGlobal("fetch", respond(409, { detail: "Limite raggiunto", code: "quota_dynamic" }));
    const quota = await api<never>("qr-codes", "POST", {}).catch((e: ApiError) => e);
    expect(quota.status).toBe(409);
    expect(quota.code).toBe("quota_dynamic");
  });

  it("redirects to /suspended on 423 and to /login on 401", async () => {
    vi.stubGlobal("fetch", respond(423, { detail: "Prova terminata", code: "trial_expired" }));
    await api("qr-codes").catch(() => undefined);
    expect(assign).toHaveBeenCalledWith("/suspended");
    vi.stubGlobal("fetch", respond(401, { detail: "Accesso richiesto." }));
    await api("qr-codes").catch(() => undefined);
    expect(assign).toHaveBeenLastCalledWith("/login");
  });

  it("does not redirect a failed login", async () => {
    vi.stubGlobal("fetch", respond(401, { detail: "Email o password non valide." }));
    const error = await api<never>("auth/login", "POST", {}).catch((e: ApiError) => e);
    expect(error.message).toBe("Email o password non valide.");
    expect(assign).not.toHaveBeenCalled();
  });

  it("uses a generic message for network failures and non-JSON errors", async () => {
    expect(errorMessage(new TypeError("fail"))).toMatch(/Connessione non riuscita/);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("boom", { status: 500 })));
    const error = await api<never>("qr-codes").catch((e: ApiError) => e);
    expect(error.message).toMatch(/Impossibile completare/);
  });
});
