import { createClient } from '@supabase/supabase-js';

// 1. BASE DE DATOS OFICIAL (La que pusiste en el .env)
const urlOficial = import.meta.env.VITE_SUPABASE_URL;
const keyOficial = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const dbOficial = createClient(urlOficial, keyOficial);

// 2. BASE DE DATOS PARDA
// Le ponemos un fallback (|| urlOficial) para que no rompa la app 
// si te olvidás de poner las variables de la Parda en el .env
const urlParda = import.meta.env.VITE_SUPABASE_PARDA_URL || urlOficial;
const keyParda = import.meta.env.VITE_SUPABASE_PARDA_KEY || keyOficial;

export const dbParda = createClient(urlParda, keyParda);