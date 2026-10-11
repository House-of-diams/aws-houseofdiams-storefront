# AWS storefront connection cleanup plan

Authorized by the user on 2026-10-11: implement the connection changes while preserving fetching and business behavior. The earlier phase-by-phase approval instruction is superseded for this local implementation. Deployment, external configuration and SQL mutations remain outside this task.

1. Preserve a snapshot of existing uncommitted work and inspect repository/Next.js guidance.
2. Select the existing RDS repositories for catalog, CMS, taxonomy, metadata and checkout reads. Preserve filters, sorting, pagination, payload mapping and cache lifetimes.
3. Route remaining legacy CMS/profile endpoints through parameterized PostgreSQL repositories. Preserve disabled auth/payment/reconciliation gates and checkout release guards.
4. Remove legacy browser/server SDK usage and dependencies. Resolve historical owned media URLs to CloudFront without legacy ENV settings. Keep external and bundled assets supported.
5. Verify TypeScript, offline auth/payment/routing/media tests, response parity against the snapshot and a production build with old-provider settings blanked. All real database checks must use the isolated clone with PostgreSQL read-only enforcement.
6. Refresh the credential-free ENV template and private DevOps handoff. Record deployed UAT dependencies and any content-policy gaps without applying SQL or changing saved local ENV.

Progress and evidence are recorded in [the implementation report](./aws-f9-implementation-report.md). No Git push or AWS deployment is authorized by this plan.
