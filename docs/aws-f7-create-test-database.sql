-- USER-RUN provisioning only; the assistant has not executed this file.
-- In pgAdmin connect to the postgres database on the SAME RDS instance.
-- Use a role authorized to create databases and clone hod_staging.
-- Run each section separately, with autocommit ON. No BEGIN/COMMIT.
-- Pause applications using hod_staging and close its Query Tool connections.
-- Do not terminate source sessions or change source access to make this work.

-- 1. Confirm the admin role, source ownership, and absence of source connections.
SELECT current_database() AS connected_database,
       current_user AS database_role,
       (SELECT rolcreatedb FROM pg_roles WHERE rolname = current_user) AS can_create_database,
       (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = 'hod_staging') AS source_owner,
       EXISTS (SELECT 1 FROM pg_database WHERE datname = 'hod_f7_test') AS test_database_exists,
       (SELECT count(*) FROM pg_stat_activity WHERE datname = 'hod_staging') AS source_connections;
-- On this RDS, proceed only if connected_database=postgres, database_role=postgres,
-- can_create_database=true, source_owner=postgres, test_database_exists=false,
-- and source_connections=0. Otherwise STOP; do not force-close sessions.

-- 2. Clone schema, data, object ownership, policies, triggers and object ACLs.
-- If this fails, STOP and report the non-secret error. Do not force it.
CREATE DATABASE hod_f7_test TEMPLATE hod_staging;

-- 3. Restrict database CONNECT to the existing application role and owner.
REVOKE CONNECT ON DATABASE hod_f7_test FROM PUBLIC;
GRANT CONNECT ON DATABASE hod_f7_test TO hod_app;

-- 4. Inspect source database/role settings; database settings are not cloned.
SELECT COALESCE(d.datname, '(all databases)') AS database_name,
       COALESCE(r.rolname, '(all roles)') AS role_name,
       s.setconfig
FROM pg_db_role_setting s
LEFT JOIN pg_database d ON d.oid = s.setdatabase
LEFT JOIN pg_roles r ON r.oid = s.setrole
WHERE s.setdatabase IN (0, (SELECT oid FROM pg_database WHERE datname = 'hod_staging'));
-- Review relevant per-database settings before test connections are configured.
-- Do not change role passwords, app grants, source data, or checkout flags here.
