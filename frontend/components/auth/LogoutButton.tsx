"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { api } from "@/lib/api";

export function LogoutButton({ variant = "secondary" }: { variant?: "secondary" | "ghost" }) {
  const router = useRouter();
  return (
    <Button
      variant={variant}
      onClick={async () => {
        await api("auth/logout", "POST").catch(() => undefined);
        router.replace("/login");
        router.refresh();
      }}
    >
      Esci
    </Button>
  );
}
