import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, fullName, password, mode } = body;

    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return NextResponse.json({ error: 'Valid corporate email required.' }, { status: 400 });
    }

    const nameParts = cleanEmail.split('@')[0].split('.');
    const derivedName = fullName?.trim() || nameParts.map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');

    const userId = crypto.randomUUID();
    const token = `sb-${crypto.randomBytes(24).toString('hex')}`;

    const session = {
      user: {
        id: userId,
        email: cleanEmail,
        fullName: derivedName,
        headline: 'Enterprise Member',
        role: 'employee',
        tenantId: '',
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanEmail)}`,
        hasCompletedOnboarding: false,
      },
      token,
    };

    return NextResponse.json({
      success: true,
      session,
      mode: mode || 'signin',
    });
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }
}
