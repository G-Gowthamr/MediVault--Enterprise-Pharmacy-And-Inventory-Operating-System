# SCALABILITY MIGRATION AUDIT: MediVault System Inspection

## 1. Current Architecture Overview
MediVault is currently built as a Single-Page Application (SPA) backed by a Node.js Express.js monolith operating on an embedded synchronous SQLite database via `better-sqlite3`.

```
                    +-------------------------------------------------+
                    |              Frontend (Vanilla JS SPA)          |
                    +-------------------------------------------------+
                                             │  HTTP / REST
                                             ▼
                    +-------------------------------------------------+
                    |              Express.js App (src/app.js)        |
                    +-------------------------------------------------+
                                             │
      ┌───────────────────────┬──────────────┼──────────────┬───────────────────────┐
      ▼                       ▼              ▼              ▼                       ▼
+─────────────+       +──────────────+ +───────────+ +──────────────+      +──────────────────+
| Auth        |       | Medicines    | | Sales     | | Settings     |      | Audit            |
| Controller  |       | Controller   | | Controller| | Controller   |      | Controller       |
+─────────────+       +──────────────+ +───────────+ +──────────────+      +──────────────────+
      │                       │              │              │                       │
      └───────────────────────┴──────────────┼──────────────┴───────────────────────┘
                                             ▼
                    +-------------------------------------------------+
                    |       Better-SQLite3 synchronous connection     |
                    +-------------------------------------------------+
                                             │
                                             ▼
                    +-------------------------------------------------+
                    |             data/medivault.db (SQLite)         |
                    +-------------------------------------------------+
```

---

## 2. Database Access Patterns & SQL Inventory
Currently, database calls are embedded directly within controller methods (`src/controllers/*.js`) via direct invocation of `db.prepare()`.

### SQLite SQL Statements Found:
1. **`users` Table**:
   - `SELECT * FROM users WHERE LOWER(email) = LOWER(?)`
   - `SELECT id, name, email, role, phone, status, created_at FROM users WHERE id = ?`
   - `SELECT id, name, email, role, phone, status, created_at FROM users ORDER BY created_at DESC`
   - `INSERT INTO users (id, name, email, password_hash, role, phone, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'Active', ?)`
   - `UPDATE users SET status = ? WHERE id = ?`
   - `UPDATE users SET role = ? WHERE id = ?`

2. **`medicines` Table**:
   - `SELECT * FROM medicines ORDER BY date_added DESC, id ASC`
   - `SELECT * FROM medicines WHERE id = ?`
   - `INSERT OR REPLACE INTO medicines (id, name, category, strength, manufacturer, batch, quantity, price, mrp, expiry, description, date_added) VALUES (...)`
   - `UPDATE medicines SET name=@name, category=@category, strength=@strength, manufacturer=@manufacturer, batch=@batch, quantity=@quantity, price=@price, mrp=@mrp, expiry=@expiry, description=@description WHERE id=@id`
   - `UPDATE medicines SET quantity = quantity - @qty WHERE id = @id`
   - `DELETE FROM medicines WHERE id = ?`

3. **`sales` & `sale_items` Tables**:
   - `SELECT s.id, s.customer_name, s.customer_phone, s.date, s.total, s.payment_method, s.payment_status, s.transaction_ref, COUNT(si.id) AS number_of_medicines, GROUP_CONCAT(m.name, ', ') AS medicine_names FROM sales s LEFT JOIN sale_items si ON si.sale_id = s.id LEFT JOIN medicines m ON m.id = si.medicine_id GROUP BY s.id ORDER BY s.date DESC`
   - `SELECT id, customer_name, customer_phone, date, total, payment_method, payment_status, transaction_ref, created_by FROM sales WHERE id = ? LIMIT 1`
   - `SELECT si.id as sale_item_id, si.medicine_id, COALESCE(m.name, si.medicine_name, '') as medicine_name, si.quantity as qty, si.price as unit_price, si.subtotal FROM sale_items si LEFT JOIN medicines m ON m.id = si.medicine_id WHERE si.sale_id = ? ORDER BY si.id ASC`
   - `INSERT INTO sales (id, customer_name, customer_phone, date, total, payment_method, payment_status, transaction_ref, created_by) VALUES (...)`
   - `INSERT INTO sale_items (sale_id, medicine_id, medicine_name, qty, price, subtotal) VALUES (...)`
   - `DELETE FROM sale_items`
   - `DELETE FROM sales`

4. **`settings` Table**:
   - `SELECT * FROM settings`
   - `INSERT INTO settings (key, value) VALUES (@key, @value) ON CONFLICT(key) DO UPDATE SET value=excluded.value`
   - `DELETE FROM settings`

5. **`audit_logs` Table**:
   - `INSERT INTO audit_logs (user_id, user_name, action, details, created_at) VALUES (?, ?, ?, ?, ?)`
   - `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100`

---

## 3. SQLite Transaction Usage Analysis
Transactions in `better-sqlite3` are instantiated using synchronous closure functions `db.transaction(() => { ... })`:
1. **POS Sale Creation (`salesController.js:80`)**:
   - Wraps `sales` insert, `sale_items` loop inserts, and `medicines` quantity decrement in a single synchronous closure.
2. **Database Reset (`settingsController.js:90`)**:
   - Wipes all records across tables in order, then re-runs schema migrations and seeds default accounts.
3. **Database Restore (`settingsController.js:118`)**:
   - Clears existing table records and re-inserts backup items in an isolated block.
4. **CSV Bulk Product Upload (`uploadController.js:21`)**:
   - Inserts or replaces product rows inside a single closure.

---

## 4. Migration Risks & Compatibility Considerations
1. **Database Access Method**: SQLite methods are synchronous (`stmt.all()`, `stmt.get()`, `stmt.run()`), whereas Node.js `pg` pool queries return Promises (`await pool.query(...)`). Controller layer methods must be refactored to `async/await`.
2. **SQLite Dialect Differences**:
   - `INSERT OR REPLACE INTO` -> PostgreSQL `ON CONFLICT (id) DO UPDATE SET ...`
   - `GROUP_CONCAT(m.name, ', ')` -> PostgreSQL `STRING_AGG(m.name, ', ')`
   - `ON CONFLICT(key) DO UPDATE SET value=excluded.value` -> Compatible syntax in PostgreSQL `ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`
3. **Floating Point Precision Risk**: SQLite `REAL` for `price`, `mrp`, `total`, `subtotal` must be mapped to PostgreSQL `NUMERIC(12, 2)` to avoid floating-point rounding errors during financial sales calculations.
4. **Concurrency Risk**: SQLite locks the database file on writes. PostgreSQL supports concurrent connections; therefore, atomic inventory decrements (`UPDATE medicines SET quantity = quantity - $1 WHERE id = $2 AND quantity >= $1`) must be enforced to prevent overselling race conditions between concurrent cashier terminals.
