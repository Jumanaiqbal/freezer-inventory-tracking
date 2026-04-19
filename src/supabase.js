import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://gypjmqyivlkcxubsevxf.supabase.co'       // from Supabase dashboard
const supabaseKey = 'sb_publishable_N32hNQY44W5L5Jb56ZdPqw_A8uEIBqZ'  // from Supabase dashboard

export const supabase = createClient(supabaseUrl, supabaseKey)