import { Link } from '@tanstack/react-router';
import { Flex, Modal, Typography } from 'antd';
import { useMemo, useState } from 'react';

import { buildLatestReleasesGrid, verdictSentence, type PairEvaluation } from '@/engine';
import type { Package, PackageVersion } from '@/types/compatibility';

import { VerdictDetail, VerdictTag } from './Verdict';
import { VERDICT_META, VERDICTS, useVerdictColors } from './verdictMeta';

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

/**
 * Every tracked package's latest stable release against every other, one
 * verdict per cell. Clicking a cell opens the per-axis detail.
 */
export function LatestReleasesGrid({ packages }: { packages: Package[] }) {
  const grid = useMemo(() => buildLatestReleasesGrid(packages), [packages]);
  const colors = useVerdictColors();
  const [selected, setSelected] = useState<PairEvaluation | null>(null);

  return (
    <Flex vertical gap="middle">
      <div className="grid-scroll" tabIndex={0}>
        <table className="verdict-grid">
          <caption className="sr-only">
            Latest stable release of every tracked package against every other. Rows and columns are packages; each
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
                  if (!cell) {
                    return (
                      <td key={col.name} className="verdict-grid__self">
                        <span className="sr-only">Same package</span>
                      </td>
                    );
                  }
                  const meta = VERDICT_META[cell.verdict];
                  const color = colors[cell.verdict];
                  return (
                    <td key={col.name}>
                      <button
                        type="button"
                        className="verdict-cell"
                        style={{ backgroundColor: color.bg, borderColor: color.border, color: color.fg }}
                        aria-label={`${row.name} ${row.version} and ${col.name} ${col.version}: ${meta.label}. ${verdictSentence(cell)} Open details.`}
                        onClick={() => setSelected(cell)}
                      >
                        {meta.icon}
                      </button>
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
        title={selected ? `${selected.a.name} ${selected.a.version} and ${selected.b.name} ${selected.b.version}` : ''}
      >
        {selected && <VerdictDetail evaluation={selected} />}
      </Modal>
    </Flex>
  );
}
