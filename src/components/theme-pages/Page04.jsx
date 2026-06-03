import { makeThemePage } from './ThemePage.jsx';
import { BT04Pipeline } from '../blacktech/index.jsx';

export const Page04 = makeThemePage({
  pageNumber: 4,
  legacyLayout: 'BT04',
  LegacyComponent: BT04Pipeline,
});
