import { Flex, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';

import {
  verdictSentence,
  versionLabel,
  type CoreAxis,
  type DeclaredDependencyAxis,
  type PairEvaluation,
  type SharedPeerAxis,
} from '@/engine';
import type { CoreRange, Verdict } from '@/types/compatibility';
import { formatRangeForDisplay } from '@/utils/semver';

import { TAG_COLOR, VERDICT_META, useStatusColors } from './verdictMeta';

const { Text } = Typography;

export function VerdictTag({ verdict }: { verdict: Verdict }) {
  const meta = VERDICT_META[verdict];
  return (
    <Tag color={TAG_COLOR[meta.status]} icon={meta.icon}>
      {meta.label}
    </Tag>
  );
}

interface VerdictCellProps {
  evaluation: PairEvaluation;
  onOpen: (evaluation: PairEvaluation) => void;
}

// One grid or matrix cell: icon on the verdict colour, the full sentence in the label.
export function VerdictCell({ evaluation, onOpen }: VerdictCellProps) {
  const meta = VERDICT_META[evaluation.verdict];
  const color = useStatusColors()[meta.status];
  const { a, b } = evaluation;
  return (
    <button
      type="button"
      className="verdict-cell"
      style={{ backgroundColor: color.bg, borderColor: color.border, color: color.fg }}
      aria-label={`${versionLabel(a)} and ${versionLabel(b)}: ${meta.label}. ${verdictSentence(evaluation)} Open details.`}
      onClick={() => onOpen(evaluation)}
    >
      {meta.icon}
    </button>
  );
}

function rangeText(r: CoreRange) {
  if (r.source === 'none') return <Text type="secondary">none</Text>;
  if (r.source === 'declared') return <code>{r.range}</code>;
  return (
    <Flex vertical>
      <code>{r.range}</code>
      <Text type="secondary">
        transitive, from {r.origin.name} {r.origin.version}
      </Text>
    </Flex>
  );
}

const OUTCOME_LABEL: Record<CoreAxis['outcome'], string> = {
  intersect: 'Intersect',
  disjoint: 'Disjoint',
  missing: 'Missing',
};

export function VerdictDetail({ evaluation }: { evaluation: PairEvaluation }) {
  const { a, b, verdict, core, declared, peers } = evaluation;

  const coreColumns: ColumnsType<CoreAxis> = [
    { title: 'Core package', dataIndex: 'core', render: (c: string) => <code>{c}</code> },
    { title: versionLabel(a), key: 'a', render: (_, axis) => (a.name === axis.core ? <code>{a.version}</code> : rangeText(axis.a)) },
    { title: versionLabel(b), key: 'b', render: (_, axis) => (b.name === axis.core ? <code>{b.version}</code> : rangeText(axis.b)) },
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
    { title: versionLabel(a), dataIndex: 'a', render: (r: string) => <code>{r}</code> },
    { title: versionLabel(b), dataIndex: 'b', render: (r: string) => <code>{r}</code> },
    {
      title: 'Outcome',
      key: 'outcome',
      render: (_, axis) =>
        axis.intersection ? <code>{formatRangeForDisplay(axis.intersection)}</code> : OUTCOME_LABEL[axis.outcome],
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
