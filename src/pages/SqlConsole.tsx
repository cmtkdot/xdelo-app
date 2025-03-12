
import React from 'react';
import { PageContainer } from '@/components/Layout/PageContainer';
import { SqlConsole as SqlConsoleComponent } from '@/components/SqlConsole/SqlConsole';

export default function SqlConsole() {
  return (
    <PageContainer title="SQL Console">
      <SqlConsoleComponent />
    </PageContainer>
  );
}
