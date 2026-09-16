import { Checkbox, Flex, Select, Typography } from 'antd';

import { candidateVersions, type Pins } from '@/engine';
import { usePrereleases } from '@/hooks/usePrereleases';
import type { Package, PackageCategory } from '@/types/compatibility';

import { LatestReleasesGrid } from './LatestReleasesGrid';
import { VersionSetView } from './VersionSetView';

const { Text, Title, Paragraph } = Typography;

// Core packages come last: most stacks do not install them directly.
const GROUPS: { category: PackageCategory; label: string }[] = [
  { category: 'ui', label: 'UI packages' },
  { category: 'style-parser', label: 'Style parsers' },
  { category: 'data-parser', label: 'Data parsers' },
  { category: 'core', label: 'Core packages' },
];

interface StackBuilderProps {
  packages: Package[];
  stack: string[];
  pins: Pins;
  onChange: (stack: string[], pins: Pins) => void;
}

const RECOMMENDED = '';

const without = (pins: Pins, name: string): Pins => Object.fromEntries(Object.entries(pins).filter(([n]) => n !== name));

export function StackBuilder({ packages, stack, pins, onChange }: StackBuilderProps) {
  const [includePrereleases] = usePrereleases();

  const toggle = (name: string, checked: boolean) => {
    const next = new Set(stack);
    if (checked) next.add(name);
    else next.delete(name);
    // Stored in tracked order so the same stack always gives the same URL.
    onChange(packages.map((p) => p.name).filter((n) => next.has(n)), checked ? pins : without(pins, name));
  };

  const pin = (name: string, version: string) => {
    onChange(stack, version === RECOMMENDED ? without(pins, name) : { ...pins, [name]: version });
  };

  const versionOptions = (pkg: Package) => {
    const versions = candidateVersions(pkg, includePrereleases).map((v) => v.version);
    const pinned = pins[pkg.name];
    if (pinned && !versions.includes(pinned)) versions.unshift(pinned);
    return [
      { value: RECOMMENDED, label: 'Recommended' },
      ...versions.map((version) => ({ value: version, label: version })),
    ];
  };

  return (
    <div className="stack-builder">
      <fieldset className="stack-builder__packages">
        <legend>
          <Title level={5} className="stack-builder__legend">
            Packages you use
          </Title>
        </legend>
        <Flex vertical gap="middle">
          {GROUPS.map(({ category, label }) => {
            const members = packages.filter((p) => p.category === category);
            if (members.length === 0) return null;
            return (
              <div key={category} role="group" aria-labelledby={`stack-group-${category}`}>
                <Text id={`stack-group-${category}`} strong>
                  {label}
                </Text>
                <ul className="stack-builder__group">
                  {members.map((pkg) => {
                    const ticked = stack.includes(pkg.name);
                    return (
                      <li key={pkg.name}>
                        <Checkbox checked={ticked} onChange={(e) => toggle(pkg.name, e.target.checked)}>
                          {pkg.name}
                        </Checkbox>
                        {ticked && (
                          <Select
                            size="small"
                            className="stack-builder__version"
                            aria-label={`${pkg.name} version`}
                            value={pins[pkg.name] ?? RECOMMENDED}
                            options={versionOptions(pkg)}
                            onChange={(version) => pin(pkg.name, version)}
                            showSearch
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </Flex>
      </fieldset>

      <div className="stack-builder__result">
        {stack.length === 0 ? (
          <>
            <Title level={5}>Latest releases</Title>
            <Paragraph type="secondary">
              Tick the packages you use to get a version set. Until then, here is the latest release of every tracked
              package against every other. Select a cell to see how the verdict was reached.
            </Paragraph>
            <LatestReleasesGrid packages={packages} />
          </>
        ) : (
          <VersionSetView packages={packages} stack={stack} pins={pins} />
        )}
      </div>
    </div>
  );
}
