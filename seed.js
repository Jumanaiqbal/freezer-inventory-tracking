const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gypjmqyivlkcxubsevxf.supabase.co';
const supabaseKey = 'sb_publishable_N32hNQY44W5L5Jb56ZdPqw_A8uEIBqZ';

const supabase = createClient(supabaseUrl, supabaseKey);

const seedData = [
  // Samosa
  { category: 'Samosa', subtype: 'Chicken', quantity: 100 },
  { category: 'Samosa', subtype: 'Veg', quantity: 150 },
  { category: 'Samosa', subtype: 'Potato', quantity: 80 },
  { category: 'Samosa', subtype: 'Cheese', quantity: 60 },
  { category: 'Samosa', subtype: 'Corn Cheese', quantity: 70 },
  { category: 'Samosa', subtype: 'Pizza', quantity: 50 },
  { category: 'Samosa', subtype: 'Jalapeño', quantity: 40 },
  { category: 'Samosa', subtype: 'Punjabi', quantity: 90 },
  { category: 'Samosa', subtype: 'Mash', quantity: 30 },
  { category: 'Samosa', subtype: 'Mushakan', quantity: 20 },
  { category: 'Samosa', subtype: 'Potato Cheese', quantity: 55 },
  { category: 'Samosa', subtype: 'Meat', quantity: 45 },

  // Springroll
  { category: 'Springroll', subtype: 'Veg', quantity: 120 },
  { category: 'Springroll', subtype: 'Chicken', quantity: 85 },
  { category: 'Springroll', subtype: 'Cheese', quantity: 65 },

  // Kibba
  { category: 'Kibba', subtype: 'Chicken', quantity: 75 },
  { category: 'Kibba', subtype: 'Cheese', quantity: 50 },
  { category: 'Kibba', subtype: 'Meat', quantity: 60 },

  // Fatayer
  { category: 'Fatayer', subtype: 'Spinach', quantity: 90 },
  { category: 'Fatayer', subtype: 'Cheese', quantity: 70 },
  { category: 'Fatayer', subtype: 'Meat', quantity: 55 },
];

async function seed() {
  try {
    const { data, error } = await supabase
      .from('items')
      .insert(seedData);

    if (error) {
      console.error('Error seeding data:', error);
    } else {
      console.log('Data seeded successfully:', data);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

seed();