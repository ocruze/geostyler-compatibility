import { createFileRoute, Link } from '@tanstack/react-router';
import { usePackages, useCompatibilityMatrix } from '@/api/queries';
import type { Package, PackageCategory } from '@/types/compatibility';
import { useState } from 'react';
import { Card, Table, Select, Space, Statistic, Row, Col, Spin, Tag, Button } from 'antd';
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

  // Filter packages
  let filteredPackages = packages;
  if (selectedCategory !== 'all') {
    filteredPackages = filteredPackages.filter(p => p.category === selectedCategory);
  }

  // Group packages by category
  const grouped: Record<PackageCategory, Package[]> = {
    pivot: packages.filter(p => p.category === 'pivot'),
    ui: packages.filter(p => p.category === 'ui'),
    'style-parser': packages.filter(p => p.category === 'style-parser'),
    'data-parser': packages.filter(p => p.category === 'data-parser'),
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
                { label: 'Pivot Style', value: 'pivot' },
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
          <Col xs={24} sm={12} lg={6}>
            <Statistic title="Total Packages" value={packages.length} />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Statistic title="Style Parsers" value={grouped['style-parser'].length} />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Statistic title="Data Parsers" value={grouped['data-parser'].length} />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Statistic title="UI Components" value={grouped['ui'].length} />
          </Col>
        </Row>
      </Card>

      {/* Package Lists by Category */}
      {Object.entries(grouped).map(([category, pkgs]) => (
        <Card
          key={category}
          title={category.charAt(0).toUpperCase() + category.slice(1).replace('-', ' ')}
        >
          <PackageList packages={pkgs} esmFilter={esmFilter} />
        </Card>
      ))}
    </Space>
  );
}

function PackageList({ packages, esmFilter }: { packages: Package[]; esmFilter: string }) {
  const columns = [
    {
      title: 'Package',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Link to="/package/$name" params={{ name: text }}>{text}</Link>,
    },
    {
      title: 'Format',
      dataIndex: 'format',
      key: 'format',
      render: (format: string | undefined) => format ? <Tag>{format}</Tag> : '—',
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
      render: (_: any, record: Package) => record.versions.length,
    },
    {
      title: 'Module System',
      key: 'moduleSystem',
      render: (_: any, record: Package) => {
        const latestVersionData = record.versions.find(v => v.version === record.latestVersion);
        const isESM = latestVersionData?.esmSupport || false;
        return <Tag color={isESM ? 'green' : 'cyan'}>{isESM ? 'ESM' : 'CJS'}</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Package) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<GithubOutlined />}
            onClick={() => window.open(record.repositoryUrl, '_blank')}
          >
            GitHub
          </Button>
          <Button
            type="link"
            size="small"
            icon={<LinkOutlined />}
            onClick={() => window.open(`https://www.npmjs.com/package/${record.name}`, '_blank')}
          >
            npm
          </Button>
        </Space>
      ),
    },
  ];

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
