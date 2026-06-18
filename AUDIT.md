# Sanar Freezer — Complete Audit (June 2026)

This document explains **why your stock numbers are wrong**, what was fixed in code, and **exact steps to start fresh** with correct data.

---

## Live database findings (your Supabase right now)

| Metric | Value |
|--------|-------|
| Items in DB | **31** |
| History rows | **950** |
| Items where `quantity ≠ ledger` | **23 of 31** |
| Phantom removals (ledger says negative stock) | **6 items** |
| Phantom `"Default"` products | **3** (Falafel, Puffs, Vada) |
| RLS | **Not protecting data** — anon key can read/write everything |

### Worst mismatches (current vs what history says it should be)

| Item | In DB now | Ledger says | Off by |
|------|-----------|-------------|--------|
| Springroll / Cheese | 3,175 | 240 | +2,935 |
| Springroll / Veg | 4,820 | 2,340 | +2,480 |
| Samosa / Meat | 450 | −1,505 | +1,955 |
| Fatayer / Cheese | 375 | −1,055 | +1,430 |
| Samosa / Chicken | 2,050 | 3,450 | −1,400 |

**Conclusion:** The data is corrupted. Do not try to “patch” individual rows — **wipe and reload** with a proper opening balance.

---

## Root causes (why this happened)

### 1. Original oversell bug (fixed in app, damage remains in DB)

Old Sales code:

- Used a **stale snapshot** of stock (loaded when page opened).
- Used `Math.max(0, available - sold)` so overselling **silently became 0** instead of error.
- No lock when two phones sold at once → **lost updates**.

**Effect:** People could sell food that wasn’t there; history logged full removal but balance was wrong.

### 2. Restock had the same race bug (fixed)

Restock did `read → add → write` with no guard. A sale at the same time could be overwritten.

### 3. Multi-line sales were not atomic

If a 3-line sale failed on line 3, lines 1–2 were already saved. Partial sales corrupted totals.

### 4. Opening stock never hit the ledger

`seed.js` inserted quantities into `items` only — **no `history` row**.

So any reconciliation formula `opening + adds − removes` is wrong unless you guess the opening numbers.

### 5. Phantom `"Default"` items

`ManageItems` created `subtype: "Default"` when adding a category. Workers could sell/restock `"Falafel / Default"` as a real product.

### 6. Duplicate names (whitespace)

Live DB has both `Samosa/Spinach` and `Samosa/Spinach ` (trailing space) — two separate products.

### 7. RLS misconfiguration

Docs say policies for “authenticated users”, but the app uses the **anon** key and never calls Supabase Auth. Policies with `USING (true)` let **anyone** read/write/delete all data from the browser.

### 8. Dashboard thresholds were wrong

Code used `< 1000` = Critical while real stock is tens/hundreds — everything looked “critical”. Fixed to match docs: Critical &lt; 20, Medium &lt; 50, Low &lt; 100, Healthy ≥ 100.

---

## What we fixed in code (this repo)

| Area | Fix |
|------|-----|
| Sales | Uses `process_sale` RPC — one DB transaction, row locks, no oversell |
| Restock | Uses `process_restock` RPC — atomic |
| Manage Items | No more `"Default"`; uses `add_category_subtype` RPC |
| Dashboard | Correct thresholds + live refresh on item changes |
| History | Shows `Opening` balance rows |
| Supabase SQL | `supabase/fresh-start.sql` — constraints, RPC, RLS |

---

## Fresh start — do this in order

### Step 1: Physical count

Count **every** product in the freezer today. That list is your truth.

### Step 2: Reset database

1. Open [Supabase SQL Editor](https://app.supabase.com)
2. Run **`supabase/fresh-start.sql`** (wipes tables, creates safe schema + RPC + RLS)

### Step 3: Load opening stock

1. Edit the JSON in **`supabase/seed-opening-stock.sql`** with your real counts
2. Run that file in SQL Editor

Example:

```sql
SELECT seed_opening_stock('[
  {"category":"Samosa","subtype":"Chicken","quantity":1200},
  {"category":"Samosa","subtype":"Veg","quantity":800}
]'::jsonb);
```

### Step 4: Deploy app

```bash
npm run build
# deploy build/ to your host (Vercel, Netlify, etc.)
```

### Step 5: Verify

Run this in SQL Editor — **every row should show `difference = 0`**:

```sql
WITH ledger AS (
  SELECT item_id,
         SUM(CASE WHEN action IN ('add','opening') THEN quantity_changed ELSE 0 END) AS added,
         SUM(CASE WHEN action = 'remove' THEN quantity_changed ELSE 0 END) AS removed
  FROM history GROUP BY item_id
)
SELECT i.category, i.subtype, i.quantity AS current,
       COALESCE(l.added,0) - COALESCE(l.removed,0) AS expected,
       i.quantity - (COALESCE(l.added,0) - COALESCE(l.removed,0)) AS difference
FROM items i
LEFT JOIN ledger l ON l.item_id = i.id
ORDER BY ABS(i.quantity - (COALESCE(l.added,0) - COALESCE(l.removed,0))) DESC;
```

---

## After fresh start — daily rules

1. **Only** use the app for sales/restock (no manual edits in Supabase Table Editor).
2. If a sale fails, **refresh** and retry — don’t hammer submit.
3. New products: **Manage Items** → add category + subtype (starts at 0), then **Update Stock** to add quantity.
4. Once a month: run the verification query above; any `difference ≠ 0` means investigate immediately.

---

## Optional next step (security)

Login is still client-side only (`Sanar` / `Sanarworker` passwords in `Login.jsx`). For production, migrate to **Supabase Auth** so RLS can tie writes to real users. The RPC + RLS setup is ready for that path.

---

## Files reference

| File | Purpose |
|------|---------|
| `supabase/fresh-start.sql` | Wipe + schema + RPC + RLS |
| `supabase/seed-opening-stock.sql` | Load your real opening counts |
| `scripts/seed-opening-stock.js` | Node alternative (needs service role for history) |
