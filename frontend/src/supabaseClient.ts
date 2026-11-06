import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://demo.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.demo';

export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_URL !== 'https://demo.supabase.co' &&
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

if (!isSupabaseConfigured) {
  console.info(
    '[RoomieSplit] Using local development fallback for Supabase. ' +
    'Provide VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend/.env to connect to live Supabase Auth.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
