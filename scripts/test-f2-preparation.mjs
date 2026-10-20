import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

const catalogRepository = source('lib/repositories/catalog-repository.ts')
const taxonomy = source('lib/catalog-taxonomy.ts')
const navbarRepository = source('lib/repositories/navbar-repository.ts')
const navbar = source('lib/navbar-server.ts')
const cmsRepository = source('lib/repositories/cms-repository.ts')

test('taxonomy RDS reads are mandatory and preserve missing-category boundaries', () => {
  assert.doesNotMatch(taxonomy, /HOD_F2_|createSupabaseServerClient/)
  assert.match(taxonomy, /await findActiveCatalogCategoryBySlug/)
  assert.match(taxonomy, /if \(!category\) return null/)
  assert.match(taxonomy, /if \(!subcategory\) return null/)
  assert.match(taxonomy, /return option \? \{ category, subcategory, option \} : null/)
})

test('taxonomy SQL binds all route inputs and checks active status', () => {
  for (const table of ['catalog_categories', 'catalog_subcategories', 'catalog_options']) {
    assert.match(catalogRepository, new RegExp(`FROM public\\.${table}`))
  }
  assert.match(catalogRepository, /slug = \$1 AND status = \$2/)
  assert.match(catalogRepository, /category_id = \$1 AND slug = \$2 AND status = \$3/)
  assert.match(catalogRepository, /subcategory_id = \$1 AND slug = \$2 AND status = \$3/)
  assert.doesNotMatch(catalogRepository, /\$\{(?:slug|categoryId|subcategoryId)\}/)
})

test('navbar RDS reads preserve the existing cache lifetime', () => {
  assert.doesNotMatch(navbar, /HOD_F2_|loadSupabaseNavbarRows/)
  assert.match(navbar, /await loadNavbarRowsFromRds\(\)/)
  assert.match(navbar, /revalidate: 300, tags: \['site-navbar'\]/)
})

test('navbar SQL preserves the hidden bespoke read and ordered active lists', () => {
  assert.match(navbarRepository, /slug = ANY\(\$1::text\[\]\) AND status = \$2/)
  assert.match(navbarRepository, /\[\['bespoke'\], 'hidden'\]/)
  assert.match(navbarRepository, /ORDER BY column_number ASC, display_order ASC/)
  assert.match(navbarRepository, /ORDER BY sort_order ASC/)
  assert.match(navbarRepository, /to_jsonb\(t\) AS row/)
})

// HOD-057 removed the unused testimonial marquee route and its queries.

test('CMS and bespoke RDS readers are server-only and mandatory', () => {
  const publicCmsRepository = source('lib/repositories/public-cms-repository.ts')
  const bespokeRepository = source('lib/repositories/bespoke-repository.ts')
  assert.match(publicCmsRepository, /^import 'server-only'/)
  assert.match(bespokeRepository, /^import 'server-only'/)
  for (const path of [
    'app/api/public/announcement-bar/route.ts',
    'app/api/public/promotions/route.ts',
    'app/api/public/bespoke/hero/route.ts',
    'app/api/public/bespoke/form-config/route.ts',
  ]) {
    assert.match(source(path), /from '@\/lib\/repositories\//)
    assert.doesNotMatch(source(path), /HOD_F2_|supabaseAnonKey/)
  }
  assert.match(publicCmsRepository, /\$2::text IS NULL OR c\.reward_type = \$2/)
  assert.match(publicCmsRepository, /SELECT to_jsonb\(t\) AS row FROM public\.promotion_popup/)
})

test('known client CMS components no longer query Supabase tables directly', () => {
  for (const path of [
    'components/common/Footer.tsx',
    'components/common/AdditionalSummaryDetails.tsx',
    'components/home/FAQ.tsx',
    'components/home/Hero.tsx',
  ]) assert.doesNotMatch(source(path), /supabase\s*\.from\s*\(/)
})

test('F2 RLS application is recorded; superseded forward SQL must not be rerun', () => {
  const taxonomyProposal = source('docs/aws-f2-hod-app-rls-proposal.sql')
  assert.match(taxonomyProposal, /user reports this migration applied and verified/)
  assert.match(taxonomyProposal, /ROLLBACK/)

  for (const name of [
    'aws-f2-navbar-rls-proposal.sql',
    'aws-f2-testimonial-marquee-rls-proposal.sql',
  ]) {
    const proposal = source(`docs/${name}`)
    assert.match(proposal, /PROPOSAL ONLY/)
    assert.match(proposal, /SUPERSEDED/)
    assert.match(proposal, /ROLLBACK/)
  }

  const executionPlan = source('docs/aws-f2-execution-plan.md')
  const normalizedPlan = executionPlan.replace(/\s+/g, ' ')
  assert.match(normalizedPlan, /F2-A taxonomy and the revised F2 master RLS migration were applied by the user/)
  assert.match(normalizedPlan, /Do not rerun either forward SQL file/)
})
