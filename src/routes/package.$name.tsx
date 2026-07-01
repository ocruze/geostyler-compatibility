import { createFileRoute, Link } from '@tanstack/react-router';
import { usePackage } from '@/api/queries';
import type { PackageVersion } from '@/types/compatibility';
import { useEffect, useState } from 'react';
import { Card, Table, Select, Space, Tag, Button, Spin, Tabs } from 'antd';
import { ArrowLeftOutlined, GithubOutlined, LinkOutlined } from '@ant-design/icons';

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
    return <Spin size="large" style={{ display: 'flex', justifyContent: 'center', minHeight: '400px' }} />;
  }
  if (error) {
    return (
      <Card title="Error Loading Package">
        <p style={{ color: '#ff4d4f' }}>{error instanceof Error ? error.message : 'Unknown error'}</p>
      </Card>
    );
  }

  if (!pkg) {
    return (
      <Card>
        <p>Package "{name}" not found in the compatibility database.</p>
        <Link to="/">← Back to Dashboard</Link>
      </Card>
    );
  }

  const currentVersion = selectedVersion 
    ? pkg.versions.find(v => v.version === selectedVersion)
    : pkg.versions.find(v => v.version === pkg.latestVersion);

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      {/* Back Link */}
      <Link to="/">
        <Button type="text" icon={<ArrowLeftOutlined />}>
          Back to Dashboard
        </Button>
      </Link>

      {/* Header */}
      <Card>
        <h2>{pkg.name}</h2>
        <Space style={{ marginTop: '1rem', flexWrap: 'wrap' }}>
          <Tag color={currentVersion?.esmSupport ? 'green' : 'cyan'}>
            {currentVersion?.esmSupport ? 'ESM' : 'CJS'}
          </Tag>
          {pkg.format && <Tag>{pkg.format}</Tag>}
          <Tag color="blue">{pkg.category}</Tag>
        </Space>
        <Space style={{ marginTop: '1rem' }}>
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
      </Card>

      {/* Version Selector */}
      <Card title="Version Details">
        <Space style={{ marginBottom: '1rem', display: 'flex' }}>
          <label style={{ fontWeight: 500 }}>Select Version:</label>
          <Select
            value={selectedVersion || pkg.latestVersion}
            onChange={setSelectedVersion}
            style={{ minWidth: 200 }}
            options={pkg.versions.map(v => ({
              label: `${v.version}${v.version === pkg.latestVersion ? ' (latest)' : ''}${v.isPrerelease ? ' (prerelease)' : ''}`,
              value: v.version,
            }))}
          />
        </Space>

        {currentVersion && <VersionDetails version={currentVersion} />}
      </Card>

      {/* All Versions */}
      <Card title={`Version History (${pkg.versions.length} versions)`}>
        <VersionHistoryTable
          versions={pkg.versions}
          latestVersion={pkg.latestVersion}
        />
      </Card>
    </Space>
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
        <Space orientation="vertical" style={{ width: '100%' }}>
          <div>
            <strong>Version:</strong> {version.version}
          </div>
          <div>
            <strong>Published:</strong> {new Date(version.publishDate).toLocaleDateString()}
          </div>
          <div>
            <strong>Module System:</strong>{' '}
            <Tag color={version.esmSupport ? 'green' : 'cyan'}>
              {version.esmSupport ? 'ESM' : 'CJS'}
            </Tag>
          </div>
          <div>
            <strong>Format:</strong> {version.format || '—'}
          </div>
        </Space>
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
        <div style={{ padding: '1rem', backgroundColor: '#f0f8ff', borderRadius: '4px' }}>
          <strong>geostyler-style Compatibility:</strong>
          <div style={{ marginTop: '0.5rem', fontSize: '1.1rem' }}>
            <code>{version.geostylerStyleRange}</code>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <a href={version.changelogUrl} target="_blank" rel="noopener noreferrer">
              View Changelog →
            </a>
          </div>
        </div>
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

  return <Table columns={columns} dataSource={data} pagination={false} />;
}

function VersionHistoryTable({
  versions,
  latestVersion,
}: {
  versions: PackageVersion[];
  latestVersion: string;
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
      render: (_: any, record: PackageVersion) => (
        <Tag color={record.esmSupport ? 'green' : 'cyan'}>
          {record.esmSupport ? 'ESM' : 'CJS'}
        </Tag>
      ),
    },
    {
      title: 'geostyler-style',
      dataIndex: 'geostylerStyleRange',
      key: 'geostylerStyleRange',
      render: (range: string | undefined) => (
        <code style={{ fontSize: '0.875rem' }}>{range || '—'}</code>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, record: PackageVersion) =>
        record.isPrerelease ? <Tag color="orange">Prerelease</Tag> : null,
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={versions}
      rowKey="version"
      pagination={{ pageSize: 20 }}
    />
  );
}
