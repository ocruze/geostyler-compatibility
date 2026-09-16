import { Checkbox, Flex, Typography } from 'antd';

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
  onStackChange: (stack: string[]) => void;
}

export function StackBuilder({ packages, stack, onStackChange }: StackBuilderProps) {
  const toggleGroup = (category: PackageCategory, checked: string[]) => {
    const next = new Set(stack.filter((name) => packages.find((p) => p.name === name)?.category !== category));
    checked.forEach((name) => next.add(name));
    // Stored in tracked order so the same stack always gives the same URL.
    onStackChange(packages.map((p) => p.name).filter((name) => next.has(name)));
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
            const options = packages.filter((p) => p.category === category).map((p) => ({ label: p.name, value: p.name }));
            if (options.length === 0) return null;
            return (
              <div key={category} role="group" aria-labelledby={`stack-group-${category}`}>
                <Text id={`stack-group-${category}`} strong>
                  {label}
                </Text>
                <Checkbox.Group
                  className="stack-builder__group"
                  options={options}
                  value={stack.filter((name) => options.some((o) => o.value === name))}
                  onChange={(checked) => toggleGroup(category, checked as string[])}
                />
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
              Tick the packages you use to get a version set. Until then, here is the latest stable release of every
              tracked package against every other. Select a cell to see how the verdict was reached.
            </Paragraph>
            <LatestReleasesGrid packages={packages} />
          </>
        ) : (
          <VersionSetView packages={packages} stack={stack} />
        )}
      </div>
    </div>
  );
}
