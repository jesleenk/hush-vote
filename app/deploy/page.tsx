import { Suspense } from 'react';
import DeployClient from './deploy-client';

export default function DeployPage() {
  return (
    <main className="builder-shell">
      <Suspense fallback={<div className="panel min-h-[540px] animate-pulse" aria-label="Loading ballot builder" />}>
        <DeployClient />
      </Suspense>
    </main>
  );
}
