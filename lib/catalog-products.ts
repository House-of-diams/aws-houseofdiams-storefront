import type { Product } from '@/lib/data/products'
import { mediaUrl } from '@/lib/media-url'
import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import {
  loadActiveProductRowsFromRds,
  loadProductCustomDropdownOptionsFromRds,
  loadProductDiscoveryRowsFromRds,
  loadProductFilterGroupsFromRds,
  loadProductHydrationRowsFromRds,
  loadProductPageIndexFromRds,
  loadProductPageReferencesFromRds,
  loadProductSearchReferencesFromRds,
  loadSearchProductsFromRds,
} from '@/lib/repositories/product-repository'
import {
  buildProductSearchDoc,
  searchProductDocs,
  SEARCH_FIELD_WEIGHTS,
  type ProductSearchDoc,
  type ProductSearchResult,
} from '@/lib/product-search'

type ProductKeyValue = {
  key: string
  value: string
}

type ProductDetailSection = {
  id: string
  title: string
  rows: ProductKeyValue[]
  visible: boolean
}

type ProductFaqItem = {
  id: string
  product_id: string
  question: string
  answer: string
  sort_order?: number | null
  is_active?: boolean | null
}

type CatalogCategory = {
  id: string
  code: string
  name: string
  slug: string
  category_lane?: 'standard' | 'hiphop' | 'collection' | null
}

type CatalogSubcategory = {
  id: string
  category_id: string
  name: string
  slug: string
}

type CatalogOption = {
  id: string
  subcategory_id: string
  name: string
  slug: string
}

type CatalogMetal = {
  id: string
  name: string
  slug: string
  color_hex?: string | null
  composition_description?: string | null
  purity_label?: string | null
  base_metal_name?: string | null
  display_label?: string | null
  is_combined_option?: boolean | null
}

type CatalogMaterialValue = {
  id: string
  name: string
  slug: string
  cta_mode?: 'both' | 'enquire_only' | 'checkout_only' | null
  cta_label?: string | null
}

type CatalogCertificate = {
  id: string
  name: string
  code?: string | null
}

type CatalogStyle = {
  id: string
  name: string
  slug: string
}

type CatalogStoneShape = {
  id: string
  name: string
  slug: string
  svg_asset_url?: string | null
}

type CatalogGstSlab = {
  id: string
  name: string
  code: string
  percentage: number
}

type CatalogRingSize = {
  id: string
  name: string
  slug: string
}

type CatalogRingCategory = {
  id: string
  name: string
  slug: string
  description?: string | null
}

type CatalogRingCategorySize = {
  id: string
  ring_category_id: string
  size_label: string
  size_value?: string | null
}

type ProductContentRule = {
  id: string
  kind: 'shipping' | 'care_warranty'
  name: string
  slug: string
  title: string
  body: string
}

type ProductRow = {
  id: string
  slug: string
  name: string
  product_lane?: 'standard' | 'hiphop' | 'collection' | null
  detail_template?: 'standard' | 'hiphop' | null
  default_purity_price_id?: string | null
  main_category_id: string
  subcategory_id: string | null
  option_id: string | null
  style_id?: string | null
  description: string | null
  tag_line: string | null
  seo_title?: string | null
  seo_description?: string | null
  h1_title?: string | null
  base_price: number | null
  gst_slab_id?: string | null
  stock_quantity?: number | null
  allow_checkout?: boolean | null
  featured: boolean
  image_1_path: string | null
  image_2_path: string | null
  image_3_path: string | null
  image_4_path: string | null
  image_1_alt?: string | null
  image_2_alt?: string | null
  image_3_alt?: string | null
  image_4_alt?: string | null
  video_path: string | null
  model_3d_url?: string | null
  show_image_1?: boolean | null
  show_image_2?: boolean | null
  show_image_3?: boolean | null
  show_image_4?: boolean | null
  show_video?: boolean | null
  status: string
  custom_order_enabled?: boolean | null
  ready_to_ship?: boolean | null
  hiphop_badges?: string[] | null
  chain_length_options?: string[] | null
  gram_weight_label?: string | null
  gram_weight_value?: string | null
  hiphop_carat_label?: string | null
  hiphop_carat_values?: string[] | null
  purity_values?: string[] | null
  certificate_ids?: string[] | null
  ring_size_ids?: string[] | null
  ring_enabled?: boolean | null
  ring_category_id?: string | null
  fit_options?: string[] | null
  fit_label?: string | null
  gemstone_label?: string | null
  gemstone_value?: string | null
  shapes_enabled?: boolean | null
  show_purity?: boolean | null
  engraving_enabled?: boolean | null
  engraving_label?: string | null
  custom_dropdowns_enabled?: boolean | null
  shipping_rule_id?: string | null
  care_warranty_rule_id?: string | null
  shipping_enabled?: boolean | null
  care_warranty_enabled?: boolean | null
  shipping_override_enabled?: boolean | null
  care_warranty_override_enabled?: boolean | null
  shipping_title_override?: string | null
  shipping_body_override?: string | null
  care_warranty_title_override?: string | null
  care_warranty_body_override?: string | null
  features?: string[] | null
  specifications?: ProductKeyValue[] | null
  product_details?: ProductKeyValue[] | null
  detail_sections?: ProductDetailSection[] | null
}

type ProductMaterialValueSelectionRow = {
  product_id: string
  material_value_id: string
  sort_order?: number | null
}

type ProductMetalSelectionRow = {
  product_id: string
  metal_id: string
  sort_order?: number | null
}

type ProductStoneShapeSelectionRow = {
  product_id: string
  shape_id: string
  shape: CatalogStoneShape | CatalogStoneShape[] | null
}

type ProductCustomDropdownRow = {
  id: string
  product_id: string
  name: string
  label: string
  is_required?: boolean | null
}

type ProductCustomDropdownOptionRow = {
  id: string
  dropdown_id: string
  label: string
  value: string
}

export type StorefrontCustomDropdown = { id: string; name: string; label: string; isRequired: boolean; options: { id: string; label: string; value: string }[] }

type ProductPurityPriceRow = {
  id: string
  product_id: string
  purity_label: string
  price: number | null
  sort_order?: number | null
}

type ProductMetalMediaRow = {
  id: string
  product_id: string
  metal_id: string
  image_1_path?: string | null
  image_2_path?: string | null
  image_3_path?: string | null
  image_4_path?: string | null
  video_path?: string | null
  is_default_fallback?: boolean | null
}

type ProductMetalVariantRow = {
  id: string
  product_id: string
  metal_id: string
  price: number | null
  is_default?: boolean | null
  sort_order?: number | null
}

type ProductVariantMediaItemRow = {
  id: string
  product_id: string
  variant_id?: string | null
  media_type: 'image' | 'video'
  media_path: string
  alt_text?: string | null
  sort_order?: number | null
  is_default_fallback?: boolean | null
}

type ProductSubcategoryLinkRow = {
  product_id: string
  subcategory_id: string
  is_primary?: boolean | null
  sort_order?: number | null
}

type ProductOptionLinkRow = {
  product_id: string
  option_id: string
  is_primary?: boolean | null
  sort_order?: number | null
}

type MetalCompositionPartRow = {
  id: number
  metal_id: string
  part_name: string
  percentage: number
  color_hex?: string | null
  sort_order?: number | null
}

export type StorefrontProduct = Product & {
  dbId: string
  productLane: 'standard' | 'hiphop' | 'collection'
  detailTemplate: 'standard' | 'hiphop'
  mainCategoryId: string
  mainCategoryCode: string
  mainCategoryName: string
  mainCategorySlug: string
  subcategoryName?: string | null
  subcategorySlug?: string | null
  linkedSubcategorySlugs: string[]
  optionName?: string | null
  optionSlug?: string | null
  linkedOptionSlugs: string[]
  styleName?: string | null
  styleSlug?: string | null
  metalsFull: {
    id: string
    name: string
    slug: string
    colorHex?: string | null
    compositionDescription?: string | null
    purityLabel?: string | null
    baseMetalName?: string | null
    displayLabel?: string | null
    isCombinedOption?: boolean
  }[]
  metalCompositions: {
    metalId: string
    name: string
    description?: string | null
    parts: { partName: string; percentage: number; colorHex?: string | null }[]
  }[]
  purities: string[]
  certificateNames: string[]
  ringSizeNames: string[]
  ringEnabled: boolean
  ringCategoryId: string
  ringCategoryName: string
  ringCategoryOptions: { id: string; name: string; sizes: string[] }[]
  fitLabel: string
  fitOptions: string[]
  gemstoneLabel: string
  gemstoneValue: string
  gemstoneValues: string[]
  materialValueOptions: { id: string; name: string; slug: string; ctaMode: 'both' | 'enquire_only' | 'checkout_only'; ctaLabel?: string | null }[]
  shapesEnabled: boolean
  shapeOptions: { id: string; name: string; slug: string; iconUrl?: string | null }[]
  primaryShapeSlug: string
  showPurity: boolean
  engravingEnabled: boolean
  engravingLabel: string
  customDropdowns: StorefrontCustomDropdown[]
  featuresList: string[]
  specificationRows: ProductKeyValue[]
  productDetailRows: ProductKeyValue[]
  detailSections: ProductDetailSection[]
  shippingContent: { title: string; body: string } | null
  careWarrantyContent: { title: string; body: string } | null
  faqItems: { id: string; question: string; answer: string; sortOrder: number }[]
  descriptionText: string
  tagLineText: string
  customOrderEnabled: boolean
  readyToShip: boolean
  hiphopBadges: string[]
  chainLengthOptions: string[]
  gramWeightLabel: string
  gramWeightValue: string
  hiphopCaratLabel: string
  hiphopCaratValues: string[]
  gstSlabId: string | null
  gstLabel: string
  gstPercentage: number
  stockQuantity: number
  allowCheckout: boolean
  defaultPurityPriceId: string | null
  purityPriceRows: ProductPurityPriceRow[]
  selectedPrice: number
  metalMediaRows: ProductMetalMediaRow[]
  defaultMetalMedia: ProductMetalMediaRow | null
  metalPurityVariants: {
    id: string
    metalId: string
    metalSlug: string
    label: string
    purityLabel?: string | null
    baseMetalName?: string | null
    price: number
    isDefault: boolean
    mediaItems: { id: string; type: 'image' | 'video'; url: string; altText?: string | null; sortOrder: number }[]
  }[]
  defaultVariantMediaItems: { id: string; type: 'image' | 'video'; url: string; altText?: string | null; sortOrder: number }[]
}

export type StorefrontProductCard = Pick<
  StorefrontProduct,
  | 'dbId'
  | 'id'
  | 'slug'
  | 'name'
  | 'category'
  | 'type'
  | 'stone'
  | 'cut'
  | 'metals'
  | 'purities'
  | 'priceFrom'
  | 'carat'
  | 'featured'
  | 'isNew'
  | 'shortMeta'
  | 'gemColor'
  | 'gemStyle'
  | 'imageUrl'
  | 'galleryUrls'
  | 'productLane'
  | 'mainCategoryName'
  | 'mainCategorySlug'
  | 'subcategorySlug'
  | 'linkedSubcategorySlugs'
  | 'optionSlug'
  | 'linkedOptionSlugs'
  | 'styleName'
  | 'styleSlug'
  | 'certificateNames'
  | 'ringSizeNames'
  | 'shapeOptions'
> & {
  metalsFull: Pick<StorefrontProduct['metalsFull'][number], 'id' | 'name' | 'slug' | 'colorHex' | 'displayLabel'>[]
  metalMediaRows: Array<Pick<ProductMetalMediaRow, 'product_id' | 'metal_id' | 'image_1_path' | 'image_2_path' | 'image_3_path' | 'image_4_path'>>
  metalPurityVariants: Array<
    Pick<StorefrontProduct['metalPurityVariants'][number], 'id' | 'metalId' | 'metalSlug' | 'label' | 'price' | 'isDefault'> & {
      mediaItems: StorefrontProduct['metalPurityVariants'][number]['mediaItems']
    }
  >
}

export function toStorefrontProductCard(product: StorefrontProduct): StorefrontProductCard {
  return {
    dbId: product.dbId,
    id: product.id,
    slug: product.slug,
    name: product.name,
    category: product.category,
    type: product.type,
    stone: product.stone,
    cut: product.cut,
    metals: product.metals,
    purities: product.purities,
    priceFrom: product.priceFrom,
    carat: product.carat,
    featured: product.featured,
    isNew: product.isNew,
    shortMeta: product.shortMeta,
    gemColor: product.gemColor,
    gemStyle: product.gemStyle,
    imageUrl: product.imageUrl,
    galleryUrls: product.galleryUrls,
    productLane: product.productLane,
    mainCategoryName: product.mainCategoryName,
    mainCategorySlug: product.mainCategorySlug,
    subcategorySlug: product.subcategorySlug,
    linkedSubcategorySlugs: product.linkedSubcategorySlugs,
    optionSlug: product.optionSlug,
    linkedOptionSlugs: product.linkedOptionSlugs,
    styleName: product.styleName,
    styleSlug: product.styleSlug,
    certificateNames: product.certificateNames,
    ringSizeNames: product.ringSizeNames,
    shapeOptions: product.shapeOptions,
    metalsFull: product.metalsFull.map(({ id, name, slug, colorHex, displayLabel }) => ({ id, name, slug, colorHex, displayLabel })),
    metalMediaRows: product.metalMediaRows.map(({ product_id, metal_id, image_1_path, image_2_path, image_3_path, image_4_path }) => ({ product_id, metal_id, image_1_path, image_2_path, image_3_path, image_4_path })),
    metalPurityVariants: product.metalPurityVariants.map(({ id, metalId, metalSlug, label, price, isDefault, mediaItems }) => ({
      id,
      metalId,
      metalSlug,
      label,
      price,
      isDefault,
      mediaItems: mediaItems.filter((item) => item.type === 'image' && item.url).slice(0, 2),
    })),
  }
}

function toPublicUrl(path: string | null | undefined) {
  if (!path) return undefined
  return mediaUrl(path)
}

function normalizeType(value: string | null | undefined) {
  const source = (value || '').toLowerCase()
  if (source.includes('ear')) return 'earring'
  if (source.includes('neck') || source.includes('pendant')) return source.includes('pendant') ? 'pendant' : 'necklace'
  if (source.includes('bracelet') || source.includes('bangle') || source.includes('tennis')) return 'bracelet'
  if (source.includes('chain')) return 'chain'
  if (source.includes('grill')) return 'grillz'
  return 'ring'
}

function buildCombinedMetalLabel(args: {
  displayLabel?: string | null
  purityLabel?: string | null
  baseMetalName?: string | null
  name: string
}) {
  const purity = args.purityLabel?.trim()
  const baseMetal = args.baseMetalName?.trim() || args.name.trim()
  const displayLabel = args.displayLabel?.trim()
  const generatedLabel = (() => {
    if (!purity) return baseMetal

    const normalizedPurity = purity.toLowerCase()
    const normalizedBaseMetal = baseMetal.toLowerCase()
    return normalizedBaseMetal === normalizedPurity || normalizedBaseMetal.startsWith(`${normalizedPurity} `)
      ? baseMetal
      : `${purity} ${baseMetal}`.trim()
  })()

  if (displayLabel && displayLabel !== args.name.trim() && displayLabel !== baseMetal) {
    return displayLabel
  }
  return generatedLabel
}

function buildShortMeta(args: {
  subcategoryName?: string | null
  optionName?: string | null
  metals: { name: string; slug: string }[]
}) {
  const { subcategoryName, optionName, metals } = args
  const label = optionName || subcategoryName || 'Signature'
  const metal = metals[0]?.name || ''
  return [label, metal].filter(Boolean).join(' · ')
}

function mapCategoryLabel(productLane: 'standard' | 'hiphop' | 'collection', categoryCode: string): Product['category'] {
  if (productLane === 'hiphop') return 'hiphop'
  return 'fine'
}

function defaultSpecs(product: ProductRow, metals: { name: string; slug: string }[]) {
  return [
    { key: 'Metal', value: metals[0]?.name || 'On Request' },
    { key: 'Crafted In', value: 'Surat, India' },
  ]
}

function buildHiphopSpecRows(product: ProductRow) {
  return [
    product.gram_weight_value ? { key: product.gram_weight_label || 'Gram Weight', value: product.gram_weight_value } : null,
  ].filter(Boolean) as ProductKeyValue[]
}

function resolveMetalMediaDefaults(
  product: ProductRow,
  metalMediaRows: ProductMetalMediaRow[]
) {
  const fallbackMedia =
    metalMediaRows.find((entry) => entry.is_default_fallback) ??
    metalMediaRows.find((entry) => entry.image_1_path || entry.image_2_path || entry.image_3_path || entry.image_4_path || entry.video_path) ??
    null

  const source = fallbackMedia
    ? {
      image_1_path: fallbackMedia.image_1_path ?? null,
      image_2_path: fallbackMedia.image_2_path ?? null,
      image_3_path: fallbackMedia.image_3_path ?? null,
      image_4_path: fallbackMedia.image_4_path ?? null,
      video_path: fallbackMedia.video_path ?? null,
    }
    : {
      image_1_path: product.image_1_path,
      image_2_path: product.image_2_path,
      image_3_path: product.image_3_path,
      image_4_path: product.image_4_path,
      video_path: product.video_path,
    }

  return { fallbackMedia, source }
}

export type StorefrontProductLane = 'standard' | 'hiphop' | 'collection'

export type StorefrontProductPageFilters = {
  categorySlug?: string | null
  subcategorySlug?: string | null
  optionSlug?: string | null
  shapeSlug?: string | null
  styleSlug?: string | null
  metalSlug?: string | null
  certificate?: string | null
}

export type StorefrontProductSort = 'best-matches' | 'price-low' | 'price-high' | 'best-sellers'

type StorefrontProductFetchScope = {
  slug?: string
  slugs?: string[]
  productIds?: string[]
  mainCategoryId?: string
  mainCategoryIds?: string[]
  excludeProductId?: string
  excludeProductIds?: string[]
  searchTokens?: string[]
  limit?: number
}

function groupRowsBy<T>(rows: T[], getKey: (row: T) => string | null | undefined) {
  const grouped = new Map<string, T[]>()
  for (const row of rows) {
    const key = getKey(row)
    if (!key) continue
    const group = grouped.get(key)
    if (group) group.push(row)
    else grouped.set(key, [row])
  }
  return grouped
}

const fetchStorefrontProducts = async (
  productLane?: StorefrontProductLane,
  scope?: StorefrontProductFetchScope
) => {

  const productsResult = { data: await loadActiveProductRowsFromRds(productLane, scope), error: null as { code?: string; message: string } | null }
  if (productsResult.error) throw new Error(productsResult.error.message)

  const productIds = (productsResult.data || []).map((product) => product.id as string)

  const [categoriesResult, subcategoriesResult, optionsResult, metalsResult, materialValuesResult, certificatesResult, stylesResult, ringCategoriesResult, ringCategorySizesResult, productContentRulesResult, metalSelectionsResult, materialValueSelectionsResult, shapeSelectionsResult, gstSlabsResult, purityPricesResult, metalMediaResult, metalCompositionPartsResult, subcategoryLinksResult, optionLinksResult, metalVariantsResult, variantMediaItemsResult, productFaqResult, customDropdownResult] =
    (await loadProductHydrationRowsFromRds(scope ? productIds : null))

  const customDropdownIds = ((customDropdownResult.data || []) as ProductCustomDropdownRow[]).map((entry) => entry.id)
  const customDropdownOptionResult = await loadProductCustomDropdownOptionsFromRds(customDropdownIds)

  const error =
    productsResult.error ||
    categoriesResult.error ||
    subcategoriesResult.error ||
    optionsResult.error ||
    metalsResult.error ||
    metalSelectionsResult.error ||
    metalVariantsResult.error ||
    variantMediaItemsResult.error ||
    customDropdownResult.error ||
    customDropdownOptionResult.error

  if (error) {
    throw new Error(error.message)
  }

  const categories = (categoriesResult.data || []) as CatalogCategory[]
  const subcategories = (subcategoriesResult.data || []) as CatalogSubcategory[]
  const options = (optionsResult.data || []) as CatalogOption[]
  const metals = (metalsResult.data || []) as CatalogMetal[]
  const materialValues = materialValuesResult.error ? ([] as CatalogMaterialValue[]) : ((materialValuesResult.data || []) as CatalogMaterialValue[])
  const certificates = certificatesResult.error ? ([] as CatalogCertificate[]) : ((certificatesResult.data || []) as CatalogCertificate[])
  const styles = stylesResult.error ? ([] as CatalogStyle[]) : ((stylesResult.data || []) as CatalogStyle[])
  const ringCategories = ringCategoriesResult.error ? ([] as CatalogRingCategory[]) : ((ringCategoriesResult.data || []) as CatalogRingCategory[])
  const ringCategorySizes = ringCategorySizesResult.error ? ([] as CatalogRingCategorySize[]) : ((ringCategorySizesResult.data || []) as CatalogRingCategorySize[])
  const productContentRules = productContentRulesResult.error ? ([] as ProductContentRule[]) : ((productContentRulesResult.data || []) as ProductContentRule[])
  const gstSlabs = gstSlabsResult.error ? ([] as CatalogGstSlab[]) : ((gstSlabsResult.data || []) as CatalogGstSlab[])
  const purityPriceRows = purityPricesResult.error ? ([] as ProductPurityPriceRow[]) : ((purityPricesResult.data || []) as ProductPurityPriceRow[])
  const metalMediaRows = metalMediaResult.error ? ([] as ProductMetalMediaRow[]) : ((metalMediaResult.data || []) as ProductMetalMediaRow[])
  const metalCompositionParts = metalCompositionPartsResult.error ? ([] as MetalCompositionPartRow[]) : ((metalCompositionPartsResult.data || []) as MetalCompositionPartRow[])
  const subcategoryLinks = subcategoryLinksResult.error ? ([] as ProductSubcategoryLinkRow[]) : ((subcategoryLinksResult.data || []) as ProductSubcategoryLinkRow[])
  const optionLinks = optionLinksResult.error ? ([] as ProductOptionLinkRow[]) : ((optionLinksResult.data || []) as ProductOptionLinkRow[])
  const productMetalVariants = metalVariantsResult.error ? ([] as ProductMetalVariantRow[]) : ((metalVariantsResult.data || []) as ProductMetalVariantRow[])
  const productVariantMediaItems = variantMediaItemsResult.error ? ([] as ProductVariantMediaItemRow[]) : ((variantMediaItemsResult.data || []) as ProductVariantMediaItemRow[])
  const productFaqItems = productFaqResult.error ? ([] as ProductFaqItem[]) : ((productFaqResult.data || []) as ProductFaqItem[])
  const metalSelections = (metalSelectionsResult.data || []) as ProductMetalSelectionRow[]
  const materialValueSelections = materialValueSelectionsResult.error ? [] : ((materialValueSelectionsResult.data || []) as ProductMaterialValueSelectionRow[])
  const shapeSelections = shapeSelectionsResult.error ? [] : ((shapeSelectionsResult.data || []) as ProductStoneShapeSelectionRow[])
  const customDropdownRows = customDropdownResult.error ? [] : ((customDropdownResult.data || []) as ProductCustomDropdownRow[])
  const customDropdownOptionRows = customDropdownOptionResult.error ? [] : ((customDropdownOptionResult.data || []) as ProductCustomDropdownOptionRow[])
  const products = (productsResult.data || []) as ProductRow[]

  const subcategoryLinksByProduct = groupRowsBy(subcategoryLinks, (entry) => entry.product_id)
  const optionLinksByProduct = groupRowsBy(optionLinks, (entry) => entry.product_id)
  const metalSelectionsByProduct = groupRowsBy(metalSelections, (entry) => entry.product_id)
  const materialValueSelectionsByProduct = groupRowsBy(materialValueSelections, (entry) => entry.product_id)
  const shapeSelectionsByProduct = groupRowsBy(shapeSelections, (entry) => entry.product_id)
  const purityPricesByProduct = groupRowsBy(purityPriceRows, (entry) => entry.product_id)
  const metalVariantsByProduct = groupRowsBy(productMetalVariants, (entry) => entry.product_id)
  const metalMediaByProduct = groupRowsBy(metalMediaRows, (entry) => entry.product_id)
  const variantMediaByProduct = groupRowsBy(productVariantMediaItems, (entry) => entry.product_id)
  const variantMediaByVariant = groupRowsBy(productVariantMediaItems, (entry) => entry.variant_id)
  const faqItemsByProduct = groupRowsBy(productFaqItems, (entry) => entry.product_id)
  const customDropdownsByProduct = groupRowsBy(customDropdownRows, (entry) => entry.product_id)
  const customDropdownOptionsByDropdown = groupRowsBy(customDropdownOptionRows, (entry) => entry.dropdown_id)
  const ringSizesByCategory = groupRowsBy(ringCategorySizes, (entry) => entry.ring_category_id)
  const compositionPartsByMetal = groupRowsBy(metalCompositionParts, (entry) => entry.metal_id)

  return products.map((product, index) => {
    const productLane = product.product_lane ?? 'standard'
    const category = categories.find((entry) => entry.id === product.main_category_id)
    const subcategory = subcategories.find((entry) => entry.id === product.subcategory_id)
    const option = options.find((entry) => entry.id === product.option_id)
    const linkedSubcategories = (subcategoryLinksByProduct.get(product.id) || [])
      .filter((entry) => !entry.is_primary)
      .map((entry) => subcategories.find((subcategoryEntry) => subcategoryEntry.id === entry.subcategory_id))
      .filter(Boolean) as CatalogSubcategory[]
    const linkedOptions = (optionLinksByProduct.get(product.id) || [])
      .filter((entry) => !entry.is_primary)
      .map((entry) => options.find((optionEntry) => optionEntry.id === entry.option_id))
      .filter(Boolean) as CatalogOption[]
    const style = styles.find((entry) => entry.id === product.style_id)
    const productMetalSelections = [...(metalSelectionsByProduct.get(product.id) || [])]
      .sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0))
    const productMetalIds = productMetalSelections.map((entry) => entry.metal_id)

    const selectedMetals = productMetalSelections
      .map((selection) => metals.find((entry) => entry.id === selection.metal_id))
      .filter(Boolean) as CatalogMetal[]
    const productMaterialValueSelections = [...(materialValueSelectionsByProduct.get(product.id) || [])]
      .sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0))
    const selectedMaterialValues = productMaterialValueSelections
      .map((entry) => materialValues.find((materialValue) => materialValue.id === entry.material_value_id))
      .filter(Boolean) as CatalogMaterialValue[]
    const selectedShapes = (shapeSelectionsByProduct.get(product.id) || [])
      .map((entry) => Array.isArray(entry.shape) ? entry.shape[0] : entry.shape)
      .filter(Boolean) as CatalogStoneShape[]
    const selectedCertificates = certificates
      .filter((entry) => (product.certificate_ids || []).includes(entry.id))
      .map((entry) => entry.name)
    const ringCategory = ringCategories.find((entry) => entry.id === product.ring_category_id)
    const selectedRingSizes = (ringSizesByCategory.get(product.ring_category_id || '') || [])
      .map((entry) => entry.size_label)
    const ringCategoryOptions = ringCategories
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        sizes: (ringSizesByCategory.get(entry.id) || []).map((size) => size.size_label),
      }))
      .filter((entry) => entry.sizes.length > 0)
    const gstSlab = gstSlabs.find((entry) => entry.id === product.gst_slab_id)
    const shippingRule = productContentRules.find((entry) => entry.id === product.shipping_rule_id && entry.kind === 'shipping')
    const careWarrantyRule = productContentRules.find((entry) => entry.id === product.care_warranty_rule_id && entry.kind === 'care_warranty')
    const productPurityPrices = purityPricesByProduct.get(product.id) || []
    const productMetalVariantRows = metalVariantsByProduct.get(product.id) || []
    const productMetalMediaRows = (metalMediaByProduct.get(product.id) || [])
      .map((entry) => ({
        ...entry,
        image_1_path: toPublicUrl(entry.image_1_path) ?? null,
        image_2_path: toPublicUrl(entry.image_2_path) ?? null,
        image_3_path: toPublicUrl(entry.image_3_path) ?? null,
        image_4_path: toPublicUrl(entry.image_4_path) ?? null,
        video_path: toPublicUrl(entry.video_path) ?? null,
      }))
    const defaultPurityPrice =
      productPurityPrices.find((entry) => entry.id === product.default_purity_price_id) ??
      productPurityPrices[0] ??
      null
    const { fallbackMedia, source: resolvedMediaSource } = resolveMetalMediaDefaults(product, productMetalMediaRows)
    const defaultVariantMediaItems = (variantMediaByProduct.get(product.id) || [])
      .filter((entry) => entry.is_default_fallback && !entry.variant_id)
      .map((entry) => ({
        id: entry.id,
        type: entry.media_type,
        url: toPublicUrl(entry.media_path) ?? entry.media_path,
        altText: entry.alt_text ?? null,
        sortOrder: Number(entry.sort_order ?? 0),
      }))
      .filter((entry) => Boolean(entry.url))
    const combinedVariants = productMetalVariantRows
      .map((entry) => {
        const metal = metals.find((metalEntry) => metalEntry.id === entry.metal_id)
        if (!metal) return null
        const mediaItems = (variantMediaByVariant.get(entry.id) || [])
          .map((mediaEntry) => ({
            id: mediaEntry.id,
            type: mediaEntry.media_type,
            url: toPublicUrl(mediaEntry.media_path) ?? mediaEntry.media_path,
            altText: mediaEntry.alt_text ?? null,
            sortOrder: Number(mediaEntry.sort_order ?? 0),
          }))
          .filter((mediaEntry) => Boolean(mediaEntry.url))

        return {
          id: entry.id,
          metalId: metal.id,
          metalSlug: metal.slug,
          label: buildCombinedMetalLabel({
            displayLabel: metal.display_label,
            purityLabel: metal.purity_label,
            baseMetalName: metal.base_metal_name,
            name: metal.name,
          }),
          purityLabel: metal.purity_label ?? null,
          baseMetalName: metal.base_metal_name ?? metal.name,
          price: Number(entry.price ?? 0),
          isDefault: Boolean(entry.is_default),
          mediaItems,
        }
      })
      .filter(Boolean) as StorefrontProduct['metalPurityVariants']
    const fallbackMetalId = fallbackMedia?.metal_id || selectedMetals[0]?.id || null
    const legacyCombinedVariants =
      combinedVariants.length > 0
        ? []
        : selectedMetals.flatMap((metal) => {
          const metalSpecificMedia = productMetalMediaRows.find((entry) => entry.metal_id === metal.id) || fallbackMedia
          const mediaItems = [
            { id: `${product.id}-${metal.id}-legacy-image-1`, type: 'image' as const, url: metalSpecificMedia?.image_1_path || '', altText: product.image_1_alt ?? null },
            { id: `${product.id}-${metal.id}-legacy-image-2`, type: 'image' as const, url: metalSpecificMedia?.image_2_path || '', altText: product.image_2_alt ?? null },
            { id: `${product.id}-${metal.id}-legacy-image-3`, type: 'image' as const, url: metalSpecificMedia?.image_3_path || '', altText: product.image_3_alt ?? null },
            { id: `${product.id}-${metal.id}-legacy-image-4`, type: 'image' as const, url: metalSpecificMedia?.image_4_path || '', altText: product.image_4_alt ?? null },
            { id: `${product.id}-${metal.id}-legacy-video`, type: 'video' as const, url: metalSpecificMedia?.video_path || '' },
          ]
            .filter((entry) => Boolean(entry.url))
            .map((entry, index) => ({ ...entry, sortOrder: index + 1 }))

          const sourcePurityRows =
            productPurityPrices.length > 0
              ? productPurityPrices
              : [
                {
                  id: `${product.id}-${metal.id}-fallback-price`,
                  purity_label: metal.purity_label ?? '',
                  price: Number(product.base_price ?? 0),
                  sort_order: 1,
                },
              ]

          return sourcePurityRows
            .filter((entry) => Number(entry.price ?? 0) > 0 || selectedMetals.length === 1)
            .map((entry, purityIndex) => {
              const purityLabel = entry.purity_label?.trim() || metal.purity_label?.trim() || ''
              const label = buildCombinedMetalLabel({
                displayLabel: purityLabel ? null : metal.display_label,
                purityLabel,
                baseMetalName: metal.base_metal_name ?? metal.name,
                name: metal.name,
              })

              return {
                id: `legacy-${product.id}-${metal.id}-${entry.id || purityIndex + 1}`,
                metalId: metal.id,
                metalSlug: metal.slug,
                label,
                purityLabel: purityLabel || null,
                baseMetalName: metal.base_metal_name ?? metal.name,
                price: Number(entry.price ?? product.base_price ?? 0),
                isDefault:
                  metal.id === fallbackMetalId &&
                  (productPurityPrices.length < 1 || entry.id === defaultPurityPrice?.id || purityIndex === 0),
                mediaItems,
              }
            })
        })
    const effectiveCombinedVariants =
      combinedVariants.length > 0
        ? combinedVariants
        : (legacyCombinedVariants as StorefrontProduct['metalPurityVariants'])
    const defaultCombinedVariant = effectiveCombinedVariants.find((entry) => entry.isDefault) ?? effectiveCombinedVariants[0] ?? null
    const resolvedPrice = Number(defaultCombinedVariant?.price ?? defaultPurityPrice?.price ?? product.base_price ?? 0)
    const combinedVariantImages = (defaultCombinedVariant?.mediaItems ?? [])
      .filter((entry) => entry.type === 'image')
      .map((entry) => entry.url)
      .filter(Boolean)
    const fallbackVariantImages = defaultVariantMediaItems
      .filter((entry) => entry.type === 'image')
      .map((entry) => entry.url)
      .filter(Boolean)
    const legacyVisibleImageEntries = [
      { url: product.show_image_1 === false ? undefined : toPublicUrl(resolvedMediaSource.image_1_path), alt: product.image_1_alt },
      { url: product.show_image_2 === false ? undefined : toPublicUrl(resolvedMediaSource.image_2_path), alt: product.image_2_alt },
      { url: product.show_image_3 === false ? undefined : toPublicUrl(resolvedMediaSource.image_3_path), alt: product.image_3_alt },
      { url: product.show_image_4 === false ? undefined : toPublicUrl(resolvedMediaSource.image_4_path), alt: product.image_4_alt },
    ].filter((entry): entry is { url: string; alt: string | null | undefined } => typeof entry.url === 'string' && entry.url.length > 0)
    const legacyVisibleImages = legacyVisibleImageEntries.map((entry) => entry.url)
    const legacyVisibleImageAlts = legacyVisibleImageEntries.map((entry) => entry.alt || product.name)
    const visibleImages =
      combinedVariantImages.length > 0
        ? combinedVariantImages
        : fallbackVariantImages.length > 0
          ? fallbackVariantImages
          : legacyVisibleImages
    const visibleImageAlts =
      visibleImages === legacyVisibleImages
        ? legacyVisibleImageAlts
        : visibleImages.map(() => product.name)
    const combinedVariantVideo = (defaultCombinedVariant?.mediaItems ?? []).find((entry) => entry.type === 'video')?.url
    const fallbackVariantVideo = defaultVariantMediaItems.find((entry) => entry.type === 'video')?.url
    const visibleVideoUrl = combinedVariantVideo || fallbackVariantVideo || (product.show_video === false ? undefined : toPublicUrl(resolvedMediaSource.video_path))

    const typeSource = option?.name || subcategory?.name || category?.name

    const baseSpecs = product.specifications?.length ? product.specifications : defaultSpecs(product, selectedMetals)
    const hiphopSpecs = product.detail_template === 'hiphop' ? buildHiphopSpecRows(product) : []

    const storefrontProduct: StorefrontProduct = {
      id: index + 1,
      dbId: product.id,
      slug: product.slug,
      name: product.name,
      productLane,
      detailTemplate: product.detail_template === 'hiphop' ? 'hiphop' : 'standard',
      category: mapCategoryLabel(productLane, category?.code || ''),
      type: normalizeType(typeSource),
      stone: 'natural-colourless',
      cut: 'round',
      metals: selectedMetals.map((entry) => entry.slug),
      priceFrom: resolvedPrice,
      carat: selectedMaterialValues[0]?.name || product.gemstone_value || option?.name || category?.name || 'Signature',
      featured: Boolean(product.featured),
      isNew: false,
      shortMeta: buildShortMeta({
        subcategoryName: subcategory?.name,
        optionName: option?.name,
        metals: selectedMetals,
      }),
      seoTitle: product.seo_title ?? undefined,
      seoDescription: product.seo_description ?? undefined,
      h1Title: product.h1_title ?? undefined,
      gemColor: '#D4A840',
      gemStyle: 'round',
      imageUrl: visibleImages[0],
      galleryUrls: visibleImages.length > 1 ? visibleImages.slice(1) : [],
      imageAlts: visibleImageAlts,
      videoUrl: visibleVideoUrl,
      model3dUrl: product.model_3d_url ?? undefined,
      mainCategoryId: product.main_category_id || '',
      mainCategoryCode: category?.code || '',
      mainCategoryName: category?.name || '',
      mainCategorySlug: category?.slug || '',
      subcategoryName: subcategory?.name ?? null,
      subcategorySlug: subcategory?.slug ?? null,
      linkedSubcategorySlugs: linkedSubcategories.map((entry) => entry.slug),
      optionName: option?.name ?? null,
      optionSlug: option?.slug ?? null,
      linkedOptionSlugs: linkedOptions.map((entry) => entry.slug),
      styleName: style?.name ?? null,
      styleSlug: style?.slug ?? null,
      metalsFull: selectedMetals.map((entry) => ({
        id: entry.id,
        name: entry.name,
        slug: entry.slug,
        colorHex: entry.color_hex ?? null,
        compositionDescription: entry.composition_description ?? null,
        purityLabel: entry.purity_label ?? null,
        baseMetalName: entry.base_metal_name ?? null,
        displayLabel: entry.display_label ?? null,
        isCombinedOption: Boolean(entry.is_combined_option),
      })),
      metalCompositions: selectedMetals.map((entry) => ({
        metalId: entry.id,
        name: entry.name,
        description: entry.composition_description ?? null,
        parts: (compositionPartsByMetal.get(entry.id) || [])
          .map((part) => ({
            partName: part.part_name,
            percentage: Number(part.percentage ?? 0),
            colorHex: part.color_hex ?? null,
          })),
      })),
      purities:
        effectiveCombinedVariants.length > 0
          ? Array.from(new Set(effectiveCombinedVariants.map((entry) => entry.purityLabel).filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)))
          : productPurityPrices.length > 0
            ? productPurityPrices.map((entry) => entry.purity_label)
            : (product.purity_values ?? []),
      certificateNames: selectedCertificates,
      ringSizeNames: product.ring_enabled ? selectedRingSizes : [],
      ringEnabled: Boolean(product.ring_enabled),
      ringCategoryId: product.ring_category_id || '',
      ringCategoryName: ringCategory?.name || '',
      ringCategoryOptions,
      fitLabel: product.fit_label || 'Fit',
      fitOptions: product.fit_options ?? [],
      gemstoneLabel: product.gemstone_label || 'Stone Type',
      gemstoneValue: selectedMaterialValues[0]?.name || (product.gemstone_value || '').split(',').map((entry) => entry.trim()).filter(Boolean)[0] || '',
      gemstoneValues: selectedMaterialValues.length > 0 ? selectedMaterialValues.map((entry) => entry.name) : (product.gemstone_value || '').split(',').map((entry) => entry.trim()).filter(Boolean),
      materialValueOptions: selectedMaterialValues.map((entry) => ({
        id: entry.id,
        name: entry.name,
        slug: entry.slug,
        ctaMode: entry.cta_mode === 'enquire_only' || entry.cta_mode === 'checkout_only' ? entry.cta_mode : 'both',
        ctaLabel: entry.cta_label ?? null,
      })),
      shapesEnabled: Boolean(product.shapes_enabled) && selectedShapes.length > 0,
      shapeOptions: selectedShapes.map((shape) => ({
        id: shape.id,
        name: shape.name,
        slug: shape.slug,
        iconUrl: shape.svg_asset_url ?? null,
      })),
      primaryShapeSlug: selectedShapes[0]?.slug || '',
      showPurity: false,
      engravingEnabled: Boolean(product.engraving_enabled),
      engravingLabel: product.engraving_label || 'Complimentary Engraving',
      customDropdowns: product.custom_dropdowns_enabled ? (customDropdownsByProduct.get(product.id) || []).map((group) => ({ id: group.id, name: group.name, label: group.label, isRequired: Boolean(group.is_required), options: (customDropdownOptionsByDropdown.get(group.id) || []).map((option) => ({ id: option.id, label: option.label, value: option.value })) })).filter((group) => group.options.length > 0) : [],
      featuresList: product.features ?? [],
      specificationRows: [...baseSpecs, ...hiphopSpecs],
      productDetailRows: product.product_details ?? [],
      detailSections: (product.detail_sections ?? []).filter((section) => section.visible !== false),
      shippingContent: product.shipping_enabled === false
        ? null
        : {
          title: product.shipping_override_enabled ? product.shipping_title_override || shippingRule?.title || 'Shipping' : shippingRule?.title || 'Shipping',
          body: product.shipping_override_enabled ? product.shipping_body_override || shippingRule?.body || '' : shippingRule?.body || '',
        },
      careWarrantyContent: product.care_warranty_enabled === false
        ? null
        : {
          title: product.care_warranty_override_enabled ? product.care_warranty_title_override || careWarrantyRule?.title || 'Care & Warranty' : careWarrantyRule?.title || 'Care & Warranty',
          body: product.care_warranty_override_enabled ? product.care_warranty_body_override || careWarrantyRule?.body || '' : careWarrantyRule?.body || '',
        },
      faqItems: (faqItemsByProduct.get(product.id) || [])
        .filter((item) => item.question?.trim() && item.answer?.trim())
        .map((item) => ({
          id: item.id,
          question: item.question.trim(),
          answer: item.answer.trim(),
          sortOrder: Number(item.sort_order ?? 0),
        })),
      descriptionText: product.description || '',
      tagLineText: product.tag_line || '',
      customOrderEnabled: Boolean(product.custom_order_enabled),
      readyToShip: Boolean(product.ready_to_ship),
      hiphopBadges: product.hiphop_badges ?? [],
      chainLengthOptions: product.chain_length_options ?? [],
      gramWeightLabel: product.gram_weight_label || 'Gram Weight',
      gramWeightValue: product.gram_weight_value || '',
      hiphopCaratLabel: product.hiphop_carat_label || 'Diamond Carat',
      hiphopCaratValues: product.hiphop_carat_values ?? [],
      gstSlabId: product.gst_slab_id ?? null,
      gstLabel: gstSlab?.name || '',
      gstPercentage: Number(gstSlab?.percentage || 0),
      stockQuantity: Number(product.stock_quantity || 0),
      allowCheckout: Boolean(product.allow_checkout),
      defaultPurityPriceId: defaultPurityPrice?.id ?? null,
      purityPriceRows: productPurityPrices,
      selectedPrice: resolvedPrice,
      metalMediaRows: productMetalMediaRows,
      defaultMetalMedia: fallbackMedia,
      metalPurityVariants: effectiveCombinedVariants,
      defaultVariantMediaItems,
    }

    return storefrontProduct
  })
}

const getRequestStorefrontProducts = cache(fetchStorefrontProducts)

export async function getStorefrontProducts(productLane?: StorefrontProductLane) {
  // The complete storefront product model includes variant and media payloads
  // and can exceed Next.js' 2 MB per-entry data-cache limit. Keep this fetch
  // deduplicated within the current render/request without persisting the full
  // result in `unstable_cache`. Compact card and single-product reads retain
  // their dedicated caches below.
  return getRequestStorefrontProducts(productLane)
}

const getCachedStorefrontProductCards = unstable_cache(
  async (productLane?: StorefrontProductLane, _source?: 'rds') => {
    void _source // The backend label is part of unstable_cache's argument key.
    const products = await fetchStorefrontProducts(productLane)
    return products.map(toStorefrontProductCard)
  },
  ['storefront-product-cards-v1'],
  { revalidate: 300, tags: ['storefront-products'] }
)

export async function getStorefrontProductCards(productLane?: StorefrontProductLane) {
  return getCachedStorefrontProductCards(productLane, 'rds')
}

// Product pages share one cached copy per product (all metal/purity variants,
// prices and media included, so metal switching stays fully client-side).
// Checkout never reads this cache; it prices from the database directly.
const getCachedStorefrontProductBySlug = unstable_cache(
  async (slug: string): Promise<StorefrontProduct | null> => {
    const exactMatches = await fetchStorefrontProducts(undefined, { slug, limit: 1 })
    if (exactMatches[0]) return exactMatches[0]

    const legacySlug = slug.replace(/-\d+$/, '')
    if (legacySlug === slug) return null

    const legacyMatches = await fetchStorefrontProducts(undefined, { slug: legacySlug, limit: 1 })
    return legacyMatches[0] || null
  },
  ['storefront-product-by-slug-v1'],
  { revalidate: 300, tags: ['storefront-products'] }
)

const getRequestStorefrontProductBySlug = cache((slug: string) => getCachedStorefrontProductBySlug(slug))

export async function getStorefrontProductBySlug(slug: string) {
  return getRequestStorefrontProductBySlug(slug)
}

const getCachedRelatedStorefrontProducts = unstable_cache(
  async (
    productId: string,
    productLane: StorefrontProductLane,
    mainCategoryId: string,
    limit: number
  ): Promise<StorefrontProduct[]> => {
    if (!productId || !mainCategoryId || limit < 1) return []

    return fetchStorefrontProducts(productLane, {
      mainCategoryId,
      excludeProductId: productId,
      limit,
    })
  },
  ['storefront-related-products-v1'],
  { revalidate: 300, tags: ['storefront-products'] }
)

const getRequestRelatedStorefrontProducts = cache(getCachedRelatedStorefrontProducts)

export async function getRelatedStorefrontProducts(product: StorefrontProduct, limit = 7) {
  return getRequestRelatedStorefrontProducts(
    product.dbId,
    product.productLane,
    product.mainCategoryId,
    limit
  )
}

function uniqueNonEmptyValues(values: string[], limit: number) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, limit)
}

export async function getStorefrontProductsByIdentifiers({
  slugs,
  ids,
  limit = 50,
}: {
  slugs: string[]
  ids: string[]
  limit?: number
}) {
  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)))
  const uniqueSlugs = uniqueNonEmptyValues(slugs, safeLimit)
  const uniqueIds = uniqueNonEmptyValues(ids, safeLimit).filter((value) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  )

  const [byId, bySlug] = await Promise.all([
    uniqueIds.length > 0
      ? fetchStorefrontProducts(undefined, { productIds: uniqueIds, limit: safeLimit })
      : Promise.resolve([]),
    uniqueSlugs.length > 0
      ? fetchStorefrontProducts(undefined, { slugs: uniqueSlugs, limit: safeLimit })
      : Promise.resolve([]),
  ])

  return [...new Map([...byId, ...bySlug].map((product) => [product.dbId, product])).values()]
    .slice(0, safeLimit)
}

export async function getStorefrontProductsByIds(ids: string[]) {
  const uniqueIds = uniqueNonEmptyValues(ids, 5000).filter((value) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  )
  const products: StorefrontProduct[] = []

  for (let index = 0; index < uniqueIds.length; index += 50) {
    products.push(...await fetchStorefrontProducts(undefined, {
      productIds: uniqueIds.slice(index, index + 50),
      limit: 50,
    }))
  }

  return products
}

export async function getStorefrontProductDiscoveryRows() {
  return loadProductDiscoveryRowsFromRds()

}

function normalizeSlug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-')
}

async function loadStorefrontProductCardPage({
  productLane,
  filters = {},
  sort = 'best-matches',
  page = 1,
  pageSize = 24,
}: {
  productLane?: StorefrontProductLane
  filters?: StorefrontProductPageFilters
  sort?: StorefrontProductSort
  page?: number
  pageSize?: number
}) {

  const safePage = Math.max(1, Math.floor(page))
  const safePageSize = Math.max(1, Math.min(48, Math.floor(pageSize)))

  const [categoriesResult, subcategoriesResult, optionsResult, shapesResult, metalsResult, stylesResult, certificatesResult] = await loadProductPageReferencesFromRds()

  const category = categoriesResult.data?.find((entry) => entry.slug === filters.categorySlug)
  const categorySubcategoryIds = new Set(
    (subcategoriesResult.data ?? [])
      .filter((entry) => !category || entry.category_id === category.id)
      .map((entry) => entry.id)
  )
  const subcategory = subcategoriesResult.data?.find((entry) =>
    entry.slug === filters.subcategorySlug && categorySubcategoryIds.has(entry.id ?? '')
  )
  const option = optionsResult.data?.find((entry) =>
    entry.slug === filters.optionSlug &&
    (!subcategory || entry.subcategory_id === subcategory.id) &&
    categorySubcategoryIds.has(entry.subcategory_id ?? '')
  )
  const shape = shapesResult.data?.find((entry) => entry.slug === filters.shapeSlug)
  const metal = metalsResult.data?.find((entry) => entry.slug === filters.metalSlug)
  const style = stylesResult.data?.find((entry) => entry.slug === filters.styleSlug)
  const certificate = certificatesResult.data?.find((entry) =>
    normalizeSlug(entry.name ?? '') === normalizeSlug(filters.certificate ?? '') ||
    normalizeSlug(entry.code ?? '') === normalizeSlug(filters.certificate ?? '')
  )

  const missingRequestedFilter = Boolean(
    (filters.categorySlug && !category) ||
    (filters.subcategorySlug && !subcategory) ||
    (filters.optionSlug && !option) ||
    (filters.shapeSlug && !shape) ||
    (filters.metalSlug && !metal) ||
    (filters.styleSlug && !style) ||
    (filters.certificate && !certificate)
  )
  if (missingRequestedFilter) return { products: [] as StorefrontProductCard[], totalCount: 0, page: safePage, pageSize: safePageSize }

  const from = (safePage - 1) * safePageSize
  const indexResult = await (async () => {
    const page = await loadProductPageIndexFromRds({
      productLane, categoryId: category?.id, subcategoryId: subcategory?.id,
      optionId: option?.id, shapeId: shape?.id, metalId: metal?.id,
      styleId: style?.id, certificateId: certificate?.id,
      sort, offset: from, pageSize: safePageSize,
    })
    return { data: page.ids.map((id) => ({ id })), count: page.count, error: null as { code?: string; message: string } | null }
  })()
  if (indexResult.error) throw new Error(indexResult.error.message)

  const orderedIds = ((indexResult.data ?? []) as unknown as Array<{ id: string }>).map((entry) => entry.id)
  const pageProducts = orderedIds.length
    ? await fetchStorefrontProducts(productLane, { productIds: orderedIds, limit: safePageSize })
    : []
  const productMap = new Map(pageProducts.map((product) => [product.dbId, product]))

  return {
    products: orderedIds.map((id) => productMap.get(id)).filter((product): product is StorefrontProduct => Boolean(product)).map(toStorefrontProductCard),
    totalCount: indexResult.count ?? 0,
    page: safePage,
    pageSize: safePageSize,
  }
}

async function loadStorefrontFilterGroups(productLane?: StorefrontProductLane, categoryId?: string) {

  const [categories, subcategories, options, shapes, metals, styles, certificates] = await loadProductFilterGroupsFromRds()
  const visibleCategories = (categories.data ?? []).filter((entry) => !productLane || entry.category_lane === productLane)
  const visibleCategoryIds = new Set(categoryId ? [categoryId] : visibleCategories.map((entry) => entry.id))
  const visibleSubcategories = (subcategories.data ?? []).filter((entry) => visibleCategoryIds.has(entry.category_id))
  const visibleSubcategoryIds = new Set(visibleSubcategories.map((entry) => entry.id))

  return [
    ...(!categoryId ? [{ id: 'category', title: 'Category', options: visibleCategories.map((entry) => ({ value: entry.slug, label: entry.name })) }] : []),
    { id: 'subcategory', title: 'Type', options: visibleSubcategories.map((entry) => ({ value: entry.slug, label: entry.name })) },
    { id: 'option', title: 'Style', options: (options.data ?? []).filter((entry) => visibleSubcategoryIds.has(entry.subcategory_id)).map((entry) => ({ value: entry.slug, label: entry.name })) },
    { id: 'shape', title: 'Shape', options: (shapes.data ?? []).map((entry) => ({ value: entry.slug, label: entry.name, iconUrl: entry.svg_asset_url })) },
    { id: 'metal', title: 'Metal', options: (metals.data ?? []).map((entry) => ({ value: entry.slug, label: entry.display_label || entry.name, color: entry.color_hex })) },
    { id: 'certificate', title: 'Certificate', options: (certificates.data ?? []).map((entry) => ({ value: entry.name, label: entry.name })) },
    { id: 'style', title: 'Design Style', options: (styles.data ?? []).map((entry) => ({ value: entry.slug, label: entry.name })) },
  ].filter((group) => group.options.length > 0)
}

type StorefrontProductCardPageArgs = Parameters<typeof loadStorefrontProductCardPage>[0]

// Listing pages share one cached copy per lane/filters/sort/page combination,
// refreshed in the background so no visitor waits on the database.
const getCachedStorefrontProductCardPage = unstable_cache(
  (args: StorefrontProductCardPageArgs) => loadStorefrontProductCardPage(args),
  ['storefront-product-card-page-v1'],
  { revalidate: 300, tags: ['storefront-products'] }
)

export async function getStorefrontProductCardPage(args: StorefrontProductCardPageArgs) {
  return getCachedStorefrontProductCardPage(args)
}

const getCachedStorefrontFilterGroups = unstable_cache(
  (productLane: StorefrontProductLane | null, categoryId: string | null) =>
    loadStorefrontFilterGroups(productLane ?? undefined, categoryId ?? undefined),
  ['storefront-filter-groups-v1'],
  { revalidate: 300, tags: ['storefront-products'] }
)

export async function getStorefrontFilterGroups(productLane?: StorefrontProductLane, categoryId?: string) {
  return getCachedStorefrontFilterGroups(productLane ?? null, categoryId ?? null)
}

const getCachedProductSearchReferences = unstable_cache(
  async (_source?: 'rds') => {
    void _source
    return loadProductSearchReferencesFromRds()

  },
  ['storefront-product-search-references-v1'],
  { revalidate: 300, tags: ['storefront-products'] }
)

function isUsablePublicImageUrl(value: string | null | undefined): value is string {
  if (!value) return false
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

async function getCanonicalSearchImageUrls(productIds: string[]) {
  if (!productIds.length) return new Map<string, string>()
  const products = await fetchStorefrontProducts(undefined, {
    productIds,
    limit: productIds.length,
  })
  return new Map(
    products.map((product) => [
      product.dbId,
      isUsablePublicImageUrl(product.imageUrl) ? product.imageUrl : '',
    ])
  )
}

async function getDefaultProductSearchItemsUncached(limit: number): Promise<ProductSearchResult[]> {
  const products = await loadSearchProductsFromRds(null, limit)
  const references = await getCachedProductSearchReferences('rds')
  const imageUrls = await getCanonicalSearchImageUrls(products.map((product) => product.id))
  return products.map((product) => {
    const category = references.categories.find((entry) => entry.id === product.main_category_id)
    const subcategory = references.subcategories.find((entry) => entry.id === product.subcategory_id)
    return {
      dbId: product.id,
      slug: product.slug,
      name: product.name,
      shortMeta: [subcategory?.name, category?.name].filter(Boolean).join(' · '),
      imageUrl: product.show_image_1 === false ? '' : imageUrls.get(product.id) || '',
      priceFrom: Number(product.base_price ?? 0),
      mainCategorySlug: category?.slug || '',
      mainCategoryName: category?.name || '',
    }
  })
}

// The index stores only compact search documents (about 1 KB per product), so it
// stays well under the 2 MB per-entry data-cache limit as the catalogue grows.
// It is rebuilt at most every five minutes; searches then run fully in memory.
const getCachedProductSearchDocs = unstable_cache(
  async (_source?: 'rds'): Promise<ProductSearchDoc[]> => {
    void _source
    const [products, references] = await Promise.all([
      fetchStorefrontProducts(undefined),
      getCachedProductSearchReferences('rds'),
    ])
    const cards = products.map(toStorefrontProductCard)
    const namesBySlug = (entries: Array<{ slug: string; name: string }>) => new Map(entries.map((entry) => [entry.slug, entry.name]))
    const optionNames = namesBySlug(references.options)
    const subcategoryNames = namesBySlug(references.subcategories)
    const text = (value: unknown) => (typeof value === 'string' ? value : null)

    return cards.map((card) => {
      const optionName = card.optionSlug ? optionNames.get(card.optionSlug) : undefined
      const subcategoryName = card.subcategorySlug ? subcategoryNames.get(card.subcategorySlug) : undefined
      return buildProductSearchDoc(
        {
          dbId: card.dbId,
          slug: card.slug,
          name: card.name,
          shortMeta: [optionName, subcategoryName, card.mainCategoryName].filter(Boolean).join(' · '),
          imageUrl: isUsablePublicImageUrl(card.imageUrl) ? card.imageUrl : '',
          priceFrom: Number(card.priceFrom ?? 0),
          mainCategorySlug: card.mainCategorySlug || '',
          mainCategoryName: card.mainCategoryName || '',
        },
        Boolean(card.featured),
        [
          { weight: SEARCH_FIELD_WEIGHTS.name, values: [card.name] },
          { weight: SEARCH_FIELD_WEIGHTS.option, values: [optionName, ...(card.linkedOptionSlugs ?? []).map((slug) => optionNames.get(slug) ?? slug)] },
          { weight: SEARCH_FIELD_WEIGHTS.subcategory, values: [subcategoryName, ...(card.linkedSubcategorySlugs ?? []).map((slug) => subcategoryNames.get(slug) ?? slug)] },
          { weight: SEARCH_FIELD_WEIGHTS.category, values: [card.mainCategoryName, text(card.category)] },
          { weight: SEARCH_FIELD_WEIGHTS.style, values: [card.styleName] },
          { weight: SEARCH_FIELD_WEIGHTS.shape, values: (card.shapeOptions ?? []).map((shape) => shape.name) },
          { weight: SEARCH_FIELD_WEIGHTS.metal, values: (card.metalsFull ?? []).flatMap((metal) => [metal.name, metal.displayLabel]) },
          { weight: SEARCH_FIELD_WEIGHTS.certificate, values: card.certificateNames ?? [] },
          { weight: SEARCH_FIELD_WEIGHTS.attribute, values: [text(card.type), text(card.stone), text(card.cut)] },
        ]
      )
    })
  },
  ['storefront-product-search-docs-v2'],
  { revalidate: 300, tags: ['storefront-products'] }
)

// Keeps the parsed index in process memory between searches instead of
// re-reading the data cache on every request.
const SEARCH_DOCS_MEMORY_MS = 30_000
let searchDocsMemory: { expiresAt: number; promise: Promise<ProductSearchDoc[]> } | null = null

function getProductSearchDocs() {
  const now = Date.now()
  if (!searchDocsMemory || searchDocsMemory.expiresAt <= now) {
    const promise = getCachedProductSearchDocs('rds')
    searchDocsMemory = { expiresAt: now + SEARCH_DOCS_MEMORY_MS, promise }
    promise.catch(() => {
      if (searchDocsMemory?.promise === promise) searchDocsMemory = null
    })
  }
  return searchDocsMemory.promise
}


const getCachedDefaultProductSearchItems = unstable_cache(
  (_source?: 'rds') => {
    void _source
    return getDefaultProductSearchItemsUncached(16)
  },
  ['storefront-default-product-search-items-v2'],
  { revalidate: 300, tags: ['storefront-products'] }
)

export async function getStorefrontProductSearchItems(query: string, limit = 12): Promise<ProductSearchResult[]> {
  const safeQuery = query.trim()
  const safeLimit = Math.max(1, Math.min(24, Math.floor(limit)))
  if (!safeQuery) {
    return safeLimit === 16 ? getCachedDefaultProductSearchItems('rds') : getDefaultProductSearchItemsUncached(safeLimit)
  }
  return searchProductDocs(await getProductSearchDocs(), safeQuery, safeLimit)
}

export async function getStorefrontCartRecommendations({
  slugs,
  ids,
  limit = 4,
}: {
  slugs: string[]
  ids: string[]
  limit?: number
}) {
  const safeLimit = Math.max(1, Math.min(12, Math.floor(limit)))
  const cartSlugs = new Set(uniqueNonEmptyValues(slugs, 50))
  const cartIds = new Set(uniqueNonEmptyValues(ids, 50))
  const productCards = await getStorefrontProductCards()
  const cartProducts = productCards.filter((product) => cartSlugs.has(product.slug) || cartIds.has(product.dbId))
  const categorySlugs = new Set(cartProducts.map((product) => product.mainCategorySlug).filter(Boolean))

  return productCards
    .filter((product) => !cartSlugs.has(product.slug) && !cartIds.has(product.dbId))
    .sort((left, right) => Number(categorySlugs.has(right.mainCategorySlug)) - Number(categorySlugs.has(left.mainCategorySlug)))
    .slice(0, safeLimit)
}

export function filterStorefrontProducts<T extends StorefrontProductCard>(
  products: T[],
  filters: {
    productLane?: 'standard' | 'hiphop' | 'collection' | null
    categorySlug?: string
    subcategorySlug?: string | null
    optionSlug?: string | null
    shapeSlug?: string | null
    styleSlug?: string | null
    metalSlug?: string | null
    purity?: string | null
    certificate?: string | null
  }
): T[] {
  const { productLane, categorySlug, subcategorySlug, optionSlug, shapeSlug, styleSlug, metalSlug, purity, certificate } = filters

  return products.filter((product) => {
    if (productLane && product.productLane !== productLane) return false
    if (categorySlug && product.mainCategorySlug !== categorySlug) return false
    if (subcategorySlug && product.subcategorySlug !== subcategorySlug && !product.linkedSubcategorySlugs.includes(subcategorySlug)) return false
    if (optionSlug && product.optionSlug !== optionSlug && !product.linkedOptionSlugs.includes(optionSlug)) return false
    if (shapeSlug && !product.shapeOptions.some((entry) => entry.slug === shapeSlug)) return false
    if (styleSlug && product.styleSlug !== styleSlug) return false
    if (metalSlug && !product.metalsFull.some((entry) => entry.slug === metalSlug)) return false
    if (purity && !product.purities.includes(purity)) return false
    if (certificate && !product.certificateNames.some((entry) => entry.toLowerCase().replace(/\s+/g, '-') === certificate)) return false
    return true
  })
}
