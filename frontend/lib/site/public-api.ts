/** Calls to the public (session-less) endpoints through the same-origin /api proxy. */
export class PublicApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

async function fail(response: Response): Promise<never> {
  const data = await response.json().catch(() => null);
  const detail = typeof data?.detail === "string" ? data.detail : "";
  const message =
    response.status === 429
      ? "Troppe richieste: aspetta qualche minuto e riprova."
      : detail || "Non è stato possibile completare l'operazione. Riprova.";
  throw new PublicApiError(message, response.status, data?.code);
}

export async function publicPost<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) return fail(response);
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export async function publicDownload(path: string, body: unknown): Promise<Blob> {
  const response = await fetch(`/api/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) return fail(response);
  return response.blob();
}

/** Privacy-friendly site analytics (Umami): a no-op when the script is not loaded. */
export function trackEvent(name: string) {
  try {
    (window as unknown as { umami?: { track: (n: string) => void } }).umami?.track(name);
  } catch {
    /* analytics must never break a page */
  }
}
