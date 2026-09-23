/** Escape a value for CSV (RFC 4180-ish). */
function escapeCsv(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function row(cells) {
  return cells.map(escapeCsv).join(',');
}

function formatCpl(value) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(2);
}

/**
 * Build a multi-section CSV of pipeline mix + territory / ZIP analytics
 * as shown on the Reports page.
 *
 * @param {{
 *   stages?: Array<{ label: string, status?: string, count: number }>,
 *   pipelineMeta?: { totalLeads?: number, wonCount?: number, conversionPct?: string|number },
 *   territorySummary?: {
 *     totalTerritories?: number,
 *     totalScannedLeads?: number,
 *     overallClosingRate?: number,
 *     avgCplUsd?: number,
 *   } | null,
 *   territories?: Array<{
 *     zip?: string,
 *     totalScanned?: number,
 *     qualifiedCount?: number,
 *     closedWonCount?: number,
 *     closingRatePct?: number,
 *     cplUsd?: number,
 *   }>,
 * }} payload
 * @returns {string}
 */
export function buildReportsCsv({
  stages = [],
  pipelineMeta = {},
  territorySummary = null,
  territories = [],
} = {}) {
  const lines = [];
  const exportedAt = new Date().toISOString();

  lines.push(row(['Reports export']));
  lines.push(row(['Exported at', exportedAt]));
  lines.push('');

  lines.push(row(['Pipeline mix']));
  lines.push(row(['Total leads', pipelineMeta.totalLeads ?? 0]));
  lines.push(row(['Won', pipelineMeta.wonCount ?? 0]));
  lines.push(row(['Conversion %', pipelineMeta.conversionPct ?? '0.0']));
  lines.push(row(['Stage', 'Count']));
  for (const stage of stages) {
    lines.push(row([stage.label, Number(stage.count) || 0]));
  }
  lines.push('');

  lines.push(row(['Territory summary']));
  const summary = territorySummary || {};
  lines.push(row(['Active ZIP territories', summary.totalTerritories ?? 0]));
  lines.push(row(['Total scanned leads', summary.totalScannedLeads ?? 0]));
  lines.push(row(['Overall closing rate %', summary.overallClosingRate ?? 0]));
  lines.push(row(['Avg cost per lead USD', formatCpl(summary.avgCplUsd)]));
  lines.push('');

  lines.push(row(['ZIP performance']));
  lines.push(
    row([
      'Territory (ZIP)',
      'Scanned',
      'Qualified',
      'Closed / Won',
      'Closing rate %',
      'CPL USD',
    ]),
  );
  for (const t of territories) {
    lines.push(
      row([
        t.zip ?? '',
        Number(t.totalScanned) || 0,
        Number(t.qualifiedCount) || 0,
        Number(t.closedWonCount) || 0,
        Number(t.closingRatePct) || 0,
        formatCpl(t.cplUsd),
      ]),
    );
  }

  return `${lines.join('\n')}\n`;
}

/**
 * Trigger a browser download of the Reports CSV.
 * @param {Parameters<typeof buildReportsCsv>[0]} payload
 * @param {string} [filename]
 */
export function downloadReportsCsv(payload, filename) {
  const csv = buildReportsCsv(payload);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download =
    filename || `solar_reports_export_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
