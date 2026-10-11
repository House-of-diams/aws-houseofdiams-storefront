# F2 RLS architecture review (proposal only)

Historical review from before F2-A. The user reports F2-A taxonomy now applied
and verified. For the remaining F2 tables, use
`aws-f2-master-rls-review.md` and its linked master SQL files; this earlier
three-table-only analysis is superseded as an execution guide.

No SQL was executed and no database change was made. This review uses the supplied `pg_policies` CSV, the `is_admin()` definition CSV, and the current storefront source. The previous 96-table SQL proposal has been replaced by a three-table taxonomy-only staging proposal in `aws-f2-hod-app-rls-proposal.sql`.

## Authorization decision

`ALTER POLICY ... TO authenticated` is a **temporary staging compatibility bridge**, not the final AWS architecture. It keeps the current `is_admin()` check for legacy Supabase-authenticated admin requests while removing that check from `hod_app` reads. It must not be promoted as the final Keycloak design. PostgreSQL role targeting changes which sessions a policy applies to; it does not turn the legacy `authenticated` role into a Keycloak identity.

Before the admin/Keycloak cutover, design and provision a dedicated admin DB role or an explicitly reviewed server-side authorization boundary. In a separate admin migration, replace each legacy admin policy with a policy scoped to that role and its verified authorization rule; test admin CRUD and confirm `hod_app` cannot write or see admin-only rows; then remove the `authenticated` bridge. The exact replacement SQL cannot be chosen until that admin design is approved. No storefront role should join the admin role or gain `auth` schema access or `BYPASSRLS`.

## Can F2 be smaller?

Yes **per deployment slice**, not yet as a proven reduction of total F2 coverage. `resolveCatalogTaxonomy` needs only `catalog_categories`, `catalog_subcategories`, and `catalog_options`, whose active-row public SELECT policies already exist. The revised SQL therefore changes only their three admin-policy role targets. It unblocks only taxonomy; navbar, products, homepage, CMS, blog, education, and public settings still need separate policy work before F2 can be called complete. The current source references about 100 F2 read tables; the supplied export shows 96 would need some policy adjustment if every read is migrated. Optional/fallback reads may reduce that total, but data-shape and route-parity checks are needed before removing any from scope. Checkout-only `public.categories` and `public.order_status_history` remain F7 blockers, not F2 inputs. The proxy SEO redirect table is excluded from this F2 proposal.

## Audit of the 29 previously policy-free F2 tables

The supplied RDS policy export confirms **all 29 tables exist with RLS enabled and no policies**. It does **not** contain column names, data types, enum values, or foreign-key definitions. A previous F2 diagnostic checked many selected/filter column names, but not the full type/FK metadata for these proposed predicates. Therefore RDS column/type/FK verification is **not complete for any of the 29**. None of their proposed policies is included in the revised executable-looking SQL file.

“Direct” means the proposed condition matches a current filter or no-filter read. “Derived” means the condition is supported by how the caller selects a parent or active products, but would move that check into RLS. “Assumption” means the predicate adds a visibility rule not shown by the current query. Relationship column names and actual FKs still require RDS verification even when code uses the column.

| Table | Current application read / rule | Earlier predicate assessment |
| --- | --- | --- |
| `bespoke_hero_slider_items` | Hero sliders are read by `hero_id` after an active hero is chosen (`app/bespoke/page.tsx`, `app/api/public/bespoke/hero/route.ts`). | Derived: active-parent `EXISTS`; `hero_id` column is used, FK unverified. |
| `blog_post_content_blocks` | Nested under published `blog_posts`; mapper omits blocks where `is_enabled` is false (`lib/blog.ts`). | Derived: published parent and enabled block; `post_id` relationship/FK unverified. |
| `blog_post_products` | Nested under published `blog_posts`; products are subsequently normalized through active catalog reads (`lib/blog.ts`). | Derived: published parent; `post_id` relationship/FK unverified. |
| `catalog_certificates` | Catalog and navbar load all certificates, without a row filter (`lib/catalog-products.ts`, `lib/navbar-server.ts`). | Direct: `true` follows the current all-row read. |
| `catalog_gst_slabs` | Catalog excludes `status = hidden` (`lib/catalog-products.ts`). | Direct: `status <> 'hidden'`; enum/type unverified. |
| `catalog_material_values` | Catalog and home load active values (`lib/catalog-products.ts`, `lib/home-data.ts`). | Direct: `status = 'active'`; enum/type unverified. |
| `catalog_ring_categories` | Catalog loads active categories (`lib/catalog-products.ts`). | Direct: `status = 'active'`; enum/type unverified. |
| `catalog_ring_category_sizes` | Catalog loads active sizes (`lib/catalog-products.ts`). | Direct: `status = 'active'`; enum/type and parent FK unverified. |
| `collection_page_config` | Home reads `section_key = main_collection_page`, including disabled configuration values (`lib/home-data.ts`). | Direct: section key only; do not suppress disabled rows. |
| `diamond_info_config` | Public route reads `section_key = home_diamond_info` (`app/api/public/diamond-info/route.ts`). | Direct: section key only. |
| `diamond_info_feature_items` | Public route reads the same section and `is_active = true` (`app/api/public/diamond-info/route.ts`). | Direct: both filters. |
| `discover_shapes_items` | Home reads `status = active` (`lib/home-data.ts`). | Direct: active status; enum/type unverified. |
| `hiphop_hero_content` | Hero reads `section_key = hiphop_hero` and `is_active = true` (`lib/hiphop-hero.ts`). | Direct: both filters. |
| `hiphop_hero_slider_items` | Slides are read by `hero_id` after the active section is chosen (`lib/hiphop-hero.ts`). | Derived: active-parent `EXISTS`; FK unverified. |
| `home_bespoke_showcase_section` | Home reads `section_key = home_bespoke_showcase`, including `is_enabled` to decide visibility (`lib/home-data.ts`). | Direct: section key only; excluding disabled rows could change behavior. |
| `metal_composition_parts` | Catalog reads **all** composition parts, then groups by `metal_id` (`lib/catalog-products.ts`). | **Assumption:** the earlier active-parent-metal predicate is not a current query rule. Do not apply it without a visibility decision. |
| `product_faq_items` | Catalog reads active FAQs for product IDs selected from active products (`lib/catalog-products.ts`). | Derived: active FAQ and active-product parent; `product_id` is used, FK unverified. |
| `product_material_value_selections` | Catalog/home use selections for active product IDs (`lib/catalog-products.ts`, `lib/home-data.ts`). | Derived: active-product parent; FK unverified. |
| `product_metal_media` | Catalog/home use media for active product IDs; an unscoped loader can fetch more before normalization (`lib/catalog-products.ts`, `lib/home-data.ts`). | Derived: active-product parent; row-count/parity impact needs testing; FK unverified. |
| `product_metal_variants` | Catalog/home use variants for active product IDs (`lib/catalog-products.ts`, `lib/home-data.ts`). | Derived: active-product parent; FK unverified. |
| `product_option_links` | Catalog uses links for selected active products (`lib/catalog-products.ts`). | Derived: active-product parent; FK unverified. |
| `product_purity_prices` | Catalog uses prices for selected active products; checkout remains out of F2 (`lib/catalog-products.ts`). | Derived: active-product parent; FK and type unverified. |
| `product_stone_shapes` | Catalog/search use links, then retain active products (`lib/catalog-products.ts`). | Derived: active-product parent; search parity and FK unverified. |
| `product_subcategory_links` | Catalog/search use links, then retain active products (`lib/catalog-products.ts`). | Derived: active-product parent; search parity and FK unverified. |
| `product_variant_media_items` | Catalog/home use media for active product IDs; an unscoped loader can fetch more before normalization (`lib/catalog-products.ts`, `lib/home-data.ts`). | Derived: active-product parent; row-count/parity impact and FK unverified. |
| `service_banner_blocks` | Public route reads `is_active = true` (`app/api/public/service-banner/route.ts`). | Direct: active flag. |
| `service_banner_section` | Public route reads `id = 1` and `is_enabled = true` (`app/api/public/service-banner/route.ts`). | Direct: both filters; ID type unverified. |
| `testimonial_marquee` | Public route reads `section_key = home_testimonial_marquee` (`app/api/public/testimonial-marquee/route.ts`). | Direct: section key. |
| `testimonial_marquee_items` | Items are read by `marquee_id` from that selected section (`app/api/public/testimonial-marquee/route.ts`). | Derived: section-parent `EXISTS`; FK unverified. |

The active-metal condition is the clearest unsupported assumption and must be removed or explicitly approved. All derived parent predicates require schema/FK confirmation and output-parity checks before inclusion in a later policy migration. For tables whose old server-side service-role path could see disabled or unpublished rows, compare the **visible response** rather than assuming the new row policy preserves it.

## Missing RDS evidence and next review gate

To complete the requested RDS verification without granting privileges or changing data, DevOps can provide exports of `information_schema.columns` (including `data_type` and `udt_name`) and `pg_constraint` foreign-key definitions for these 29 tables and their referenced parents. No such export was attached, and this review deliberately did not query RDS. After receiving it, check every predicate column, enum value, FK direction, and referenced parent policy; then prepare the next small, separately reversible F2 slice. Do not apply the old 96-table proposal.
