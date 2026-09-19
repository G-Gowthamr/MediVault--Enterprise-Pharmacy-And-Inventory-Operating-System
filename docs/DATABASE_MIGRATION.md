# DATABASE MIGRATION GUIDE: SQLite to PostgreSQL

This document outlines the migration procedures for transitioning existing SQLite data to PostgreSQL.

---

## 📋 1. Schema Data Type Mapping

| SQLite Type | PostgreSQL Type | Notes / Precision |
| :--- | :--- | :--- |
| `TEXT` | `VARCHAR` / `TEXT` | Mapped based on domain semantics (e.g. `name VARCHAR(255)` vs `description TEXT`). |
| `INTEGER` | `INTEGER` / `BIGSERIAL` | Primary keys for `sale_items` and `audit_logs` use `BIGSERIAL`. |
| `REAL` | `NUMERIC(12, 2)` | Preserves exact monetary precision without floating point rounding errors. |
| `TEXT` (ISO Timestamp) | `TIMESTAMPTZ` | Standardized ISO timestamp handling across timezones. |

---

## 🛠️ 2. Migration Execution Steps

1. Start PostgreSQL server (`docker compose up -d postgres`).
2. Run PostgreSQL DDL migrations:
   ```bash
   node -e "require('./src/config/migratePostgres').runPostgresMigrations()"
   ```
3. Run dry-run validation:
   ```bash
   node scripts/migrate-sqlite-to-postgres.js --dry-run
   ```
4. Execute live data migration:
   ```bash
   node scripts/migrate-sqlite-to-postgres.js
   ```
5. Inspect report output in `docs/SQLITE_TO_POSTGRES_MIGRATION.md`.
