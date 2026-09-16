import { Link } from '@tanstack/react-router';
import { Alert, Collapse, Flex, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo } from 'react';

import { CORE_PACKAGES } from '@/constants/repos';
import {
  bottleneckSentence,
  buildVersionSet,
  stackPairSentence,
  versionLabel,
  type Anchors,
  type NoSet,
  type Pins,
  type StackPair,
  type VersionSet,
} from '@/engine';
import { usePrereleases } from '@/hooks/usePrereleases';
import type { Package, PackageVersion } from '@/types/compatibility';
import { encodeStackSearch } from '@/utils/stackSearch';

import { InstallLine } from './InstallLine';
import { CoreRangeText, VerdictTag } from './Verdict';

const { Text, Title } = Typography;

interface Row {
  chosen: PackageVersion;
  newest: PackageVersion;
  pinned: boolean;
}

// Package links carry the stack so the package page can come back to it.
const packageColumn = (stack: string[], pins: Pins): ColumnsType<Row>[number] => ({
  title: 'Package',
  key: 'name',
  render: (_, { chosen }) => (
    <Link to="/package/$name" params={{ name: chosen.name }} search={encodeStackSearch(stack, pins)}>
      {chosen.name}
    </Link>
  ),
});

const chosenColumn: ColumnsType<Row>[number] = {
  title: 'Chosen version',
  key: 'version',
  render: (_, { chosen, pinned }) => (
    <>
      <code>{chosen.version}</code> {pinned && <Tag>pinned</Tag>}
    </>
  ),
};

// One column per core package, showing the range of the version `pick` returns.
const coreRangeColumns = (pick: (row: Row) => PackageVersion, titleSuffix = ''): ColumnsType<Row> =>
  CORE_PACKAGES.map((core) => ({
    title: `${core} range${titleSuffix}`,
    key: core,
    render: (_, row) => {
      const version = pick(row);
      return version.name === core ? <Text type="secondary">is the core</Text> : <CoreRangeText range={version.coreRanges[core]} />;
    },
  }));

const columns = (stack: string[], pins: Pins): ColumnsType<Row> => [
  packageColumn(stack, pins),
  chosenColumn,
  {
    title: 'Newest available',
    key: 'newest',
    render: (_, { chosen, newest }) =>
      newest.version === chosen.version ? <Tag color="success">newest</Tag> : <code>{newest.version}</code>,
  },
  ...coreRangeColumns((row) => row.chosen),
];

const passedOverColumns = (stack: string[], pins: Pins): ColumnsType<Row> => [
  packageColumn(stack, pins),
  { title: 'Newest available', key: 'newest', render: (_, { newest }) => <code>{newest.version}</code> },
  chosenColumn,
  ...coreRangeColumns((row) => row.newest, ' of the newest'),
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

// The sentence naming the bottleneck, over one row per stack package whose newest release was passed over.
function BottleneckNote({ set, rows, stack, pins }: { set: VersionSet; rows: Row[]; stack: string[]; pins: Pins }) {
  const passedOver = rows.filter(({ chosen, newest }) => chosen !== newest);
  if (passedOver.length === 0) return null;
  const sentence = bottleneckSentence(set);
  return (
    <Flex vertical gap="small">
      {sentence ? (
        <Alert type="info" showIcon title={sentence} />
      ) : (
        <Text type="secondary">Several packages together hold the set below the newest releases.</Text>
      )}
      <Collapse
        size="small"
        items={[
          {
            key: 'evidence',
            label: `Newest releases passed over (${passedOver.length})`,
            children: (
              <Table<Row>
                size="small"
                pagination={false}
                rowKey={(row) => row.chosen.name}
                columns={passedOverColumns(stack, pins)}
                dataSource={passedOver}
                scroll={{ x: 'max-content' }}
              />
            ),
          },
        ]}
      />
    </Flex>
  );
}

function toRows(set: VersionSet, pins: Pins): Row[] {
  return set.versions.map((chosen, i) => ({ chosen, newest: set.newest[i], pinned: pins[chosen.name] === chosen.version }));
}

function VersionSetPanel({ set, stack, pins }: { set: VersionSet; stack: string[]; pins: Pins }) {
  const rows = toRows(set, pins);
  return (
    <Flex vertical gap="middle">
      <Table<Row>
        size="small"
        pagination={false}
        rowKey={(row) => row.chosen.name}
        columns={columns(stack, pins)}
        dataSource={rows}
        scroll={{ x: 'max-content' }}
      />
      <InstallLine versions={set.versions} />
      <BottleneckNote set={set} rows={rows} stack={stack} pins={pins} />
      <AnchorLine anchors={set.anchors} />
      <PairList pairs={set.pairs} label="Pair verdicts" />
    </Flex>
  );
}

function relaxSentence({ pinToRelax, failing }: NoSet, pinned: boolean): string {
  if (pinToRelax) {
    const { name, count } = pinToRelax;
    return `Relax the pin on ${name}: it is in ${count === 1 ? 'the failing pair' : `${count} of the ${failing.length} failing pairs`}.`;
  }
  if (pinned) return 'No failing pair involves a pin: the other packages need disjoint core versions.';
  return 'No geostyler-style or geostyler-data version is accepted by every package in the stack.';
}

function NoSetView({ result, stack, pins }: { result: NoSet; stack: string[]; pins: Pins }) {
  const pinned = Object.keys(pins).length > 0;
  return (
    <Flex vertical gap="middle">
      <Alert
        type="warning"
        showIcon
        title={pinned ? 'No version set keeps these pins' : 'No version set for this stack'}
        description={relaxSentence(result, pinned)}
      />
      <Title level={5}>Failing pairs</Title>
      <PairList pairs={result.failing} label="Failing pairs" />
      {result.partial && (
        <>
          <Title level={5}>Partial set without {result.partial.removed}</Title>
          <VersionSetPanel set={result.partial.set} stack={stack.filter((n) => n !== result.partial?.removed)} pins={pins} />
        </>
      )}
    </Flex>
  );
}

function IgnoredPins({ names, pins }: { names: string[]; pins: Pins }) {
  if (names.length === 0) return null;
  return (
    <Alert
      type="warning"
      showIcon
      title="Some pins were left out"
      description={`The dataset has no ${names.map((name) => `${name} ${pins[name]}`).join(', ')}. Those packages take the recommended version.`}
    />
  );
}

interface VersionSetViewProps {
  packages: Package[];
  stack: string[];
  pins: Pins;
}

export function VersionSetView({ packages, stack, pins }: VersionSetViewProps) {
  const [includePrereleases] = usePrereleases();
  const result = useMemo(
    () => buildVersionSet(packages, stack, { includePrereleases, pins }),
    [packages, stack, includePrereleases, pins],
  );

  return (
    <Flex vertical gap="middle">
      <IgnoredPins names={result.ignoredPins} pins={pins} />
      {result.status === 'found' ? (
        <>
          <Title level={5}>Version set</Title>
          <VersionSetPanel set={result.set} stack={stack} pins={pins} />
        </>
      ) : (
        <NoSetView result={result} stack={stack} pins={pins} />
      )}
    </Flex>
  );
}
