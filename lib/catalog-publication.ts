type CatalogPublicationRecord = {
  status?: string | null
}

/**
 * The deployed catalog schema publishes taxonomy records through their
 * existing `status` field. Keep this rule separate from product availability:
 * active taxonomy destinations may intentionally be empty while the catalog
 * is being populated.
 */
export function isPublicCatalogTaxonomy(record: CatalogPublicationRecord) {
  return record.status === 'active'
}
