# 💊 MediVault - Enterprise Pharmacy & Healthcare Management Operating System

[![Node.js](https://img.shields.io/badge/Node.js-v20.x-339933?logo=nodedotjs)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-v4.x-000000?logo=express)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-v3.x-003B57?logo=sqlite)](https://www.sqlite.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-v16.x-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![JWT Security](https://img.shields.io/badge/Auth-JWT_%26_bcrypt-FF6F00?logo=jsonwebtokens)](https://jwt.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**MediVault** is a next-generation pharmaceutical operating system designed for enterprise drug inventory control, multi-channel POS billing, automated expiry radar alerts, role-based access security (RBAC), and real-time security auditing. Built with a dual-database architecture, MediVault runs zero-config SQLite locally for development while offering instant PostgreSQL scaling for cloud deployment.

---

## 📋 Table of Contents
- [System Overview](#-system-overview)
- [Architecture & System Flow](#-architecture--system-flow)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Directory & Project Structure](#-directory--project-structure)
- [Default Demo Credentials](#-default-demo-credentials)
- [Installation & Quick Start](#-installation--quick-start)
- [Environment Variables](#-environment-variables)
- [API Endpoints Overview](#-api-endpoints-overview)
- [Data Backup & System Recovery](#-data-backup--system-recovery)
- [Future Enhancements](#-future-enhancements)
- [License](#-license)

---

## 🌟 System Overview

MediVault bridges the gap between pharmaceutical compliance, point-of-sale efficiency, and robust security. It automates inventory updates upon billing, tracks medicine expiration dates, enforces strict multi-role permissions, and logs every system operation to an immutable audit log.

```
       ┌─────────────────────────────────────────────────────────┐
       │                   Public Landing Page                   │
       └────────────────────────────┬────────────────────────────┘
                                    │ (Portal Authentication)
                                    ▼
       ┌─────────────────────────────────────────────────────────┐
       │              Role-Based Access Control (RBAC)           │
       └───────┬────────────────────┼────────────────────┬───────┘
               │                    │                    │
               ▼                    ▼                    ▼
       ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
       │     ADMIN     │    │  PHARMACIST   │    │    CASHIER    │
       │ Full System & │    │  Inventory &  │    │  POS Billing  │
       │ Security Access│    │ Drug Control  │    │ Terminal Only │
       └───────────────┘    └───────────────┘    └───────────────┘
```

---

## 🏗️ Architecture & System Flow

MediVault follows a modular Model-View-Controller (MVC) design pattern powered by Express.js and client-side JavaScript.

```mermaid
graph TD
    User((User / Client)) -->|HTTP Requests| Router[Express Router / API Layer]
    Router --> AuthMid{JWT Auth Middleware}
    AuthMid -->|Authorized| RoleMid{Role Permission Gate}
    RoleMid -->|Passed| Controller[Controller Handlers]
    Controller -->|Audit Log Event| Audit[Audit Trail Service]
    Controller -->|Read / Write| DBAdapter[Dual DB Abstraction Layer]
    DBAdapter -->|SQLite Dev| SQLite[(SQLite Database)]
    DBAdapter -->|Postgres Prod| PG[(PostgreSQL Database)]
```

---

## 🔥 Key Features

### 🔒 1. Role-Based Access Control (RBAC) & JWT Security
- Enforces strict security layers using **JSON Web Tokens (JWT)** and **bcrypt** password hashing.
- Three distinct user roles:
  - **System Admin**: Complete platform management, staff account registration, audit logs, and data backup/reset.
  - **Pharmacist**: Stock inventory management, drug entry, bulk CSV imports, POS billing, and reports.
  - **Cashier**: Isolated access to the POS billing terminal without settings or inventory modification rights.

### 🆔 2. Standardized Dynamic ID Engine
- Automatically formats business records with standardized prefix identifiers:
  - **Medicines**: `MED-2026-xxx`
  - **Sales Invoices**: `INV-2026-xxx`
  - **Staff User Accounts**: `USR-xxx`
  - **Suppliers**: `SUP-xxx`

### 💳 3. Multi-Payment POS Billing Terminal
- Process customer orders with instant invoice printing and real-time inventory stock deduction.
- Supports 5 payment payment methods:
  - Cash Payment
  - Credit / Debit Card
  - UPI / QR Code Payment
  - Net Banking
  - Store Credit Account

### 📊 4. Interactive Dashboard Result Modals
- Clicking any dashboard stat card opens a direct pop-up detail modal without navigating away:
  - **Total Stock Modal**: Complete drug inventory listing with inline editing.
  - **Low Stock Modal**: Items below warning threshold (`≤ 10` default).
  - **Near Expiry Modal**: Batches expiring within warning window (`≤ 30 days`).
  - **Today's Revenue Modal**: Real-time sales transaction summary.

### 🗄️ 5. Dual Database Engine (SQLite & PostgreSQL)
- **Zero-Config Local Development**: Out-of-the-box synchronous `better-sqlite3` execution.
- **Production Scaling**: Automatic switch to PostgreSQL (`pg` adapter) when `DATABASE_URL` environment variable is defined.
- **Auto-Migrations & Seeder**: Auto-creates table schemas and seeds initial demo team accounts on startup.

### 🛡️ 6. System Data Backup & Password-Protected Recovery
- **Export JSON Snapshot**: Download complete database backup files.
- **Restore JSON Snapshot**: Upload and restore previous system database snapshots.
- **Factory Reset**: Password-verified Admin database wipe & re-seeding.

---

## 💻 Tech Stack

| Component | Technology | Description |
|---|---|---|
| **Backend Runtime** | Node.js (v20+) | Event-driven JavaScript runtime |
| **Web Framework** | Express.js (v4.x) | Fast, unopinionated REST API framework |
| **Authentication** | JWT & bcryptjs | Stateless JSON Web Tokens & salted password hashing |
| **Database (Dev)** | SQLite (`better-sqlite3`) | High-performance embedded database |
| **Database (Prod)** | PostgreSQL (`pg`) | Enterprise relational database |
| **Frontend UI** | HTML5, CSS3, Vanilla JS | SPA architecture with dark/light glassmorphism design system |
| **PDF Generation** | html2pdf.js | Native browser printable PDF invoice generator |

---

## 📁 Directory & Project Structure

```
MediVault/
├── data/
│   └── medivault.db            # Local SQLite database instance (auto-generated)
├── public/
│   ├── css/
│   │   └── style.css           # Glassmorphism design tokens, light/dark themes
│   ├── js/
│   │   ├── auth.js             # JWT authentication, session storage & RBAC gating
│   │   └── script.js           # SPA navigation, POS billing, stat card modals
│   └── index.html              # Landing page, dashboard, billing terminal & modals
├── src/
│   ├── config/
│   │   ├── db.js               # Dual SQLite / PostgreSQL abstraction & ID generator
│   │   └── migrate.js          # Database migrations & default demo account seeder
│   ├── controllers/
│   │   ├── auditController.js  # Security audit trail recorder & endpoints
│   │   ├── authController.js   # Authentication & team user management
│   │   ├── medicinesController.js # Drug inventory CRUD & batch management
│   │   ├── salesController.js  # POS billing & multi-payment transaction handler
│   │   └── settingsController.js # App preferences, backup export/import & reset
│   ├── middlewares/
│   │   ├── authMiddleware.js   # JWT verification middleware
│   │   └── roleMiddleware.js   # RBAC permission middleware (Admin/Staff/Cashier)
│   ├── routes/
│   │   ├── auditRoutes.js
│   │   ├── authRoutes.js
│   │   ├── medicinesRoutes.js
│   │   ├── reportsRoutes.js
│   │   ├── salesRoutes.js
│   │   └── settingsRoutes.js
│   └── app.js                  # Express middleware mounting & API router binding
├── server.js                   # Main application entry point
├── package.json                # Project dependencies & scripts
├── LICENSE                     # MIT License
└── README.md                   # System documentation
```

---

## 🔑 Default Demo Credentials

When the server boots for the first time, it automatically seeds three default team accounts:

| Role | Email Address | Password | Permissions |
|---|---|---|---|
| **System Admin** | `admin@medivault.com` | `admin123` | Full access (Inventory, Sales, Users, Audit Logs, Settings) |
| **Pharmacist** | `pharmacist@medivault.com` | `pharm123` | Inventory, Drug Entry, Bulk CSV, Sales, Reports |
| **Cashier** | `cashier@medivault.com` | `cash123` | POS Sales & Billing Terminal only |

---

## 🚀 Installation & Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or higher)
- [Git](https://git-scm.com/)

### 1. Clone the Repository
```bash
git clone https://github.com/G-Gowthamr/MediVault--Enterprise-Pharmacy-And-Inventory-Operating-System.git
cd MediVault--Enterprise-Pharmacy-And-Inventory-Operating-System
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start the Server
```bash
npm start
```

### 4. Access the Application
Open your web browser and navigate to:
```
http://localhost:3000
```

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory to customize system settings:

```env
PORT=3000
JWT_SECRET=your_super_secret_jwt_key_2026
NODE_ENV=development

# Optional PostgreSQL Connection (Leave empty to use local SQLite)
# DATABASE_URL=postgres://user:password@localhost:5432/medivault
```

---

## 📡 API Endpoints Overview

### Authentication & Users
- `POST /api/auth/login` - Authenticate user & receive JWT token.
- `GET /api/auth/me` - Get current logged-in user profile.
- `GET /api/auth/users` - List all staff accounts *(Admin Only)*.
- `POST /api/auth/users` - Create a new staff account *(Admin Only)*.

### Drug Inventory Management
- `GET /api/medicines` - Fetch all pharmaceutical inventory products.
- `POST /api/medicines` - Add a new medicine record.
- `PUT /api/medicines/:id` - Update medicine details.
- `DELETE /api/medicines/:id` - Delete a medicine record *(Admin Only)*.
- `POST /api/medicines/upload-csv` - Import bulk CSV batch file.

### POS Sales & Invoicing
- `GET /api/sales` - Get all sales transactions.
- `POST /api/sales` - Process a new customer checkout transaction.

### Settings & Maintenance
- `GET /api/settings` - Retrieve system preferences.
- `POST /api/settings` - Save updated preferences.
- `GET /api/settings/backup` - Export JSON system backup file *(Admin Only)*.
- `POST /api/settings/restore` - Restore JSON system backup file *(Admin Only)*.
- `POST /api/settings/reset` - Password-verified database reset *(Admin Only)*.

---

## 🔮 Future Enhancements

- 📱 **Mobile App Integration**: React Native mobile app for barcode scanning.
- 📦 **Supplier Reorder Automation**: Automated purchase order generation when stock hits threshold.
- 🔔 **WhatsApp / SMS Invoicing**: Send digital receipts directly to customer phone numbers.
- 📈 **Advanced Predictive Analytics**: Machine-learning demand forecasting for seasonal medicine trends.

---

## 📜 License

This project is open-source software licensed under the [MIT License](LICENSE).

Developed with ❤️ by **[Gowtham R](https://github.com/G-Gowthamr)**.
