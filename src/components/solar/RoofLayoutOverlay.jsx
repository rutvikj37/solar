import React, { useMemo } from 'react';
import { ringToSvgPoints } from '../../lib/roofLayout.js';

/**
 * SVG roof-segment + panel overlay positioned over a Google Static Maps image of the same frame.
 * The image must use object-fit: cover; preserveAspectRatio="xMidYMid slice" matches it.
 */
export default function RoofLayoutOverlay({
  layout,
  frame,
  panelCount = null,
  showSegments = true,
  showPanels = true,
  className = '',
}) {
  const segments = useMemo(
    () =>
      (layout?.segments || [])
        .filter((s) => Array.isArray(s.polygon))
        .map((s) => ({ ...s, points: ringToSvgPoints(s.polygon, frame) })),
    [layout, frame],
  );
  const panels = useMemo(() => {
    const list = layout?.panels || [];
    const n = panelCount != null ? Math.max(0, Math.min(list.length, panelCount)) : list.length;
    return list.slice(0, n).map((p, i) => ({ key: i, color: p.color, points: ringToSvgPoints(p.polygon, frame) }));
  }, [layout, frame, panelCount]);

  if (!layout || !frame) return null;
  return (
    <svg
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      viewBox={`0 0 ${frame.width} ${frame.height}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {showSegments &&
        segments.map((s) => (
          <polygon
            key={`seg-${s.index}`}
            points={s.points}
            fill={s.color}
            fillOpacity={0.18}
            stroke={s.color}
            strokeOpacity={0.9}
            strokeWidth={1}
            strokeDasharray="3 2"
          />
        ))}
      {showPanels &&
        panels.map((p) => (
          <polygon
            key={`panel-${p.key}`}
            points={p.points}
            fill="#0f172a"
            fillOpacity={0.75}
            stroke={p.color}
            strokeWidth={0.8}
          />
        ))}
    </svg>
  );
}
