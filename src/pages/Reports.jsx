import React from 'react';
import TerritoryAnalyticsPanel from '../components/TerritoryAnalyticsPanel.jsx';

export default function Reports() {
  return (
    <>
      <div className="mb-stack-lg">
        <h2 className="font-headline-lg text-2xl md:text-headline-lg font-bold text-primary">
          Reports
        </h2>
        <p className="text-on-surface-variant text-sm mt-1">
          Territory conversion, cost per lead, and ZIP performance from your pipeline.
        </p>
      </div>
      <TerritoryAnalyticsPanel />
    </>
  );
}
