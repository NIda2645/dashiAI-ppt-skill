import { makeThemePage } from './ThemePage.jsx';
import { BT05Halftone } from '../blacktech/index.jsx';

export const Page05 = makeThemePage({
  pageNumber: 5,
  legacyLayout: 'BT05',
  LegacyComponent: BT05Halftone,
});
