import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL as string;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const userId = process.argv[2];
if (!userId) {
  console.error('Usage: ts-node scripts/enable-push-for-user.ts <user_id>');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

(async () => {
  const { error } = await supabase.from('profiles').update({ push_opt_in: true, notify_messages: true, updated_at: new Date().toISOString() }).eq('id', userId);
  if (error) throw error;
  console.log('push_opt_in enabled for', userId);
})();
