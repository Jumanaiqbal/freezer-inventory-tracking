# Sanar Freezer - Database Setup Guide

## Overview
This document provides step-by-step instructions to set up the Supabase database for the Sanar Freezer Inventory Tracking System.

## Prerequisites
- Access to your Supabase project: https://app.supabase.com
- Project URL: `https://gypjmqyivlkcxubsevxf.supabase.co`

## Step 1: Update the `items` Table Schema

Your current `items` table has the old schema. You need to modify it to match the new structure.

### Old Schema (REMOVE these columns):
- `name` (text)
- `unit` (text)

### New Schema (KEEP/ADD these columns):
| Column Name | Type | Settings |
|---|---|---|
| `id` | `bigint` | Primary Key, Auto-increment |
| `category` | `text` | NOT NULL |
| `subtype` | `text` | NOT NULL |
| `quantity` | `integer` | NOT NULL, Default: 0 |
| `created_at` | `timestamp with time zone` | Default: now() |
| `updated_at` | `timestamp with time zone` | Default: now() |

### Steps in Supabase Dashboard:
1. Go to **SQL Editor** in your Supabase dashboard
2. Run this SQL to drop and recreate the table:

```sql
-- Drop the old items table if it exists
DROP TABLE IF EXISTS items;

-- Create new items table with correct schema
CREATE TABLE items (
  id BIGSERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  subtype TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(category, subtype)
);

-- Create indexes for better query performance
CREATE INDEX idx_items_category ON items(category);
CREATE INDEX idx_items_subtype ON items(subtype);
```

## Step 2: Create the `history` Table

This table logs all inventory changes for audit trail purposes.

```sql
-- Create history table for activity logging
CREATE TABLE history (
  id BIGSERIAL PRIMARY KEY,
  item_id BIGINT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('add', 'remove')),
  quantity_changed INTEGER NOT NULL,
  worker_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_history_item_id ON history(item_id);
CREATE INDEX idx_history_created_at ON history(created_at);
```

## Step 3: Enable Row Level Security (Optional but Recommended)

If you want basic security:

```sql
-- Enable RLS for items table
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read and modify
CREATE POLICY "Enable all for authenticated users" ON items
  FOR ALL
  USING (true);

-- Enable RLS for history table
ALTER TABLE history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read/insert for authenticated users" ON history
  FOR ALL
  USING (true);
```

## Step 4: Seed Initial Data

After creating the tables and ensuring the app compiles, run the seed script to populate initial inventory data:

```bash
cd /Users/mhdhishaa/Desktop/freezer-inventory
node seed.js
```

**Expected Output:**
```
Data seeded successfully: [array of 21 items]
```

### Initial Stock Levels (by design):
- **Samosa** (12 subtypes): 20-150 pieces each
- **Springroll** (3 subtypes): 65-120 pieces each
- **Kibba** (3 subtypes): 50-75 pieces each
- **Fatayer** (3 subtypes): 55-90 pieces each

## Step 5: Verify Setup

Once seeded, reload the application in your browser:
- **Dashboard** should show all items grouped by category
- **Color Coding:**
  - Green: Healthy (>100 pieces)
  - Yellow: Medium (50-100 pieces)
  - Red: Low (20-50 pieces)
  - Dark Red: Critical (<20 pieces)
- **Stats cards at top:** Total Items, Types, Low Stock count, Critical count
- **Search functionality:** Type to filter items

## Database Schema Diagram

```
┌─────────────────────────────┐
│         items               │
├─────────────────────────────┤
│ id (PK)                     │
│ category (text, NOT NULL)   │
│ subtype (text, NOT NULL)    │
│ quantity (integer)          │
│ created_at (timestamp)      │
│ updated_at (timestamp)      │
│ UNIQUE(category, subtype)   │
└─────────────────────────────┘
           │
           │ (1:M)
           │
┌─────────────────────────────┐
│       history               │
├─────────────────────────────┤
│ id (PK)                     │
│ item_id (FK → items.id)     │
│ action (add|remove)         │
│ quantity_changed (integer)  │
│ worker_name (text)          │
│ created_at (timestamp)      │
└─────────────────────────────┘
```

## Troubleshooting

### Error: "column items.category does not exist"
**Solution:** You haven't updated the table schema yet. Follow Step 1.

### Error: "relation history does not exist"
**Solution:** You haven't created the history table. Follow Step 2.

### Seed script fails with permission error
**Solution:** Check your RLS policies or temporarily disable RLS to seed data, then re-enable.

### Data not appearing after seeding
1. Refresh the browser (Ctrl+R or Cmd+R)
2. Check the browser console for errors (F12)
3. Verify the data in Supabase: Menu → Table Editor → items

## Next Steps

Once database is set up:
1. Dashboard will display live inventory with color coding
2. Workers can update stock using "Update Stock" button
3. New items can be added via "Add Item" button
4. All changes are logged in the history table

## Architecture Notes

### Color-Coding System
- **Healthy (Green)**: ≥ 100 pieces - Good stock levels
- **Medium (Yellow)**: 50-99 pieces - Monitor stock
- **Low (Red)**: 20-49 pieces - Order more ingredients
- **Critical (Dark Red)**: < 20 pieces - Urgent action needed

### Real-time Updates
The dashboard automatically updates when:
- Stock is added or removed
- New items are created
- Any user makes changes (real-time via Supabase subscriptions)

### Data Model
- Categories: Samosa, Springroll, Kibba, Fatayer
- Each category can have multiple subtypes (Chicken, Veg, Cheese, etc.)
- Quantity is tracked in pieces (unit: pièce/pc)
- All changes are logged with worker name and timestamp
