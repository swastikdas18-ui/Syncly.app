import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAuthContext } from '@/lib/auth/server.ts';
import { handleAuthErrors } from '@/lib/auth/guard.ts';

export async function GET(request: NextRequest) {
  const auth = await getVerifiedAuthContext(request);
  const authError = handleAuthErrors(auth, { requireWorkspace: true });
  if (authError) {
    return authError;
  }

  const tenantId = auth.activeTenantId!;

  return NextResponse.json({
    success: true,
    tenantId,
    count: 0,
    data: [],
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
    };

    return NextResponse.json({ success: true, data: newEvent }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Malformed request payload.' }, { status: 400 });
  }
}
