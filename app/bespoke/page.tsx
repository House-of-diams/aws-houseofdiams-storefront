import type { Metadata } from 'next';
import type { ComponentProps } from 'react';
import BespokeClient from '@/components/pages/BespokeClient';
import { createPageMetadata } from '@/lib/seo';
import { buildCategoryPath } from '@/lib/catalog-paths';
import {
  findBespokeHeroFromRds, loadBespokeFormConfigFromRds, loadBespokeHeroSlidesFromRds,
  loadBespokePortfolioFromRds, loadBespokeProcessCardsFromRds,
} from '@/lib/repositories/bespoke-repository';
import { loadBespokeExploreCategoriesFromRds } from '@/lib/repositories/catalog-repository';
import { mediaUrl } from '@/lib/media-url';

export const metadata: Metadata = createPageMetadata({
  title: 'Bespoke',
  description: 'Commission a bespoke piece. From CAD to setting, crafted in Surat with certified lab-grown diamonds.',
  path: '/bespoke',
});

// This content is administered in real time; do not serve a five-minute-old form.
export const dynamic = 'force-dynamic';

export default async function BespokePage() {
  const [heroResult, formResult, processItems, portfolioResult, exploreRows] = await Promise.all([
    findBespokeHeroFromRds(), loadBespokeFormConfigFromRds(), loadBespokeProcessCardsFromRds(),
    loadBespokePortfolioFromRds(), loadBespokeExploreCategoriesFromRds(),
  ]);
  const slides = heroResult.item ? await loadBespokeHeroSlidesFromRds(String(heroResult.item.id)) : [];

  const buildPublicUrl = mediaUrl;
  const categoryMap = new Map(portfolioResult.categories.map((category) => [String(category.id), category]));
  const portfolioItems = portfolioResult.items.flatMap((item) => {
    const category = categoryMap.get(String(item.category_id));
    if (!category) return [];
    return [{ ...item, category, media_url: buildPublicUrl(item.media_path as string | null), thumbnail_url: buildPublicUrl(item.thumbnail_path as string | null) }];
  });
  const formConfig = {
    settings: {
      intro_heading: String(formResult.settings?.intro_heading ?? 'Configure Your Bespoke Order'),
      intro_subtitle: String(formResult.settings?.intro_subtitle ?? 'Every bespoke commission begins with a conversation. Share your vision below and our team will be in touch within 24 hours with next steps.'),
      footer_note: String(formResult.settings?.footer_note ?? "We'll reply within 24 hours. Your details stay confidential."),
    },
    guarantees: formResult.guarantees,
    pieceTypes: formResult.pieceTypes,
    stoneOptions: formResult.stoneOptions,
    caratOptions: formResult.caratOptions,
    metalOptions: formResult.metalOptions,
  };
  const moreToExploreCategories = exploreRows
    .filter((category) => category.banner_desktop_image_path || category.banner_mobile_image_path)
    .map((category) => ({
      name: category.name, href: buildCategoryPath(category),
      imageUrl: buildPublicUrl(category.banner_desktop_image_path ?? category.banner_mobile_image_path),
      imageAlt: category.banner_desktop_image_alt || category.banner_mobile_image_alt || category.name,
    }));
  return <BespokeClient
      hero={heroResult.item as ComponentProps<typeof BespokeClient>['hero']}
      slides={slides as ComponentProps<typeof BespokeClient>['slides']}
      processItems={processItems as ComponentProps<typeof BespokeClient>['processItems']}
      portfolioCategories={portfolioResult.categories as ComponentProps<typeof BespokeClient>['portfolioCategories']}
      portfolioItems={portfolioItems as unknown as ComponentProps<typeof BespokeClient>['portfolioItems']}
      formConfig={formConfig as unknown as ComponentProps<typeof BespokeClient>['formConfig']}
    moreToExploreCategories={moreToExploreCategories}
  />;

}
