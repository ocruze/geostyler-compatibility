import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { usePackages, useCompatibilityCheck } from '@/api/queries';
import { useState } from 'react';
import { intersectRanges } from '@/utils/semver';
import { Card, Select, Space, Tag, Table, Alert, Empty } from 'antd';

type CompareSearch = {
  packages?: string;
};

export const Route = createFileRoute('/compare')({
  component: Compare,
  validateSearch: (search: Record<string, unknown>): CompareSearch => {
    return {
      packages: (search.packages as string) || undefined,
    };
  },
} as any);

function Compare() {
  const searchParams = Route.useSearch() as CompareSearch;
  const navigate = useNavigate();
  const { data: allPackages, isLoading } = usePackages();
  
  const [selectedPackages, setSelectedPackages] = useState<string[]>(
    searchParams.packages ? searchParams.packages.split(',') : []
  );

  if (isLoading) {
    return <Card loading />;
  }

  if (!allPackages) {
    return <Card>No packages available</Card>;
  }

  const handleAddPackage = (packageId: string) => {
    if (!selectedPackages.includes(packageId)) {
      const updated = [...selectedPackages, packageId];
      setSelectedPackages(updated);
      navigate({
        search: { packages: updated.join(',') } as any,
      });
    }
  };

  const handleRemovePackage = (packageId: string) => {
    const updated = selectedPackages.filter(p => p !== packageId);
    setSelectedPackages(updated);
    navigate({
      search: (updated.length > 0 ? { packages: updated.join(',') } : {}) as any,
    });
  };

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <Card title="Compare Package Compatibility">
        <p style={{ marginBottom: '1rem' }}>
          Select packages to check their compatibility with each other.
        </p>

        {/* Package Selector */}
        <Space style={{ marginBottom: '1.5rem', display: 'flex' }}>
          <label style={{ fontWeight: 500 }}>Add Package:</label>
          <Select
            placeholder="Select a package..."
            onChange={(value) => {
              if (value) {
                handleAddPackage(value);
              }
            }}
            style={{ minWidth: 300 }}
            allowClear
            options={allPackages.map(pkg => {
              const latestVersion = `${pkg.name}@${pkg.latestVersion}`;
              const isSelected = selectedPackages.includes(latestVersion);
              return {
                label: `${pkg.name} @${pkg.latestVersion} ${pkg.format ? `(${pkg.format})` : ''}`,
                value: latestVersion,
                disabled: isSelected,
              };
            })}
          />
        </Space>

        {/* Selected Packages */}
        {selectedPackages.length > 0 && (
          <div>
            <p style={{ marginBottom: '0.5rem', fontWeight: 500 }}>Selected Packages:</p>
            <Space wrap>
              {selectedPackages.map(pkgId => {
                const [name] = pkgId.split('@').slice(0, -1);
                return (
                  <Tag
                    key={pkgId}
                    closable
                    onClose={() => handleRemovePackage(pkgId)}
                    color="blue"
                  >
                    <Link to="/package/$name" params={{ name }} style={{ color: 'inherit' }}>
                      {pkgId}
                    </Link>
                  </Tag>
                );
              })}
            </Space>
          </div>
        )}
      </Card>

      {/* Compatibility Results */}
      {selectedPackages.length >= 2 && (
        <CompatibilityResults packageIds={selectedPackages} allPackages={allPackages} />
      )}

      {selectedPackages.length < 2 && (
        <Card>
          <Empty 
            description="Select at least 2 packages to see compatibility analysis"
          />
        </Card>
      )}
    </Space>
  );
}

function CompatibilityResults({ 
  packageIds, 
  allPackages 
}: { 
  packageIds: string[];
  allPackages: any[];
}) {
  const { data: check } = useCompatibilityCheck(packageIds);

  // Parse package IDs to get version info
  const packageVersions = packageIds.map(id => {
    const lastAtIndex = id.lastIndexOf('@');
    const name = id.slice(0, lastAtIndex);
    const version = id.slice(lastAtIndex + 1);
    const pkg = allPackages.find(p => p.name === name);
    const versionData = pkg?.versions.find((v: any) => v.version === version);
    return { name, version, data: versionData };
  }).filter(p => p.data);

  // Compute geostyler-style intersection
  const geostylerStyleRanges = packageVersions
    .map(p => p.data?.geostylerStyleRange)
    .filter((r): r is string => !!r);
  
  const sharedRange = geostylerStyleRanges.length > 0 
    ? intersectRanges(geostylerStyleRanges)
    : null;

  // Check ESM compatibility
  const esmSupport = packageVersions.map(p => p.data?.esmSupport);
  const mixedESM = esmSupport.some(e => e === true) && esmSupport.some(e => e === false);

  const hasErrors = !sharedRange || mixedESM;

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <Card title="Compatibility Analysis">
        {/* Overall Status */}
        <Alert
          message={hasErrors ? '✗ Incompatible' : '✓ Compatible'}
          description={
            hasErrors 
              ? 'These packages have compatibility conflicts'
              : 'These packages can be used together'
          }
          type={hasErrors ? 'error' : 'success'}
          showIcon
          style={{ marginBottom: '1.5rem' }}
        />

        {/* geostyler-style Compatibility */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ marginBottom: '1rem' }}>geostyler-style Compatibility</h4>
          <Table
            columns={[
              {
                title: 'Package',
                dataIndex: 'name',
                key: 'name',
                render: (name: string) => <code>{name}</code>,
              },
              {
                title: 'Required geostyler-style',
                dataIndex: 'range',
                key: 'range',
                render: (range: string) => <code>{range}</code>,
              },
            ]}
            dataSource={packageVersions.map(p => ({
              key: p.name,
              name: `${p.name}@${p.version}`,
              range: p.data?.geostylerStyleRange || '—',
            }))}
            pagination={false}
          />
          
          <Alert
            message={`Shared Range: ${sharedRange || 'No overlapping versions'}`}
            type={sharedRange ? 'success' : 'error'}
            style={{ marginTop: '1rem' }}
            showIcon
          />
        </div>

        {/* ESM/CJS Compatibility */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ marginBottom: '1rem' }}>Module System</h4>
          <Table
            columns={[
              {
                title: 'Package',
                dataIndex: 'name',
                key: 'name',
                render: (name: string) => <code>{name}</code>,
              },
              {
                title: 'Module System',
                dataIndex: 'esm',
                key: 'esm',
                render: (isESM: boolean) => (
                  <Tag color={isESM ? 'green' : 'cyan'}>
                    {isESM ? 'ESM' : 'CJS'}
                  </Tag>
                ),
              },
            ]}
            dataSource={packageVersions.map(p => ({
              key: p.name,
              name: `${p.name}@${p.version}`,
              esm: p.data?.esmSupport || false,
            }))}
            pagination={false}
          />
          
          {mixedESM && (
            <Alert
              message="⚠ Warning: Mixed ESM and CJS"
              description="Mixed ESM and CJS packages may cause bundling issues"
              type="warning"
              style={{ marginTop: '1rem' }}
              showIcon
            />
          )}
        </div>

        {/* Conflicts from pre-computed check */}
        {check?.conflicts && check.conflicts.length > 0 && (
          <div>
            <h4 style={{ marginBottom: '1rem' }}>Detected Conflicts</h4>
            <Space orientation="vertical" style={{ width: '100%' }}>
              {check.conflicts.map((conflict, idx) => (
                <Alert
                  key={idx}
                  message={conflict.reason}
                  description={conflict.message}
                  type={conflict.severity === 'error' ? 'error' : 'warning'}
                  showIcon
                />
              ))}
            </Space>
          </div>
        )}

        {/* Recommendations */}
        {check?.recommendations && check.recommendations.length > 0 && (
          <div style={{ marginTop: '1.5rem' }}>
            <h4 style={{ marginBottom: '1rem' }}>Recommendations</h4>
            <Space orientation="vertical">
              {check.recommendations.map((rec, idx) => (
                <span key={idx}>• {rec}</span>
              ))}
            </Space>
          </div>
        )}
      </Card>
    </Space>
  );
}
