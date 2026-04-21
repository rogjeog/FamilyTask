'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { me } from '@/lib/api/auth';

export default function HomePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    me()
      .then((data) => {
        queryClient.setQueryData(['me'], data);
        router.replace('/dashboard');
      })
      .catch(() => {
        // client.ts already handles session cleanup and redirects to /login
        // on refresh failure; this catch handles the case where it doesn't.
        router.replace('/login');
      });
  }, [router, queryClient]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-surface">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </main>
  );
}
