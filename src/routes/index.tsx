import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Card } from 'antd';
import { useEffect, useMemo } from 'react';

import { usePackages } from '@/api/queries';
import { StackBuilder } from '@/components/StackBuilder';
import type { Pins } from '@/engine';

// The stack and its pins live in the URL: back undoes the last change and links share the same answer.
type StackSearch = { stack?: string; pin?: string };

const nonEmptyString = (value: unknown) => (typeof value === 'string' && value ? value : undefined);

export const Route = createFileRoute('/')({
  component: StackBuilderPage,
  validateSearch: (search: Record<string, unknown>): StackSearch => ({
    stack: nonEmptyString(search.stack),
    pin: nonEmptyString(search.pin),
  }),
});

// `name@version` entries; a pin outside the stack is dropped, the engine reports one on an unknown version.
function parsePins(param: string | undefined, stack: string[]): Pins {
  const pins: Pins = {};
  for (const entry of param ? param.split(',') : []) {
    const at = entry.lastIndexOf('@');
    if (at <= 0) continue;
    const name = entry.slice(0, at);
    if (stack.includes(name)) pins[name] = entry.slice(at + 1);
  }
  return pins;
}

function StackBuilderPage() {
  const { data: packages } = usePackages();
  const { stack: stackParam, pin: pinParam } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const stack = useMemo(() => {
    const tracked = new Set(packages.map((p) => p.name));
    return (stackParam ? stackParam.split(',') : []).filter((name) => tracked.has(name));
  }, [packages, stackParam]);

  const pins = useMemo(() => parsePins(pinParam, stack), [pinParam, stack]);

  useEffect(() => {
    document.title = 'Check compatibility · GeoStyler Compatibility';
  }, []);

  const update = (nextStack: string[], nextPins: Pins) => {
    const search: StackSearch = {};
    if (nextStack.length > 0) search.stack = nextStack.join(',');
    const pinEntries = nextStack.filter((name) => name in nextPins).map((name) => `${name}@${nextPins[name]}`);
    if (pinEntries.length > 0) search.pin = pinEntries.join(',');
    navigate({ search });
  };

  return (
    <Card title="Which versions do I install?">
      <StackBuilder packages={packages} stack={stack} pins={pins} onChange={update} />
    </Card>
  );
}
