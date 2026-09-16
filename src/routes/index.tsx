import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Card } from 'antd';
import { useEffect } from 'react';

import { usePackages } from '@/api/queries';
import { StackBuilder } from '@/components/StackBuilder';

// The stack lives in the URL: back undoes the last change and links share the same answer.
type StackSearch = { stack?: string };

export const Route = createFileRoute('/')({
  component: StackBuilderPage,
  validateSearch: (search: Record<string, unknown>): StackSearch => ({
    stack: typeof search.stack === 'string' && search.stack ? search.stack : undefined,
  }),
});

function StackBuilderPage() {
  const { data: packages } = usePackages();
  const { stack: stackParam } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const tracked = new Set(packages.map((p) => p.name));
  const stack = (stackParam ? stackParam.split(',') : []).filter((name) => tracked.has(name));

  useEffect(() => {
    document.title = 'Stack builder · GeoStyler Compatibility';
  }, []);

  const setStack = (next: string[]) => {
    navigate({ search: (next.length > 0 ? { stack: next.join(',') } : {}) satisfies StackSearch });
  };

  return (
    <Card title="Which versions do I install?">
      <StackBuilder packages={packages} stack={stack} onStackChange={setStack} />
    </Card>
  );
}
