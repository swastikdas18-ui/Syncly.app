import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envText = fs.readFileSync('.env', 'utf8');
const env = {};
for (const line of envText.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const [k, ...v] = trimmed.split('=');
    env[k.trim()] = v.join('=').trim().replace(/^"(.*)"$/, '$1');
  }
}

const supabaseAdmin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function diagnose() {
  const { data: { users }, error: uErr } = await supabaseAdmin.auth.admin.listUsers();
  console.log('--- ALL AUTH USERS DIAGNOSIS ---');
  for (const u of users) {
    const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', u.id).maybeSingle();
    const { data: mems } = await supabaseAdmin.from('memberships').select('*, tenants(name, slug)').eq('user_id', u.id);
    console.log(JSON.stringify({
      id: u.id,
      email: u.email,
      user_metadata_tenant_id: u.user_metadata?.tenant_id,
      profile_tenant_id: profile?.tenant_id,
      profile_full_name: profile?.full_name,
      profile_role: profile?.role,
      memberships_count: mems?.length || 0,
      memberships: mems?.map(m => ({
        community_id: m.community_id,
        tenant_name: m.tenants?.name,
        role: m.role
      }))
    }, null, 2));
  }
}

diagnose().catch(console.error);

