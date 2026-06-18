-- =============================================================================
-- SANAR FREEZER — FRESH START (run in Supabase SQL Editor)
-- =============================================================================
-- What this does:
--   1. Wipes corrupted items + history
--   2. Recreates tables with safety constraints
--   3. Adds atomic RPC functions (sale + restock in one transaction)
--   4. Locks down RLS so the app must use RPC for stock changes
--
-- AFTER running this:
--   node scripts/seed-opening-stock.js   (loads your real opening quantities)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- STEP 1: Clean slate
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS process_sale(jsonb, text, text, text);
DROP FUNCTION IF EXISTS process_restock(jsonb, text);
DROP FUNCTION IF EXISTS add_category_subtype(text, text);

DROP TABLE IF EXISTS history CASCADE;
DROP TABLE IF EXISTS items CASCADE;

-- ---------------------------------------------------------------------------
-- STEP 2: Tables + constraints
-- ---------------------------------------------------------------------------
CREATE TABLE items (
  id         BIGSERIAL PRIMARY KEY,
  category   TEXT NOT NULL,
  subtype    TEXT NOT NULL,
  quantity   INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (category, subtype),
  -- Prevent accidental whitespace duplicates like "Spinach" vs "Spinach "
  CHECK (category = TRIM(category)),
  CHECK (subtype = TRIM(subtype)),
  CHECK (LENGTH(TRIM(category)) > 0),
  CHECK (LENGTH(TRIM(subtype)) > 0)
);

CREATE TABLE history (
  id               BIGSERIAL PRIMARY KEY,
  item_id          BIGINT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  action           TEXT NOT NULL CHECK (action IN ('add', 'remove', 'opening')),
  quantity_changed INTEGER NOT NULL CHECK (quantity_changed >= 0),
  worker_name      TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_items_category ON items(category);
CREATE INDEX idx_items_subtype ON items(subtype);
CREATE INDEX idx_history_item_id ON history(item_id);
CREATE INDEX idx_history_created_at ON history(created_at DESC);

-- ---------------------------------------------------------------------------
-- STEP 3: Atomic sale (all lines succeed or ALL roll back)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION process_sale(
  p_lines         JSONB,
  p_worker_name   TEXT,
  p_customer_type TEXT DEFAULT 'shop',
  p_company_name  TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  line             JSONB;
  v_item_id        BIGINT;
  v_available      INTEGER;
  v_qty            INTEGER;
  v_sale_ref       TEXT;
  v_worker_context TEXT;
  v_processed      INTEGER := 0;
BEGIN
  IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'Add at least one valid sales item';
  END IF;

  IF TRIM(p_worker_name) = '' THEN
    RAISE EXCEPTION 'Worker name is required';
  END IF;

  IF p_customer_type = 'company' AND (p_company_name IS NULL OR TRIM(p_company_name) = '') THEN
    RAISE EXCEPTION 'Company name required for company sale';
  END IF;

  v_sale_ref := 'SALE-' || FLOOR(EXTRACT(EPOCH FROM NOW()) * 1000)::TEXT
                || '-' || SUBSTR(MD5(RANDOM()::TEXT), 1, 6);

  v_worker_context := TRIM(p_worker_name) || ' | ' || v_sale_ref || ' | ' ||
    CASE
      WHEN p_customer_type = 'company' THEN 'company:' || TRIM(p_company_name)
      ELSE 'shop'
    END;

  FOR line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_qty := (line->>'quantity')::INTEGER;

    IF line->>'category' IS NULL OR line->>'subtype' IS NULL
       OR v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Invalid line: category, subtype, and positive quantity required';
    END IF;

    -- Lock row for this transaction (prevents concurrent oversell)
    SELECT id, quantity INTO v_item_id, v_available
    FROM items
    WHERE category = TRIM(line->>'category')
      AND subtype  = TRIM(line->>'subtype')
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Item not found: % / %', line->>'category', line->>'subtype';
    END IF;

    IF v_qty > v_available THEN
      RAISE EXCEPTION 'Not enough stock for %. Available: %, requested: %',
        line->>'subtype', v_available, v_qty;
    END IF;

    UPDATE items
    SET quantity = quantity - v_qty,
        updated_at = NOW()
    WHERE id = v_item_id;

    INSERT INTO history (item_id, action, quantity_changed, worker_name)
    VALUES (v_item_id, 'remove', v_qty, v_worker_context);

    v_processed := v_processed + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'sale_ref', v_sale_ref,
    'processed', v_processed
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- STEP 4: Atomic restock (all lines succeed or ALL roll back)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION process_restock(
  p_lines       JSONB,
  p_worker_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  line       JSONB;
  v_item_id  BIGINT;
  v_qty      INTEGER;
  v_processed INTEGER := 0;
BEGIN
  IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'Add at least one product with a valid quantity';
  END IF;

  IF TRIM(p_worker_name) = '' THEN
    RAISE EXCEPTION 'Worker name is required';
  END IF;

  FOR line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_qty := (line->>'quantity')::INTEGER;

    IF line->>'category' IS NULL OR line->>'subtype' IS NULL
       OR v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Invalid line: category, subtype, and positive quantity required';
    END IF;

    SELECT id INTO v_item_id
    FROM items
    WHERE category = TRIM(line->>'category')
      AND subtype  = TRIM(line->>'subtype')
    FOR UPDATE;

    IF FOUND THEN
      UPDATE items
      SET quantity = quantity + v_qty,
          updated_at = NOW()
      WHERE id = v_item_id;
    ELSE
      INSERT INTO items (category, subtype, quantity)
      VALUES (TRIM(line->>'category'), TRIM(line->>'subtype'), v_qty)
      RETURNING id INTO v_item_id;
    END IF;

    INSERT INTO history (item_id, action, quantity_changed, worker_name)
    VALUES (v_item_id, 'add', v_qty, TRIM(p_worker_name));

    v_processed := v_processed + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'processed', v_processed);
END;
$$;

-- ---------------------------------------------------------------------------
-- STEP 5: Add category + subtype (no phantom "Default" row)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION add_category_subtype(
  p_category TEXT,
  p_subtype  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id BIGINT;
BEGIN
  IF TRIM(p_category) = '' OR TRIM(p_subtype) = '' THEN
    RAISE EXCEPTION 'Category and subtype names are required';
  END IF;

  IF p_subtype = 'Default' THEN
    RAISE EXCEPTION 'Subtype name "Default" is not allowed';
  END IF;

  INSERT INTO items (category, subtype, quantity)
  VALUES (TRIM(p_category), TRIM(p_subtype), 0)
  ON CONFLICT (category, subtype) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'This item already exists: % / %', p_category, p_subtype;
  END IF;

  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- STEP 6: Row Level Security
-- App uses the anon (publishable) key — stock changes go through RPC only.
-- ---------------------------------------------------------------------------
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE history ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Enable all for authenticated users" ON items;
DROP POLICY IF EXISTS "Enable read/insert for authenticated users" ON history;
DROP POLICY IF EXISTS "anon_read_items" ON items;
DROP POLICY IF EXISTS "anon_read_history" ON history;

CREATE POLICY "anon_read_items"
  ON items FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "anon_read_history"
  ON history FOR SELECT
  TO anon, authenticated
  USING (true);

-- Block direct writes from the browser; RPC (SECURITY DEFINER) bypasses RLS.
REVOKE INSERT, UPDATE, DELETE ON items FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON history FROM anon, authenticated;

-- App must be able to READ items/history (Dashboard, Sales dropdowns, Logs).
GRANT SELECT ON items TO anon, authenticated;
GRANT SELECT ON history TO anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT EXECUTE ON FUNCTION process_sale(jsonb, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION process_restock(jsonb, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION add_category_subtype(text, text) TO anon, authenticated;

-- Opening stock loader (run seed-opening-stock.sql after editing quantities)
CREATE OR REPLACE FUNCTION seed_opening_stock(p_rows JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_data JSONB;
  v_id BIGINT;
  v_qty INTEGER;
  v_count INTEGER := 0;
BEGIN
  IF (SELECT COUNT(*) FROM items) > 0 THEN
    RAISE EXCEPTION 'items table is not empty — truncate first or run fresh-start.sql';
  END IF;

  FOR row_data IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_qty := COALESCE((row_data->>'quantity')::INTEGER, 0);
    IF v_qty < 0 THEN
      RAISE EXCEPTION 'Negative quantity not allowed for %/%',
        row_data->>'category', row_data->>'subtype';
    END IF;

    INSERT INTO items (category, subtype, quantity)
    VALUES (TRIM(row_data->>'category'), TRIM(row_data->>'subtype'), v_qty)
    RETURNING id INTO v_id;

    INSERT INTO history (item_id, action, quantity_changed, worker_name)
    VALUES (v_id, 'opening', v_qty, 'Opening balance');

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('seeded', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION seed_opening_stock(JSONB) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- STEP 7: Verify (should return empty — no tables yet)
-- ---------------------------------------------------------------------------
SELECT 'Setup complete. Run: node scripts/seed-opening-stock.js' AS next_step;
