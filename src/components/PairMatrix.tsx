import { Button, Flex, Modal, Typography } from 'antd';
import { useMemo, useState } from 'react';

import { buildPairMatrix, PAIR_MATRIX_DEFAULT_LIMIT, versionLabel, type PairEvaluation } from '@/engine';
import { usePrereleases } from '@/hooks/usePrereleases';
import type { Package } from '@/types/compatibility';

import { VerdictCell, VerdictDetail, VerdictTag } from './Verdict';
import { VERDICT_META, VERDICTS } from './verdictMeta';

const { Text } = Typography;

// Rows are versions of `a`, columns versions of `b`; the newest 20 of each until expanded.
export function PairMatrix({ a, b }: { a: Package; b: Package }) {
  const [includePrereleases] = usePrereleases();
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<PairEvaluation | null>(null);

  const matrix = useMemo(
    () => buildPairMatrix(a, b, { includePrereleases, limit: showAll ? undefined : PAIR_MATRIX_DEFAULT_LIMIT }),
    [a, b, includePrereleases, showAll],
  );
  const truncated = matrix.total.rows > matrix.rows.length || matrix.total.cols > matrix.cols.length;

  return (
    <Flex vertical gap="middle">
      <Flex gap="small" align="center" wrap>
        <Text type="secondary">
          {matrix.rows.length} of {matrix.total.rows} {a.name} versions against {matrix.cols.length} of {matrix.total.cols}{' '}
          {b.name} versions.
        </Text>
        {(truncated || showAll) && (
          <Button size="small" onClick={() => setShowAll(!showAll)}>
            {showAll ? `Show the newest ${PAIR_MATRIX_DEFAULT_LIMIT}` : 'Show all versions'}
          </Button>
        )}
      </Flex>

      <div className="grid-scroll" tabIndex={0}>
        <table className="verdict-grid">
          <caption className="sr-only">
            Versions of {a.name} as rows against versions of {b.name} as columns; each cell is a verdict.
          </caption>
          <thead>
            <tr>
              <td />
              {matrix.cols.map((col) => (
                <th key={col.version} scope="col">
                  <Text className="cell-code">{col.version}</Text>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row, i) => (
              <tr key={row.version}>
                <th scope="row">
                  <Text className="cell-code">{row.version}</Text>
                </th>
                {matrix.cols.map((col, j) => (
                  <td key={col.version}>
                    <VerdictCell evaluation={matrix.cells[i][j]} onOpen={setSelected} />
                  </td>
                ))}
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
        {selected && <VerdictDetail evaluation={selected} />}
      </Modal>
    </Flex>
  );
}
