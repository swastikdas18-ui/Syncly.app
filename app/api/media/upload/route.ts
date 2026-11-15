import { NextResponse } from 'next/server';

/**
 * File bytes must be uploaded directly from the authenticated browser client
 * to Supabase Storage. Sending base64 or multipart file bodies through a Vercel
 * Function can exceed Vercel's 4.5 MB request-body ceiling.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'Server-proxied uploads are disabled. Upload directly to the authenticated workspace Storage bucket.',
      code: 'DIRECT_STORAGE_UPLOAD_REQUIRED',
    },
    { status: 410, headers: { 'Cache-Control': 'no-store' } }
  );
}
