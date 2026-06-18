-- =============================================================================
-- FIX: "permission denied for table items" (Sales / Dashboard / Restock)
-- Run in Supabase SQL Editor, then rebuild + redeploy the app.
-- =============================================================================

-- 1) Table read access for the app (anon key)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON items TO anon, authenticated, service_role;
GRANT SELECT ON history TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 2) Block direct browser writes (stock changes go through RPC only)
REVOKE INSERT, UPDATE, DELETE ON items FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON history FROM anon, authenticated;

-- 3) RLS read policies
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE history ENABLE ROW LEVEL SECURITY;

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

-- 4) RPC functions the app calls
GRANT EXECUTE ON FUNCTION process_sale(jsonb, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION process_restock(jsonb, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION add_category_subtype(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION seed_opening_stock(jsonb) TO anon, authenticated;

-- 5) Realtime (ignore error if tables already in publication)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.items;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.history;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

SELECT 'Permissions fixed. Now run: npm run build and redeploy the app.' AS status;
