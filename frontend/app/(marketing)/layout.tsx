import { AttributionCapture } from "@/components/site/AttributionCapture";
import { ConsentBanner } from "@/components/site/ConsentBanner";
import { SiteScripts } from "@/components/site/SiteScripts";
import { JsonLd } from "@/components/site/JsonLd";
import { SiteFooter } from "@/components/site/SiteFooter";
import { PromoStrip } from "@/components/site/PromoStrip";
import { SiteHeader } from "@/components/site/SiteHeader";
import { navGroups } from "@/components/site/nav";
import { SITE, absoluteUrl } from "@/lib/site/config";
import { fetchOffer } from "@/lib/site/offer";

/** Public site: static pages, own header/footer, separate from the app layouts. */
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const offer = await fetchOffer(true);
  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: SITE.name,
            url: SITE.url,
            logo: absoluteUrl("/assets/branding/vorya_v.png"),
            parentOrganization: {
              "@type": "Organization",
              name: SITE.parent.name,
              url: SITE.parent.url,
            },
          },
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: SITE.name,
            url: SITE.url,
            inLanguage: "it",
          },
        ]}
      />
      <AttributionCapture />
      <SiteScripts />
      <ConsentBanner />
      <PromoStrip offer={offer} />
      <SiteHeader groups={navGroups()} />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
