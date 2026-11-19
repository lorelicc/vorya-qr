import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/components/ui";
import "@/styles/vorya-tokens.css";
import "@/styles/reset.css";
import "@/styles/layout.css";

export const metadata: Metadata = {
  title: { default: "Vorya QR · Codici QR statici e dinamici", template: "%s · Vorya QR" },
  description: "Crea e gestisci codici QR statici e dinamici con statistiche delle scansioni.",
  icons: { icon: "/assets/branding/vorya_v.png", apple: "/assets/branding/vorya_v.png" },
};

export const viewport: Viewport = { themeColor: "#00e99a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
