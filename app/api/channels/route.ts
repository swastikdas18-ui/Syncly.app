import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAuthContext } from '@/lib/auth/server.ts';
import { handleAuthErrors } from '@/lib/auth/guard.ts';
import { createClient } from '@/lib/supabase/server.ts';
import { Channel } from '@/src/types.ts';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await getVerifiedAuthContext(request);
  const authError = handleAuthErrors(auth, { requireWorkspace: true });
  if (authError) {
    return authError;
  }

  const tenantId = auth.activeTenantId!;
  const supabase = await createClient(request);

  const { data: dbChannels, error } = await (supabase.from('channels') as any)
    .select('id, tenant_id, name, description, is_private, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch channels: ' + error.message }, { status: 500 });
  }

  const channels: Channel[] = (dbChannels || []).map((c: any) => ({
    id: c.id,
    tenantId: c.tenant_id,
    name: c.name,
    description: c.description || '',
    isPrivate: Boolean(c.is_private),
    createdAt: c.created_at,
  }));

  return NextResponse.json({
    success: true,
    tenantId,
    count: channels.length,
    data: channels,
  });
}

export async function POST(request: NextRequest) {
  const auth = await getVerifiedAuthContext(request);
  const authError = handleAuthErrors(auth, { requireWorkspace: true });
  if (authError) {
    return authError;
  }

  const tenantId = auth.activeTenantId!;

  try {
    const body = await request.json();
    const name = body?.name?.trim()?.toLowerCase()?.replace(/[^a-z0-9-_]/g, '-');
    const description = body?.description?.trim() || '';
    const isPrivate = Boolean(body?.isPrivate);

    if (!name) {
      return NextResponse.json({ error: 'Channel name is required.' }, { status: 400 });
    }

    const channelId = body?.id?.trim() || name;
    const supabase = await createClient(request);

    const { data: newCh, error } = await (supabase.from('channels') as any)
      .insert({
        id: channelId,
        tenant_id: tenantId,
        name,
        description,
        is_private: isPrivate,
      })
      .select('id, tenant_id, name, description, is_private, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to create channel: ' + error.message }, { status: 500 });
    }

    const createdChannel: Channel = {
      id: newCh.id,
      tenantId: newCh.tenant_id,
      name: newCh.name,
      description: newCh.description || '',
      isPrivate: Boolean(newCh.is_private),
      createdAt: newCh.created_at,
    };

    return NextResponse.json({ success: true, data: createdChannel }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Malformed JSON payload.' }, { status: 400 });
  }
}
