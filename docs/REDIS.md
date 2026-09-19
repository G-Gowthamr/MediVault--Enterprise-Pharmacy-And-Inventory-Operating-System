# REDIS CACHING STRATEGY & DEGRADATION FALLBACK

This document details MediVault's Redis read-aside caching pattern, cache invalidation rules, and graceful fallback behavior.

---

## 🏗️ Read-Aside Caching Architecture
Redis operates strictly as a read-aside secondary cache. PostgreSQL remains the authoritative single source of transactional truth.

```
Request GET /api/medicines
           │
           ▼
    Check Redis Key ('medicines:all')
           │
     ┌─────┴─────┐
     │           │
 Cache Hit   Cache Miss / Redis Down
     │           │
     │           ▼
     │    Query PostgreSQL Primary DB
     │           │
     │           ▼
     │    Populate Redis Cache Key
     │           │
     └───────────┼───────────┐
                 ▼           │
          Return Response ───┘
```

---

## 🔑 Cache Targets & TTL Configurations

| Data Target | Redis Key Pattern | TTL | Invalidation Trigger |
| :--- | :--- | :--- | :--- |
| **All Medicines** | `medicines:all` | 3600s (1 hr) | `addMedicine`, `updateMedicine`, `deleteMedicine`, `uploadMedicinesCsv`, `createSale` |
| **Single Medicine** | `medicines:item:<id>` | 3600s (1 hr) | `updateMedicine`, `deleteMedicine`, `createSale` |
| **All Settings** | `settings:all` | 3600s (1 hr) | `saveSettings`, `restoreDatabase`, `resetDatabase` |

---

## 🛡️ Graceful Degradation Strategy
If the Redis instance crashes, network disconnects, or `REDIS_ENABLED=false` is configured:
1. `src/config/redis.js` logs connection warning messages without throwing unhandled exceptions.
2. All Redis wrapper helpers (`getCache`, `setCache`, `delCache`) silently catch errors and return `null` or `false`.
3. Express controllers and services detect `null` cache responses and query PostgreSQL directly.
4. `GET /api/health` reports status `"degraded"` (`"database": "connected"`, `"redis": "degraded"`), maintaining 100% operational availability for cashiers and pharmacists.
