import type { ModuleSystem, PackageCategory } from '@/types/compatibility';

export const CATEGORY_LABEL: Record<PackageCategory, string> = {
  core: 'Core package',
  ui: 'UI package',
  'style-parser': 'Style parser',
  'data-parser': 'Data parser',
};

export const MODULE_LABEL: Record<ModuleSystem, string> = { esm: 'ESM', cjs: 'CJS', 'types-only': 'Types only' };
