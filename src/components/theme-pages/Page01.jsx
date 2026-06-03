import { makeThemePage } from './ThemePage.jsx';
import { BT01Cover } from '../blacktech/index.jsx';

export const Page01 = makeThemePage({
  pageNumber: 1,
  legacyLayout: 'BT01',
  LegacyComponent: BT01Cover,
});
