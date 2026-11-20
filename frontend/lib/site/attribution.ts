/**
 * First-touch attribution and the generator handoff, kept in the browser until signup.
 * Nothing is sent anywhere before the visitor registers; then the API stores a short summary.
 */
const ATTR_KEY = "vorya_attr";
const HANDOFF_KEY = "vorya_handoff";
const UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

export type Attribution = Partial<Record<(typeof UTM)[number], string>> & {
  referrer?: string;
  landing?: string;
  generator?: string;
};
export type Handoff = {
  type: "website" | "vcard_static";
  data: Record<string, string | boolean>;
  design: Record<string, unknown> | null;
};

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode: attribution is simply skipped */
  }
}

/** Called on every marketing page: the first visit wins, later pages never overwrite it. */
export function captureAttribution() {
  if (read<Attribution>(ATTR_KEY)) return;
  const params = new URLSearchParams(window.location.search);
  const attribution: Attribution = { landing: window.location.pathname.slice(0, 64) };
  for (const key of UTM) {
    const value = params.get(key);
    if (value) attribution[key] = value.slice(0, 100);
  }
  try {
    const ref = document.referrer ? new URL(document.referrer) : null;
    if (ref && ref.host !== window.location.host)
      attribution.referrer = `${ref.host}${ref.pathname}`.slice(0, 200);
  } catch {
    /* malformed referrer */
  }
  write(ATTR_KEY, attribution);
}

export function readAttribution(): Attribution | null {
  return read<Attribution>(ATTR_KEY);
}

export function noteGenerator(type: string) {
  write(ATTR_KEY, { ...(read<Attribution>(ATTR_KEY) ?? {}), generator: type });
}

export const saveHandoff = (handoff: Handoff) => write(HANDOFF_KEY, handoff);
export const readHandoff = () => read<Handoff>(HANDOFF_KEY);
export function clearHandoff() {
  try {
    localStorage.removeItem(HANDOFF_KEY);
  } catch {
    /* ignore */
  }
}
