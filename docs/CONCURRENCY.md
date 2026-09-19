# CONCURRENCY & TRANSACTION ISOLATION

This document details MediVault's POS checkout concurrency protection, transaction boundaries, and stock overselling prevention strategy.

---

## 1. Previous SQLite Behavior vs PostgreSQL Multi-Connection Concurrency
- **Previous SQLite Behavior**: SQLite operates with file-level database locking (single writer at a time). While this prevented simultaneous write access, it suffered from severe write contention bottlenecks when multiple cashier counters attempted simultaneous checkouts.
- **PostgreSQL Concurrency Advantage**: PostgreSQL supports multiple concurrent connection pool clients executing simultaneous transactions. However, without explicit concurrency controls, two concurrent cashiers attempting to purchase stock (`quantity = 1`) at the exact same millisecond could both read `quantity = 1` and both succeed, driving inventory negative (`quantity = -1`).

---

## 2. Race Condition Hazard Example
```
Cashier A                           Cashier B
   │                                   │
   ├─ GET Medicine A (Qty = 1) ────────┼─ GET Medicine A (Qty = 1)
   │                                   │
   ├─ Check Qty >= 1 (OK) ─────────────┼─ Check Qty >= 1 (OK)
   │                                   │
   ├─ UPDATE Qty = 1 - 1 = 0 ──────────┼─ UPDATE Qty = 1 - 1 = 0  (OVERSELL HAZARD!)
```

---

## 3. Atomic Stock Deduction Solution
To prevent stock overselling without requiring heavy table locks, MediVault implements **Atomic Conditional Stock Decrements**:

```sql
UPDATE medicines
SET quantity = quantity - $1
WHERE id = $2 AND quantity >= $1
RETURNING id, name, quantity;
```

### Execution Flow in `salesService.js`:
1. Checked-out dedicated pool client executes `BEGIN`.
2. Inserts `sales` header and `sale_items`.
3. For each line item, executes `UPDATE medicines SET quantity = quantity - $1 WHERE id = $2 AND quantity >= $1`.
4. Checks `res.rowCount`:
   - If `rowCount === 1`: Stock deduction succeeded atomically at the database engine level.
   - If `rowCount === 0`: Available stock was less than requested quantity. The service throws a stock shortage error.
5. `catch` block catches stock shortage exception and executes `client.query('ROLLBACK')`.
6. Header record, line items, and stock deductions are completely wiped out of PostgreSQL state, and the cashier receives a `400 Stock Shortage` API error response.

---

## 4. Transaction Atomicity Contract
Every POS sale checkout guarantees the following atomic all-or-nothing contract:
1. `sales` header record insertion.
2. `sale_items` line item insertions.
3. `medicines` quantity decrement with concurrency guard.
4. `audit_logs` record creation.

If any of these 4 steps fail, the entire transaction is rolled back (`ROLLBACK`), ensuring zero data corruption or partial sales records.
