import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAuthContext } from '@/lib/auth/server.ts';
import { createClient } from '@/lib/supabase/server.ts';

export async function POST(request: NextRequest) {
  const auth = await getVerifiedAuthContext(request);
  if (!auth.isAuthenticated || !auth.userId || !auth.activeTenantId) {
    return NextResponse.json(
      { error: 'Unauthorized. Valid Supabase session required.' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { fullName, headline, avatarUrl, selectedChannels, notifications } = body;

    if (!fullName || typeof fullName !== 'string' || fullName.trim().length === 0) {
      return NextResponse.json(
        { error: 'Full name is required' },
        { status: 400 }
      );
    }

    const assignedRole = auth.role || 'employee';
    const initials = fullName
      .trim()
      .split(/\s+/)
      .map((part: string) => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'U';

    const supabase = await createClient(request);

    // Update profile in PostgreSQL public.profiles
    await (supabase.from('profiles') as any)
      .update({
        full_name: fullName.trim(),
        avatar_url: avatarUrl || auth.profile?.avatar_url,
      })
      .eq('id', auth.userId);

    const updatedProfile = {
      id: auth.userId,
      tenantId: auth.activeTenantId,
      fullName: fullName.trim(),
      headline: headline?.trim() || (assignedRole === 'intern' ? 'Software Engineering Intern' : 'Product Team Member'),
      avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(fullName.trim())}`,
      role: assignedRole,
      status: 'active',
      initials,
      selectedChannels: Array.isArray(selectedChannels) && selectedChannels.length > 0 ? selectedChannels : ['general', 'announcements'],
      notifications: notifications || { emailDigest: true, realtimePush: true },
      hasCompletedOnboarding: true,
      updatedAt: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      profile: updatedProfile,
      has_completed_onboarding: true,
      message: 'Onboarding completed successfully'
    });
  } catch {
    return NextResponse.json({ error: 'Server error processing onboarding payload' }, { status: 500 });
  }
}
