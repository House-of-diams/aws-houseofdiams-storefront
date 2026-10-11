import { findHipHopHeroFromRds, loadHipHopHeroSlidesFromRds } from '@/lib/repositories/legacy-cms-repository'
import { findHipHopShowcaseFromRds } from '@/lib/repositories/public-cms-repository'
import { resolveLegacyHipHopHref } from '@/lib/legacy-hiphop'

export type HipHopHeroSlide = {
  sort_order: number
  image_path: string
  mobile_image_path?: string
  button_text: string
  button_link: string
}

export type HipHopHeroContent = {
  eyebrow: string
  headline: string
  subtitle: string
  slider_enabled?: boolean
}

export const fallbackHipHopHeroContent: HipHopHeroContent = {
  eyebrow: 'Hip Hop',
  headline: 'Hip Hop Jewellery',
  subtitle: 'Fully iced chains, grillz, pendants and statement rings - handcrafted with lab-grown diamonds in 14K and 18K gold.',
  slider_enabled: false,
}

export async function getHipHopHeroData() {

  try {
    const section = await findHipHopHeroFromRds()

    if (section) {
      const items = await loadHipHopHeroSlidesFromRds(section.id)

      const nextSlides = (items ?? []).filter((item) => item.image_path?.trim())
      const hasBanner = Boolean(section.slider_enabled) && nextSlides.length > 0

      if (hasBanner) {
        return {
          content: {
            eyebrow: section.eyebrow ?? fallbackHipHopHeroContent.eyebrow,
            headline: section.headline ?? fallbackHipHopHeroContent.headline,
            subtitle: section.subtitle ?? fallbackHipHopHeroContent.subtitle,
            slider_enabled: true,
          } satisfies HipHopHeroContent,
          slides: nextSlides as HipHopHeroSlide[],
        }
      }

      return {
        content: {
          eyebrow: section.eyebrow ?? fallbackHipHopHeroContent.eyebrow,
          headline: section.headline ?? fallbackHipHopHeroContent.headline,
          subtitle: section.subtitle ?? fallbackHipHopHeroContent.subtitle,
          slider_enabled: Boolean(section.slider_enabled),
        } satisfies HipHopHeroContent,
        slides: nextSlides as HipHopHeroSlide[],
      }
    }

    const legacySection = await findHipHopShowcaseFromRds() as {
      eyebrow: string | null; heading_line_1: string | null; heading_line_2: string | null; heading_emphasis: string | null
      cta_label: string | null; cta_link: string | null; image_path: string | null
    } | null

    if (legacySection?.image_path) {
      const legacyHeadline = [
        legacySection.heading_line_1,
        legacySection.heading_line_2,
        legacySection.heading_emphasis,
      ]
        .filter((part) => typeof part === 'string' && part.trim().length > 0)
        .join(' ')

      return {
        content: {
          eyebrow: legacySection.eyebrow ?? fallbackHipHopHeroContent.eyebrow,
          headline: legacyHeadline || fallbackHipHopHeroContent.headline,
          subtitle: fallbackHipHopHeroContent.subtitle,
          slider_enabled: true,
        } satisfies HipHopHeroContent,
        slides: [
          {
            sort_order: 1,
            image_path: legacySection.image_path,
            mobile_image_path: legacySection.image_path,
            button_text: legacySection.cta_label ?? 'Explore',
            button_link: resolveLegacyHipHopHref(legacySection.cta_link),
          },
        ] satisfies HipHopHeroSlide[],
      }
    }
  } catch { }

  return {
    content: fallbackHipHopHeroContent,
    slides: [] as HipHopHeroSlide[],
  }
}
