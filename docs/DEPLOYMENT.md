# DEPLOYMENT & PRODUCTION GUIDE

This document provides deployment instructions for MediVault in local development and production environments.

---

## 🐋 1. Local Development via Docker Compose
To start PostgreSQL 16 and Redis 7 containers locally:

```bash
# Start containerized PostgreSQL and Redis
docker compose up -d

# Verify container health
docker compose ps
```

---

## ⚙️ 2. Environment Variables (.env)
Configure connection strings and security keys in `.env`:

```env
NODE_ENV=production
PORT=3000

# PostgreSQL Settings
DATABASE_URL=postgresql://medivault_app:medivault_secret@localhost:5432/medivault
DATABASE_POOL_MAX=20
DATABASE_IDLE_TIMEOUT=30000
DATABASE_CONNECTION_TIMEOUT=5000

# Redis Settings
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=true
REDIS_CACHE_TTL=3600

# App Security
JWT_SECRET=super_secret_production_jwt_key
```

---

## 🔄 3. Database Schema Migrations & Data Import

```bash
# Run PostgreSQL schema DDL migrations & default account seeding
node -e "require('./src/config/migratePostgres').runPostgresMigrations()"

# Run SQLite -> PostgreSQL data migration script (Dry Run mode)
node scripts/migrate-sqlite-to-postgres.js --dry-run

# Execute live data migration from legacy SQLite database
node scripts/migrate-sqlite-to-postgres.js
```

---

## 🚀 4. Application Startup

```bash
# Start production Express app
npm start

# Health check verification
curl http://localhost:3000/api/health
```
