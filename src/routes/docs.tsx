import { createFileRoute } from '@tanstack/react-router';
import { useEffect } from 'react';
import { Card, Collapse, Space, Table, Alert, Badge, Divider } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';

export const Route = createFileRoute('/docs')({
  component: Docs,
});

function Docs() {
  useEffect(() => {
    document.title = 'Docs · GeoStyler Compatibility';
  }, []);

  const docItems = [
    {
      key: 'categories',
      label: '📦 Package Categories',
      children: (
        <Space orientation="vertical" style={{ width: '100%' }}>
          <p>All GeoStyler packages fall into one of four categories:</p>

          <div style={{ marginTop: '1rem' }}>
            <h4>🔗 Core Packages</h4>
            <p>
              Core data structures that all other packages depend on. These define the standard format for styles and data.
            </p>
            <Table
              columns={[
                { title: 'Package', dataIndex: 'name', key: 'name', render: (name: string) => <code>{name}</code> },
                { title: 'Purpose', dataIndex: 'purpose', key: 'purpose' },
              ]}
              dataSource={[
                { key: 'style', name: 'geostyler-style', purpose: 'Universal style format that all style parsers convert to/from' },
                { key: 'data', name: 'geostyler-data', purpose: 'Universal data feature format that all data parsers convert to/from' },
              ]}
              pagination={false}
              size="small"
            />
            <Alert 
              title="All style/data parsers depend on these core packages within specific version ranges"
              type="info"
              style={{ marginTop: '1rem' }}
            />
          </div>

          <Divider />

          <div>
            <h4>🎨 Style Parsers</h4>
            <p>Convert between geostyler-style and specific style format representations (SLD, Mapbox, QGIS, etc.).</p>
            <Alert 
              title="All require geostyler-style in specific version ranges"
              description="When combining style parsers, they must share compatible geostyler-style versions"
              type="info"
            />
            <p style={{ marginTop: '1rem' }}>
              <strong>Examples:</strong> geostyler-sld-parser, geostyler-mapbox-parser, geostyler-qgis-parser, geostyler-openlayers-parser, geostyler-cql-parser
            </p>
          </div>

          <Divider />

          <div>
            <h4>📊 Data Parsers</h4>
            <p>Convert between geostyler-data and specific data format representations (GeoJSON, WFS, Shapefile, CQL).</p>
            <Alert 
              title="All require geostyler-data"
              description="Data parsers are less tightly coupled than style parsers - each has independent geostyler-data dependency"
              type="info"
            />
            <p style={{ marginTop: '1rem' }}>
              <strong>Examples:</strong> geostyler-geojson-parser, geostyler-wfs-parser, geostyler-shapefile-parser, geostyler-cql-parser
            </p>
          </div>

          <Divider />

          <div>
            <h4>🎚️ UI Packages</h4>
            <p>React components for building GeoStyler user interfaces.</p>
            <p>
              <strong>Examples:</strong> geostyler (main UI components), geostyler-legend (legend display)
            </p>
          </div>
        </Space>
      ),
    },
    {
      key: 'compatibility',
      label: '🔄 How Compatibility is Determined',
      children: (
        <Space orientation="vertical" style={{ width: '100%' }}>
          <p>Package compatibility depends on several factors:</p>

          <div style={{ marginTop: '1rem' }}>
            <h4>1. geostyler-style Version Intersection</h4>
            <p>
              The primary factor for style parser compatibility. Each style parser specifies which versions of geostyler-style it supports.
            </p>
            <Alert 
              title="When combining multiple style parsers, they must have overlapping geostyler-style ranges"
              type="warning"
              showIcon
              style={{ marginBottom: '1rem' }}
            />
            <p>
              <strong>Example:</strong>
            </p>
            <Table
              columns={[
                { title: 'Package', dataIndex: 'pkg', key: 'pkg', render: (pkg: string) => <code>{pkg}</code> },
                { title: 'geostyler-style Range', dataIndex: 'range', key: 'range', render: (range: string) => <code>{range}</code> },
              ]}
              dataSource={[
                { key: 'sld', pkg: 'geostyler-sld-parser@8.3.0', range: '^11.0.0' },
                { key: 'mapbox', pkg: 'geostyler-mapbox-parser@7.1.0', range: '^11.0.0' },
              ]}
              pagination={false}
              size="small"
            />
            <p style={{ marginTop: '1rem' }}>
              ✓ <strong>Compatible:</strong> Both require ^11.0.0, so the shared range is ^11.0.0
            </p>

            <Table
              columns={[
                { title: 'Package', dataIndex: 'pkg', key: 'pkg', render: (pkg: string) => <code>{pkg}</code> },
                { title: 'geostyler-style Range', dataIndex: 'range', key: 'range', render: (range: string) => <code>{range}</code> },
              ]}
              dataSource={[
                { key: 'sld', pkg: 'geostyler-sld-parser@8.2.0', range: '^10.5.0' },
                { key: 'mapbox', pkg: 'geostyler-mapbox-parser@7.2.0', range: '^10.3.0' },
              ]}
              pagination={false}
              size="small"
              style={{ marginTop: '1rem' }}
            />
            <p style={{ marginTop: '1rem' }}>
              ✗ <strong>Incompatible:</strong> ^10.5.0 ∩ ^10.3.0 = ∅ (no overlapping versions)
            </p>
          </div>

          <Divider />

          <div>
            <h4>2. ESM vs CommonJS Module System</h4>
            <p>
              Modern packages (2024+) are ESM-only, while older versions support CommonJS (CJS). Mixing can cause bundling issues.
            </p>
            <Alert 
              title="⚠ Warning: Mixed ESM and CJS"
              description="If some packages are ESM and others are CJS, your build tool must support interop"
              type="warning"
              showIcon
            />
            <p style={{ marginTop: '1rem' }}>
              <strong>Example Versions:</strong>
            </p>
            <Table
              columns={[
                { title: 'Package', dataIndex: 'pkg', key: 'pkg', render: (pkg: string) => <code>{pkg}</code> },
                { 
                  title: 'Module System', 
                  dataIndex: 'esm', 
                  key: 'esm', 
                  render: (esm: boolean) => <Badge color={esm ? '#52c41a' : '#096dd9'} text={esm ? 'ESM' : 'CJS'} />
                },
              ]}
              dataSource={[
                { key: 'v1', pkg: 'geostyler-sld-parser@8.3.0', esm: true },
                { key: 'v2', pkg: 'geostyler-sld-parser@7.5.0', esm: false },
              ]}
              pagination={false}
              size="small"
            />
          </div>

          <Divider />

          <div>
            <h4>3. Peer Dependencies</h4>
            <p>
              Some packages may have peer dependencies that conflict with other packages.
            </p>
            <Alert 
              title="Check the package detail pages to see all dependencies and peer dependencies"
              type="info"
              showIcon
            />
          </div>
        </Space>
      ),
    },
    {
      key: 'how-to-compare',
      label: '🔍 How to Use the Compare Tool',
      children: (
        <Space orientation="vertical" style={{ width: '100%' }}>
          <ol style={{ lineHeight: '1.8' }}>
            <li>
              <strong>Select 2 packages</strong>
              <p>Go to the Compare page and add 2 or more packages using the package selector.</p>
            </li>
            <li>
              <strong>View compatibility analysis</strong>
              <p>See if the selected versions can work together. The analysis shows:</p>
              <ul>
                <li>Overall compatible/incompatible status</li>
                <li>geostyler-style version requirements and intersection</li>
                <li>Module system (ESM vs CJS) compatibility</li>
                <li>Any detected conflicts or warnings</li>
              </ul>
            </li>
            <li>
              <strong>Explore version matrix</strong>
              <p>Scroll down to the "Version Compatibility Matrix" to see all version combinations:</p>
              <ul>
                <li>Package A versions as rows, Package B versions as columns</li>
                <li>Green cells = compatible versions</li>
                <li>Red cells = incompatible versions</li>
                <li>Look for the ⭐ star badge for recommended (latest compatible) pair</li>
              </ul>
            </li>
            <li>
              <strong>Click for details</strong>
              <p>Click any cell in the matrix to see detailed compatibility breakdown for that specific version pair.</p>
            </li>
            <li>
              <strong>Install compatible versions</strong>
              <p>Once you've identified compatible versions, use npm to install:</p>
              <p>
                <code>npm install geostyler-sld-parser@8.3.0 geostyler-mapbox-parser@7.1.0</code>
              </p>
            </li>
          </ol>
        </Space>
      ),
    },
    {
      key: 'how-to-dashboard',
      label: '📊 Dashboard Overview',
      children: (
        <Space orientation="vertical" style={{ width: '100%' }}>
          <p>The Dashboard gives you an overview of all available packages.</p>

          <div>
            <h4>Package Statistics</h4>
            <p>Quick summary cards showing:</p>
            <ul>
              <li><strong>Total Packages:</strong> Count of all packages being tracked</li>
              <li><strong>Core Packages:</strong> Core packages (geostyler-style, geostyler-data)</li>
              <li><strong>Style Parsers:</strong> Packages for style format conversion</li>
              <li><strong>Data Parsers:</strong> Packages for data format conversion</li>
            </ul>
          </div>

          <Divider />

          <div>
            <h4>Package Table & Filtering</h4>
            <p>Browse all packages with filters:</p>
            <ul>
              <li><strong>Category Filter:</strong> Show only specific package types (core, style-parser, data-parser, ui)</li>
              <li><strong>Module System Filter:</strong> Filter by ESM or CommonJS support</li>
              <li><strong>Search:</strong> Find packages by name or category</li>
            </ul>
          </div>

          <Divider />

          <div>
            <h4>Package Details</h4>
            <p>Click any package name to see:</p>
            <ul>
              <li>All available versions with publication dates</li>
              <li>Dependencies and peer dependencies for each version</li>
              <li>geostyler-style range requirements (for style parsers)</li>
              <li>ESM support status per version</li>
              <li>Links to npm, GitHub, and changelog</li>
            </ul>
          </div>
        </Space>
      ),
    },
    {
      key: 'faq',
      label: '❓ Frequently Asked Questions',
      children: (
        <Space orientation="vertical" style={{ width: '100%' }}>
          <div>
            <h4>Q: Why can't I use these two packages together?</h4>
            <p>
              <strong>A:</strong> Most likely because they don't have overlapping geostyler-style version requirements. Each style parser specifies which versions of geostyler-style it's compatible with. If those ranges don't overlap, the packages can't work together.
            </p>
            <p>
              <strong>Solution:</strong> Use the Compare tool's Version Compatibility Matrix to find compatible version pairs.
            </p>
          </div>

          <Divider />

          <div>
            <h4>Q: Can I mix ESM and CommonJS packages?</h4>
            <p>
              <strong>A:</strong> It depends on your build tool. Modern bundlers (Webpack 5+, Vite, etc.) can handle mixed ESM/CJS, but you may encounter issues. It's recommended to use all ESM or all CJS for the same project when possible.
            </p>
          </div>

          <Divider />

          <div>
            <h4>Q: Why should I care about geostyler-style versions?</h4>
            <p>
              <strong>A:</strong> geostyler-style is the universal format that all style parsers convert to/from. When you use multiple parsers together, they all need to be able to read/write the same version of geostyler-style to share data correctly. If their requirements don't overlap, they can't communicate.
            </p>
          </div>

          <Divider />

          <div>
            <h4>Q: What's the difference between style parsers and data parsers?</h4>
            <p>
              <strong>A:</strong>
            </p>
            <ul>
              <li>
                <strong>Style Parsers:</strong> Convert style definitions (how things look) to/from formats like SLD, Mapbox GL, QGIS, etc. All tightly coupled through geostyler-style.
              </li>
              <li>
                <strong>Data Parsers:</strong> Convert data/feature structures to/from formats like GeoJSON, WFS, Shapefile. All depend on geostyler-data but are less tightly coupled.
              </li>
            </ul>
          </div>

          <Divider />

          <div>
            <h4>Q: Can I see version history for a package?</h4>
            <p>
              <strong>A:</strong> Yes! Go to the package detail page (click a package name from the Dashboard) to see all versions with publication dates, dependencies, and other metadata.
            </p>
          </div>

          <Divider />

          <div>
            <h4>Q: How often is this data updated?</h4>
            <p>
              <strong>A:</strong> The package metadata is automatically refreshed daily from the npm registry and GitHub API. You can also check GitHub Actions for the latest build status.
            </p>
          </div>
        </Space>
      ),
    },
    {
      key: 'technical-details',
      label: '⚙️ Technical Details',
      children: (
        <Space orientation="vertical" style={{ width: '100%' }}>
          <div>
            <h4>Data Sources</h4>
            <ul>
              <li><strong>npm Registry:</strong> Package versions, dependencies, peer dependencies</li>
              <li><strong>GitHub API:</strong> Repository metadata, update timestamps</li>
            </ul>
          </div>

          <Divider />

          <div>
            <h4>Build-Time Data Generation</h4>
            <p>
              Package metadata is generated at build time, not at runtime. This means:
            </p>
            <ul>
              <li>✓ No network requests needed while using the app</li>
              <li>✓ Data is bundled with the application</li>
              <li>✓ App works offline</li>
              <li>Data updates once per day via GitHub Actions</li>
            </ul>
          </div>

          <Divider />

          <div>
            <h4>Compatible with...</h4>
            <p>
              This compatibility checker tracks the official GeoStyler packages maintained by the GeoStyler team. Check the repository list on GitHub for the definitive list of tracked packages.
            </p>
          </div>

          <Divider />

          <div>
            <h4>About This Tool</h4>
            <p>
              Built with React, TypeScript, Ant Design, and TanStack Router to help developers navigate the GeoStyler package ecosystem and find compatible version combinations.
            </p>
          </div>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card 
        title={
          <span>
            <FileTextOutlined style={{ marginRight: '0.5rem' }} />
            Documentation
          </span>
        }
        style={{ marginBottom: '2rem' }}
      >
        <p style={{ marginBottom: '1.5rem', fontSize: '16px' }}>
          Welcome to the GeoStyler Compatibility Checker documentation. Use the sections below to understand how packages are organized, how compatibility is determined, and how to use this tool effectively.
        </p>
      </Card>

      <Collapse items={docItems} />
    </div>
  );
}
