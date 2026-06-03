import { makeThemePage } from './ThemePage.jsx';
import { BT03SignalNoise } from '../blacktech/index.jsx';

export const Page03 = makeThemePage({
  pageNumber: 3,
  legacyLayout: 'BT03',
  LegacyComponent: BT03SignalNoise,
});
