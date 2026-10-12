import { buildCategoryPath, buildOptionPath, buildSubcategoryPath } from '@/lib/catalog-paths'
import { loadShopByCategoryRowsFromRds } from '@/lib/repositories/cms-repository'
import { mediaUrl } from '@/lib/media-url'
import { cachePublicRead, PUBLIC_CACHE_LONG_SECONDS } from '@/lib/public-cache'

export type ShopByCategoryCard = { id: string; type: 'category' | 'subcategory' | 'option'; name: string; imageUrl: string | null; imageAlt: string; href: string }
export type ShopByCategoryData = { heading: string; shopAllLabel: string; shopAllLink: string; desktopColumns: number; tabletColumns: number; mobileColumns: number; cards: ShopByCategoryCard[] }
type Category = { id: string; name: string; slug: string; status: string; banner_desktop_image_path: string | null; banner_mobile_image_path: string | null; banner_desktop_image_alt: string | null; banner_mobile_image_alt: string | null }
type Subcategory = { id: string; category_id: string; name: string; slug: string; status: string; image_path: string | null; icon_svg_path: string | null; image_alt: string | null }
type Option = { id: string; subcategory_id: string; name: string; slug: string; status: string; image_path: string | null; icon_svg_path: string | null; image_alt: string | null }

function publicUrl(path: string | null) {
  return path ? mediaUrl(path) : null
}

export async function getFreshShopByCategory(): Promise<ShopByCategoryData | null> {
  const result = await loadShopByCategoryRowsFromRds()
  if (!result || !result.items.length) return null
  const categories = new Map((result.categories as Category[]).map((item) => [item.id, item]))
  const subs = new Map((result.subcategories as Subcategory[]).map((item) => [item.id, item]))
  const options = new Map((result.options as Option[]).map((item) => [item.id, item]))
  const cards = (result.items as Array<{ id: string; item_type: string; category_id: string | null; subcategory_id: string | null; option_id: string | null }>).flatMap((item): ShopByCategoryCard[] => {
    try {
      if (item.item_type === 'category' && item.category_id) {
        const category = categories.get(item.category_id)
        return category ? [{ id: `category-${category.id}`, type: 'category', name: category.name, imageUrl: publicUrl(category.banner_desktop_image_path ?? category.banner_mobile_image_path), imageAlt: category.banner_desktop_image_alt ?? category.banner_mobile_image_alt ?? category.name, href: buildCategoryPath(category) }] : []
      }
      if (item.item_type === 'subcategory' && item.subcategory_id) {
        const subcategory = subs.get(item.subcategory_id), category = subcategory ? categories.get(subcategory.category_id) : null
        return subcategory && category ? [{ id: `subcategory-${subcategory.id}`, type: 'subcategory', name: subcategory.name, imageUrl: publicUrl(subcategory.image_path ?? subcategory.icon_svg_path), imageAlt: subcategory.image_alt ?? subcategory.name, href: buildSubcategoryPath(category, subcategory) }] : []
      }
      if (item.item_type === 'option' && item.option_id) {
        const option = options.get(item.option_id), subcategory = option ? subs.get(option.subcategory_id) : null, category = subcategory ? categories.get(subcategory.category_id) : null
        return option && subcategory && category ? [{ id: `option-${option.id}`, type: 'option', name: option.name, imageUrl: publicUrl(option.image_path ?? option.icon_svg_path), imageAlt: option.image_alt ?? option.name, href: buildOptionPath(category, subcategory, option) }] : []
      }
    } catch { return [] }
    return []
  })
  if (!cards.length) return null
  const section = result.section
  return {
    heading: String(section.heading ?? ''), shopAllLabel: String(section.shop_all_label ?? ''), shopAllLink: String(section.shop_all_link ?? ''),
    desktopColumns: Math.min(8, Math.max(2, Number(section.desktop_columns))),
    tabletColumns: Math.min(6, Math.max(1, Number(section.tablet_columns))),
    mobileColumns: Math.min(3, Math.max(1, Number(section.mobile_columns))), cards,
  }

}

// Five queries per read, so share one result across visitors for a few minutes.
export const getCachedShopByCategory = cachePublicRead('shop-by-category', getFreshShopByCategory, PUBLIC_CACHE_LONG_SECONDS)
