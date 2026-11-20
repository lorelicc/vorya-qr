"use client";
import { useEffect } from "react";

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

/**
 * Browser errors to GlitchTip (Sentry-compatible), scrubbed: no user, cookies, request data,
 * query strings or e-mail addresses. Does nothing without NEXT_PUBLIC_SENTRY_DSN.
 */
export function ErrorReporting() {
  useEffect(() => {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) return;
    import("@sentry/browser").then((Sentry) =>
      Sentry.init({
        dsn,
        sendDefaultPii: false,
        tracesSampleRate: 0,
        integrations: [],
        beforeSend(event) {
          delete event.user;
          delete event.extra;
          delete event.breadcrumbs;
          if (event.request) {
            delete event.request.cookies;
            delete event.request.headers;
            delete event.request.data;
            if (event.request.url)
              event.request.url = event.request.url.split("?")[0].split("#")[0];
            delete event.request.query_string;
          }
          for (const exception of event.exception?.values ?? [])
            if (exception.value) exception.value = exception.value.replace(EMAIL, "<email>");
          return event;
        },
      }),
    );
  }, []);
  return null;
}
