import { makeThemePage } from './ThemePage.jsx';
import { BT08Compression } from '../blacktech/index.jsx';

export const Page08 = makeThemePage({
  pageNumber: 8,
  legacyLayout: 'BT08',
  LegacyComponent: BT08Compression,
});
