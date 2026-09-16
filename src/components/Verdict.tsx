import { Flex, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';

import { verdictSentence, type CoreAxis, type DeclaredDependencyAxis, type PairEvaluation, type SharedPeerAxis } from '@/engine';
import type { CoreRange, PackageVersion, Verdict } from '@/types/compatibility';
import { formatRangeForDisplay } from '@/utils/semver';

import { VERDICT_META } from './verdictMeta';

const { Text } = Typography;

const label = (v: PackageVersion) => `${v.name} ${v.version}`;

/**
 * Compact verdict: icon and label in a coloured tag. Used in grids and tables.
 */
export function VerdictTag({ verdict }: { verdict: Verdict }) {
  const meta = VERDICT_META[verdict];
  return (
    <Tag color={meta.tagColor} icon={meta.icon}>
      {meta.label}
    </Tag>
  );
}

const rangeText = (r: CoreRange) => (r.source === 'none' ? <Text type="secondary">none</Text> : <code>{r.range}</code>);

const OUTCOME_LABEL: Record<CoreAxis['outcome'], string> = {
  agree: 'Intersect',
  disjoint: 'Disjoint',
  unknown: 'Missing',
};

/**
 * Full verdict: tag, sentence and the per-axis detail.
 */
export function VerdictDetail({ evaluation }: { evaluation: PairEvaluation }) {
  const { a, b, verdict, core, declared, peers } = evaluation;

  const coreColumns: ColumnsType<CoreAxis> = [
    { title: 'Core package', dataIndex: 'core', render: (c: string) => <code>{c}</code> },
    { title: label(a), key: 'a', render: (_, axis) => (a.name === axis.core ? <code>{a.version}</code> : rangeText(axis.a)) },
    { title: label(b), key: 'b', render: (_, axis) => (b.name === axis.core ? <code>{b.version}</code> : rangeText(axis.b)) },
    {
      title: 'Outcome',
      key: 'outcome',
      render: (_, axis) =>
        axis.intersection ? <code>{formatRangeForDisplay(axis.intersection)}</code> : OUTCOME_LABEL[axis.outcome],
    },
  ];

  const declaredColumns: ColumnsType<DeclaredDependencyAxis> = [
    { title: 'Declared by', dataIndex: 'from', render: (n: string) => <code>{n}</code> },
    { title: 'On', dataIndex: 'to', render: (n: string) => <code>{n}</code> },
    { title: 'Range', dataIndex: 'range', render: (r: string) => <code>{r}</code> },
    { title: 'Chosen version', dataIndex: 'version', render: (v: string) => <code>{v}</code> },
    { title: 'Outcome', dataIndex: 'satisfied', render: (ok: boolean) => (ok ? 'Satisfied' : 'Not satisfied') },
  ];

  const peerColumns: ColumnsType<SharedPeerAxis> = [
    { title: 'Shared peer', dataIndex: 'peer', render: (n: string) => <code>{n}</code> },
    { title: label(a), dataIndex: 'a', render: (r: string) => <code>{r}</code> },
    { title: label(b), dataIndex: 'b', render: (r: string) => <code>{r}</code> },
    {
      title: 'Outcome',
      dataIndex: 'intersection',
      render: (r: string | null) => (r ? <code>{formatRangeForDisplay(r)}</code> : 'Disjoint'),
    },
  ];

  return (
    <Flex vertical gap="middle">
      <div>
        <VerdictTag verdict={verdict} />
        <Text>{verdictSentence(evaluation)}</Text>
      </div>
      {core.length > 0 && (
        <Table size="small" pagination={false} rowKey="core" columns={coreColumns} dataSource={core} scroll={{ x: 'max-content' }} />
      )}
      {declared.length > 0 && (
        <Table size="small" pagination={false} rowKey={(d) => `${d.from}>${d.to}`} columns={declaredColumns} dataSource={declared} scroll={{ x: 'max-content' }} />
      )}
      {peers.length > 0 && (
        <Table size="small" pagination={false} rowKey="peer" columns={peerColumns} dataSource={peers} scroll={{ x: 'max-content' }} />
      )}
    </Flex>
  );
}
