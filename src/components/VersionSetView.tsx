import { Link } from '@tanstack/react-router';
import { Alert, Flex, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo } from 'react';

import { buildVersionSet, stackPairSentence, versionLabel, type StackPair, type VersionSet } from '@/engine';
import type { CoreRange, Package, PackageVersion } from '@/types/compatibility';

import { VerdictTag } from './Verdict';

const { Text, Title } = Typography;

interface Row {
  chosen: PackageVersion;
  newest: PackageVersion;
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
  { title: 'Chosen version', key: 'version', render: (_, { chosen }) => <code>{chosen.version}</code> },
  {
    title: 'Newest available',
    key: 'newest',
    render: (_, { chosen, newest }) =>
      newest.version === chosen.version ? <Tag color="success">newest</Tag> : <code>{newest.version}</code>,
  },
  {
    title: 'geostyler-style range',
    key: 'style',
    render: (_, { chosen }) =>
      chosen.name === 'geostyler-style' ? <Text type="secondary">is the core</Text> : coreRangeText(chosen.coreRanges['geostyler-style']),
  },
  {
    title: 'geostyler-data range',
    key: 'data',
    render: (_, { chosen }) =>
      chosen.name === 'geostyler-data' ? <Text type="secondary">is the core</Text> : coreRangeText(chosen.coreRanges['geostyler-data']),
  },
];

function Anchors({ set }: { set: VersionSet }) {
  const usedCores = (['geostyler-style', 'geostyler-data'] as const).filter((core) =>
    set.versions.some((v) => v.name === core || v.coreRanges[core].source !== 'none'),
  );
  if (usedCores.length === 0) return null;
  return (
    <Text type="secondary">
      Anchor: {usedCores.map((core) => versionLabel(set.anchors[core])).join(', ')}.
    </Text>
  );
}

function PairList({ pairs }: { pairs: StackPair[] }) {
  if (pairs.length === 0) return null;
  return (
    <ul className="pair-list" aria-label="Pair verdicts">
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

export function VersionSetView({ packages, stack }: { packages: Package[]; stack: string[] }) {
  const result = useMemo(() => buildVersionSet(packages, stack), [packages, stack]);

  if (result.status !== 'found') {
    return (
      <Alert
        type="warning"
        showIcon
        title="No version set for this stack"
        description="No geostyler-style or geostyler-data version is accepted by every package in the stack."
      />
    );
  }

  const { set } = result;
  const rows: Row[] = set.versions.map((chosen, i) => ({ chosen, newest: set.newest[i] }));

  return (
    <Flex vertical gap="middle">
      <Title level={5}>Version set</Title>
      <Table<Row>
        size="small"
        pagination={false}
        rowKey={(row) => row.chosen.name}
        columns={columns}
        dataSource={rows}
        scroll={{ x: 'max-content' }}
      />
      <Anchors set={set} />
      <PairList pairs={set.pairs} />
    </Flex>
  );
}
