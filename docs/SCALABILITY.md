# SCALABILITY & PERFORMANCE ARCHITECTURE

This document explains the scalability characteristics, database connection pooling strategy, and multi-user performance design of MediVault.

---

## 📈 1. Architectural Evolution

```
[ Legacy Architecture ]                     [ New Scalable Monolithic Architecture ]
  Single Cashier Terminal                      Multiple Concurrent Cashier Terminals
           │                                          │              │
           ▼                                          ▼              ▼
  Express Node App                           Express Node App    Express Node App
           │                                          │              │
  Better-SQLite3                                      └───────┬──────┘
  (File Locking Single-Writer)                                │
           │                                       pg Connection Pool
           ▼                                   (DATABASE_POOL_MAX Configurable)
    medivault.db                                              │
                                           ┌──────────────────┴──────────────────┐
                                           ▼                                     ▼
                                  PostgreSQL Primary DB                Redis Read Cache
                              (ACID Multiversion Concurrency)          (Sub-millisecond)
```

---

## ⚡ 2. Connection Pool Tuning Guidelines
PostgreSQL connection pool max size (`DATABASE_POOL_MAX`) must be tuned according to database server hardware capacity:

- **Formula**: `Max Connections = ((CPU Cores * 2) + Effective Spindle Count)`
- **Development Default**: `DATABASE_POOL_MAX=10`
- **Production Guidance**:
  - 2 CPU Cores / 4GB RAM: `DATABASE_POOL_MAX=15`
  - 4 CPU Cores / 8GB RAM: `DATABASE_POOL_MAX=30`
  - 8 CPU Cores / 16GB RAM: `DATABASE_POOL_MAX=60`

---

## 🛡️ 3. Multi-Branch Preparation (Future Capability)
The data layer repositories and services are designed for multi-tenant extensions. In future multi-store branch releases, a `store_id` foreign key can be added to `users`, `medicines`, `sales`, and `audit_logs` without altering existing Express controller interfaces.
