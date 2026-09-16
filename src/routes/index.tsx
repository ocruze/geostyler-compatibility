import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Card } from 'antd';
import { useEffect, useMemo } from 'react';

import { usePackages } from '@/api/queries';
import { StackBuilder } from '@/components/StackBuilder';
import type { Pins } from '@/engine';
import { encodeStackSearch, parsePins, parseStack, validateStackSearch } from '@/utils/stackSearch';

// The stack and its pins live in the URL: back undoes the last change and links share the same answer.
export const Route = createFileRoute('/')({
  component: StackBuilderPage,
  validateSearch: validateStackSearch,
});

function StackBuilderPage() {
  const { data: packages } = usePackages();
  const { stack: stackParam, pin: pinParam } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const stack = useMemo(() => parseStack(stackParam, packages.map((p) => p.name)), [packages, stackParam]);
  const pins = useMemo(() => parsePins(pinParam, stack), [pinParam, stack]);

  useEffect(() => {
    document.title = 'Check compatibility · GeoStyler Compatibility';
  }, []);

  const update = (nextStack: string[], nextPins: Pins) => {
    navigate({ search: encodeStackSearch(nextStack, nextPins) });
  };

  return (
    <Card title="Which versions do I install?">
      <StackBuilder packages={packages} stack={stack} pins={pins} onChange={update} />
    </Card>
  );
}
