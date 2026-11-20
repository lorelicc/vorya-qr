import { Hero } from "@/components/site/blocks";
import { HOME } from "@/lib/site/content";
import { pageMetadata } from "@/lib/site/config";

export const metadata = pageMetadata({
  title: "Link brevi e codici QR, in italiano e senza pubblicità",
  description: HOME.hero.lead,
  path: "/",
});

export default function HomePage() {
  return <Hero title={HOME.hero.title} lead={HOME.hero.lead} art="guarantee" />;
}
