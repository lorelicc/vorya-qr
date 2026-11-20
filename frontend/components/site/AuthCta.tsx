"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/ui";

type Me = { role: string } | null;

/**
 * The marketing pages are static, so "am I logged in?" is asked in the browser (no redirect: a
 * logged-in customer can read the site and gets a "Vai alla dashboard" button).
 */
export function AuthCta({
  compact = false,
  sheet = false,
}: {
  compact?: boolean;
  /** Phone menu: two separate, full-width buttons. */
  sheet?: boolean;
}) {
  const [me, setMe] = useState<Me | undefined>(undefined);
  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setMe, () => setMe(null));
  }, []);
  if (me)
    return (
      <ButtonLink
        href={me.role === "company_admin" ? "/app" : "/admin"}
        data-umami-event="dashboard"
        block={sheet}
      >
        Vai alla dashboard
      </ButtonLink>
    );
  if (sheet)
    return (
      <>
        <ButtonLink href="/login" variant="secondary" block>
          Accedi
        </ButtonLink>
        <ButtonLink href="/register" block data-umami-event="prova-gratis-menu-mobile">
          Prova gratis
        </ButtonLink>
      </>
    );
  return (
    <>
      <Link href="/login" style={{ fontSize: "var(--fs-sm)", fontWeight: 600 }}>
        Accedi
      </Link>
      {!compact && (
        <ButtonLink href="/register" data-umami-event="prova-gratis-header">
          Prova gratis
        </ButtonLink>
      )}
    </>
  );
}
