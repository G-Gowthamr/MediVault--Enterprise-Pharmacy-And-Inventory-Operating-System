# ARCHITECTURE: MediVault Scalable Monolithic Architecture

## 📐 Scalable Architecture Pattern
MediVault follows a **Layered Monolithic Architecture** with PostgreSQL persistence and Redis read-aside caching.

```
                    +-------------------------------------------------+
                    |              Client Tier (Browser)              |
                    |   Vanilla Single Page Application (HTML/CSS/JS) |
                    +-------------------------------------------------+
                                             │  HTTP / REST APIs
                                             ▼
                    +-------------------------------------------------+
                    |              Express Web Application            |
                    |        Middleware: Auth, RBAC, Error Handler    |
                    +-------------------------------------------------+
                                             │
                                     Controller Tier
                                  (HTTP Request / Res)
                                             │
                                       Service Tier
                           (Financial Decimal Rounding & Rules)
                                             │
                 ┌───────────────────────────┴───────────────────────────┐
                 ▼                                                       ▼
      Repository Tier (PostgreSQL)                             Redis Cache Manager
                 │                                                (Cache-Aside)
         pg Connection Pool                                              │
  (DATABASE_POOL_MAX Configurable)                                 Redis Client
                 │                                              (Read-Aside w/
                 ▼                                              Graceful Fallback)
      +─────────────────────+                                            │
      |  PostgreSQL DB      | ◄──────────────────────────────────────────┘
      | (Primary Source of  |
      |  Transactional Truth|
      +─────────────────────+
```

---

## 🏗️ Detailed Component Breakdown

### 1. Presentation Tier (Frontend Client)
- **Tech Stack**: Vanilla HTML5, ES6 JavaScript, CSS3 variables.
- **Single Page Application (SPA)**: Tab switching handled via `showPage(pageId)` without page reloads.

### 2. API Routing & Middleware Tier (`src/routes/` & `src/middlewares/`)
- Express routes delegate HTTP handling to Controllers.
- `authMiddleware.js` verifies JWT / Session headers and RBAC roles (`Admin`, `Pharmacist`, `Cashier`).

### 3. Business Logic Service Tier (`src/services/`)
- Enforces validation, exact monetary rounding (`Math.round(val * 100) / 100`), stock deduction guards, and audit trail logging.

### 4. Repository & Persistence Tier (`src/repositories/` & `src/config/`)
- **`postgres.js`**: `pg` pool connection manager with configurable `DATABASE_POOL_MAX`, `DATABASE_IDLE_TIMEOUT`, and `DATABASE_CONNECTION_TIMEOUT`.
- **`redis.js`**: Redis read-aside cache manager with automatic cache invalidation and graceful fallback.
