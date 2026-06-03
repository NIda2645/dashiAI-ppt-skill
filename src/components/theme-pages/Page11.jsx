import { makeThemePage } from './ThemePage.jsx';
import { BT11Applications } from '../blacktech/index.jsx';

export const Page11 = makeThemePage({
  pageNumber: 11,
  legacyLayout: 'BT11',
  LegacyComponent: BT11Applications,
});
