# F2 cart and checkout summary RLS review

Status: **applied on 2026-10-09** by the user as `hod_migration`. This SQL covers only the Additional Summary
Details panel used on cart and checkout. Home Hero is already wired to RDS.
Hip Hop Hero and Diamond Info are unused and excluded. Do not rerun F2-A or
the F2 master migration.

Read-only `hod_app` inspection on 2026-10-09 found both summary tables present,
RLS enabled, and table-level `SELECT` granted. Both reads failed with SQLSTATE
42501: their admin `ALL` policies apply to `PUBLIC` and call `is_admin()`, which
reaches the inaccessible `auth` schema. Existing public `SELECT` policies
already limit reads to enabled sections and their pointers.

The [forward SQL](aws-f2-summary-rls-forward.sql) changes only those two admin
policies from `PUBLIC` to `authenticated`, as in the F2 master migration. It
leaves the existing public read predicates intact. It does not change data or
grant access to `auth`. The [rollback](aws-f2-summary-rls-rollback.sql) restores
the prior policy roles.

After the user's successful `COMMIT`, a TLS-verified read-only `hod_app` check
returned one visible row from each summary table. The RDS-backed summary API
also returned HTTP 200 and passed its response-shape check. The local
`HOD_F2_RDS_SUMMARY_READS` flag is now ON. The [read-only verification](aws-f2-summary-rls-verify.sql)
can also be run in pgAdmin as `hod_app`. Do not rerun the forward SQL.
Admin/Keycloak role design remains a later phase.
