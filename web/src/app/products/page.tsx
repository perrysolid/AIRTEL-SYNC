import { PageHero, PageShell } from "@/components/SiteNav";
import { catalogue } from "@/lib/catalogue";
import { ProductBrowser } from "./ProductBrowser";

export const metadata = { title: "Products — Accel Business", description: "All 25 products with real prices, contracts, setup fees, install times and eligibility rules." };

export default function ProductsPage() {
  const products = [...catalogue().values()];
  return (
    <PageShell>
      <PageHero eyebrow="Products" title="Everything a small business needs, in one catalogue" sub="25 products across connectivity, communication, cloud, security and IoT. Each shows its real price range, contract, setup fee, install time and who it is open to." />
      <ProductBrowser products={products} />
    </PageShell>
  );
}
