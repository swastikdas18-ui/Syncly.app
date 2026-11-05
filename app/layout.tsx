import type { Metadata, Viewport } from 'next';
import React from 'react';
import '@/src/index.css';
import { AuthProvider } from '@/lib/context/AuthContext';
import { WorkspaceProvider } from '@/lib/context/WorkspaceContext';

export const metadata: Metadata = {
  title: 'Syncly — Multi-Tenant Corporate Communication & Chat Platform',
  description: 'Enterprise multi-tenant corporate hub with company feeds, drag-and-drop media uploads, real-time channel chat, and verified tenant isolation.',
  openGraph: {
    title: 'Syncly — Multi-Tenant Corporate Communication & Chat Platform',
    description: 'Enterprise multi-tenant corporate hub with company feeds, drag-and-drop media uploads, real-time channel chat, and verified tenant isolation.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#0a0f1d',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
        <AuthProvider>
          <WorkspaceProvider>
            {children}
          </WorkspaceProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
