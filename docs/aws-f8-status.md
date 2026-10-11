# F8 current status

Updated 2026-10-11. **Locally prepared and isolated-SQL-tested; not deployed or UAT-approved.** Saved flags stay OFF and checkout guards remain. No SQL migration or pgAdmin action is needed.

Implemented made-to-order payment expiry without stock reservations, missing-ledger capture discovery, durable queued recovery without automatic refunds, refund/payment validation, generation-bound worker/webhook updates, exhaustion handling and aggregate observability.

Checks pass: typecheck, strict read-only clone build, 28 F7 mocked tests, 42 F8 mocked tests, 16 real SQL tests plus conflicting-recovery follow-up, 7 payment-subunit and 3 DB-foundation tests. Focused lint is clean; full lint matches 30 errors / 167 warnings. All checked pre-existing clone business rows are unchanged. Tagged synthetic concurrency fixtures remain only in hod_f7_test.

Only deployed provider test-mode UAT, scheduler/secret/timeout/monitoring/operator checks and wider F7 release approval remain. No deployment, staging mutation or live provider operation occurred.

See [the complete implementation report](./aws-f8-implementation-report.md) for exact files, safeguards, test evidence, retained fixtures and remaining release gates. This replaces the earlier intermediate F8 blockers.
