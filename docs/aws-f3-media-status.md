# F3 media status

The storefront resolves owned image and video paths through `https://media.houseofdiams.com` when `NEXT_PUBLIC_MEDIA_CDN_BASE_URL` is set. The host is a CloudFront distribution with the `house-of-diams` S3 bucket as its origin. Existing relative paths, Supabase public URLs for the `hod` bucket, and R2 public URLs resolve to the same keys on this CDN. External media URLs remain external.

The admin uses `AWS_MEDIA_BUCKET=house-of-diams` and `NEXT_PUBLIC_MEDIA_CDN_BASE_URL=https://media.houseofdiams.com` to upload new images and videos to S3. Its server upload path uses the AWS default credential chain and requires S3 PutObject and HeadObject permissions. Most CMS uploads are temporarily mirrored to Supabase because existing admin previews still build Supabase URLs from relative paths. Product uploads return a full CDN URL. A failed mirror returns an upload error; the S3 object can remain orphaned, so an operator should inspect it before retrying. Direct signed CMS uploads are blocked by the existing admin proxy and use the authenticated server fallback.

Read-only inventory after migration: 5,253 S3 objects; 5,034 distinct values found across 94 RDS columns. Of the 5,019 actual media references, 5,017 keys are present. The other 13 values counted by the broad scanner are text or category slugs. Two referenced SVG keys remain absent because their source URLs returned HTTP 400:

- `catalog/options/004-battery-low.svg`
- `catalog/subcategories/005-approximate-equals.svg`

The migration copied 2,878 missing objects without overwriting existing keys. It used SHA-256 checksums and verified uploaded object lengths. The two missing SVGs need source assets or deliberate replacement. No database rows were changed by F3.

Verification on 2026-10-09: storefront production build passed; admin TypeScript typecheck passed; local production Home, About, and Bespoke pages returned HTTP 200 and rendered CDN URLs without Supabase storage URLs in their HTML. Product image and video CDN requests were checked earlier and returned HTTP 200. The existing Fixer API fallback warning during build is outside F3.

Before deploying the admin, confirm its runtime AWS identity can put and head objects in the S3 bucket. Deploy both applications with the environment variables above and verify a real authenticated image upload and video upload. Local checks did not exercise authenticated admin uploads or a production deployment.
