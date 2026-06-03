import React from 'react';

export function makeThemePage({ LegacyComponent }) {
  return function ThemePage(props) {
    return <LegacyComponent {...props} />;
  };
}
