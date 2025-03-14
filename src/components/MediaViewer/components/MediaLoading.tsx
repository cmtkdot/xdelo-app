
import React from 'react';
import { Spinner } from '@/components/ui/spinner';

interface MediaLoadingProps {
  message?: string;
}

export function MediaLoading({ message = 'Loading media...' }: MediaLoadingProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 z-10">
      <Spinner size="lg" className="mb-2" />
      <p className="text-white text-sm">{message}</p>
    </div>
  );
}
