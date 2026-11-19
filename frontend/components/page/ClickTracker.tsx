"use client";
import { useEffect } from "react";

/** Counts clicks on page buttons and links (aggregated per block, no personal data). */
export function ClickTracker({ slug }: { slug: string }) {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>("[data-track]");
      if (!target) return;
      const body = JSON.stringify({
        block_id: target.dataset.track,
        item: target.dataset.item ?? "",
      });
      const url = `/api/public/pages/${slug}/events`;
      if (!navigator.sendBeacon?.(url, new Blob([body], { type: "application/json" })))
        fetch(url, {
          method: "POST",
          body,
          headers: { "Content-Type": "application/json" },
          keepalive: true,
        }).catch(() => undefined);
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [slug]);
  return null;
}
