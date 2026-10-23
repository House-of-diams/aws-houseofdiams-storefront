-- Storefront catalogue read-path indexes. All statements are idempotent and
-- use partial indexes where the public storefront only reads active rows.

create index if not exists products_storefront_active_lane_created_idx
  on public.products (product_lane, created_at desc)
  where status = 'active';

create index if not exists products_storefront_active_category_idx
  on public.products (main_category_id, created_at desc)
  where status = 'active';

create index if not exists products_storefront_active_slug_idx
  on public.products (slug)
  where status = 'active';

create index if not exists product_metal_selections_product_sort_idx
  on public.product_metal_selections (product_id, sort_order);

create index if not exists product_metal_selections_metal_product_idx
  on public.product_metal_selections (metal_id, product_id);

create index if not exists product_stone_shapes_product_shape_idx
  on public.product_stone_shapes (product_id, shape_id);

create index if not exists product_stone_shapes_shape_product_idx
  on public.product_stone_shapes (shape_id, product_id);

create index if not exists product_subcategory_links_product_sort_idx
  on public.product_subcategory_links (product_id, sort_order);

create index if not exists product_subcategory_links_subcategory_product_idx
  on public.product_subcategory_links (subcategory_id, product_id);

create index if not exists product_option_links_product_sort_idx
  on public.product_option_links (product_id, sort_order);

create index if not exists product_option_links_option_product_idx
  on public.product_option_links (option_id, product_id);

create index if not exists product_metal_variants_product_sort_idx
  on public.product_metal_variants (product_id, sort_order);

create index if not exists product_variant_media_items_product_sort_idx
  on public.product_variant_media_items (product_id, sort_order);

create index if not exists product_variant_media_items_variant_sort_idx
  on public.product_variant_media_items (variant_id, sort_order);

create index if not exists product_metal_media_product_metal_idx
  on public.product_metal_media (product_id, metal_id);

create index if not exists product_purity_prices_product_sort_idx
  on public.product_purity_prices (product_id, sort_order);

create index if not exists product_material_value_selections_product_sort_idx
  on public.product_material_value_selections (product_id, sort_order);

create index if not exists product_faq_items_active_product_sort_idx
  on public.product_faq_items (product_id, sort_order)
  where is_active = true;

create index if not exists product_custom_dropdowns_enabled_product_order_idx
  on public.product_custom_dropdowns (product_id, display_order)
  where is_enabled = true;

create index if not exists product_custom_dropdown_options_enabled_dropdown_order_idx
  on public.product_custom_dropdown_options (dropdown_id, display_order)
  where is_enabled = true;
