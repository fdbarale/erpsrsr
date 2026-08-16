import { createClient } from '@supabase/supabase-js';

// CONEXIÓN 1: LA OFICIAL (Física y Fiscal)
const supabaseUrlOficial = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKeyOficial = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const dbOficial = createClient(supabaseUrlOficial, supabaseAnonKeyOficial);

// CONEXIÓN 2: LA PARDA (Negro y Cuentas Corrientes)
const supabaseUrlParda = import.meta.env.VITE_SUPABASE_URL_PARDA;
const supabaseAnonKeyParda = import.meta.env.VITE_SUPABASE_ANON_KEY_PARDA;
export const dbParda = createClient(supabaseUrlParda, supabaseAnonKeyParda);