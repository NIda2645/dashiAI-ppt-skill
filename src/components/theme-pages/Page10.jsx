import { makeThemePage } from './ThemePage.jsx';
import { BT10Observation } from '../blacktech/index.jsx';

export const Page10 = makeThemePage({
  pageNumber: 10,
  legacyLayout: 'BT10',
  LegacyComponent: BT10Observation,
});
