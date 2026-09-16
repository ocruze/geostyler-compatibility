import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Card } from 'antd';
import { useEffect, useMemo } from 'react';

import { usePackages } from '@/api/queries';
import { StackBuilder } from '@/components/StackBuilder';
import { encodeStackSearch, parseStackSelection, validateStackSearch, type StackSelection } from '@/utils/stackSearch';

// The stack and its pins live in the URL: back undoes the last change and links share the same answer.
export const Route = createFileRoute('/')({
  component: StackBuilderPage,
  validateSearch: validateStackSearch,
});

function StackBuilderPage() {
  const { data: packages } = usePackages();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const selection = useMemo(() => parseStackSelection(search, packages.map((p) => p.name)), [packages, search]);

  useEffect(() => {
    document.title = 'Check compatibility · GeoStyler Compatibility';
  }, []);

  const update = (next: StackSelection) => {
    navigate({ search: encodeStackSearch(next) });
  };

  return (
    <Card title="Which versions do I install?">
      <StackBuilder packages={packages} selection={selection} onChange={update} />
    </Card>
  );
}
