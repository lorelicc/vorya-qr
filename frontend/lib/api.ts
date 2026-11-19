import { csrfHeaders } from "./auth-client";

export type FieldErrors = Record<string, string>;

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public fields: FieldErrors = {},
  ) {
    super(message);
  }
}

const TIMEOUT_MS = 15000;

const FIELD_LABELS: Record<string, string> = {
  website: "Sito web",
  number: "Telefono",
  address: "Indirizzo o email",
  url: "Link",
  first_name: "Nome",
  last_name: "Cognome",
  organization: "Azienda",
  price: "Prezzo",
  title: "Titolo",
  label: "Etichetta",
};

function redirectFor(status: number): string | null {
  if (typeof window === "undefined") return null;
  if (status === 423) return "/suspended";
  if (status === 401 && !window.location.pathname.startsWith("/login")) return "/login";
  return null;
}

/** JSON client for the same-origin /api proxy. Adds CSRF on mutations, maps errors. */
export async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(method === "GET" ? {} : csrfHeaders()),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const target = redirectFor(response.status);
    if (target && !(response.status === 401 && path.startsWith("auth/"))) {
      window.location.assign(target);
    }
    const fields: FieldErrors = {};
    for (const item of data?.errors ?? []) {
      if (item?.field && !fields[item.field]) fields[item.field] = item.message;
      // Errors inside the hosted page content: say which field, so the user can find it.
      if (typeof item?.path === "string" && item.path.startsWith("page.") && !fields.page)
        fields.page = `${FIELD_LABELS[item.field] ?? "Un campo"}: ${item.message}`;
    }
    throw new ApiError(
      typeof data?.detail === "string"
        ? data.detail
        : "Impossibile completare la richiesta. Riprova tra poco.",
      response.status,
      typeof data?.code === "string" ? data.code : undefined,
      fields,
    );
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof DOMException && error.name === "TimeoutError")
    return "Il server non risponde. Riprova tra poco.";
  return "Connessione non riuscita. Controlla la rete e riprova.";
}

export function fieldErrors(error: unknown): FieldErrors {
  return error instanceof ApiError ? error.fields : {};
}
