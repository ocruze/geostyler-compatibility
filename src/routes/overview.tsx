import { GithubOutlined, LinkOutlined } from '@ant-design/icons';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Alert, Button, Card, Col, Flex, Row, Space, Spin, Statistic, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect } from 'react';

import { useCompatibilityMatrix, usePackages } from '@/api/queries';
import type { Package, PackageCategory } from '@/types/compatibility';

const { Text } = Typography;

type CategoryFilter = PackageCategory | 'all';
type EsmFilter = 'all' | 'esm' | 'cjs';

type OverviewSearch = {
  category?: CategoryFilter;
  module?: EsmFilter;
};

const CATEGORY_VALUES: CategoryFilter[] = ['all', 'core', 'ui', 'style-parser', 'data-parser'];
const MODULE_VALUES: EsmFilter[] = ['all', 'esm', 'cjs'];

// Section order and labels shared by the stats row and the category tables,
// so both always agree (single source of truth).
const CATEGORY_SECTIONS: { category: PackageCategory; label: string }[] = [
  { category: 'core', label: 'Core' },
  { category: 'ui', label: 'UI Components' },
  { category: 'style-parser', label: 'Style Parsers' },
  { category: 'data-parser', label: 'Data Parsers' },
];

export const Route = createFileRoute('/overview')({
  component: Overview,
  validateSearch: (search: Record<string, unknown>): OverviewSearch => ({
    category: CATEGORY_VALUES.includes(search.category as CategoryFilter)
      ? (search.category as CategoryFilter)
      : undefined,
    module: MODULE_VALUES.includes(search.module as EsmFilter)
      ? (search.module as EsmFilter)
      : undefined,
  }),
});

function Overview() {
  const { data: packages, isLoading: packagesLoading, error: packagesError } = usePackages();
  const { data: matrix, isLoading: matrixLoading, error: matrixError } = useCompatibilityMatrix();
  const { category, module } = Route.useSearch();  
  const selectedCategory: CategoryFilter = category ?? 'all';
  const esmFilter: EsmFilter = module ?? 'all';

  useEffect(() => {
    document.title = 'Overview · GeoStyler Compatibility';
  }, []);  

  if (packagesLoading || matrixLoading) {
    return <Spin size="large" className="centered-spin" />;
  }

  if (packagesError || matrixError) {
    return (
      <Alert
        type="error"
        showIcon
        title="Error Loading Data"
        description={packagesError?.message || matrixError?.message || 'Unknown error'}
      />
    );
  }

  if (!packages || !matrix) {
    return <Card>No data available</Card>;
  }
  const isFiltered = selectedCategory !== 'all' || esmFilter !== 'all';

  return (
    <Flex vertical gap="large">
      <Card title="Package Overview">
        <Flex vertical gap="middle">
          {/* Statistics — computed from the filtered set so they match the tables */}
          <Row gutter={[16, 16]}>
            <Col xs={12} sm={8} md={4}>
              <Statistic title={isFiltered ? 'Matching Packages' : 'Total Packages'} value={packages.length} />
            </Col>
            {CATEGORY_SECTIONS.map(({ category: cat, label }) => (
              <Col xs={12} sm={8} md={4} key={cat}>
                <Statistic title={label} value={packages.filter((p) => p.category === cat).length} />
              </Col>
            ))}
          </Row>

          <Text type="secondary">
            Last updated: {new Date(matrix.generated).toLocaleString()}
          </Text>
        </Flex>
      </Card>

      {/* Package Lists by Category */}
      {CATEGORY_SECTIONS.map(({ category: cat, label }) => {
        const pkgs = packages.filter((p) => p.category === cat);
        if (pkgs.length === 0) return null;
        return (
          <Card key={cat} title={label}>
            <PackageList packages={pkgs} />
          </Card>
        );
      })}
    </Flex>
  );
}

function PackageList({ packages }: { packages: Package[] }) {
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

  return (
    <Table
      columns={columns}
      dataSource={packages}
      rowKey="name"
      pagination={{ pageSize: 10, hideOnSinglePage: true }}
      scroll={{ x: 'max-content' }}
    />
  );
}
