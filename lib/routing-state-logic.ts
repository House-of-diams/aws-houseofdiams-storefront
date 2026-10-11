export const fallbackMaintenanceMessage =
  'Our atelier is receiving a careful polish. House of Diams will be back online shortly.'

export type RoutingCategory = { id: string; slug: string }
export type RoutingSubcategory = { id: string; category_id: string; slug: string }
export type RoutingOption = { id: string; subcategory_id: string; slug: string }
export type RoutingSeoRedirect = {
  source_path: string
  target_path: string
  http_status: number
  is_active: boolean
}

export type RoutingStateInput = {
  categories: RoutingCategory[]
  subcategories: RoutingSubcategory[]
  options: RoutingOption[]
  seo_redirects: RoutingSeoRedirect[]
  maintenance: { enabled: boolean; message: string | null } | null
}

export type RoutingState = RoutingStateInput & {
  maintenance: { enabled: boolean; message: string }
  seo_redirects: RoutingSeoRedirect[]
}

function isSafeInternalPath(value: string) {
  return value.startsWith('/') && !value.startsWith('//') && !/[\\\u0000-\u001f#]/.test(value)
}

function redirectCycleSources(redirects: readonly RoutingSeoRedirect[]) {
  const targets = new Map(redirects.map((redirect) => [redirect.source_path, redirect.target_path]))
  const cyclicSources = new Set<string>()

  for (const source of targets.keys()) {
    const path: string[] = []
    const positions = new Map<string, number>()
    let current: string | undefined = source

    while (current !== undefined && targets.has(current)) {
      const cycleStart = positions.get(current)
      if (cycleStart !== undefined) {
        for (const cycleSource of path.slice(cycleStart)) cyclicSources.add(cycleSource)
        break
      }
      positions.set(current, path.length)
      path.push(current)
      current = targets.get(current)
    }
  }

  return cyclicSources
}

export function createRoutingState(input: RoutingStateInput): RoutingState {
  const seenSources = new Set<string>()
  const validRedirects = input.seo_redirects.filter((redirect) => {
    if (!redirect.is_active || !isSafeInternalPath(redirect.source_path) || !isSafeInternalPath(redirect.target_path)) {
      return false
    }
    if (seenSources.has(redirect.source_path)) return false
    seenSources.add(redirect.source_path)
    return true
  })
  const cycleSources = redirectCycleSources(validRedirects)

  return {
    categories: input.categories,
    subcategories: input.subcategories,
    options: input.options,
    seo_redirects: validRedirects.filter((redirect) => !cycleSources.has(redirect.source_path)),
    maintenance: {
      enabled: Boolean(input.maintenance?.enabled),
      message:
        typeof input.maintenance?.message === 'string' && input.maintenance.message.trim()
          ? input.maintenance.message.trim()
          : fallbackMaintenanceMessage,
    },
  }
}

export function findStoredRedirect(state: RoutingState, sourcePath: string) {
  return state.seo_redirects.find((redirect) => redirect.source_path === sourcePath)?.target_path ?? null
}

export function findLegacyTaxonomyRedirect(
  state: RoutingState,
  pathname: string,
  searchParams: URLSearchParams,
) {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length !== 1) return null

  const keys = [...searchParams.keys()]
  const allowedKeys = new Set(['subcategory', 'option'])
  if (keys.length === 0 || keys.some((key) => !allowedKeys.has(key))) return null

  const subcategorySlug = searchParams.get('subcategory')
  const optionSlug = searchParams.get('option')
  if (!subcategorySlug || keys.length !== (optionSlug ? 2 : 1)) return null

  const category = state.categories.find((row) => row.slug === segments[0])
  if (!category) return null
  const subcategory = state.subcategories.find(
    (row) => row.category_id === category.id && row.slug === subcategorySlug,
  )
  if (!subcategory) return null

  let target = `/${encodeURIComponent(category.slug)}/${encodeURIComponent(subcategory.slug)}`
  if (optionSlug) {
    const option = state.options.find(
      (row) => row.subcategory_id === subcategory.id && row.slug === optionSlug,
    )
    if (!option) return null
    target += `/${encodeURIComponent(option.slug)}`
  }

  return target
}

/** Returns true only for a missing child of a category that is known active. */
export function isInvalidActiveTaxonomyPath(state: RoutingState, pathname: string) {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length !== 2 && segments.length !== 3) return false

  const category = state.categories.find((row) => row.slug === segments[0])
  if (!category) return false

  const subcategory = state.subcategories.find(
    (row) => row.category_id === category.id && row.slug === segments[1],
  )
  if (!subcategory) return true
  if (segments.length === 2) return false

  return !state.options.some(
    (row) => row.subcategory_id === subcategory.id && row.slug === segments[2],
  )
}

export type RoutingDecision =
  | { type: 'next' }
  | { type: 'maintenance'; message: string }
  | { type: 'redirect'; pathname: string; status: 301 }
  | { type: 'not-found' }

export function decideRouting(state: RoutingState, pathname: string, search: string): RoutingDecision {
  if (pathname === '/maintenance') return { type: 'next' }
  if (state.maintenance.enabled) {
    return { type: 'maintenance', message: state.maintenance.message }
  }

  const sourcePath = `${pathname}${search}`
  const storedTarget = findStoredRedirect(state, sourcePath)
  if (storedTarget && storedTarget !== sourcePath) {
    return { type: 'redirect', pathname: storedTarget, status: 301 }
  }

  if (isInvalidActiveTaxonomyPath(state, pathname)) return { type: 'not-found' }

  const legacyTarget = findLegacyTaxonomyRedirect(
    state,
    pathname,
    new URLSearchParams(search),
  )
  if (legacyTarget && legacyTarget !== pathname) {
    return { type: 'redirect', pathname: legacyTarget, status: 301 }
  }

  return { type: 'next' }
}
