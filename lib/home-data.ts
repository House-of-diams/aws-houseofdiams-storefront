import { reelVideoUrl } from '@/lib/reel-video';
import { unstable_cache } from 'next/cache';
import { formatUsd } from '@/lib/money';
import { mediaUrl } from '@/lib/media-url';
import { cachePublicRead, PUBLIC_CACHE_LONG_SECONDS, PUBLIC_CACHE_SHORT_SECONDS } from '@/lib/public-cache';
import { buildOptionPath, buildSubcategoryPath } from '@/lib/catalog-paths';
import {
  findActiveHomeHeroRowFromRds,
  loadHomeBestSellerRowsFromRds,
  loadHomeCmsRowsFromRds,
  loadHomeHeroSliderRowsFromRds,
  loadHomeInstagramRowsFromRds,
} from '@/lib/repositories/cms-repository';

export type HomeHeroContent = {
  eyebrow: string;
  headline: string;
  subtitle: string;
  slider_enabled?: boolean;
  slider_items?: Array<{
    sort_order: number;
    image_path: string;
    mobile_image_path?: string;
    headline: string;
    subtitle: string;
    button_text: string;
    button_link: string;
  }>;
};

export type HomeSeoData = {
  title?: string;
  description?: string;
};

export type HomeMarqueeData = {
  title: string;
  items: Array<{ quote: string; author: string }>;
};

export type HomeInstagramReelsData = {
  heading: string;
  subtitle: string;
  isEnabled: boolean;
  marqueeDurationSeconds: number;
  pauseOnHover: boolean;
  // A reel is either an Instagram link or an uploaded video; the other one is null.
  items: Array<{ id: string; instagramUrl: string | null; videoUrl: string | null; title: string; coverImageUrl: string | null }>;
};
export type HomeTrustedPartnersData = {
  heading: string;
  isEnabled: boolean;
  logos: Array<{
    id: string;
    name: string;
    logoUrl: string;
    logoAlt?: string | null;
    linkUrl?: string | null;
    displayOrder: number;
  }>;
};

export type HomeCollectionItem = {
  sort_order: number;
  label: string;
  title: string;
  description: string;
  image_path: string;
  link: string;
};

export type HomeMaterialItem = {
  sort_order: number;
  title: string;
  description: string;
  icon_path: string;
};

export type HomeDiscoverItem = {
  sort_order: number;
  title: string;
  description: string;
  image_path: string;
  image_alt?: string | null;
  href?: string | null;
  shape_id?: string | null;
  target_kind?: string | null;
  target_id?: string | null;
};


export type CollectionPageConfig = {
  pageEnabled: boolean;
  showInFooter: boolean;
  showHomeShowcase: boolean;
  showcaseHeading: string;
  showcaseSubtitle: string;
  showcaseCtaLabel: string;
  showcaseCtaHref: string;
  showcaseImageUrl?: string;
  showcaseMobileImageUrl?: string;
};

export type HomeBespokeShowcaseSection = {
  isEnabled: boolean;
  eyebrow: string;
  heading: string;
  subtitle: string;
  ctaLabel: string;
  imageUrl?: string;
  mobileImageUrl?: string;
  imageAlt: string;
};

export type HomeCertificationSection = {
  eyebrow: string;
  heading: string;
};

export type HomeCertificationItem = {
  sort_order: number;
  title: string;
  description: string;
  badge: string;
  icon_path: string;
};

export type HomeCoupleItem = {
  sort_order?: number;
  names: string;
  location: string;
  story: string;
  product_name: string;
  product_link?: string;
  product_detail: string;
  image_path: string;
};


export type HomeDiamondInfoItem = {
  id?: string;
  sort_order: number;
  iconSvg?: string | null;
  title: string;
  description: string;
  is_active?: boolean;
};

export type HomeDiamondInfoConfig = {
  videoEnabled: boolean;
  videoUrl?: string;
  videoPosterUrl?: string;
  layoutMode?: string;
  eyebrow?: string;
  sectionHeading?: string;
  sectionSubtext?: string;
  ctaLabel?: string;
  ctaLink?: string;
};

export type HomeBestSellerSection = {
  eyebrow: string;
  heading: string;
  cta_label: string;
  cta_href: string;
};

export type HomeBestSellerProduct = {
  id: string;
  slug: string;
  name: string;
  meta: string;
  price: string;
  badge: string;
  badgeVariant: 'navy' | 'outline';
  detailTemplate?: 'standard' | 'hiphop';
  image?: string;
  displayTitle?: string;
  metalsFull?: Array<{ id: string; name: string; slug: string; colorHex?: string | null }>;
  metalMediaRows?: Array<{ product_id: string; metal_id: string; image_1_path?: string | null; is_default_fallback?: boolean | null }>;
  metalPurityVariants?: Array<{
    id: string;
    metalId: string;
    metalSlug: string;
    isDefault: boolean;
    mediaItems: Array<{ id: string; type: 'image' | 'video'; url: string; sortOrder: number }>;
  }>;
};

type BestSellerProductRow = {
  id: string;
  slug: string;
  name: string;
  base_price: number | null;
  detail_template?: 'standard' | 'hiphop' | null;
  featured?: boolean | null;
  image_1_path?: string | null;
  gemstone_label?: string | null;
  gemstone_value?: string | null;
  purity_values?: string[] | null;
  subcategory?: { name?: string | null } | { name?: string | null }[] | null;
  option?: { name?: string | null } | { name?: string | null }[] | null;
  category?: { name?: string | null } | { name?: string | null }[] | null;
};

type BestSellerProductSelectionRow = {
  section_id: string;
  product_id: string;
  display_order?: number | null;
  display_title?: string | null;
  display_image_path?: string | null;
};

type BestSellerMetalSelectionRow = {
  product_id: string;
  metal_id: string;
  sort_order?: number | null;
};

type BestSellerMetalRow = {
  id: string;
  name: string;
  slug: string;
  color_hex?: string | null;
};

type BestSellerMetalMediaRow = {
  product_id: string;
  metal_id: string;
  image_1_path?: string | null;
  is_default_fallback?: boolean | null;
};

type BestSellerMetalVariantRow = {
  id: string;
  product_id: string;
  metal_id: string;
  is_default?: boolean | null;
  sort_order?: number | null;
};

type BestSellerVariantMediaRow = {
  id: string;
  product_id: string;
  variant_id?: string | null;
  media_type: 'image' | 'video';
  media_path: string;
  sort_order?: number | null;
  is_default_fallback?: boolean | null;
};

type BestSellerMaterialValueSelectionRow = {
  product_id: string;
  material_value_id: string;
  sort_order?: number | null;
};

type BestSellerMaterialValueRow = {
  id: string;
  name: string;
};

type DiscoverCategoryRow = {
  id: string;
  name: string;
  slug: string;
};

type DiscoverSubcategoryRow = {
  id: string;
  category_id: string;
  name: string;
  slug: string;
};

type DiscoverOptionRow = {
  id: string;
  subcategory_id: string;
  name: string;
  slug: string;
};

type DiscoverStoneShapeRow = {
  id: string;
  name: string;
  slug: string;
};

type DiscoverStyleRow = {
  id: string;
  name: string;
  slug: string;
};

function toPublicUrl(path: string | null | undefined) {
  if (!path) return undefined;
  return mediaUrl(path);
}

function readRelationName(
  relation?: { name?: string | null } | { name?: string | null }[] | null
) {
  if (Array.isArray(relation)) return relation[0]?.name || '';
  return relation?.name || '';
}

function buildBestSellerMeta(product: BestSellerProductRow) {
  const bits = [
    readRelationName(product.option) || readRelationName(product.subcategory) || readRelationName(product.category) || '',
    product.gemstone_label && product.gemstone_value ? `${product.gemstone_label} · ${product.gemstone_value}` : '',
    product.purity_values?.[0] || '',
  ].filter(Boolean);

  return bits.join(' · ');
}

function buildBestSellerPrice(value: number | null | undefined) {
  if (!value) return 'Price on Request';
  return formatUsd(value);
}

function normalizeDiscoverText(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function slugifyDiscoverValue(value: string | null | undefined) {
  return normalizeDiscoverText(value).replace(/\s+/g, '-');
}

function findExactDiscoverMatch<T extends { name: string; slug: string }>(items: T[], value: string) {
  const normalizedValue = normalizeDiscoverText(value);
  const slugValue = slugifyDiscoverValue(value);
  return items.find((item) => item.slug === slugValue || normalizeDiscoverText(item.name) === normalizedValue) ?? null;
}

function findContainedDiscoverMatch<T extends { name: string; slug: string }>(items: T[], value: string) {
  const haystack = ` ${normalizeDiscoverText(value)} `;

  return (
    items
      .slice()
      .sort((left, right) => {
        const rightLength = Math.max(normalizeDiscoverText(right.name).length, (right.slug ?? '').length);
        const leftLength = Math.max(normalizeDiscoverText(left.name).length, (left.slug ?? '').length);
        return rightLength - leftLength;
      })
      .find((item) => {
        const normalizedName = normalizeDiscoverText(item.name);
        const normalizedSlug = normalizeDiscoverText(item.slug);
        return (
          (normalizedName && haystack.includes(` ${normalizedName} `)) ||
          (normalizedSlug && haystack.includes(` ${normalizedSlug} `))
        );
      }) ?? null
  );
}

function buildCategoryCollectionHref(categorySlug: string, params?: URLSearchParams) {
  const query = params?.toString();
  return query ? `/${categorySlug}?${query}` : `/${categorySlug}`;
}

function buildDiscoverSubcategoryHref(args: {
  subcategory: DiscoverSubcategoryRow;
  categoriesById: Map<string, DiscoverCategoryRow>;
  extraParams?: Record<string, string | null | undefined>;
}) {
  const { subcategory, categoriesById, extraParams } = args;
  const params = new URLSearchParams();

  if (extraParams) {
    Object.entries(extraParams).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
  }

  const category = categoriesById.get(subcategory.category_id);
  if (category?.slug) {
    const path = buildSubcategoryPath(category, subcategory);
    const query = params.toString();
    return query ? `${path}?${query}` : path;
  }

  params.set('subcategory', subcategory.slug);
  return `/shop?${params.toString()}`;
}

function buildDiscoverOptionHref(args: {
  option: DiscoverOptionRow;
  subcategoriesById: Map<string, DiscoverSubcategoryRow>;
  categoriesById: Map<string, DiscoverCategoryRow>;
  extraParams?: Record<string, string | null | undefined>;
}) {
  const { option, subcategoriesById, categoriesById, extraParams } = args;
  const subcategory = subcategoriesById.get(option.subcategory_id);
  const params = new URLSearchParams();

  if (extraParams) {
    Object.entries(extraParams).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
  }

  const category = subcategory ? categoriesById.get(subcategory.category_id) : null;
  if (category?.slug && subcategory?.slug) {
    const path = buildOptionPath(category, subcategory, option);
    const query = params.toString();
    return query ? `${path}?${query}` : path;
  }

  if (subcategory?.slug) params.set('subcategory', subcategory.slug);
  params.set('option', option.slug);
  return `/shop?${params.toString()}`;
}

function buildDiscoverFilterHref(filters: Record<string, string | null | undefined>) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });

  const query = params.toString();
  return query ? `/shop?${query}` : '/shop';
}

function resolveDiscoverShapeHref(shapeId: string | null | undefined, stoneShapes: DiscoverStoneShapeRow[]) {
  const matchedShape = stoneShapes.find((entry) => entry.id === shapeId) ?? null;
  return matchedShape ? buildDiscoverFilterHref({ shape: matchedShape.slug }) : '/shop';
}

function resolveDiscoverRingHref(args: {
  title: string;
  targetKind?: string | null;
  targetId?: string | null;
  categories: DiscoverCategoryRow[];
  subcategories: DiscoverSubcategoryRow[];
  options: DiscoverOptionRow[];
  stoneShapes: DiscoverStoneShapeRow[];
  styles: DiscoverStyleRow[];
}) {
  const { title, targetKind, targetId, categories, subcategories, options, stoneShapes, styles } = args;
  const categoriesById = new Map(categories.map((item) => [item.id, item] as const));
  const subcategoriesById = new Map(subcategories.map((item) => [item.id, item] as const));

  if (targetKind && targetId) {
    if (targetKind === 'category') {
      const category = categories.find((entry) => entry.id === targetId) ?? null;
      if (category) return buildCategoryCollectionHref(category.slug);
    }

    if (targetKind === 'subcategory') {
      const subcategory = subcategories.find((entry) => entry.id === targetId) ?? null;
      if (subcategory) {
        return buildDiscoverSubcategoryHref({ subcategory, categoriesById });
      }
    }

    if (targetKind === 'option') {
      const option = options.find((entry) => entry.id === targetId) ?? null;
      if (option) {
        return buildDiscoverOptionHref({ option, subcategoriesById, categoriesById });
      }
    }

    if (targetKind === 'shape') {
      const shape = stoneShapes.find((entry) => entry.id === targetId) ?? null;
      if (shape) return buildDiscoverFilterHref({ shape: shape.slug });
    }

    if (targetKind === 'style') {
      const style = styles.find((entry) => entry.id === targetId) ?? null;
      if (style) return buildDiscoverFilterHref({ style: style.slug });
    }
  }

  const exactOption = findExactDiscoverMatch(options, title);
  if (exactOption) {
    return buildDiscoverOptionHref({ option: exactOption, subcategoriesById, categoriesById });
  }

  const exactSubcategory = findExactDiscoverMatch(subcategories, title);
  if (exactSubcategory) {
    return buildDiscoverSubcategoryHref({ subcategory: exactSubcategory, categoriesById });
  }

  const exactCategory = findExactDiscoverMatch(categories, title);
  if (exactCategory) {
    return buildCategoryCollectionHref(exactCategory.slug);
  }

  const exactStyle = findExactDiscoverMatch(styles, title);
  if (exactStyle) {
    return buildDiscoverFilterHref({ style: exactStyle.slug });
  }

  const exactShape = findExactDiscoverMatch(stoneShapes, title);
  if (exactShape) {
    return buildDiscoverFilterHref({ shape: exactShape.slug });
  }

  const containedShape = findContainedDiscoverMatch(stoneShapes, title);
  const containedOption = findContainedDiscoverMatch(options, title);
  if (containedOption) {
    return buildDiscoverOptionHref({
      option: containedOption,
      subcategoriesById,
      categoriesById,
      extraParams: { shape: containedShape?.slug },
    });
  }

  const containedSubcategory = findContainedDiscoverMatch(subcategories, title);
  if (containedSubcategory) {
    return buildDiscoverSubcategoryHref({
      subcategory: containedSubcategory,
      categoriesById,
      extraParams: { shape: containedShape?.slug },
    });
  }

  const containedStyle = findContainedDiscoverMatch(styles, title);
  if (containedStyle || containedShape) {
    return buildDiscoverFilterHref({
      style: containedStyle?.slug,
      shape: containedShape?.slug,
    });
  }

  const containedCategory = findContainedDiscoverMatch(categories, title);
  if (containedCategory) {
    return buildCategoryCollectionHref(containedCategory.slug);
  }

  return '/shop';
}

function buildBestSellerMetaFromMaterialValue(
  product: BestSellerProductRow,
  materialValueName?: string
) {
  const primaryLabel =
    readRelationName(product.option) || readRelationName(product.subcategory) || readRelationName(product.category) || '';
  const materialLabel = product.gemstone_label && materialValueName ? `${product.gemstone_label} · ${materialValueName}` : '';
  const purityLabel = product.purity_values?.[0] || '';

  return [primaryLabel, materialLabel, purityLabel].filter(Boolean).join(' · ');
}

type ReadResult<T> = { data: T; error: { code?: string; message: string } | null };
type HeroRow = HomeHeroContent & { id: number; seo_title?: string | null; seo_description?: string | null };
type CollectionConfigRow = {
  page_enabled: boolean; show_in_footer: boolean; show_home_showcase: boolean;
  showcase_heading: string; showcase_subtitle: string; showcase_cta_label: string; showcase_cta_href: string;
  showcase_image_path: string | null; showcase_mobile_image_path: string | null;
};
type BespokeShowcaseRow = {
  is_enabled: boolean; eyebrow: string; heading: string; subtitle: string; cta_label: string;
  image_path: string | null; mobile_image_path: string | null; image_alt: string;
};
type HomeRows = [
  ReadResult<HeroRow | null>, ReadResult<Record<string, unknown>[]>, ReadResult<HomeCollectionItem[]>,
  ReadResult<(HomeDiscoverItem & { shape_id: string })[]>, ReadResult<DiscoverStoneShapeRow[]>,
  ReadResult<CollectionConfigRow | null>, ReadResult<BespokeShowcaseRow | null>,
  ReadResult<(HomeBestSellerSection & { id: string }) | null>, ReadResult<BestSellerProductSelectionRow[]>,
];
type BestSellerRows = [
  ReadResult<BestSellerProductRow[]>, ReadResult<BestSellerMetalSelectionRow[]>, ReadResult<BestSellerMetalRow[]>,
  ReadResult<BestSellerMetalMediaRow[]>, ReadResult<BestSellerMaterialValueSelectionRow[]>,
  ReadResult<BestSellerMaterialValueRow[]>, ReadResult<BestSellerMetalVariantRow[]>, ReadResult<BestSellerVariantMediaRow[]>,
];
type HeroSlides = NonNullable<HomeHeroContent['slider_items']>;

const loadHomePageData = unstable_cache(
  async (_source?: 'rds') => {
    void _source;

    const [
      heroResult,
      blogResult,
      collectionResult,
      discoverShapesResult,
      discoverStoneShapesResult,
      collectionPageConfigResult,
      bespokeShowcaseResult,
      bestSellerSectionResult,
      bestSellerProductSelectionsResult,
    ] = await loadHomeCmsRowsFromRds() as unknown as HomeRows;

    const heroData = heroResult.data;
    let sliderItems: HomeHeroContent['slider_items'] = [];
    if (heroData?.id && heroData.slider_enabled) {
      const { data: itemsData } = await loadHomeHeroSliderRowsFromRds(heroData.id) as unknown as ReadResult<HeroSlides>;
      sliderItems = (itemsData ?? []).map((item) => ({ ...item, headline: item.headline ?? '', subtitle: item.subtitle ?? '' }));
    }


    let bestSellerProducts: HomeBestSellerProduct[] = [];
    const discoverStoneShapes = (discoverStoneShapesResult.data ?? []) as DiscoverStoneShapeRow[];

    if (bestSellerSectionResult.data?.id) {
      const selectedProductRows = (bestSellerProductSelectionsResult.data ?? [])
        .filter((item) => item.section_id === bestSellerSectionResult.data?.id) as BestSellerProductSelectionRow[];
      const productIds = selectedProductRows.map((item) => item.product_id);
      const selectionByProduct = new Map(selectedProductRows.map((item) => [item.product_id, item]));

      if (productIds.length) {
        const [
          { data },
          { data: metalSelections },
          { data: metalCatalog },
          { data: metalMediaRows },
          { data: materialValueSelections },
          { data: materialValueCatalog },
          { data: metalVariants },
          { data: variantMediaItems },
        ] = await loadHomeBestSellerRowsFromRds(productIds) as unknown as BestSellerRows;

        const productMap = new Map((data ?? []).map((item) => [item.id, item as BestSellerProductRow]));
        const metalsById = new Map((metalCatalog ?? []).map((item) => {
          const metal = item as BestSellerMetalRow;
          return [metal.id, metal] as const;
        }));
        const selectionsByProduct = new Map<string, BestSellerMetalSelectionRow[]>();
        (metalSelections ?? []).forEach((selection) => {
          const typedSelection = selection as BestSellerMetalSelectionRow;
          const existing = selectionsByProduct.get(typedSelection.product_id) ?? [];
          existing.push(typedSelection);
          selectionsByProduct.set(typedSelection.product_id, existing);
        });
        const mediaByProduct = new Map<string, BestSellerMetalMediaRow[]>();
        (metalMediaRows ?? []).forEach((entry) => {
          const typedEntry = entry as BestSellerMetalMediaRow;
          const existing = mediaByProduct.get(typedEntry.product_id) ?? [];
          existing.push(typedEntry);
          mediaByProduct.set(typedEntry.product_id, existing);
        });
        const materialValuesById = new Map((materialValueCatalog ?? []).map((item) => {
          const materialValue = item as BestSellerMaterialValueRow;
          return [materialValue.id, materialValue] as const;
        }));
        const materialValueSelectionsByProduct = new Map<string, BestSellerMaterialValueSelectionRow[]>();
        (materialValueSelections ?? []).forEach((selection) => {
          const typedSelection = selection as BestSellerMaterialValueSelectionRow;
          const existing = materialValueSelectionsByProduct.get(typedSelection.product_id) ?? [];
          existing.push(typedSelection);
          materialValueSelectionsByProduct.set(typedSelection.product_id, existing);
        });
        bestSellerProducts = productIds
          .map((id) => productMap.get(id) ?? null)
          .filter((product): product is BestSellerProductRow => Boolean(product))
          .map((product, index) => {
            const cardSelection = selectionByProduct.get(product.id);
            const selectedMetals = (selectionsByProduct.get(product.id) ?? [])
              .map((selection) => metalsById.get(selection.metal_id))
              .filter((metal): metal is BestSellerMetalRow => Boolean(metal))
              .map((metal) => ({
                id: metal.id,
                name: metal.name,
                slug: metal.slug,
                colorHex: metal.color_hex ?? null,
              }));
            const fallbackMedia =
              (mediaByProduct.get(product.id) ?? []).find((entry) => entry.is_default_fallback && entry.image_1_path) ??
              (mediaByProduct.get(product.id) ?? []).find((entry) => entry.image_1_path);
            const primaryMaterialValueName =
              (materialValueSelectionsByProduct.get(product.id) ?? [])
                .map((selection) => materialValuesById.get(selection.material_value_id)?.name)
                .find(Boolean) ?? undefined;
            const productVariants = ((metalVariants ?? []) as BestSellerMetalVariantRow[])
              .filter((variant) => variant.product_id === product.id)
              .map((variant) => {
                const metal = metalsById.get(variant.metal_id);
                if (!metal) return null;

                return {
                  id: variant.id,
                  metalId: metal.id,
                  metalSlug: metal.slug,
                  isDefault: Boolean(variant.is_default),
                  mediaItems: ((variantMediaItems ?? []) as BestSellerVariantMediaRow[])
                    .filter((media) => media.variant_id === variant.id && Boolean(media.media_path))
                    .map((media) => ({
                      id: media.id,
                      type: media.media_type,
                      url: toPublicUrl(media.media_path) ?? media.media_path,
                      sortOrder: Number(media.sort_order ?? 0),
                    })),
                };
              })
              .filter((variant): variant is NonNullable<typeof variant> => Boolean(variant));
            const defaultVariant = productVariants.find((variant) => variant.isDefault) ?? productVariants[0];
            const defaultVariantImage = defaultVariant?.mediaItems.find((media) => media.type === 'image')?.url;
            const defaultFallbackImage = ((variantMediaItems ?? []) as BestSellerVariantMediaRow[])
              .find((media) => media.product_id === product.id && !media.variant_id && media.is_default_fallback && media.media_type === 'image')
              ?.media_path;

            return {
              id: product.id,
              slug: product.slug,
              name: cardSelection?.display_title?.trim() || product.name,
              displayTitle: cardSelection?.display_title?.trim() || undefined,
              meta: buildBestSellerMetaFromMaterialValue(product, primaryMaterialValueName),
              price: buildBestSellerPrice(product.base_price),
              badge: index === 0 ? 'Bestseller' : product.featured ? 'Featured' : 'Selected',
              badgeVariant: index === 0 || product.featured ? 'navy' : 'outline',
              detailTemplate: product.detail_template === 'hiphop' ? 'hiphop' : 'standard',
              image: toPublicUrl(cardSelection?.display_image_path) || defaultVariantImage || toPublicUrl(defaultFallbackImage || fallbackMedia?.image_1_path || product.image_1_path),
              metalsFull: selectedMetals,
              metalMediaRows: (mediaByProduct.get(product.id) ?? []).map((entry) => ({
                ...entry,
                image_1_path: toPublicUrl(entry.image_1_path) ?? null,
              })),
              metalPurityVariants: productVariants,
            };
          });
      }
    }

    const collectionPageConfigError = collectionPageConfigResult.error
    const bespokeShowcaseError = bespokeShowcaseResult.error
    const isMissingCollectionPageConfigTable =
      collectionPageConfigError?.code === 'PGRST205' ||
      collectionPageConfigError?.message?.includes("Could not find the table 'public.collection_page_config'")
    const isMissingBespokeShowcaseTable =
      bespokeShowcaseError?.code === 'PGRST205' ||
      bespokeShowcaseError?.message?.includes("Could not find the table 'public.home_bespoke_showcase_section'")

    if (collectionPageConfigError && !isMissingCollectionPageConfigTable) {
      throw collectionPageConfigError
    }
    if (bespokeShowcaseError && !isMissingBespokeShowcaseTable) {
      throw bespokeShowcaseError
    }

    return {
      heroContent: heroData ? { ...heroData, slider_items: sliderItems ?? [] } : undefined,
      blogRows: blogResult.data ?? [],
      collectionItems: collectionResult.data ?? [],
      discoverShapesItems: (discoverShapesResult.data ?? []).map((item) => ({
        ...item,
        image_path: toPublicUrl(item.image_path) || item.image_path,
        href: resolveDiscoverShapeHref(item.shape_id, discoverStoneShapes),
      })),
      collectionPageConfig: {
        pageEnabled: isMissingCollectionPageConfigTable ? false : (collectionPageConfigResult.data?.page_enabled ?? false),
        showInFooter: isMissingCollectionPageConfigTable ? false : (collectionPageConfigResult.data?.show_in_footer ?? false),
        showHomeShowcase: isMissingCollectionPageConfigTable ? false : (collectionPageConfigResult.data?.show_home_showcase ?? false),
        showcaseHeading: collectionPageConfigResult.data?.showcase_heading ?? 'Collection',
        showcaseSubtitle: collectionPageConfigResult.data?.showcase_subtitle ?? 'Browse House of Diams collection pieces in a dedicated enquiry-first showcase.',
        showcaseCtaLabel: collectionPageConfigResult.data?.showcase_cta_label ?? 'Explore Collection',
        showcaseCtaHref: collectionPageConfigResult.data?.showcase_cta_href ?? '/collection',
        showcaseImageUrl: toPublicUrl(collectionPageConfigResult.data?.showcase_image_path),
        showcaseMobileImageUrl: toPublicUrl(collectionPageConfigResult.data?.showcase_mobile_image_path),
      },
      bespokeShowcaseSection: {
        isEnabled: isMissingBespokeShowcaseTable ? false : (bespokeShowcaseResult.data?.is_enabled ?? true),
        eyebrow: bespokeShowcaseResult.data?.eyebrow ?? 'Bespoke Atelier',
        heading: bespokeShowcaseResult.data?.heading ?? 'Create Something One of One',
        subtitle:
          bespokeShowcaseResult.data?.subtitle ??
          'Begin a bespoke commission with House of Diams, from first sketch to final setting.',
        ctaLabel: bespokeShowcaseResult.data?.cta_label ?? 'Start Bespoke Enquiry',
        imageUrl: toPublicUrl(bespokeShowcaseResult.data?.image_path),
        mobileImageUrl: toPublicUrl(bespokeShowcaseResult.data?.mobile_image_path),
        imageAlt: bespokeShowcaseResult.data?.image_alt ?? 'House of Diams bespoke jewelry showcase',
      },
      bestSellerSection: {
        eyebrow: bestSellerSectionResult.data?.eyebrow ?? 'House of Diams',
        heading: bestSellerSectionResult.data?.heading ?? 'Our Best Sellers',
        cta_label: bestSellerSectionResult.data?.cta_label ?? 'View All Collection',
        cta_href: bestSellerSectionResult.data?.cta_href ?? '/shop',
      },
      bestSellerProducts,
    };
  },
  ['home-page-data-v4'],
  { revalidate: 300 }
);

async function getFreshInstagramReelsData(): Promise<HomeInstagramReelsData> {

  const [sectionResult, initialItemsResult] = await loadHomeInstagramRowsFromRds() as unknown as [
    ReadResult<{ heading: string; subtitle: string; is_enabled: boolean; marquee_duration_seconds: number; pause_on_hover: boolean } | null>,
    ReadResult<{ id: string; instagram_url: string; title: string | null; cover_image_url: string | null }[]>,
  ];
  const itemsResult = initialItemsResult;
  const missingTable = [sectionResult.error, itemsResult.error].some((error) => error?.code === 'PGRST205' || error?.message?.includes('home_instagram_reels'));
  if (missingTable) return { heading: '', subtitle: '', isEnabled: false, marqueeDurationSeconds: 40, pauseOnHover: true, items: [] };
  if (sectionResult.error) throw sectionResult.error;
  if (itemsResult.error) throw itemsResult.error;
  return {
    heading: sectionResult.data?.heading ?? 'Follow Us on Instagram',
    subtitle: sectionResult.data?.subtitle ?? '',
    isEnabled: sectionResult.data?.is_enabled ?? false,
    marqueeDurationSeconds: Math.min(180, Math.max(10, sectionResult.data?.marquee_duration_seconds ?? 40)),
    pauseOnHover: sectionResult.data?.pause_on_hover ?? true,
    items: (itemsResult.data ?? []).map((item) => {
      const reel = item as { id: string; instagram_url?: string | null; video_url?: string | null; title?: string | null; cover_image_url?: string | null };
      return { id: reel.id, instagramUrl: reel.instagram_url ?? null, videoUrl: reelVideoUrl(reel.video_url), title: reel.title ?? '', coverImageUrl: reel.cover_image_url ?? null };
    }).filter((reel) => reel.instagramUrl || reel.videoUrl),
  };
}

const getCachedInstagramReelsData = cachePublicRead('home-instagram-reels', getFreshInstagramReelsData, PUBLIC_CACHE_LONG_SECONDS);

export async function getHomePageData() {
  const [data, instagramReels] = await Promise.all([
    loadHomePageData('rds'),
    getCachedInstagramReelsData().catch(() => ({ heading: '', subtitle: '', isEnabled: false, marqueeDurationSeconds: 40, pauseOnHover: true, items: [] })),
  ]);
  return { ...data, instagramReels };
}

/**
 * Keep the large homepage payload cached, but read the admin-managed hero fresh.
 * This ensures banner edits are visible on the next request instead of waiting
 * for the five-minute homepage cache to expire.
 */
export async function getFreshHomeHeroContent(): Promise<HomeHeroContent | undefined> {

  const { data: hero, error: heroError } = await findActiveHomeHeroRowFromRds() as unknown as ReadResult<HeroRow | null>;

  if (heroError) throw heroError;
  if (!hero) return undefined;

  let sliderItems: HomeHeroContent['slider_items'] = [];
  if (hero.slider_enabled) {
    const { data: items, error: itemsError } = await loadHomeHeroSliderRowsFromRds(hero.id) as unknown as ReadResult<HeroSlides>;

    if (itemsError) throw itemsError;
    sliderItems = (items ?? []).map((item) => ({ ...item, headline: item.headline ?? '', subtitle: item.subtitle ?? '' }));
  }

  return {
    eyebrow: hero.eyebrow,
    headline: hero.headline,
    subtitle: hero.subtitle,
    slider_enabled: hero.slider_enabled,
    slider_items: sliderItems,
  };
}

// Shared by the homepage render and /api/public/home-hero: one read per minute
// keeps banner edits visible quickly without a database query per visit.
export const getCachedHomeHeroContent = cachePublicRead(
  'home-hero',
  async () => (await getFreshHomeHeroContent()) ?? null,
  PUBLIC_CACHE_SHORT_SECONDS
);

const loadHomeSeoData = unstable_cache(
  async (_source?: 'rds'): Promise<HomeSeoData> => {
    void _source;

    const { data, error } = await findActiveHomeHeroRowFromRds() as unknown as ReadResult<HeroRow | null>;

    if (error) throw error;

    return {
      title: data?.seo_title?.trim() || undefined,
      description: data?.seo_description?.trim() || undefined,
    };
  },
  ['home-seo-data-v1'],
  { revalidate: 300 }
);

export async function getHomeSeoData() {
  return loadHomeSeoData('rds');
}
