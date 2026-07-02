import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  usePackages,
  useCompatibilityCheck,
  getVersionCompatibilityMatrix,
  checkVersionCompatibility,
  findRecommendedSet,
  type VersionCompatibilityMatrixData,
  type VersionCompatibilityResult,
} from '@/api/queries';
import { useEffect, useState } from 'react';
import { intersectRanges, formatRangeForDisplay } from '@/utils/semver';
import type { Package, PackageVersion } from '@/types/compatibility';
import {
  App,
  Card,
  Select,
  Space,
  Tag,
  Table,
  Alert,
  Empty,
  Tooltip,
  Badge,
  Modal,
  Collapse,
  Button,
  Switch,
  Result,
  Flex,
  Typography,
  theme,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  CopyOutlined,
} from '@ant-design/icons';

const { Text, Title } = Typography;

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
});

/** One entry per id in ?packages=, resolved against the dataset. */
interface SelectedEntry {
  id: string;
  name: string;
  version: string;
  data: PackageVersion | undefined;
}

function parsePackageId(id: string): { name: string; version: string } {
  const lastAtIndex = id.lastIndexOf('@');
  return { name: id.slice(0, lastAtIndex), version: id.slice(lastAtIndex + 1) };
}

function Compare() {
  const searchParams = Route.useSearch() as CompareSearch;
  const navigate = useNavigate({ from: Route.fullPath });
  const { data: allPackages, isLoading } = usePackages();

  // Selection lives in the URL (single source of truth): back/forward and
  // shared links always reflect exactly what is shown.
  const selectedPackages = searchParams.packages ? searchParams.packages.split(',') : [];

  useEffect(() => {
    document.title = 'Compare · GeoStyler Compatibility';
  }, []);

  if (isLoading) {
    return <Card loading />;
  }

  if (!allPackages) {
    return <Card>No packages available</Card>;
  }

  const setSelection = (ids: string[]) => {
    navigate({
      search: (ids.length > 0 ? { packages: ids.join(',') } : {}) satisfies CompareSearch,
    });
  };

  const handleAddPackage = (packageId: string) => {
    if (!selectedPackages.includes(packageId)) {
      setSelection([...selectedPackages, packageId]);
    }
  };

  const handleRemovePackage = (packageId: string) => {
    setSelection(selectedPackages.filter((p) => p !== packageId));
  };

  // Resolve every selected id against the dataset; ids may go stale when a
  // package/version leaves the tracked set, and shared URLs can contain typos.
  const entries: SelectedEntry[] = selectedPackages.map((id) => {
    const { name, version } = parsePackageId(id);
    const pkg = allPackages.find((p) => p.name === name);
    const data = pkg?.versions.find((v) => v.version === version);
    return { id, name, version, data };
  });
  const knownEntries = entries.filter((e) => e.data);
  const unknownEntries = entries.filter((e) => !e.data);

  return (
    <Flex vertical gap="large">
      <Card title="Compare Package Compatibility">
        <Flex vertical gap="middle">
          <Text>Select packages to check their compatibility with each other.</Text>

          {/* Package Selector */}
          <Flex gap="small" align="center" wrap className="package-select-row">
            <label htmlFor="compare-package-select">
              <Text strong>Add Package:</Text>
            </label>
            <Select
              id="compare-package-select"
              placeholder="Select a package…"
              onSelect={(value) => {
                if (value) {
                  handleAddPackage(value);
                }
              }}
              className="package-select"
              popupMatchSelectWidth={false}
              showSearch={{ optionFilterProp: 'label' }}
              options={allPackages.map((pkg) => {
                const latestVersion = `${pkg.name}@${pkg.latestVersion}`;
                const isSelected = selectedPackages.includes(latestVersion);
                return {
                  label: `${pkg.name}@${pkg.latestVersion}${pkg.format ? ` (${pkg.format})` : ''}`,
                  value: latestVersion,
                  disabled: isSelected,
                };
              })}
            />
            {selectedPackages.length > 0 && (
              <Button icon={<CloseCircleOutlined />} onClick={() => setSelection([])}>
                Clear All
              </Button>
            )}
          </Flex>

          {/* Selected Packages */}
          {entries.length > 0 && (
            <Flex vertical gap="small" align="flex-start">
              <Text strong>Selected Packages:</Text>
              <div>
                <Space wrap>
                  {entries.map((entry) => (
                    <Tag
                      key={entry.id}
                      closable
                      onClose={() => handleRemovePackage(entry.id)}
                      color={entry.data ? 'blue' : 'red'}
                    >
                      {entry.data ? (
                        <Link to="/package/$name" params={{ name: entry.name }} className="tag-link">
                          {entry.id}
                        </Link>
                      ) : (
                        <Tooltip title="Not found in the compatibility database">
                          {entry.id} (not found)
                        </Tooltip>
                      )}
                    </Tag>
                  ))}
                </Space>
              </div>
            </Flex>
          )}
        </Flex>
      </Card>

      {/* Unknown-package warning: never let a stale link produce a silent verdict */}
      {unknownEntries.length > 0 && (
        <Alert
          type="warning"
          showIcon
          title={`${unknownEntries.length} of ${entries.length} selected ${entries.length === 1 ? 'package' : 'packages'} couldn't be found`}
          description={`Not in the compatibility database: ${unknownEntries.map((e) => e.id).join(', ')}. ${
            knownEntries.length >= 2
              ? 'The analysis below covers only the packages that were found.'
              : 'Select at least 2 known packages to see a compatibility analysis.'
          }`}
        />
      )}

      {/* Compatibility Results */}
      {knownEntries.length >= 2 && (
        <CompatibilityResults entries={knownEntries} allPackages={allPackages} />
      )}

      {knownEntries.length < 2 && unknownEntries.length === 0 && (
        <Card>
          <Empty description="Select at least 2 packages to see compatibility analysis" />
        </Card>
      )}
    </Flex>
  );
}

function CompatibilityResults({
  entries,
  allPackages,
}: {
  entries: SelectedEntry[];
  allPackages: Package[];
}) {
  const packageIds = entries.map((e) => e.id);
  const { data: check } = useCompatibilityCheck(packageIds);
  const [selectedCell, setSelectedCell] = useState<{ v1: string; v2: string } | null>(null);

  // Get version compatibility matrix (pairs only)
  const matrixData = getVersionCompatibilityMatrix(packageIds, allPackages);

  const packageVersions = entries as (SelectedEntry & { data: PackageVersion })[];

  // Compute geostyler-style intersection
  const geostylerStyleRanges = packageVersions
    .map((p) => p.data.geostylerStyleRange)
    .filter((r): r is string => !!r);

  const sharedRange = geostylerStyleRanges.length > 0
    ? intersectRanges(geostylerStyleRanges)
    : null;

  // Check ESM compatibility
  const esmSupport = packageVersions.map((p) => p.data.esmSupport);
  const mixedESM = esmSupport.some((e) => e === true) && esmSupport.some((e) => e === false);

  const hasErrors = (geostylerStyleRanges.length > 0 && !sharedRange) || mixedESM;
  const selectedLabel = packageVersions.map((p) => p.id).join(' + ');

  return (
    <Flex vertical gap="large">
      <Card title="Compatibility Analysis">
        <Flex vertical gap="large">
          {/* Overall Status — scoped to the versions actually selected */}
          <Alert
            title={hasErrors ? 'Selected versions are incompatible' : 'Selected versions are compatible'}
            description={
              hasErrors
                ? `${selectedLabel} cannot be used together. Other version combinations may be compatible — see the recommendation and matrix below.`
                : `${selectedLabel} can be used together.`
            }
            type={hasErrors ? 'error' : 'success'}
            showIcon
          />

          {/* geostyler-style Compatibility */}
          <Flex vertical gap="small">
            <Title level={4}>geostyler-style Compatibility</Title>
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
              dataSource={packageVersions.map((p) => ({
                key: p.name,
                name: p.id,
                range: p.data.geostylerStyleRange || '—',
              }))}
              pagination={false}
              scroll={{ x: 'max-content' }}
            />

            <Alert
              title={
                sharedRange
                  ? `Shared Range: ${formatRangeForDisplay(sharedRange)}`
                  : 'Shared Range: No overlapping versions'
              }
              type={sharedRange ? 'success' : 'error'}
              showIcon
            />
          </Flex>

          {/* ESM/CJS Compatibility */}
          <Flex vertical gap="small">
            <Title level={4}>Module System</Title>
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
              dataSource={packageVersions.map((p) => ({
                key: p.name,
                name: p.id,
                esm: p.data.esmSupport || false,
              }))}
              pagination={false}
              scroll={{ x: 'max-content' }}
            />

            {mixedESM && (
              <Alert
                title="Warning: Mixed ESM and CJS"
                description="Mixed ESM and CJS packages may cause bundling issues"
                type="warning"
                showIcon
              />
            )}
          </Flex>

          {/* Conflicts from pre-computed check */}
          {check?.conflicts && check.conflicts.length > 0 && (
            <div>
              <Title level={4}>Detected Conflicts</Title>
              <Flex vertical gap="small">
                {check.conflicts.map((conflict, idx) => (
                  <Alert
                    key={idx}
                    title={conflict.reason}
                    description={conflict.message}
                    type={conflict.severity === 'error' ? 'error' : 'warning'}
                    showIcon
                  />
                ))}
              </Flex>
            </div>
          )}

          {/* Recommendations */}
          {check?.recommendations && check.recommendations.length > 0 && (
            <div>
              <Title level={4}>Recommendations</Title>
              <ul>
                {check.recommendations.map((rec, idx) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </Flex>
      </Card>

      {/* 3+ packages: pairwise grid + recommended set */}
      {packageVersions.length >= 3 && (
        <PairwiseGridCard entries={packageVersions} allPackages={allPackages} />
      )}

      {/* Exactly 2 packages: deep version-by-version matrix */}
      {matrixData && packageVersions.length === 2 && (
        <VersionCompatibilityMatrixCard
          matrixData={matrixData}
          selectedCell={selectedCell}
          onSelectCell={setSelectedCell}
        />
      )}
    </Flex>
  );
}

/**
 * Shared visual language for compatibility cells (used by both the pairwise
 * grid and the version matrix).
 */
function CompatCell({
  compat,
  label,
  onActivate,
  badge,
}: {
  compat: VersionCompatibilityResult;
  label: string;
  onActivate: () => void;
  badge?: boolean;
}) {
  const { token } = theme.useToken();

  return (
    <Tooltip title={compat.reason || (compat.compatible ? 'Compatible' : 'Incompatible')}>
      <div
        role="button"
        tabIndex={0}
        aria-label={label}
        onClick={onActivate}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onActivate();
          }
        }}
        style={{
          backgroundColor: compat.compatible ? token.colorSuccessBg : token.colorErrorBg,
          border: `2px solid ${compat.compatible ? token.colorSuccessBorder : token.colorErrorBorder}`,
          borderRadius: token.borderRadiusSM,
          padding: 4,
          textAlign: 'center',
          cursor: 'pointer',
          position: 'relative',
        }}
      >
        {badge && (
          <Badge
            count="★"
            style={{
              backgroundColor: token.colorWarning,
              color: '#fff',
              fontSize: 10,
              position: 'absolute',
              top: -4,
              right: -4,
            }}
          />
        )}
        {compat.compatible ? (
          compat.warnings.length > 0 ? (
            <ExclamationCircleOutlined style={{ color: token.colorWarning, fontSize: 14 }} />
          ) : (
            <CheckCircleOutlined style={{ color: token.colorSuccess, fontSize: 14 }} />
          )
        ) : (
          <CloseCircleOutlined style={{ color: token.colorError, fontSize: 14 }} />
        )}
      </div>
    </Tooltip>
  );
}

/**
 * N-package view: which pair breaks the stack, at a glance — plus the newest
 * mutually-compatible version set with a copyable install command.
 */
function PairwiseGridCard({
  entries,
  allPackages,
}: {
  entries: (SelectedEntry & { data: PackageVersion })[];
  allPackages: Package[];
}) {
  const navigate = useNavigate({ from: Route.fullPath });

  const drillDown = (a: SelectedEntry, b: SelectedEntry) => {
    navigate({
      search: { packages: `${a.id},${b.id}` } satisfies CompareSearch,
    });
  };

  const columns = [
    {
      title: '',
      dataIndex: 'rowLabel',
      key: 'rowLabel',
      fixed: 'left' as const,
      render: (label: string) => <code>{label}</code>,
    },
    ...entries.map((col, colIdx) => ({
      title: <code className="cell-code">{col.id}</code>,
      key: col.id,
      width: 90,
      render: (_: unknown, __: unknown, rowIdx: number) => {
        if (rowIdx === colIdx) {
          return <Text type="secondary">—</Text>;
        }
        const row = entries[rowIdx];
        const compat = checkVersionCompatibility(row.data, col.data);
        const verdict = compat.compatible
          ? compat.warnings.length > 0
            ? 'compatible with warnings'
            : 'compatible'
          : 'incompatible';
        return (
          <CompatCell
            compat={compat}
            label={`${row.id} and ${col.id}: ${verdict}. Open the version matrix for this pair.`}
            onActivate={() => drillDown(row, col)}
          />
        );
      },
    })),
  ];

  const dataSource = entries.map((e) => ({ key: e.id, rowLabel: e.id }));

  return (
    <Card title="Pairwise Compatibility">
      <Flex vertical gap="middle">
        <RecommendedSetBanner entries={entries} allPackages={allPackages} />
        <Text type="secondary">
          Each cell compares one pair at the selected versions. Click a cell to open the
          full version-by-version matrix for that pair.
        </Text>
        <Table
          columns={columns}
          dataSource={dataSource}
          pagination={false}
          size="small"
          bordered
          scroll={{ x: 'max-content' }}
        />
      </Flex>
    </Card>
  );
}

function RecommendedSetBanner({
  entries,
  allPackages,
}: {
  entries: (SelectedEntry & { data: PackageVersion })[];
  allPackages: Package[];
}) {
  const { message } = App.useApp();
  const recommended = findRecommendedSet(entries.map((e) => e.name), allPackages);

  if (!recommended) {
    return (
      <Alert
        type="warning"
        showIcon
        title="No mutually compatible version set found"
        description="No combination of tracked versions of these packages is fully compatible."
      />
    );
  }

  const installCommand = `npm install ${recommended.versions
    .map((v) => `${v.name}@${v.version}`)
    .join(' ')}`;

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(installCommand);
      message.success('Install command copied');
    } catch {
      message.error('Could not copy to clipboard');
    }
  };

  return (
    <Alert
      type="success"
      showIcon
      title={`★ Recommended compatible set: ${recommended.versions
        .map((v) => `${v.name}@${v.version}`)
        .join(' + ')}`}
      description={
        <Flex vertical gap="small" align="flex-start">
          {recommended.warnings.map((w, idx) => (
            <Text key={idx} type="warning">
              ⚠ {w}
            </Text>
          ))}
          <Flex gap="small" align="center" wrap>
            <Text code>{installCommand}</Text>
            <Button size="small" icon={<CopyOutlined />} onClick={copyCommand}>
              Copy
            </Button>
          </Flex>
        </Flex>
      }
    />
  );
}

interface VersionCompatibilityMatrixCardProps {
  matrixData: VersionCompatibilityMatrixData;
  selectedCell: { v1: string; v2: string } | null;
  onSelectCell: (cell: { v1: string; v2: string } | null) => void;
}

function VersionCompatibilityMatrixCard({
  matrixData,
  selectedCell,
  onSelectCell,
}: VersionCompatibilityMatrixCardProps) {
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [problemsOnly, setProblemsOnly] = useState(true);

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

  // A cell is a "problem" if it's incompatible or carries warnings.
  const isProblemCell = (compat: { compatible: boolean; warnings: string[] }) =>
    !compat.compatible || compat.warnings.length > 0;

  // Only keep rows/columns that participate in at least one problem cell,
  // so a "problems only" row/column never shows an all-clear cell with nothing to see.
  const pkg1VersionsWithProblems = matrixData.pkg1Versions.filter((v1: PackageVersion) =>
    matrixData.pkg2Versions.some((v2: PackageVersion) => isProblemCell(matrixData.matrix[v1.version][v2.version]))
  );
  const pkg2VersionsWithProblems = matrixData.pkg2Versions.filter((v2: PackageVersion) =>
    matrixData.pkg1Versions.some((v1: PackageVersion) => isProblemCell(matrixData.matrix[v1.version][v2.version]))
  );

  const hasAnyProblems = pkg1VersionsWithProblems.length > 0 && pkg2VersionsWithProblems.length > 0;

  const visiblePkg1Versions = problemsOnly ? pkg1VersionsWithProblems : matrixData.pkg1Versions;
  const visiblePkg2Versions = problemsOnly ? pkg2VersionsWithProblems : matrixData.pkg2Versions;

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
    ...visiblePkg2Versions.map((v: PackageVersion) => ({
      title: <code className="cell-code">{v.version}</code>,
      dataIndex: `v_${v.version}`,
      key: `v_${v.version}`,
      width: 80,
      render: (_: unknown, record: { version: string }) => {
        const compat = matrixData.matrix[record.version][v.version];
        const isRecommended = recommendedPair &&
          recommendedPair.v1 === record.version &&
          recommendedPair.v2 === v.version;

        const verdict = compat.compatible
          ? (compat.warnings.length > 0 ? 'compatible with warnings' : 'compatible')
          : 'incompatible';

        return (
          <CompatCell
            compat={compat}
            label={`${matrixData.pkg1Name}@${record.version} and ${matrixData.pkg2Name}@${v.version}: ${verdict}. View details.`}
            onActivate={() => {
              onSelectCell({ v1: record.version, v2: v.version });
              setDetailModalOpen(true);
            }}
            badge={!!isRecommended}
          />
        );
      },
    })),
  ];

  // Build matrix data
  const matrixDataSource: ({ version: string } & Record<string, string | null>)[] =
    visiblePkg1Versions.map((v1: PackageVersion) => {
      const row: { version: string } & Record<string, string | null> = { version: v1.version };
      for (const v2 of visiblePkg2Versions) {
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

  const grid = (
    <Flex vertical gap="middle">
      <Table
        columns={columns}
        dataSource={matrixDataSource}
        pagination={false}
        size="small"
        bordered
        rowKey="version"
        scroll={{ x: 'max-content' }}
      />

      <Text type="secondary">
        Showing the 20 most recent versions of each package.
      </Text>

      <Collapse items={legendItems} />
    </Flex>
  );

  const fullGridPanel = {
    key: 'full-matrix',
    label: `Full version-by-version matrix (${matrixData.pkg1Versions.length}×${matrixData.pkg2Versions.length})`,
    children: grid,
  };

  return (
    <>
      <Card title="Version Compatibility Matrix">
        <Flex vertical gap="middle">
          {recommendedPair && (
            <Alert
              title="★ Recommended Compatible Versions"
              description={`${matrixData.pkg1Name}@${recommendedPair.v1} + ${matrixData.pkg2Name}@${recommendedPair.v2}`}
              type="success"
              showIcon
            />
          )}

          <Space>
            <Switch
              id="problems-only-switch"
              checked={problemsOnly}
              onChange={setProblemsOnly}
            />
            <label htmlFor="problems-only-switch">
              Only show versions with problems
            </label>
          </Space>

          <Text type="secondary">
            Click any cell to see detailed compatibility information
          </Text>

          {problemsOnly && !hasAnyProblems ? (
            <Result
              status="success"
              title="All checked version combinations are compatible."
              subTitle="No incompatible or warning-level version pairs were found among the 20 most recent versions of each package."
            />
          ) : problemsOnly ? (
            grid
          ) : (
            <Collapse defaultActiveKey={[]} items={[fullGridPanel]} />
          )}
        </Flex>
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
          pkg1Data={matrixData.pkg1Versions.find((v: PackageVersion) => v.version === selectedCell.v1)}
          pkg2Data={matrixData.pkg2Versions.find((v: PackageVersion) => v.version === selectedCell.v2)}
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
  compat: VersionCompatibilityResult;
  pkg1Data: PackageVersion | undefined;
  pkg2Data: PackageVersion | undefined;
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
  const { token } = theme.useToken();

  return (
    <Modal
      title={`${pkg1Name}@${pkg1Version} + ${pkg2Name}@${pkg2Version}`}
      open={open}
      onCancel={onClose}
      width={700}
      footer={null}
    >
      <Flex vertical gap="large">
        {/* Compatibility Status */}
        <Alert
          title={compat.compatible ? 'Compatible' : 'Incompatible'}
          description={compat.reason || (compat.compatible ? 'These versions can be used together' : 'These versions have conflicts')}
          type={compat.compatible ? 'success' : 'error'}
          showIcon
        />

        {/* geostyler-style Requirements */}
        {pkg1Data?.geostylerStyleRange || pkg2Data?.geostylerStyleRange ? (
          <Flex vertical gap="small">
            <Title level={4}>geostyler-style Requirements</Title>
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
              scroll={{ x: 'max-content' }}
            />
            {compat.sharedRange && (
              <Alert
                title={`Overlapping Range: ${formatRangeForDisplay(compat.sharedRange)}`}
                type="success"
              />
            )}
          </Flex>
        ) : null}

        {/* Module System */}
        <div>
          <Title level={4}>Module System</Title>
          <Space wrap>
            <Badge
              color={pkg1Data?.esmSupport ? token.colorSuccess : token.colorInfo}
              text={`${pkg1Name}@${pkg1Version}: ${pkg1Data?.esmSupport ? 'ESM' : 'CJS'}`}
            />
            <Badge
              color={pkg2Data?.esmSupport ? token.colorSuccess : token.colorInfo}
              text={`${pkg2Name}@${pkg2Version}: ${pkg2Data?.esmSupport ? 'ESM' : 'CJS'}`}
            />
          </Space>
        </div>

        {/* Warnings */}
        {compat.warnings.length > 0 && (
          <div>
            <Title level={4}>Warnings</Title>
            <Flex vertical gap="small">
              {compat.warnings.map((warning: string, idx: number) => (
                <Alert key={idx} title={warning} type="warning" showIcon />
              ))}
            </Flex>
          </div>
        )}
      </Flex>
    </Modal>
  );
}
