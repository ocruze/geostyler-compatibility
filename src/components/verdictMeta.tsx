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

// The antd status each verdict maps to; tag colours and cell tokens derive from it.
export type VerdictStatus = 'error' | 'warning' | 'info' | 'success' | 'neutral';

interface VerdictMeta {
  label: string;
  // Glossary definition, shown in legends.
  definition: string;
  status: VerdictStatus;
  icon: ReactNode;
}

export const VERDICTS: Verdict[] = [
  'conflict', 'risk', 'duplicate', 'shipped-together', 'compatible', 'independent', 'unknown',
];

export const VERDICT_META: Record<Verdict, VerdictMeta> = {
  conflict: {
    label: 'Conflict',
    definition: 'Shared peer ranges are disjoint. Installation fails.',
    status: 'error',
    icon: <CloseCircleOutlined aria-hidden="true" />,
  },
  risk: {
    label: 'Risk',
    definition: 'Core ranges differ and neither package declares the other. Style or data objects may have a different schema.',
    status: 'warning',
    icon: <WarningOutlined aria-hidden="true" />,
  },
  duplicate: {
    label: 'Duplicate',
    definition: 'One package declares the other but the chosen version does not satisfy the range. Two copies get installed.',
    status: 'info',
    icon: <CopyOutlined aria-hidden="true" />,
  },
  'shipped-together': {
    label: 'Shipped together',
    definition: 'Core ranges differ but one package declares the other in a satisfied range. Upstream builds and tests this pair.',
    status: 'success',
    icon: <LinkOutlined aria-hidden="true" />,
  },
  compatible: {
    label: 'Compatible',
    definition: 'Core ranges intersect and shared peers intersect.',
    status: 'success',
    icon: <CheckCircleOutlined aria-hidden="true" />,
  },
  independent: {
    label: 'Independent',
    definition: 'The pair shares no axis. Not a pass: nothing was checked.',
    status: 'neutral',
    icon: <MinusCircleOutlined aria-hidden="true" />,
  },
  unknown: {
    label: 'Unknown',
    definition: 'A package version declares no core range and none resolves transitively.',
    status: 'neutral',
    icon: <QuestionCircleOutlined aria-hidden="true" />,
  },
};

// The colour word the docs use for each status.
export const COLOR_NAME: Record<VerdictStatus, string> = {
  error: 'red',
  warning: 'amber',
  info: 'blue',
  success: 'green',
  neutral: 'grey',
};

export const TAG_COLOR: Record<VerdictStatus, string> = {
  error: 'error',
  warning: 'warning',
  info: 'processing',
  success: 'success',
  neutral: 'default',
};

export interface StatusColors {
  bg: string;
  border: string;
  fg: string;
}

export function useStatusColors(): Record<VerdictStatus, StatusColors> {
  const { token } = theme.useToken();
  return {
    error: { bg: token.colorErrorBg, border: token.colorErrorBorder, fg: token.colorError },
    warning: { bg: token.colorWarningBg, border: token.colorWarningBorder, fg: token.colorWarning },
    info: { bg: token.colorInfoBg, border: token.colorInfoBorder, fg: token.colorInfo },
    success: { bg: token.colorSuccessBg, border: token.colorSuccessBorder, fg: token.colorSuccess },
    neutral: { bg: token.colorFillQuaternary, border: token.colorBorderSecondary, fg: token.colorTextTertiary },
  };
}
