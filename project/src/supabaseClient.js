import { createClient } from '@supabase/supabase-js';

// Base de Datos Oficial (Fiscal, AFIP, Stock en Blanco)
const URL_OFICIAL = 'https://wmqkspuzebothufolmuo.supabase.co';
const KEY_OFICIAL = 'sb_publishable_aGv55nVJ5Rmk1D6-uefmRg_-hoE8rWJ';
export const dbOficial = createClient(URL_OFICIAL, KEY_OFICIAL);

// Base de Datos Interna (Remitos X, Billetera paralela, Movimientos internos)
// ATENCIÓN: Reemplazá esto con las credenciales de tu NUEVO proyecto en Supabase.
const URL_INTERNA = 'https://edthjhnqfivbsljbhrzv.supabase.co';
const KEY_INTERNA = 'sb_publishable_wXcYd9zneVTykiKROK1xhQ_QduutZfI';
export const dbInterna = createClient(URL_INTERNA, KEY_INTERNA);