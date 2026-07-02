import { createFileRoute, Link } from '@tanstack/react-router';
import { usePackages, useCompatibilityMatrix } from '@/api/queries';
import type { Package, PackageCategory } from '@/types/compatibility';
import { useState } from 'react';
import { Card, Table, Select, Space, Statistic, Row, Col, Spin, Tag, Button } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { GithubOutlined, LinkOutlined } from '@ant-design/icons';

export const Route = createFileRoute('/')({
  component: Dashboard,
});

function Dashboard() {
  const { data: packages, isLoading: packagesLoading, error: packagesError } = usePackages();
  const { data: matrix, isLoading: matrixLoading, error: matrixError } = useCompatibilityMatrix();
  const [selectedCategory, setSelectedCategory] = useState<PackageCategory | 'all'>('all');
  const [esmFilter, setEsmFilter] = useState<'all' | 'esm' | 'cjs'>('all');

  if (packagesLoading || matrixLoading) {
    return <Spin size="large" style={{ display: 'flex', justifyContent: 'center', minHeight: '400px' }} />;
  }

  if (packagesError || matrixError) {
    return (
      <Card style={{ borderColor: '#ff4d4f' }} title="Error Loading Data">
        <p style={{ color: '#ff4d4f' }}>{packagesError?.message || matrixError?.message || 'Unknown error'}</p>
      </Card>
    );
  }

  if (!packages || !matrix) {
    return <Card>No data available</Card>;
  }

  // Apply filters
  const visiblePackages = packages.filter((p) => {
    if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
    if (esmFilter !== 'all') {
      const latest = p.versions.find((v) => v.version === p.latestVersion);
      const isEsm = latest?.esmSupport ?? false;
      if (esmFilter === 'esm' && !isEsm) return false;
      if (esmFilter === 'cjs' && isEsm) return false;
    }
    return true;
  });

  // Group packages by category
  const grouped: Record<PackageCategory, Package[]> = {
    core: visiblePackages.filter((p) => p.category === 'core'),
    ui: visiblePackages.filter((p) => p.category === 'ui'),
    'style-parser': visiblePackages.filter((p) => p.category === 'style-parser'),
    'data-parser': visiblePackages.filter((p) => p.category === 'data-parser'),
  };

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <Card title="Package Compatibility Matrix">
        <p style={{ color: '#666', marginBottom: '1rem' }}>
          Last updated: {new Date(matrix.generated).toLocaleString()}
        </p>

        {/* Filters */}
        <Space style={{ marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <div>
            <label style={{ marginRight: '0.5rem', fontWeight: 500 }}>Category:</label>
            <Select
              value={selectedCategory}
              onChange={setSelectedCategory}
              style={{ width: 200 }}
              options={[
                { label: 'All Categories', value: 'all' },
                { label: 'Core Packages', value: 'core' },
                { label: 'UI Components', value: 'ui' },
                { label: 'Style Parsers', value: 'style-parser' },
                { label: 'Data Parsers', value: 'data-parser' },
              ]}
            />
          </div>

          <div>
            <label style={{ marginRight: '0.5rem', fontWeight: 500 }}>Module System:</label>
            <Select
              value={esmFilter}
              onChange={setEsmFilter}
              style={{ width: 150 }}
              options={[
                { label: 'All', value: 'all' },
                { label: 'ESM Only', value: 'esm' },
                { label: 'CJS Only', value: 'cjs' },
              ]}
            />
          </div>
        </Space>
      </Card>

      {/* Package Statistics */}
      <Card title="Package Overview">
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={8} md={4}>
            <Statistic title="Total Packages" value={packages.length} />
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Statistic title="Core" value={packages.filter((p) => p.category === 'core').length} />
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Statistic title="Style Parsers" value={packages.filter((p) => p.category === 'style-parser').length} />
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Statistic title="Data Parsers" value={packages.filter((p) => p.category === 'data-parser').length} />
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Statistic title="UI Components" value={packages.filter((p) => p.category === 'ui').length} />
          </Col>
        </Row>
      </Card>

      {/* Package Lists by Category */}
      {Object.entries(grouped).map(([category, pkgs]) => {
        if (pkgs.length === 0) return null;
        return (
        <Card
          key={category}
          title={category === "ui" ? "UI" : category.charAt(0).toUpperCase() + category.slice(1).replace('-', ' ')}
        >
          <PackageList packages={pkgs} esmFilter={esmFilter} />
        </Card>
        );
      })}
    </Space>
  );
}

function PackageList({ packages, esmFilter }: { packages: Package[]; esmFilter: string }) {
  const columns: ColumnsType<Package> = [
    {
      title: 'Package',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Link to="/package/$name" params={{ name: text }}>{text}</Link>,
    },
    {
      title: 'Latest Version',
      dataIndex: 'latestVersion',
      key: 'latestVersion',
      render: (version: string) => <Tag color="blue">{version}</Tag>,
    },
    {
      title: 'Total Versions',
      dataIndex: 'versions',
      key: 'versionsCount',
      render: (_: unknown, record: Package) => record.versions.length,
    },
    {
      title: 'Module System',
      key: 'moduleSystem',
      render: (_: unknown, record: Package) => {
        const latestVersionData = record.versions.find(v => v.version === record.latestVersion);
        const isESM = latestVersionData?.esmSupport || false;
        return <Tag color={isESM ? 'green' : 'cyan'}>{isESM ? 'ESM' : 'CJS'}</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: Package) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<GithubOutlined />}
            href={record.repositoryUrl}
            target='_blank'
            rel="noopener noreferrer"
          >
            GitHub
          </Button>
          <Button
            type="link"
            size="small"
            icon={<LinkOutlined />}
            href={`https://www.npmjs.com/package/${record.name}`}
            target='_blank'
            rel="noopener noreferrer"
          >
            npm
          </Button>
        </Space>
      ),
    },
  ];

  // Only show the Format column for sections where at least one package
  // actually has a format (e.g. Style/Data Parsers) — Core and UI packages
  // never have one, so the column would otherwise always render '—'.
  if (packages.some((p) => p.format)) {
    columns.splice(1, 0, {
      title: 'Format',
      dataIndex: 'format',
      key: 'format',
      render: (format: string | undefined) => (format ? <Tag>{format}</Tag> : '—'),
    });
  }

  const filteredData = packages.filter(pkg => {
    const latestVersionData = pkg.versions.find(v => v.version === pkg.latestVersion);
    const isESM = latestVersionData?.esmSupport || false;

    if (esmFilter === 'esm' && !isESM) return false;
    if (esmFilter === 'cjs' && isESM) return false;
    return true;
  });

  return (
    <Table
      columns={columns}
      dataSource={filteredData}
      rowKey="name"
      pagination={{ pageSize: 10 }}
    />
  );
}
