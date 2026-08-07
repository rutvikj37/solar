import React from 'react';
import { Link } from 'react-router-dom';

export default function LeadEmptyState({ hasFilters = false, onClearFilters }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
        <span className="material-symbols-outlined text-3xl text-primary">
          {hasFilters ? 'filter_alt_off' : 'radar'}
        </span>
      </div>
      <h3 className="text-lg font-bold text-white mb-2">
        {hasFilters ? 'No leads match your filters' : 'Your pipeline is empty'}
      </h3>
      <p className="text-sm text-on-surface-variant max-w-md mb-6 leading-relaxed">
        {hasFilters
          ? 'Try adjusting your search or filter criteria to find leads in your pipeline.'
          : 'Scan properties on the Mission Targeting map to unlock homeowner leads with solar potential scores.'}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {hasFilters && onClearFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="px-4 py-2 rounded-xl bg-white/5 border border-glass-stroke text-xs font-bold text-white hover:bg-white/10 transition-all"
          >
            Clear filters
          </button>
        )}
        <Link
          to="/map"
          className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-primary/20"
        >
          <span className="material-symbols-outlined text-base">radar</span>
          Open Mission Targeting
        </Link>
      </div>
    </div>
  );
}
