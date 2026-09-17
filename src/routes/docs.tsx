import { createFileRoute, Link } from '@tanstack/react-router';
import { Card, Collapse, Flex, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, type ReactNode } from 'react';

import { datasetGeneratedAt, usePackages } from '@/api/queries';
import {
  CoreAxisTable,
  DeclaredDependencyTable,
  SharedPeerTable,
  VerdictDetail,
  VerdictTag,
} from '@/components/Verdict';
import { COLOR_NAME, VERDICT_META } from '@/components/verdictMeta';
import { VersionSetView } from '@/components/VersionSetView';
import { CATEGORY_LABEL, MODULE_LABEL } from '@/constants/labels';
import {
  PAIR_MATRIX_DEFAULT_LIMIT,
  VERDICTS,
  buildVersionSet,
  findTransitiveRangeExample,
  findVerdictExamples,
  latestVersion,
  stackPairSentence,
  verdictSentence,
  versionLabel,
  type PairEvaluation,
  type VerdictExamples,
} from '@/engine';
import { usePrereleases } from '@/hooks/usePrereleases';
import type { Package, PackageCategory, PackageVersion, Verdict } from '@/types/compatibility';
import { formatUtcDate } from '@/utils/date';

const { Paragraph, Text, Title } = Typography;

export const Route = createFileRoute('/docs')({
  component: Docs,
});

const CATEGORY_DESCRIPTION: Record<PackageCategory, string> = {
  core: 'Defines a schema other packages consume: geostyler-style for styles, geostyler-data for features.',
  ui: 'A React library that consumes styles and data and declares parsers as dependencies.',
  'style-parser': 'Converts between geostyler-style and one style format.',
  'data-parser': 'Converts between geostyler-data and one data format.',
};

// A UI package, the legend and four style parsers: a stack whose set trails the newest releases, so it has a bottleneck.
const EXAMPLE_STACK = [
  'geostyler',
  'geostyler-legend',
  'geostyler-sld-parser',
  'geostyler-mapbox-parser',
  'geostyler-qgis-parser',
  'geostyler-openlayers-parser',
];

// A UI package with two parsers it declares: the stack where a third version can vouch for a Risk pair.
const VIA_STACK = ['geostyler', 'geostyler-sld-parser', 'geostyler-mapbox-parser'];

const SECTIONS = [
  { id: 'pages', title: 'The pages' },
  { id: 'packages', title: 'Tracked packages' },
  { id: 'axes', title: 'The three axes' },
  { id: 'verdicts', title: 'The seven verdicts' },
  { id: 'version-sets', title: 'Version sets' },
  { id: 'data', title: 'Where the data comes from' },
];

// Examples are searched in this order so an axis example comes from the pair most likely to show it clearly.
const AXIS_EXAMPLE_ORDER: Verdict[] = ['compatible', 'shipped-together', 'risk', 'duplicate', 'conflict', 'unknown', 'independent'];

function axisExample<T>(
  examples: VerdictExamples,
  pick: (evaluation: PairEvaluation) => T[],
  matches: (row: T) => boolean,
): { evaluation: PairEvaluation; rows: T[] } | null {
  for (const verdict of AXIS_EXAMPLE_ORDER) {
    const evaluation = examples[verdict];
    if (!evaluation) continue;
    const rows = pick(evaluation).filter(matches);
    if (rows.length > 0) return { evaluation, rows };
  }
  return null;
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <Card id={id} title={<Title level={3} className="docs-section__title">{title}</Title>}>
      <Flex vertical gap="middle">
        {children}
      </Flex>
    </Card>
  );
}

function NoExample({ what }: { what: string }) {
  return <Text type="secondary">No {what} in the current dataset.</Text>;
}

interface AxisExampleProps<T> {
  example: { evaluation: PairEvaluation; rows: T[] } | null;
  // What the dataset lacks when there is no example.
  missing: string;
  table: (a: PackageVersion, b: PackageVersion, rows: T[]) => ReactNode;
}

function AxisExample<T>({ example, missing, table }: AxisExampleProps<T>) {
  if (!example) return <NoExample what={missing} />;
  const { a, b } = example.evaluation;
  return (
    <>
      <Text type="secondary">
        Example: {versionLabel(a)} and {versionLabel(b)}
      </Text>
      {table(a, b, example.rows)}
    </>
  );
}

// The sentence the app shows for one pair.
function ExampleSentence({ a, b, children }: { a: PackageVersion; b: PackageVersion; children: ReactNode }) {
  return (
    <blockquote className="docs-example">
      <Text type="secondary">
        {versionLabel(a)} and {versionLabel(b)}:
      </Text>{' '}
      {children}
    </blockquote>
  );
}

function PagesSection() {
  return (
    <Section id="pages" title="The pages">
      <Title level={4}>Check compatibility</Title>
      <Paragraph>
        The <Link to="/">stack builder</Link> is the landing page. Tick the packages you use. Each ticked package gets a
        version control set to Recommended; choose a version there to pin it. The result is a version set: one version
        per package and an <code>npm install</code> line to copy. When the set is older than the newest releases, a
        sentence names the bottleneck. With nothing ticked, the page shows the latest releases grid: the latest release
        of every tracked package against every other, one verdict per cell.
      </Paragraph>
      <Paragraph>
        The stack and its pins live in the URL. A shared link shows the same answer, and the back button undoes the last
        change.
      </Paragraph>
      <Title level={4}>Package page</Title>
      <Paragraph>
        One tracked package: its category, format and module system, and the version history with each core range and
        its source. Below them, the pair matrix against a package you choose. The matrix shows the newest{' '}
        {PAIR_MATRIX_DEFAULT_LIMIT} stable versions on each side until you expand it to all. Select a cell to see how its
        verdict was reached. Add to stack returns to the stack builder with the package added.
      </Paragraph>
      <Title level={4}>Prereleases</Title>
      <Paragraph>
        Every page hides versions with a <code>-next</code>, <code>-beta</code> or similar tag by default. The stack
        builder never recommends one while a stable release exists. The Show prereleases switch in the header reveals them in grids,
        matrices and version controls. It is a browser preference, not part of the URL.
      </Paragraph>
    </Section>
  );
}

interface PackageRow {
  pkg: Package;
  latest: PackageVersion | undefined;
}

function PackagesSection({ packages, includePrereleases }: { packages: Package[]; includePrereleases: boolean }) {
  const rows: PackageRow[] = packages.map((pkg) => ({ pkg, latest: latestVersion(pkg, includePrereleases) }));
  const columns: ColumnsType<PackageRow> = [
    {
      title: 'Package',
      key: 'name',
      render: (_, { pkg }) => (
        <Link to="/package/$name" params={{ name: pkg.name }}>
          {pkg.name}
        </Link>
      ),
    },
    { title: 'Category', key: 'category', render: (_, { pkg }) => CATEGORY_LABEL[pkg.category] },
    { title: 'Format', key: 'format', render: (_, { pkg }) => pkg.format ?? <Text type="secondary">none</Text> },
    { title: 'Latest release', key: 'latest', render: (_, { latest }) => (latest ? <code>{latest.version}</code> : <Text type="secondary">none</Text>) },
    { title: 'Published', key: 'published', render: (_, { latest }) => (latest ? formatUtcDate(latest.publishDate) : null) },
    { title: 'Module system', key: 'module', render: (_, { latest }) => (latest ? MODULE_LABEL[latest.moduleSystem] : null) },
  ];
  return (
    <Section id="packages" title="Tracked packages">
      <Paragraph>
        The dataset covers a fixed list of packages in four categories. <code>geostyler-cql-parser</code> is not
        tracked: users do not install it directly.
      </Paragraph>
      <ul className="docs-definitions">
        {(Object.keys(CATEGORY_LABEL) as PackageCategory[]).map((category) => (
          <li key={category}>
            <Text strong>{CATEGORY_LABEL[category]}</Text> {CATEGORY_DESCRIPTION[category]}
          </li>
        ))}
      </ul>
      <Table<PackageRow>
        size="small"
        pagination={false}
        rowKey={(row) => row.pkg.name}
        columns={columns}
        dataSource={rows}
        scroll={{ x: 'max-content' }}
      />
    </Section>
  );
}

function AxesSection({ examples, packages, includePrereleases }: { examples: VerdictExamples; packages: Package[]; includePrereleases: boolean }) {
  const coreIntersect = axisExample(examples, (e) => e.core, (row) => row.outcome === 'intersect');
  const coreDisjoint = axisExample(examples, (e) => e.core, (row) => row.outcome === 'disjoint');
  const declaredSatisfied = axisExample(examples, (e) => e.declared, (row) => row.satisfied);
  const declaredUnsatisfied = axisExample(examples, (e) => e.declared, (row) => !row.satisfied);
  const peerIntersect = axisExample(examples, (e) => e.peers, (row) => row.outcome === 'intersect');
  const peerDisjoint = axisExample(examples, (e) => e.peers, (row) => row.outcome === 'disjoint');
  const transitive = useMemo(() => findTransitiveRangeExample(packages, includePrereleases), [packages, includePrereleases]);

  return (
    <Section id="axes" title="The three axes">
      <Paragraph>
        The engine compares a pair of package versions on three axes. Each axis has an outcome; the verdict is the
        strongest outcome across them.
      </Paragraph>

      <Title level={4}>1. Core range</Title>
      <Paragraph>
        A parser or UI package declares a version range on a core package: <code>geostyler-style</code> for style
        parsers and UI packages, <code>geostyler-data</code> for data parsers. Two ranges that intersect mean both
        versions read and write the same schema. Disjoint ranges mean npm installs two copies of the core package, and
        style or data objects may not match between them. When one member of the pair is the core package itself, its
        version must satisfy the other's range.
      </Paragraph>
      <AxisExample example={coreIntersect} missing="pair has intersecting core ranges" table={(a, b, rows) => <CoreAxisTable a={a} b={b} rows={rows} />} />
      <AxisExample example={coreDisjoint} missing="pair has disjoint core ranges" table={(a, b, rows) => <CoreAxisTable a={a} b={b} rows={rows} />} />
      <Paragraph>
        A version that declares no core range can inherit one through a declared dependency on a tracked package. The
        build step follows declared dependencies, taking the newest version satisfying each range, until it reaches a
        declared core range. It records where that range came from, and the version history on each package page shows
        the origin.
      </Paragraph>
      {transitive ? (
        <Flex vertical>
          <Text type="secondary">Example: {versionLabel(transitive.version)}</Text>
          <Text>
            Its <code>{transitive.core}</code> range <code>{transitive.range.range}</code> comes from{' '}
            {transitive.range.origin.name} {transitive.range.origin.version}, reached through its declared dependencies.
          </Text>
        </Flex>
      ) : (
        <NoExample what="version inherits a core range" />
      )}

      <Title level={4}>2. Declared dependency</Title>
      <Paragraph>
        A UI package lists parsers in its <code>dependencies</code> with a range. When the chosen parser version
        satisfies that range, upstream built and tested the pair, whatever their core ranges say. When it does not, npm
        installs the parser twice: your version and the one the UI package bundles.
      </Paragraph>
      <AxisExample example={declaredSatisfied} missing="pair has a satisfied declared dependency" table={(_a, _b, rows) => <DeclaredDependencyTable rows={rows} />} />
      <AxisExample example={declaredUnsatisfied} missing="pair has an unsatisfied declared dependency" table={(_a, _b, rows) => <DeclaredDependencyTable rows={rows} />} />

      <Title level={4}>3. Shared peer</Title>
      <Paragraph>
        An external package both versions list in <code>peerDependencies</code>, such as <code>ol</code> or{' '}
        <code>react</code>. A project holds one copy of a peer, so disjoint ranges make <code>npm install</code> fail.
        This is the only axis that can break installation.
      </Paragraph>
      <AxisExample example={peerIntersect} missing="pair shares a peer with intersecting ranges" table={(a, b, rows) => <SharedPeerTable a={a} b={b} rows={rows} />} />
      <AxisExample example={peerDisjoint} missing="pair shares a peer with disjoint ranges" table={(a, b, rows) => <SharedPeerTable a={a} b={b} rows={rows} />} />
    </Section>
  );
}

function VerdictEntry({ verdict, example }: { verdict: Verdict; example: PairEvaluation | null }) {
  const meta = VERDICT_META[verdict];
  return (
    <li className="docs-verdict">
      <Flex gap="small" align="baseline" wrap>
        <VerdictTag verdict={verdict} />
        <Text type="secondary">{COLOR_NAME[meta.status]}</Text>
      </Flex>
      <Paragraph className="docs-verdict__definition">{meta.definition}</Paragraph>
      {example ? (
        <Flex vertical gap="small">
          <ExampleSentence a={example.a} b={example.b}>
            {verdictSentence(example)}
          </ExampleSentence>
          <Collapse
            size="small"
            items={[{ key: 'detail', label: 'How this verdict was reached', children: <VerdictDetail evaluation={example} /> }]}
          />
        </Flex>
      ) : (
        <NoExample what="pair of tracked versions has this verdict" />
      )}
    </li>
  );
}

function VerdictsSection({ examples }: { examples: VerdictExamples }) {
  return (
    <Section id="verdicts" title="The seven verdicts">
      <Paragraph>
        Every pair gets exactly one verdict. Conflict wins over every other outcome; Independent applies only when no
        other rule does. The colour and icon are the same in the latest releases grid, the version set, the pair matrix
        and the cell detail. Independent and Unknown are grey on purpose: nothing was checked, or data was missing, and
        neither is a pass. Each example below is a real pair from the current dataset, with the sentence the app shows
        for it.
      </Paragraph>
      <ul className="docs-verdicts">
        {VERDICTS.map((verdict) => (
          <VerdictEntry key={verdict} verdict={verdict} example={examples[verdict]} />
        ))}
      </ul>
    </Section>
  );
}

function VersionSetsSection({ packages, includePrereleases }: { packages: Package[]; includePrereleases: boolean }) {
  const { exampleStack, viaPair } = useMemo(() => {
    const isTracked = (name: string) => packages.some((p) => p.name === name);
    const result = buildVersionSet(packages, VIA_STACK.filter(isTracked), { includePrereleases });
    return {
      exampleStack: EXAMPLE_STACK.filter(isTracked),
      viaPair: result.status === 'found' ? (result.set.pairs.find((pair) => pair.via) ?? null) : null,
    };
  }, [packages, includePrereleases]);

  return (
    <Section id="version-sets" title="Version sets">
      <Paragraph>
        The stack builder searches for an anchor: a <code>geostyler-style</code> version and, inside it, a{' '}
        <code>geostyler-data</code> version, newest first. For each anchor, every package in the stack takes its newest
        stable version whose core ranges accept the anchor, or its pinned version. A package that another chosen package
        declares then moves to the newest version satisfying that declared range, even when its own core range differs.
        The set is accepted when every pair is Compatible, Shipped together or Independent. The first accepted set wins.
      </Paragraph>
      <Title level={4}>Shipped together through a third package</Title>
      <Paragraph>
        In a version set, a Risk pair also counts as Shipped together when a third chosen version declares both members
        in satisfied ranges. The pair verdict itself stays Risk; only the stack builder applies this rule, and it names
        the declaring version.
      </Paragraph>
      {viaPair ? (
        <ExampleSentence a={viaPair.a} b={viaPair.b}>
          {stackPairSentence(viaPair)}
        </ExampleSentence>
      ) : (
        <NoExample what="version set has a pair vouched for by a third package" />
      )}
      <Title level={4}>Pins</Title>
      <Paragraph>
        A pin fixes one package at a version you cannot change. The search keeps it and finds what fits around it. When
        no set keeps every pin, the page lists the failing pairs with their verdicts. It also names the pin to relax:
        the pinned package in the most failing pairs. A pin on a version the dataset does not have is left out and reported.
      </Paragraph>
      <Title level={4}>Partial set</Title>
      <Paragraph>
        When no set exists, the search retries with one package removed, the pin to relax first and then each stack
        package in order. The first removal that leaves a set is offered as a partial set, naming the removed package.
      </Paragraph>
      <Title level={4}>Bottleneck</Title>
      <Paragraph>
        When a set passes over a package's newest release, the bottleneck is the stack package whose removal moves the
        anchor furthest forward. The sentence names the anchor the set would reach without it. A table under it lists
        every newest release passed over, with the core range that release declares.
      </Paragraph>
      <Title level={4}>Example stack</Title>
      <Paragraph>
        The version set for {exampleStack.join(', ')}, computed now from the dataset.{' '}
        <Link to="/" search={{ stack: exampleStack.join(',') }}>
          Open this stack in the stack builder
        </Link>
        .
      </Paragraph>
      {exampleStack.length > 0 ? (
        <VersionSetView packages={packages} selection={{ stack: exampleStack, pins: {} }} />
      ) : (
        <NoExample what="package of the example stack is tracked" />
      )}
    </Section>
  );
}

function DataSection({ packages, includePrereleases }: { packages: Package[]; includePrereleases: boolean }) {
  const generatedDate = formatUtcDate(datasetGeneratedAt);
  const typesOnly =
    packages.map((pkg) => latestVersion(pkg, includePrereleases)).find((v) => v?.moduleSystem === 'types-only') ??
    packages.flatMap((pkg) => pkg.versions).find((v) => v.moduleSystem === 'types-only');

  return (
    <Section id="data" title="Where the data comes from">
      <Paragraph>
        The build step reads the npm registry for the tracked packages and writes one data file. It reads nothing else:
        no GitHub API, no changelogs. A GitHub Actions workflow runs it on every push to <code>main</code>, daily at
        midnight UTC and on demand, then deploys the site to GitHub Pages. This copy was generated on{' '}
        {generatedDate ? <time dateTime={datasetGeneratedAt}>{generatedDate}</time> : 'an unknown date'} (UTC).
      </Paragraph>
      <Paragraph>
        For each version the file keeps the version number, publish date, prerelease flag and module system. It also
        keeps the core ranges with their source, the declared dependencies on tracked packages and the peer
        dependencies. The build step computes no verdict. Your browser evaluates every pair and every version set from that file, so the build and the page
        cannot disagree on what compatible means.
      </Paragraph>
      <Title level={4}>Module system</Title>
      <Paragraph>
        Whether a version ships ESM, CJS or TypeScript declarations only is shown on the package page as a fact. It is
        not an axis and never changes a verdict.
        {typesOnly && (
          <>
            {' '}
            A types-only package such as {versionLabel(typesOnly)} has no module system to clash with.
          </>
        )}
      </Paragraph>
    </Section>
  );
}

function Docs() {
  const { data: packages } = usePackages();
  const [includePrereleases] = usePrereleases();
  const examples = useMemo(() => findVerdictExamples(packages, includePrereleases), [packages, includePrereleases]);

  useEffect(() => {
    document.title = 'Docs · GeoStyler Compatibility';
  }, []);

  return (
    <Flex vertical gap="large">
      <Card title={<Title level={2} className="docs-section__title">Documentation</Title>}>
        <Paragraph>
          This site answers one question: you use some GeoStyler packages, which versions do you install together? Every
          verdict and version set is computed in your browser from npm registry metadata. The examples on this page are
          computed the same way, so they change when the data does.
        </Paragraph>
        <nav aria-label="Sections">
          <ul className="docs-toc">
            {SECTIONS.map(({ id, title }) => (
              <li key={id}>
                <a href={`#${id}`}>{title}</a>
              </li>
            ))}
          </ul>
        </nav>
      </Card>
      <PagesSection />
      <PackagesSection packages={packages} includePrereleases={includePrereleases} />
      <AxesSection examples={examples} packages={packages} includePrereleases={includePrereleases} />
      <VerdictsSection examples={examples} />
      <VersionSetsSection packages={packages} includePrereleases={includePrereleases} />
      <DataSection packages={packages} includePrereleases={includePrereleases} />
    </Flex>
  );
}
