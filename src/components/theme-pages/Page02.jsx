import { makeThemePage } from './ThemePage.jsx';
import { BT02Hypothesis } from '../blacktech/index.jsx';

export const Page02 = makeThemePage({
  pageNumber: 2,
  legacyLayout: 'BT02',
  LegacyComponent: BT02Hypothesis,
});
