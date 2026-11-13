import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAuthContext } from '@/lib/auth/server.ts';
import { handleAuthErrors } from '@/lib/auth/guard.ts';
import { createClient } from '@/lib/supabase/server.ts';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await getVerifiedAuthContext(request);
  const authError = handleAuthErrors(auth, { requireWorkspace: true });
  if (authError) {
    return authError;
  }

  const tenantId = auth.activeTenantId!;
  const supabase = await createClient(request);

  const { data: dbEvents, error } = await (supabase.from('events') as any)
    .select(`
      id,
      tenant_id,
      organizer_id,
      title,
      description,
      date,
      time,
      location,
      category,
      rsvp_count,
      created_at,
      profiles:organizer_id (
        id,
        full_name,
        avatar_url,
        role
      )
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch events: ' + error.message }, { status: 500 });
  }

  const events = (dbEvents || []).map((e: any) => ({
    id: e.id,
    tenantId: e.tenant_id,
    organizerId: e.organizer_id,
    organizerName: e.profiles?.full_name || 'Team Member',
    organizerAvatar: e.profiles?.avatar_url || undefined,
    title: e.title,
    description: e.description || '',
    date: e.date,
    time: e.time || '',
    location: e.location || 'Virtual Stage',
    category: e.category || 'all-hands',
    rsvpCount: e.rsvp_count || 0,
    createdAt: e.created_at,
  }));

  return NextResponse.json({
    success: true,
    tenantId,
    count: events.length,
    data: events,
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
    const { title, description, date, time, location, category } = body;

    if (!title || !date) {
      return NextResponse.json({ error: 'Title and date are required.' }, { status: 400 });
    }

    const supabase = await createClient(request);

    const { data: newEvent, error } = await (supabase.from('events') as any)
      .insert({
        tenant_id: tenantId,
        organizer_id: auth.userId,
        title: title.trim(),
        description: (description || '').trim(),
        date: date.trim(),
        time: (time || '').trim(),
        location: (location || 'Virtual Stage').trim(),
        category: category || 'all-hands',
        rsvp_count: 1,
      })
      .select(`
        id,
        tenant_id,
        organizer_id,
        title,
        description,
        date,
        time,
        location,
        category,
        rsvp_count,
        created_at
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to create event: ' + error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: newEvent.id,
        tenantId: newEvent.tenant_id,
        organizerId: newEvent.organizer_id,
        title: newEvent.title,
        description: newEvent.description,
        date: newEvent.date,
        time: newEvent.time,
        location: newEvent.location,
        category: newEvent.category,
        rsvpCount: newEvent.rsvp_count,
        createdAt: newEvent.created_at,
      },
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Malformed request payload.' }, { status: 400 });
  }
}
