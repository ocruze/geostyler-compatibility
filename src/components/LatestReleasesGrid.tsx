import { Link } from '@tanstack/react-router';
import { Flex, Modal, Typography } from 'antd';
import { useMemo, useState } from 'react';

import { buildLatestReleasesGrid, versionLabel, type PairEvaluation } from '@/engine';

import { usePrereleases } from '@/hooks/usePrereleases';
import type { Package, PackageVersion } from '@/types/compatibility';

import { VerdictCell, VerdictDetail, VerdictTag } from './Verdict';
import { VERDICT_META, VERDICTS } from './verdictMeta';

const { Text } = Typography;

// Column headers drop the shared prefix so the grid fits on one screen.
const shortName = (name: string) => name.replace(/^geostyler-/, '') || name;

function HeaderLink({ version, short }: { version: PackageVersion; short?: boolean }) {
  return (
    <Flex vertical>
      <Link to="/package/$name" params={{ name: version.name }} aria-label={version.name}>
        {short ? shortName(version.name) : version.name}
      </Link>
      <Text type="secondary" className="cell-code">
        {version.version}
      </Text>
    </Flex>
  );
}

export function LatestReleasesGrid({ packages }: { packages: Package[] }) {
  const [includePrereleases] = usePrereleases();
  const grid = useMemo(() => buildLatestReleasesGrid(packages, includePrereleases), [packages, includePrereleases]);
  const [selected, setSelected] = useState<PairEvaluation | null>(null);

  return (
    <Flex vertical gap="middle">
      <div className="grid-scroll" tabIndex={0}>
        <table className="verdict-grid">
          <caption className="sr-only">
            Latest release of every tracked package against every other. Rows and columns are packages; each
            cell is a verdict.
          </caption>
          <thead>
            <tr>
              <td />
              {grid.versions.map((v) => (
                <th key={v.name} scope="col">
                  <HeaderLink version={v} short />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.versions.map((row, i) => (
              <tr key={row.name}>
                <th scope="row">
                  <HeaderLink version={row} />
                </th>
                {grid.versions.map((col, j) => {
                  const cell = grid.cells[i][j];
                  return (
                    <td key={col.name} className={cell ? undefined : 'verdict-grid__self'}>
                      {cell ? <VerdictCell evaluation={cell} onOpen={setSelected} /> : <span className="sr-only">Same package</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="verdict-legend" aria-label="Verdict legend">
        {VERDICTS.map((verdict) => (
          <li key={verdict}>
            <VerdictTag verdict={verdict} />
            <Text type="secondary">{VERDICT_META[verdict].definition}</Text>
          </li>
        ))}
      </ul>

      <Modal
        open={selected !== null}
        onCancel={() => setSelected(null)}
        footer={null}
        width={720}
        title={selected ? `${versionLabel(selected.a)} and ${versionLabel(selected.b)}` : ''}
      >
        {selected && (
          <Flex vertical gap="middle">
            <VerdictDetail evaluation={selected} />
            <Link to="/package/$name" params={{ name: selected.a.name }} search={{ compare: selected.b.name }}>
              Open this pair on the {selected.a.name} page
            </Link>
          </Flex>
        )}
      </Modal>
    </Flex>
  );
}
