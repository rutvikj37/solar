/**
 * Seed data for the `solar_incentives` table (INSERT IGNORE by code — edits in the DB win).
 * Amounts are not legal/tax advice; every row carries an as-of date and notes, and the
 * proposal/report UI shows them. Update rows in the DB (admin API) when law changes.
 *
 * kind: 'percent' (amount = fraction of gross cost) | 'fixed' (USD) | 'per_watt' (USD per W DC)
 * ownership: CSV of cash,loan,lease,ppa. For lease/ppa the credit is claimed by the system owner
 * (lessor/PPA provider) and only reduces the homeowner's lease/PPA pricing.
 */
export const DEFAULT_SOLAR_INCENTIVES = [
  {
    code: 'US_25D',
    jurisdiction: 'US',
    label: 'Federal Residential Clean Energy Credit (§25D)',
    segment: 'residential',
    ownership: 'cash,loan',
    kind: 'percent',
    amount: 0,
    cap: null,
    enabled: 1,
    asOf: '2025-07-04',
    notes:
      'Terminated for expenditures made after Dec 31, 2025 (P.L. 119-21). Shown as $0 for homeowner-owned systems; update this row if the law changes.',
  },
  {
    code: 'US_48E_TPO',
    jurisdiction: 'US',
    label: 'Federal Clean Electricity ITC (§48E) — claimed by lessor / PPA provider',
    segment: 'residential',
    ownership: 'lease,ppa',
    kind: 'percent',
    amount: 0.3,
    cap: null,
    enabled: 1,
    asOf: '2025-07-04',
    notes:
      'Not a homeowner tax credit. Reflected only as lower lease/PPA pricing. Subject to begin-construction / placed-in-service deadlines and foreign-entity rules — confirm with your financing partner.',
  },
  {
    code: 'US_48E_COMMERCIAL',
    jurisdiction: 'US',
    label: 'Federal Clean Electricity ITC (§48E) — commercial',
    segment: 'commercial',
    ownership: 'cash,loan,lease,ppa',
    kind: 'percent',
    amount: 0.3,
    cap: null,
    enabled: 1,
    asOf: '2025-07-04',
    notes:
      'Base 30% assumes prevailing-wage/apprenticeship compliance or <1 MW. Subject to begin-construction / placed-in-service deadlines and foreign-entity rules — confirm with a tax professional.',
  },
  {
    code: 'NY_SOLAR_EQUIPMENT_CREDIT',
    jurisdiction: 'NY',
    label: 'New York solar energy system equipment credit',
    segment: 'residential',
    ownership: 'cash,loan',
    kind: 'percent',
    amount: 0.25,
    cap: 5000,
    enabled: 1,
    asOf: '2025-01-01',
    notes: '25% of qualified cost, max $5,000. Verify current eligibility with NY DTF.',
  },
  {
    code: 'SC_SOLAR_CREDIT',
    jurisdiction: 'SC',
    label: 'South Carolina solar energy tax credit',
    segment: 'residential',
    ownership: 'cash,loan',
    kind: 'percent',
    amount: 0.25,
    cap: 35000,
    enabled: 1,
    asOf: '2025-01-01',
    notes: '25% of cost; usable up to $3,500 per year with carryforward. Verify with SC DOR.',
  },
  {
    code: 'AZ_SOLAR_CREDIT',
    jurisdiction: 'AZ',
    label: 'Arizona residential solar energy credit',
    segment: 'residential',
    ownership: 'cash,loan',
    kind: 'percent',
    amount: 0.25,
    cap: 1000,
    enabled: 1,
    asOf: '2025-01-01',
    notes: '25% of cost, max $1,000. Verify with AZ DOR.',
  },
  {
    code: 'MA_SOLAR_CREDIT',
    jurisdiction: 'MA',
    label: 'Massachusetts residential renewable energy income tax credit',
    segment: 'residential',
    ownership: 'cash,loan',
    kind: 'percent',
    amount: 0.15,
    cap: 1000,
    enabled: 1,
    asOf: '2025-01-01',
    notes: '15% of cost, max $1,000. Verify with MA DOR.',
  },
];

/** Approximate average residential retail price, $/kWh (EIA, 2024 annual). Fallback only. */
export const STATE_AVG_RESIDENTIAL_RATE_AS_OF = '2024-12-31';
export const NATIONAL_AVG_RESIDENTIAL_RATE = 0.165;
export const STATE_AVG_RESIDENTIAL_RATES = {
  AL: 0.154, AK: 0.249, AZ: 0.15, AR: 0.129, CA: 0.32, CO: 0.156, CT: 0.29, DE: 0.169, DC: 0.175,
  FL: 0.154, GA: 0.141, HI: 0.41, ID: 0.116, IL: 0.16, IN: 0.153, IA: 0.139, KS: 0.144, KY: 0.131,
  LA: 0.123, ME: 0.268, MD: 0.185, MA: 0.3, MI: 0.194, MN: 0.156, MS: 0.135, MO: 0.136, MT: 0.136,
  NE: 0.119, NV: 0.149, NH: 0.25, NJ: 0.195, NM: 0.146, NY: 0.245, NC: 0.139, ND: 0.116, OH: 0.16,
  OK: 0.13, OR: 0.144, PA: 0.184, RI: 0.29, SC: 0.144, SD: 0.133, TN: 0.129, TX: 0.153, UT: 0.119,
  VT: 0.226, VA: 0.146, WA: 0.124, WV: 0.145, WI: 0.176, WY: 0.128,
};

/** Modeling defaults surfaced in report/proposal assumptions. */
export const SOLAR_MODEL_DEFAULTS = {
  utilityEscalationPct: 3.0,
  panelDegradationPct: 0.5,
  analysisYears: 25,
  fallbackYieldKwhPerKw: 1350,
};
