import { NextRequest, NextResponse } from 'next/server';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, fullName, headline, role, avatarUrl, selectedChannels, notifications } = body;

    // Strict UUID validation to prevent Postgres 22P02 invalid input syntax errors
    const safeTenantId = (tenantId && UUID_REGEX.test(tenantId)) ? tenantId : DEFAULT_TENANT_ID;

    if (!fullName || typeof fullName !== 'string' || fullName.trim().length === 0) {
      return NextResponse.json(
        { error: 'Full name is required' },
        { status: 400 }
      );
    }

    const assignedRole = role === 'intern' ? 'intern' : 'employee';
    const initials = fullName
      .trim()
      .split(/\s+/)
      .map((part: string) => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'U';

    const newProfile = {
      id: crypto.randomUUID(),
      tenantId: safeTenantId,
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

    const response = NextResponse.json({
      success: true,
      profile: newProfile,
      has_completed_onboarding: true,
      message: 'Onboarding completed successfully'
    });

    // Set cookie for session & tenant persistence
    response.cookies.set('x-tenant-id', safeTenantId, { path: '/', httpOnly: false });
    response.cookies.set('syncly_onboarded', 'true', { path: '/', maxAge: 60 * 60 * 24 * 30 });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to process onboarding submission', details: String(error) },
      { status: 500 }
    );
  }
}
