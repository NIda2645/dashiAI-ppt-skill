import { makeThemePage } from './ThemePage.jsx';
import { BT09Failures } from '../blacktech/index.jsx';

export const Page09 = makeThemePage({
  pageNumber: 9,
  legacyLayout: 'BT09',
  LegacyComponent: BT09Failures,
});
