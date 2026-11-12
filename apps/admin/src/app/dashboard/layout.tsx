'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/components/providers';
import { Sidebar } from '@/components/sidebar';
import { TopBar } from '@/components/top-bar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, authReady } = useAdmin();
  const router = useRouter();

  useEffect(() => {
    if (authReady && !session) {
      router.replace('/login');
    }
  }, [authReady, session, router]);

  if (!authReady || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-sm text-text-secondary">
        Verifying RBAC session...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-bg text-text-primary">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
