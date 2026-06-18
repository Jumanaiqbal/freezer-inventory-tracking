/**
 * Load opening stock into a FRESH database (after supabase/fresh-start.sql).
 *
 * Edit OPENING_STOCK below with your real physical counts, then run:
 *   node scripts/seed-opening-stock.js
 *
 * Each row is inserted into `items` AND logged in `history` as action='opening'
 * so the ledger always matches the balance from day one.
 */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://gypjmqyivlkcxubsevxf.supabase.co';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'sb_publishable_N32hNQY44W5L5Jb56ZdPqw_A8uEIBqZ';

const supabase = createClient(supabaseUrl, supabaseKey);

// ─── EDIT THIS: your real opening quantities ───────────────────────────────
const OPENING_STOCK = [
  // Example — replace with your actual physical count today
  { category: 'Samosa', subtype: 'Chicken', quantity: 0 },
  { category: 'Samosa', subtype: 'Veg', quantity: 0 },
  // ... add every category/subtype you sell
];
// ───────────────────────────────────────────────────────────────────────────

async function seedOpeningStock() {
  if (OPENING_STOCK.length === 0) {
    console.error('OPENING_STOCK is empty. Edit scripts/seed-opening-stock.js first.');
    process.exit(1);
  }

  const { count: existing } = await supabase
    .from('items')
    .select('*', { count: 'exact', head: true });

  if (existing > 0) {
    console.error(
      `Aborting: items table already has ${existing} rows.\n` +
        'Run supabase/fresh-start.sql first if you want a clean slate.'
    );
    process.exit(1);
  }

  console.log(`Seeding ${OPENING_STOCK.length} items with opening-balance history...`);

  for (const row of OPENING_STOCK) {
    const category = row.category.trim();
    const subtype = row.subtype.trim();
    const quantity = Number(row.quantity) || 0;

    if (!category || !subtype) {
      console.error('Skip invalid row:', row);
      continue;
    }
    if (subtype === 'Default') {
      console.error('Skip: subtype "Default" is not allowed:', row);
      continue;
    }

    const { data: inserted, error: insertError } = await supabase
      .from('items')
      .insert([{ category, subtype, quantity }])
      .select('id')
      .single();

    if (insertError) {
      console.error(`Failed ${category}/${subtype}:`, insertError.message);
      process.exit(1);
    }

  // Opening balance must be logged via service role after fresh-start.sql
  // (direct history insert is blocked for anon). If you only have anon key,
  // use the Supabase SQL Editor instead — see AUDIT.md "Manual seed via SQL".
    const { error: historyError } = await supabase.from('history').insert([
      {
        item_id: inserted.id,
        action: 'opening',
        quantity_changed: quantity,
        worker_name: 'Opening balance',
      },
    ]);

    if (historyError) {
      console.error(`History failed for ${category}/${subtype}:`, historyError.message);
      console.error(
        'Tip: run the SQL seed block in AUDIT.md if anon cannot insert history.'
      );
      process.exit(1);
    }

    console.log(`  ✓ ${category} / ${subtype}: ${quantity}`);
  }

  console.log('\nDone. Open the app Dashboard to verify.');
}

seedOpeningStock();
