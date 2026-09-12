import React from 'react';

export default function ApiErrorBanner({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex flex-wrap items-center justify-between gap-2">
      <span>{error}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="text-xs font-bold uppercase tracking-wider text-red-200 hover:text-on-surface"
        >
          Retry
        </button>
      )}
    </div>
  );
}
