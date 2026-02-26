import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { usePackages, useCompatibilityCheck, getVersionCompatibilityMatrix } from '@/api/queries';
import { useState } from 'react';
import { intersectRanges } from '@/utils/semver';
import { Card, Select, Space, Tag, Table, Alert, Empty, Tooltip, Badge, Modal, Collapse, Button } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined, } from '@ant-design/icons';

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
            onSelect={(value) => {
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
          <Button icon={<CloseCircleOutlined />} onClick={()=>setSelectedPackages([])} />
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
  const [selectedCell, setSelectedCell] = useState<{ v1: string; v2: string } | null>(null);

  // Get version compatibility matrix
  const matrixData = getVersionCompatibilityMatrix(packageIds, allPackages);

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
          title={hasErrors ? '✗ Incompatible' : '✓ Compatible'}
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
            title={`Shared Range: ${sharedRange || 'No overlapping versions'}`}
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
              title="⚠ Warning: Mixed ESM and CJS"
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
                  title={conflict.reason}
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

      {/* Version Compatibility Matrix */}
      {matrixData && packageIds.length === 2 && (
        <VersionCompatibilityMatrixCard 
          matrixData={matrixData}
          selectedCell={selectedCell}
          onSelectCell={setSelectedCell}
        />
      )}
    </Space>
  );
}

interface VersionCompatibilityMatrixCardProps {
  matrixData: any;
  selectedCell: { v1: string; v2: string } | null;
  onSelectCell: (cell: { v1: string; v2: string } | null) => void;
}

function VersionCompatibilityMatrixCard({ 
  matrixData, 
  selectedCell,
  onSelectCell
}: VersionCompatibilityMatrixCardProps) {
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Find recommended version pair (latest compatible)
  let recommendedPair: { v1: string; v2: string } | null = null;
  for (const v1 of matrixData.pkg1Versions) {
    for (const v2 of matrixData.pkg2Versions) {
      const compat = matrixData.matrix[v1.version][v2.version];
      if (compat.compatible && !recommendedPair) {
        recommendedPair = { v1: v1.version, v2: v2.version };
        break;
      }
    }
    if (recommendedPair) break;
  }

  // Build matrix table columns
  const columns = [
    {
      title: `${matrixData.pkg1Name}`,
      dataIndex: 'version',
      key: 'version',
      width: 120,
      fixed: 'left' as const,
      render: (version: string) => <code>{version}</code>,
    },
    ...matrixData.pkg2Versions.map((v: any) => ({
      title: <code style={{ fontSize: '12px' }}>{v.version}</code>,
      dataIndex: `v_${v.version}`,
      key: `v_${v.version}`,
      width: 80,
      render: (_: any, record: any) => {
        const compat = matrixData.matrix[record.version][v.version];
        const isRecommended = recommendedPair && 
          recommendedPair.v1 === record.version && 
          recommendedPair.v2 === v.version;
        
        return (
          <Tooltip 
            title={compat.reason || (compat.compatible ? 'Compatible' : 'Incompatible')}
          >
            <div
              onClick={() => {
                onSelectCell({ v1: record.version, v2: v.version });
                setDetailModalOpen(true);
              }}
              style={{
                backgroundColor: compat.compatible ? '#f6ffed' : '#fef2f0',
                border: `2px solid ${compat.compatible ? '#91d5ff' : '#ffccc7'}`,
                borderRadius: '4px',
                padding: '4px',
                textAlign: 'center',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              {isRecommended && (
                <Badge 
                  count="★" 
                  style={{ 
                    backgroundColor: '#faad14',
                    color: '#fff',
                    fontSize: '10px',
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                  }} 
                />
              )}
              {compat.compatible ? (
                <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '14px' }} />
              ) : compat.warnings.length > 0 ? (
                <ExclamationCircleOutlined style={{ color: '#faad14', fontSize: '14px' }} />
              ) : (
                <CloseCircleOutlined style={{ color: '#f5222d', fontSize: '14px' }} />
              )}
            </div>
          </Tooltip>
        );
      },
    })),
  ];

  // Build matrix data
  const matrixDataSource = matrixData.pkg1Versions.map((v1: any) => {
    const row: any = { version: v1.version };
    for (const v2 of matrixData.pkg2Versions) {
      row[`v_${v2.version}`] = null; // Actual display is in render
    }
    return row;
  });

  // Build legend
  const legendItems = [
    {
      key: 'compatible',
      label: '✓ Compatible versions',
      children: <p>Both packages can be used together with these versions.</p>,
    },
    {
      key: 'warning',
      label: '⚠ Has warnings',
      children: <p>Packages can work together but there may be issues (e.g., mixed ESM/CJS).</p>,
    },
    {
      key: 'incompatible',
      label: '✗ Incompatible versions',
      children: <p>These versions cannot be used together due to conflicting requirements.</p>,
    },
  ];

  return (
    <>
      <Card title="Version Compatibility Matrix">
        {recommendedPair && (
          <Alert
            title="★ Recommended Compatible Versions"
            description={`${matrixData.pkg1Name}@${recommendedPair.v1} + ${matrixData.pkg2Name}@${recommendedPair.v2}`}
            type="success"
            showIcon
            style={{ marginBottom: '1.5rem' }}
          />
        )}

        <p style={{ marginBottom: '1rem', fontSize: '12px', color: '#666' }}>
          Click any cell to see detailed compatibility information
        </p>

        <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
          <Table
            columns={columns}
            dataSource={matrixDataSource}
            pagination={false}
            size="small"
            bordered
            rowKey="version"
            scroll={{ x: true }}
          />
        </div>

        <Collapse items={legendItems} />
      </Card>

      {selectedCell && matrixData && (
        <DetailModal
          open={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          pkg1Name={matrixData.pkg1Name}
          pkg1Version={selectedCell.v1}
          pkg2Name={matrixData.pkg2Name}
          pkg2Version={selectedCell.v2}
          compat={matrixData.matrix[selectedCell.v1][selectedCell.v2]}
          pkg1Data={matrixData.pkg1Versions.find((v: any) => v.version === selectedCell.v1)}
          pkg2Data={matrixData.pkg2Versions.find((v: any) => v.version === selectedCell.v2)}
        />
      )}
    </>
  );
}

interface DetailModalProps {
  open: boolean;
  onClose: () => void;
  pkg1Name: string;
  pkg1Version: string;
  pkg2Name: string;
  pkg2Version: string;
  compat: any;
  pkg1Data: any;
  pkg2Data: any;
}

function DetailModal({
  open,
  onClose,
  pkg1Name,
  pkg1Version,
  pkg2Name,
  pkg2Version,
  compat,
  pkg1Data,
  pkg2Data,
}: DetailModalProps) {
  return (
    <Modal
      title={`${pkg1Name}@${pkg1Version} + ${pkg2Name}@${pkg2Version}`}
      open={open}
      onCancel={onClose}
      width={700}
      footer={null}
    >
      <Space orientation="vertical" style={{ width: '100%' }} size="large">
        {/* Compatibility Status */}
        <Alert
          title={compat.compatible ? '✓ Compatible' : '✗ Incompatible'}
          description={compat.reason || (compat.compatible ? 'These versions can be used together' : 'These versions have conflicts')}
          type={compat.compatible ? 'success' : 'error'}
          showIcon
        />

        {/* geostyler-style Requirements */}
        {pkg1Data?.geostylerStyleRange || pkg2Data?.geostylerStyleRange ? (
          <div>
            <h4>geostyler-style Requirements</h4>
            <Table
              columns={[
                { title: 'Package', dataIndex: 'name', key: 'name', render: (name: string) => <code>{name}</code> },
                { title: 'Required Range', dataIndex: 'range', key: 'range', render: (range: string) => <code>{range}</code> },
              ]}
              dataSource={[
                { key: 'pkg1', name: `${pkg1Name}@${pkg1Version}`, range: pkg1Data?.geostylerStyleRange || '—' },
                { key: 'pkg2', name: `${pkg2Name}@${pkg2Version}`, range: pkg2Data?.geostylerStyleRange || '—' },
              ]}
              pagination={false}
              size="small"
            />
            {compat.sharedRange && (
              <Alert 
                title={`✓ Overlapping Range: ${compat.sharedRange}`}
                type="success"
                style={{ marginTop: '0.5rem' }}
              />
            )}
          </div>
        ) : null}

        {/* Module System */}
        <div>
          <h4>Module System</h4>
          <Space>
            <Badge 
              color={pkg1Data?.esmSupport ? '#52c41a' : '#096dd9'} 
              text={`${pkg1Name}@${pkg1Version}: ${pkg1Data?.esmSupport ? 'ESM' : 'CJS'}`}
            />
            <Badge 
              color={pkg2Data?.esmSupport ? '#52c41a' : '#096dd9'} 
              text={`${pkg2Name}@${pkg2Version}: ${pkg2Data?.esmSupport ? 'ESM' : 'CJS'}`}
            />
          </Space>
        </div>

        {/* Warnings */}
        {compat.warnings.length > 0 && (
          <div>
            <h4>Warnings</h4>
            <Space orientation="vertical">
              {compat.warnings.map((warning: string, idx: number) => (
                <Alert key={idx} title={warning} type="warning" showIcon />
              ))}
            </Space>
          </div>
        )}
      </Space>
    </Modal>
  );
}
