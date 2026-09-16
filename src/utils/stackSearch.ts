import type { Pins } from '@/engine';

// The stack builder's URL state: a comma-separated stack and `name@version` pins.
export interface StackSearch {
  stack?: string;
  pin?: string;
}

const nonEmptyString = (value: unknown) => (typeof value === 'string' && value ? value : undefined);

export function validateStackSearch(search: Record<string, unknown>): StackSearch {
  return { stack: nonEmptyString(search.stack), pin: nonEmptyString(search.pin) };
}

export function parseStack(param: string | undefined, tracked: string[]): string[] {
  return (param ? param.split(',') : []).filter((name) => tracked.includes(name));
}

// A pin outside the stack is dropped; the engine reports one on an unknown version.
export function parsePins(param: string | undefined, stack: string[]): Pins {
  const pins: Pins = {};
  for (const entry of param ? param.split(',') : []) {
    const at = entry.lastIndexOf('@');
    if (at <= 0) continue;
    const name = entry.slice(0, at);
    if (stack.includes(name)) pins[name] = entry.slice(at + 1);
  }
  return pins;
}

export function encodeStackSearch(stack: string[], pins: Pins): StackSearch {
  const search: StackSearch = {};
  if (stack.length > 0) search.stack = stack.join(',');
  const entries = stack.filter((name) => name in pins).map((name) => `${name}@${pins[name]}`);
  if (entries.length > 0) search.pin = entries.join(',');
  return search;
}
