import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wmqkspuzebothufolmuo.supabase.co';
const supabaseKey = 'sb_publishable_aGv55nVJ5Rmk1D6-uefmRg_-hoE8rWJ';

export const supabase = createClient(supabaseUrl, supabaseKey);
