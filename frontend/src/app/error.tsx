'use client';

import React, { useEffect } from 'react';
import { Button } from '@/components/ui/Button';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App error boundary caught:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-100 p-4">
      <div className="bg-white border-2 border-neutral-800 rounded p-8 max-w-md w-full text-center space-y-4 shadow-sm">
        <div className="w-12 h-12 bg-neutral-900 text-white font-mono text-sm font-bold flex items-center justify-center mx-auto rounded">
          ERR
        </div>
        <h1 className="text-base font-bold uppercase tracking-wider text-black">
          System Error
        </h1>
        <p className="text-xs text-neutral-600">
          An error occurred while loading this page. Please try refreshing or restoring session.
        </p>
        <div className="pt-2 flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.location.href = '/'}>
            Go Home
          </Button>
          <Button variant="primary" size="sm" onClick={() => reset()}>
            Try Again
          </Button>
        </div>
      </div>
    </div>
  );
}

