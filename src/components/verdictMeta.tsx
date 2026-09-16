import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CopyOutlined,
  LinkOutlined,
  MinusCircleOutlined,
  QuestionCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { theme } from 'antd';
import type { ReactNode } from 'react';

import type { Verdict } from '@/types/compatibility';

type TagColor = 'error' | 'warning' | 'processing' | 'success' | 'default';

interface VerdictMeta {
  label: string;
  // Glossary definition, shown in legends.
  definition: string;
  tagColor: TagColor;
  icon: ReactNode;
}

export const VERDICTS: Verdict[] = [
  'conflict', 'risk', 'duplicate', 'shipped-together', 'compatible', 'independent', 'unknown',
];

export const VERDICT_META: Record<Verdict, VerdictMeta> = {
  conflict: {
    label: 'Conflict',
    definition: 'Shared peer ranges are disjoint. Installation fails.',
    tagColor: 'error',
    icon: <CloseCircleOutlined aria-hidden="true" />,
  },
  risk: {
    label: 'Risk',
    definition: 'Core ranges differ and neither package declares the other. Style or data objects may have a different schema.',
    tagColor: 'warning',
    icon: <WarningOutlined aria-hidden="true" />,
  },
  duplicate: {
    label: 'Duplicate',
    definition: 'One package declares the other but the chosen version does not satisfy the range. Two copies get installed.',
    tagColor: 'processing',
    icon: <CopyOutlined aria-hidden="true" />,
  },
  'shipped-together': {
    label: 'Shipped together',
    definition: 'Core ranges differ but one package declares the other in a satisfied range. Upstream builds and tests this pair.',
    tagColor: 'success',
    icon: <LinkOutlined aria-hidden="true" />,
  },
  compatible: {
    label: 'Compatible',
    definition: 'Core ranges intersect and shared peers intersect.',
    tagColor: 'success',
    icon: <CheckCircleOutlined aria-hidden="true" />,
  },
  independent: {
    label: 'Independent',
    definition: 'The pair shares no axis. Not a pass: nothing was checked.',
    tagColor: 'default',
    icon: <MinusCircleOutlined aria-hidden="true" />,
  },
  unknown: {
    label: 'Unknown',
    definition: 'A package version declares no core range and none resolves transitively.',
    tagColor: 'default',
    icon: <QuestionCircleOutlined aria-hidden="true" />,
  },
};

/**
 * Cell colours for a verdict, from the antd theme tokens.
 */
export function useVerdictColors() {
  const { token } = theme.useToken();
  const colors: Record<Verdict, { bg: string; border: string; fg: string }> = {
    conflict: { bg: token.colorErrorBg, border: token.colorErrorBorder, fg: token.colorError },
    risk: { bg: token.colorWarningBg, border: token.colorWarningBorder, fg: token.colorWarning },
    duplicate: { bg: token.colorInfoBg, border: token.colorInfoBorder, fg: token.colorInfo },
    'shipped-together': { bg: token.colorSuccessBg, border: token.colorSuccessBorder, fg: token.colorSuccess },
    compatible: { bg: token.colorSuccessBg, border: token.colorSuccessBorder, fg: token.colorSuccess },
    independent: { bg: token.colorFillQuaternary, border: token.colorBorderSecondary, fg: token.colorTextTertiary },
    unknown: { bg: token.colorFillQuaternary, border: token.colorBorderSecondary, fg: token.colorTextTertiary },
  };
  return colors;
}
