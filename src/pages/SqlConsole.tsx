
import React from 'react';
import { PageContainer } from '@/components/Layout/PageContainer';
import { SqlConsole as SqlConsoleComponent } from '@/components/SqlConsole/SqlConsole';

export default function SqlConsole() {
  return (
    <PageContainer>
      <h1 className="text-2xl font-bold mb-4">SQL Console</h1>
      <SqlConsoleComponent />
    </PageContainer>
  );
}
