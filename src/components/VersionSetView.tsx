import { Link } from '@tanstack/react-router';
import { Alert, Flex, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo } from 'react';

import { CORE_PACKAGES } from '@/constants/repos';
import {
  buildVersionSet,
  stackPairSentence,
  versionLabel,
  type Anchors,
  type PartialSet,
  type StackPair,
  type VersionSet,
} from '@/engine';
import { usePrereleases } from '@/hooks/usePrereleases';
import type { CoreRange, Package, PackageVersion } from '@/types/compatibility';

import { InstallLine } from './InstallLine';
import { VerdictTag } from './Verdict';

const { Text, Title } = Typography;

interface Row {
  chosen: PackageVersion;
  newest: PackageVersion;
  pinned: boolean;
}

function coreRangeText(range: CoreRange) {
  if (range.source === 'none') return <Text type="secondary">none</Text>;
  return (
    <span>
      <code>{range.range}</code>
      {range.source === 'transitive' && (
        <Text type="secondary"> from {range.origin.name} {range.origin.version}</Text>
      )}
    </span>
  );
}

const columns: ColumnsType<Row> = [
  {
    title: 'Package',
    key: 'name',
    render: (_, { chosen }) => (
      <Link to="/package/$name" params={{ name: chosen.name }}>
        {chosen.name}
      </Link>
    ),
  },
  {
    title: 'Chosen version',
    key: 'version',
    render: (_, { chosen, pinned }) => (
      <>
        <code>{chosen.version}</code> {pinned && <Tag>pinned</Tag>}
      </>
    ),
  },
  {
    title: 'Newest available',
    key: 'newest',
    render: (_, { chosen, newest }) =>
      newest.version === chosen.version ? <Tag color="success">newest</Tag> : <code>{newest.version}</code>,
  },
  ...CORE_PACKAGES.map(
    (core): ColumnsType<Row>[number] => ({
      title: `${core} range`,
      key: core,
      render: (_, { chosen }) =>
        chosen.name === core ? <Text type="secondary">is the core</Text> : coreRangeText(chosen.coreRanges[core]),
    }),
  ),
];

function AnchorLine({ anchors }: { anchors: Anchors }) {
  const used = CORE_PACKAGES.map((core) => anchors[core]).filter((v): v is PackageVersion => v !== undefined);
  if (used.length === 0) return null;
  return <Text type="secondary">Anchor: {used.map(versionLabel).join(', ')}.</Text>;
}

function PairList({ pairs, label }: { pairs: StackPair[]; label: string }) {
  if (pairs.length === 0) return null;
  return (
    <ul className="pair-list" aria-label={label}>
      {pairs.map((pair) => (
        <li key={`${pair.a.name}|${pair.b.name}`}>
          <VerdictTag verdict={pair.verdict} />
          <Text>
            <Text strong>
              {versionLabel(pair.a)} and {versionLabel(pair.b)}
            </Text>
            : {stackPairSentence(pair)}
          </Text>
        </li>
      ))}
    </ul>
  );
}

function VersionSetPanel({ set, pins }: { set: VersionSet; pins: Record<string, string> }) {
  const rows: Row[] = set.versions.map((chosen, i) => ({
    chosen,
    newest: set.newest[i],
    pinned: pins[chosen.name] === chosen.version,
  }));
  return (
    <Flex vertical gap="middle">
      <Table<Row>
        size="small"
        pagination={false}
        rowKey={(row) => row.chosen.name}
        columns={columns}
        dataSource={rows}
        scroll={{ x: 'max-content' }}
      />
      <InstallLine versions={set.versions} />
      <AnchorLine anchors={set.anchors} />
      <PairList pairs={set.pairs} label="Pair verdicts" />
    </Flex>
  );
}

function relaxSentence(relax: string | null, failing: StackPair[], pinned: boolean): string {
  if (relax) {
    const count = failing.filter((p) => p.a.name === relax || p.b.name === relax).length;
    return `Relax the pin on ${relax}: it is in ${count === 1 ? 'the failing pair' : `${count} of the failing pairs`}.`;
  }
  if (pinned) return 'Every pin fits; the packages themselves need disjoint core versions.';
  return 'No geostyler-style or geostyler-data version is accepted by every package in the stack.';
}

function NoSet({
  failing,
  relax,
  partial,
  pins,
}: {
  failing: StackPair[];
  relax: string | null;
  partial: PartialSet | null;
  pins: Record<string, string>;
}) {
  const pinned = Object.keys(pins).length > 0;
  return (
    <Flex vertical gap="middle">
      <Alert
        type="warning"
        showIcon
        title={pinned ? 'No version set keeps these pins' : 'No version set for this stack'}
        description={relaxSentence(relax, failing, pinned)}
      />
      <Title level={5}>Failing pairs</Title>
      <PairList pairs={failing} label="Failing pairs" />
      {partial && (
        <>
          <Title level={5}>Best partial set without {partial.removed}</Title>
          <VersionSetPanel set={partial.set} pins={pins} />
        </>
      )}
    </Flex>
  );
}

interface VersionSetViewProps {
  packages: Package[];
  stack: string[];
  pins: Record<string, string>;
}

export function VersionSetView({ packages, stack, pins }: VersionSetViewProps) {
  const [includePrereleases] = usePrereleases();
  const result = useMemo(
    () => buildVersionSet(packages, stack, { includePrereleases, pins }),
    [packages, stack, includePrereleases, pins],
  );

  if (result.status !== 'found') {
    return <NoSet failing={result.failing} relax={result.relax} partial={result.partial} pins={pins} />;
  }

  return (
    <Flex vertical gap="middle">
      <Title level={5}>Version set</Title>
      <VersionSetPanel set={result.set} pins={pins} />
    </Flex>
  );
}
