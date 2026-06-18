-- =============================================================================
-- OPENING STOCK — run AFTER fresh-start.sql
-- =============================================================================
-- 1. Change only the "quantity" numbers below (your physical count today)
-- 2. Delete any row you don't sell
-- 3. Copy this ENTIRE file → Supabase SQL Editor → Run
--
-- Note: seed_opening_stock() was already created by fresh-start.sql
-- =============================================================================

SELECT seed_opening_stock('[
  {"category":"Samosa","subtype":"Chicken","quantity":0},
  {"category":"Samosa","subtype":"Veg","quantity":1875},
  {"category":"Samosa","subtype":"Potato","quantity":3250},
  {"category":"Samosa","subtype":"Cheese","quantity":4650},
  {"category":"Samosa","subtype":"Corn Cheese","quantity":1200},
  {"category":"Samosa","subtype":"Pizza","quantity":0},
  {"category":"Samosa","subtype":"Jalapeño","quantity":0},
  {"category":"Samosa","subtype":"Punjabi","quantity":0},
  {"category":"Samosa","subtype":"Mash","quantity":300},
  {"category":"Samosa","subtype":"Mushakan","quantity":500},
  {"category":"Samosa","subtype":"Potato Cheese","quantity":1175},
  {"category":"Samosa","subtype":"Meat","quantity":2500},
  {"category":"Samosa","subtype":"Chicken thandoori","quantity":1000},
  {"category":"Samosa","subtype":"Feta cheese","quantity":750},
  {"category":"Samosa","subtype":"Malli cheese","quantity":250},
  {"category":"Samosa","subtype":"Punjabi mini","quantity":0},
  {"category":"Samosa","subtype":"Spinach","quantity":250},

  {"category":"Springroll","subtype":"Veg","quantity":0},
  {"category":"Springroll","subtype":"Chicken","quantity":0},
  {"category":"Springroll","subtype":"Cheese","quantity":0},
  {"category":"Springroll","subtype":"Mushkan","quantity":0},

  {"category":"Kibba","subtype":"Chicken","quantity":450},
  {"category":"Kibba","subtype":"Cheese","quantity":150},
  {"category":"Kibba","subtype":"Meat","quantity":250},

  {"category":"Fatayer","subtype":"Spinach","quantity":1925},
  {"category":"Fatayer","subtype":"Cheese","quantity":375},
  {"category":"Fatayer","subtype":"Meat","quantity":950},

  {"category":"Falafel","subtype":"Standard","quantity":1950},
  {"category":"Puffs","subtype":"Standard","quantity":0},
  {"category":"Vada","subtype":"Standard","quantity":0}
]'::jsonb);
