import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL as string;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const token = process.argv[2];
if (!token) {
  console.error('Usage: ts-node scripts/find-user-by-token.ts <ExpoPushToken>');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

(async () => {
  const { data, error } = await supabase.from('push_tokens').select('user_id').eq('token', token).limit(1);
  if (error) throw error;
  if (!data || !data.length) {
    console.log('No user found for token');
    return;
  }
  console.log(data[0].user_id);
})();
