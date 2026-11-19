// Self-hosted fonts (SIL OFL 1.1) for hosted pages only; woff2 files are served from this app.
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/montserrat/latin-400.css";
import "@fontsource/montserrat/latin-600.css";
import "@fontsource/playfair-display/latin-400.css";
import "@fontsource/playfair-display/latin-700.css";
import "@fontsource/space-grotesk/latin-400.css";
import "@fontsource/space-grotesk/latin-600.css";

export default function PublicPagesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
