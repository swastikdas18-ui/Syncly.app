import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAuthContext } from '@/lib/auth/server.ts';
import { buildTenantSessionSql } from '@/lib/tenant/context.ts';

export async function GET(request: NextRequest) {
  const auth = await getVerifiedAuthContext(request);
  if (!auth.isAuthenticated || !auth.userId || !auth.activeTenantId) {
    return NextResponse.json(
      { error: 'Unauthorized. Valid Supabase session required.' },
      { status: 401 }
    );
  }

  const tenantId = auth.activeTenantId;

  return NextResponse.json({
    success: true,
    tenantId,
    rlsContextSql: buildTenantSessionSql(tenantId),
    count: 0,
    data: [],
  });
}

export async function POST(request: NextRequest) {
  const auth = await getVerifiedAuthContext(request);
  if (!auth.isAuthenticated || !auth.userId || !auth.activeTenantId) {
    return NextResponse.json(
      { error: 'Unauthorized. Valid Supabase session required.' },
      { status: 401 }
    );
  }

  const tenantId = auth.activeTenantId;

  try {
    const body = await request.json();
    const { title, description, date, time, location, category } = body;

    if (!title || !date) {
      return NextResponse.json({ error: 'Title and date are required.' }, { status: 400 });
    }

    const newEvent = {
      id: crypto.randomUUID(),
      tenantId,
      organizerId: auth.userId,
      title: title.trim(),
      description: (description || '').trim(),
      date: date.trim(),
      time: (time || '').trim(),
      location: (location || 'Virtual Stage').trim(),
      category: category || 'all-hands',
      rsvpCount: 1,
      createdAt: new Date().toISOString(),
      rlsContextSql: buildTenantSessionSql(tenantId),
    };

    return NextResponse.json({ success: true, data: newEvent }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Malformed request payload.' }, { status: 400 });
  }
}
