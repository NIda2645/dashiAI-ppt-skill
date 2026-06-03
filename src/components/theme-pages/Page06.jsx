import { makeThemePage } from './ThemePage.jsx';
import { BT06Dither } from '../blacktech/index.jsx';

export const Page06 = makeThemePage({
  pageNumber: 6,
  legacyLayout: 'BT06',
  LegacyComponent: BT06Dither,
});
