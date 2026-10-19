# Database migrations

Every schema or function change ships as three files with the same prefix:

| File | Purpose |
| --- | --- |
| `YYYYMMDDNN_name.forward.sql` | Makes the change. Runs in one transaction and aborts if the database is not in the expected state. |
| `YYYYMMDDNN_name.verify.sql` | Read-only checks that the change is installed as expected. Safe to run with the application role. |
| `YYYYMMDDNN_name.rollback.sql` | Restores the previous definition. |

Rules:

- Migrations are applied by a person with the migration role, to UAT first, after an RDS snapshot. Application code never applies them.
- Forward files never delete or rewrite business data unless the file name says so and the change was approved.
- `supabase/migrations` and `docs/*.sql` are historical. New changes go here.
