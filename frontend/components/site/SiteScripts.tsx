import Script from "next/script";

/**
 * Privacy-friendly site analytics (Umami, self-hosted, no cookies). Only loaded when the
 * environment configures it; events are sent by `data-umami-event` attributes and trackEvent().
 */
export function SiteScripts() {
  const url = process.env.NEXT_PUBLIC_UMAMI_URL?.replace(/\/$/, "");
  const id = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
  if (!url || !id) return null;
  return <Script src={`${url}/script.js`} data-website-id={id} strategy="afterInteractive" defer />;
}
