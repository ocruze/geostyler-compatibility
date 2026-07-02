import { createFileRoute, Link } from '@tanstack/react-router';
import { usePackage } from '@/api/queries';
import type { PackageVersion } from '@/types/compatibility';
import { useEffect, useState } from 'react';
import { Card, Table, Select, Space, Tag, Button, Spin, Tabs, Flex, Typography, Alert, Result } from 'antd';
import { ArrowLeftOutlined, GithubOutlined, LinkOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

export const Route = createFileRoute('/package/$name')({
  component: PackageDetail,
});

function PackageDetail() {
  const { name } = Route.useParams();
  const { data: pkg, isLoading, error } = usePackage(name);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);

  useEffect(() => {
    document.title = pkg ? `${pkg.name} · GeoStyler Compatibility` : 'GeoStyler Compatibility';
  }, [pkg]);

  if (isLoading) {
    return <Spin size="large" className="centered-spin" />;
  }
  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        title="Error Loading Package"
        description={error instanceof Error ? error.message : 'Unknown error'}
      />
    );
  }

  if (!pkg) {
    return (
      <Result
        status="404"
        title="Package Not Found"
        subTitle={`Package “${name}” is not in the compatibility database.`}
        extra={
          <Link to="/overview">
            <Button type="primary">Back to Overview</Button>
          </Link>
        }
      />
    );
  }

  const currentVersion = selectedVersion
    ? pkg.versions.find(v => v.version === selectedVersion)
    : pkg.versions.find(v => v.version === pkg.latestVersion);

  return (
    <Flex vertical gap="large">
      {/* Back Link */}
      <Link to="/overview">
        <Button type="text" icon={<ArrowLeftOutlined />}>
          Back to Overview
        </Button>
      </Link>

      {/* Header */}
      <Card>
        <Flex vertical gap="middle" align="flex-start">
          <Title level={2} style={{ margin: 0 }}>{pkg.name}</Title>
          <Space wrap>
            <Tag color={currentVersion?.esmSupport ? 'green' : 'cyan'}>
              {currentVersion?.esmSupport ? 'ESM' : 'CJS'}
            </Tag>
            {pkg.format && <Tag>{pkg.format}</Tag>}
            <Tag color="blue">{pkg.category}</Tag>
          </Space>
          <Space wrap>
            <Button
              type="primary"
              icon={<GithubOutlined />}
              href={pkg.repositoryUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub Repository
            </Button>
            <Button
              icon={<LinkOutlined />}
              href={`https://www.npmjs.com/package/${pkg.name}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              npm Package
            </Button>
          </Space>
        </Flex>
      </Card>

      {/* Version Selector */}
      <Card title="Version Details">
        <Flex vertical gap="small">
          <Flex gap="small" align="center" wrap>
            <label htmlFor="version-select">
              <Text strong>Select Version:</Text>
            </label>
            <Select
              id="version-select"
              value={selectedVersion || pkg.latestVersion}
              onChange={setSelectedVersion}
              className="filter-select"
              popupMatchSelectWidth={false}
              showSearch={{ optionFilterProp: 'label' }}
              options={pkg.versions.map(v => ({
                label: `${v.version}${v.version === pkg.latestVersion ? ' (latest)' : ''}${v.isPrerelease ? ' (prerelease)' : ''}`,
                value: v.version,
              }))}
            />
          </Flex>

          {currentVersion && <VersionDetails version={currentVersion} />}
        </Flex>
      </Card>

      {/* All Versions */}
      <Card title={`Version History (${pkg.versions.length} versions)`}>
        <VersionHistoryTable
          versions={pkg.versions}
          latestVersion={pkg.latestVersion}
          selectedVersion={selectedVersion || pkg.latestVersion}
          onSelectVersion={setSelectedVersion}
        />
      </Card>
    </Flex>
  );
}

function VersionDetails({ version }: { version: PackageVersion }) {
  const deps = Object.entries(version.dependencies || {});
  const peerDeps = Object.entries(version.peerDependencies || {});

  const tabItems = [
    {
      key: 'info',
      label: 'Info',
      children: (
        <Flex vertical gap="small">
          <div>
            <Text strong>Version:</Text> {version.version}
          </div>
          <div>
            <Text strong>Published:</Text> {new Date(version.publishDate).toLocaleDateString()}
          </div>
          <div>
            <Text strong>Module System:</Text>{' '}
            <Tag color={version.esmSupport ? 'green' : 'cyan'}>
              {version.esmSupport ? 'ESM' : 'CJS'}
            </Tag>
          </div>
          {version.format && (
            <div>
              <Text strong>Format:</Text> {version.format}
            </div>
          )}
        </Flex>
      ),
    },
  ];

  if (deps.length > 0) {
    tabItems.push({
      key: 'dependencies',
      label: `Dependencies (${deps.length})`,
      children: <DependencyTable deps={version.dependencies} />,
    });
  }

  if (peerDeps.length > 0) {
    tabItems.push({
      key: 'peerDependencies',
      label: `Peer Dependencies (${peerDeps.length})`,
      children: <DependencyTable deps={version.peerDependencies} />,
    });
  }

  if (version.geostylerStyleRange) {
    tabItems.push({
      key: 'geostyler',
      label: 'geostyler-style',
      children: (
        <Alert
          type="info"
          title={
            <>
              geostyler-style Compatibility: <code>{version.geostylerStyleRange}</code>
            </>
          }
          description={
            version.changelogUrl && (
              <a href={version.changelogUrl} target="_blank" rel="noopener noreferrer">
                View Changelog →
              </a>
            )
          }
        />
      ),
    });
  }

  return <Tabs items={tabItems} />;
}

function DependencyTable({ deps }: { deps: Record<string, string> }) {
  const data = Object.entries(deps).map(([name, range]) => ({
    key: name,
    name,
    range,
  }));

  const columns = [
    {
      title: 'Package',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <code>{text}</code>,
    },
    {
      title: 'Version Range',
      dataIndex: 'range',
      key: 'range',
      render: (text: string) => <code>{text}</code>,
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={data}
      pagination={false}
      scroll={{ x: 'max-content' }}
    />
  );
}

function VersionHistoryTable({
  versions,
  latestVersion,
  selectedVersion,
  onSelectVersion,
}: {
  versions: PackageVersion[];
  latestVersion: string;
  selectedVersion: string;
  onSelectVersion: (version: string) => void;
}) {
  const columns = [
    {
      title: 'Version',
      dataIndex: 'version',
      key: 'version',
      render: (version: string) => (
        <Space>
          <Tag color="blue">{version}</Tag>
          {version === latestVersion && <Tag color="green">Latest</Tag>}
        </Space>
      ),
    },
    {
      title: 'Published',
      dataIndex: 'publishDate',
      key: 'publishDate',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Module System',
      key: 'esm',
      render: (_: unknown, record: PackageVersion) => (
        <Tag color={record.esmSupport ? 'green' : 'cyan'}>
          {record.esmSupport ? 'ESM' : 'CJS'}
        </Tag>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: unknown, record: PackageVersion) =>
        record.isPrerelease ? <Tag color="orange">Prerelease</Tag> : null,
    },
  ];

  // Core packages have no geostyler-style range of their own; showing the
  // column there would render a wall of '—'.
  if (versions.some((v) => v.geostylerStyleRange)) {
    columns.splice(3, 0, {
      title: 'geostyler-style',
      key: 'geostylerStyleRange',
      render: (_: unknown, record: PackageVersion) => (
        <code>{record.geostylerStyleRange || '—'}</code>
      ),
    });
  }

  return (
    <Flex vertical gap="small">
      <Text type="secondary">Click a row to inspect that version above.</Text>
      <Table
        columns={columns}
        dataSource={versions}
        rowKey="version"
        pagination={{ pageSize: 20, hideOnSinglePage: true }}
        scroll={{ x: 'max-content' }}
        rowClassName={(record) => (record.version === selectedVersion ? 'ant-table-row-selected' : '')}
        onRow={(record) => ({
          onClick: () => onSelectVersion(record.version),
          style: { cursor: 'pointer' },
        })}
      />
    </Flex>
  );
}
