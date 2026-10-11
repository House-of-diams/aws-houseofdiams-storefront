import { NextResponse } from 'next/server'
import { loadDiamondInfoFeaturesFromRds, findDiamondInfoConfigFromRds } from '@/lib/repositories/legacy-cms-repository'
import { DatabaseError } from '@/lib/db/errors'
import { mediaUrl } from '@/lib/media-url'

export const dynamic = 'force-static'
export const revalidate = 300

function toPublicUrl(path?: string | null) {
  if (!path) return ''
  return mediaUrl(path)
}

async function readPublicContent() {
  const read = async <T,>(operation: () => Promise<T>) => {
    try { return { data: await operation(), missing: false } }
    catch (error) {
      if (error instanceof DatabaseError && error.code === '42P01') return { data: null, missing: true }
      throw error
    }
  }
  const [featureResult, configResult] = await Promise.all([read(loadDiamondInfoFeaturesFromRds), read(findDiamondInfoConfigFromRds)])
  const features = featureResult.data
  const config = configResult.data
  const isMissingFeatureTable = featureResult.missing
  const isMissingConfigTable = configResult.missing

  return NextResponse.json({
    items: isMissingFeatureTable
      ? []
      : (features ?? []).map((item) => ({
        id: item.id,
        sort_order: item.sort_order,
        iconSvg: item.icon_svg ?? '',
        title: item.title ?? '',
        description: item.description ?? '',
        is_active: item.is_active ?? true,
      })),
    config: {
      videoEnabled: isMissingConfigTable ? false : (config?.video_enabled ?? false),
      videoUrl: isMissingConfigTable ? '' : toPublicUrl(config?.video_path),
      videoPosterUrl: isMissingConfigTable ? '' : toPublicUrl(config?.video_poster_path),
      layoutMode: isMissingConfigTable ? 'split_video_text' : (config?.layout_mode ?? 'split_video_text'),
      eyebrow: isMissingConfigTable ? '' : (config?.eyebrow ?? ''),
      sectionHeading: isMissingConfigTable ? '' : (config?.section_heading ?? ''),
      sectionSubtext: isMissingConfigTable ? '' : (config?.section_subtext ?? ''),
      ctaLabel: isMissingConfigTable ? '' : (config?.cta_label ?? ''),
      ctaLink: isMissingConfigTable ? '' : (config?.cta_link ?? ''),
    },
  })
}

export async function GET() {
  try { return await readPublicContent() }
  catch {
    return NextResponse.json({ error: 'Unable to load content.' }, { status: 500 })
  }
}
