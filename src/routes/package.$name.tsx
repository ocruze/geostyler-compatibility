import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { Button, Card, Flex, Result, Select, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowLeftOutlined, GithubOutlined, LinkOutlined, PlusOutlined } from '@ant-design/icons';
import { useEffect, useMemo } from 'react';

import { usePackages } from '@/api/queries';
import { PairMatrix } from '@/components/PairMatrix';
import { CoreRangeText } from '@/components/Verdict';
import { CORE_PACKAGES } from '@/constants/repos';
import { candidateVersions } from '@/engine';
import { EXPECTED_CORES } from '@/engine/evaluatePair';
import { usePrereleases } from '@/hooks/usePrereleases';
import type { ModuleSystem, Package, PackageCategory, PackageVersion } from '@/types/compatibility';
import { formatUtcDate } from '@/utils/date';
import { encodeStackSearch, parseStackSelection, validateStackSearch, type StackSearch } from '@/utils/stackSearch';

const { Text, Title } = Typography;

const CATEGORY_LABEL: Record<PackageCategory, string> = {
  core: 'Core package',
  ui: 'UI package',
  'style-parser': 'Style parser',
  'data-parser': 'Data parser',
};

const MODULE_LABEL: Record<ModuleSystem, string> = { esm: 'ESM', cjs: 'CJS', 'types-only': 'Types only' };

// The stack travels with the page so "Add to stack" returns to the same stack builder state; `with` names the pair matrix partner.
type PackageSearch = StackSearch & { with?: string };

export const Route = createFileRoute('/package/$name')({
  component: PackageDetail,
  validateSearch: (search: Record<string, unknown>): PackageSearch => ({
    ...validateStackSearch(search),
    with: typeof search.with === 'string' && search.with ? search.with : undefined,
  }),
});

function PackageDetail() {
  const { name } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data: packages } = usePackages();
  const [includePrereleases] = usePrereleases();

  const pkg = packages.find((p) => p.name === name);
  const tracked = useMemo(() => packages.map((p) => p.name), [packages]);
  const selection = useMemo(() => parseStackSelection(search, tracked), [search, tracked]);
  const partner = packages.find((p) => p.name === search.with && p.name !== name);

  useEffect(() => {
    document.title = pkg ? `${pkg.name} · GeoStyler Compatibility` : 'GeoStyler Compatibility';
  }, [pkg]);

  if (!pkg) {
    return (
      <Result
        status="404"
        title="Package not found"
        subTitle={`${name} is not a tracked package.`}
        extra={
          <Link to="/">
            <Button type="primary">Back to the stack builder</Button>
          </Link>
        }
      />
    );
  }

  // npm's latest tag, the same version the history marks as latest.
  const latest = pkg.versions.find((v) => v.version === pkg.latestVersion);
  const inStack = selection.stack.includes(pkg.name);
  const addToStack = () => {
    const stack = tracked.filter((n) => n === pkg.name || selection.stack.includes(n));
    navigate({ to: '/', search: encodeStackSearch({ stack, pins: selection.pins }) });
  };

  return (
    <Flex vertical gap="large">
      <Link to="/" search={encodeStackSearch(selection)}>
        <Button type="text" icon={<ArrowLeftOutlined aria-hidden="true" />}>
          Back to the stack builder
        </Button>
      </Link>

      <Card>
        <Flex vertical gap="middle" align="flex-start">
          <Title level={2} style={{ margin: 0 }}>
            {pkg.name}
          </Title>
          <Flex gap="small" wrap>
            <Tag color="blue">{CATEGORY_LABEL[pkg.category]}</Tag>
            {pkg.format && <Tag>{pkg.format}</Tag>}
            {latest && <Tag>{MODULE_LABEL[latest.moduleSystem]}</Tag>}
            {latest && (
              <Text type="secondary">
                Latest {latest.version}, published {formatUtcDate(latest.publishDate)}
              </Text>
            )}
          </Flex>
          <Flex gap="small" wrap>
            <Button type="primary" icon={<PlusOutlined aria-hidden="true" />} onClick={addToStack} disabled={inStack}>
              {inStack ? 'In your stack' : 'Add to stack'}
            </Button>
            <Button icon={<LinkOutlined aria-hidden="true" />} href={`https://www.npmjs.com/package/${pkg.name}`} target="_blank" rel="noopener noreferrer">
              npm
            </Button>
            {pkg.repositoryUrl && (
              <Button icon={<GithubOutlined aria-hidden="true" />} href={pkg.repositoryUrl} target="_blank" rel="noopener noreferrer">
                GitHub
              </Button>
            )}
          </Flex>
        </Flex>
      </Card>

      <Card title="Pair matrix">
        <Flex vertical gap="middle">
          <Flex gap="small" align="center" wrap>
            <label htmlFor="partner-select">
              <Text strong>Against</Text>
            </label>
            <Select
              id="partner-select"
              className="package-select"
              placeholder="Choose another tracked package"
              value={partner?.name}
              onChange={(name: string) => navigate({ search: (prev) => ({ ...prev, with: name }) })}
              showSearch
              options={packages.filter((p) => p.name !== pkg.name).map((p) => ({ value: p.name, label: p.name }))}
            />
          </Flex>
          {partner ? (
            <PairMatrix a={pkg} b={partner} />
          ) : (
            <Text type="secondary">Pick another tracked package to see a verdict for every pair of versions.</Text>
          )}
        </Flex>
      </Card>

      <Card title="Version history">
        <VersionHistory pkg={pkg} includePrereleases={includePrereleases} />
      </Card>
    </Flex>
  );
}

function VersionHistory({ pkg, includePrereleases }: { pkg: Package; includePrereleases: boolean }) {
  const versions = candidateVersions(pkg, includePrereleases);
  // A core the category expects always gets a column, so a missing range shows as none.
  const cores = CORE_PACKAGES.filter(
    (core) => pkg.name !== core && (EXPECTED_CORES[pkg.category].includes(core) || versions.some((v) => v.coreRanges[core].source !== 'none')),
  );

  const columns: ColumnsType<PackageVersion> = [
    {
      title: 'Version',
      key: 'version',
      render: (_, v) => (
        <Flex gap="small" align="center">
          <code>{v.version}</code>
          {v.version === pkg.latestVersion && <Tag color="success">latest</Tag>}
          {v.isPrerelease && <Tag color="warning">prerelease</Tag>}
        </Flex>
      ),
    },
    { title: 'Published', key: 'published', render: (_, v) => formatUtcDate(v.publishDate) ?? 'unknown' },
    { title: 'Module system', key: 'module', render: (_, v) => MODULE_LABEL[v.moduleSystem] },
    ...cores.map(
      (core): ColumnsType<PackageVersion>[number] => ({
        title: `${core} range`,
        key: core,
        render: (_, v) => <CoreRangeText range={v.coreRanges[core]} />,
      }),
    ),
  ];

  return (
    <Table<PackageVersion>
      size="small"
      columns={columns}
      dataSource={versions}
      rowKey="version"
      pagination={{ pageSize: 20, hideOnSinglePage: true }}
      scroll={{ x: 'max-content' }}
    />
  );
}
