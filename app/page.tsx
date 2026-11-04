'use client';

import React from 'react';
import { WorkConnectHub } from '@/src/App.tsx';

/**
 * Next.js App Router Page Entry: /
 * Renders the multi-tenant corporate communication feed and hub.
 */
export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950">
      <WorkConnectHub />
    </main>
  );
}
