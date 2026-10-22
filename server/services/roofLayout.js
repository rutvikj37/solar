/**
 * Roof segment + panel layout geometry from (compacted) Google Solar buildingInsights.
 * Output polygons are [lat, lng] rings so any client (Google Maps, SVG over a static image) can draw them.
 */

const EARTH_RADIUS_M = 6378137;
const MAX_PANELS = 400;

const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;
const r6 = (n) => Math.round(n * 1e6) / 1e6;

/** Same maths as google.maps.geometry.spherical.computeOffset. heading: degrees clockwise from north. */
export function computeOffset(lat, lng, distanceM, headingDeg) {
  const d = distanceM / EARTH_RADIUS_M;
  const h = toRad(headingDeg);
  const fromLat = toRad(lat);
  const fromLng = toRad(lng);
  const cosD = Math.cos(d);
  const sinD = Math.sin(d);
  const sinLat = Math.sin(fromLat);
  const cosLat = Math.cos(fromLat);
  const sinLat2 = cosD * sinLat + sinD * cosLat * Math.cos(h);
  const dLng = Math.atan2(sinD * cosLat * Math.sin(h), cosD - sinLat * sinLat2);
  return [r6(toDeg(Math.asin(sinLat2))), r6(toDeg(fromLng + dLng))];
}

function compassLabel(azimuth) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(((Number(azimuth) % 360) + 360) % 360 / 45) % 8];
}

/** 0..1 → blue (low) … yellow … orange (high), as hex. */
function rampColor(t) {
  const stops = [
    [0, [59, 130, 246]],
    [0.5, [250, 204, 21]],
    [1, [249, 115, 22]],
  ];
  const x = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0.5));
  let i = 0;
  while (i < stops.length - 2 && x > stops[i + 1][0]) i += 1;
  const [t0, c0] = stops[i];
  const [t1, c1] = stops[i + 1];
  const f = (x - t0) / (t1 - t0 || 1);
  const c = c0.map((v, k) => Math.round(v + (c1[k] - v) * f));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function medianSunshine(stats) {
  const q = stats?.sunshineQuantiles;
  if (!Array.isArray(q) || !q.length) return null;
  return Math.round(q[Math.floor(q.length / 2)]);
}

function bboxRing(bb) {
  const sw = bb?.sw;
  const ne = bb?.ne;
  if (!sw || !ne) return null;
  return [
    [r6(sw.latitude), r6(sw.longitude)],
    [r6(sw.latitude), r6(ne.longitude)],
    [r6(ne.latitude), r6(ne.longitude)],
    [r6(ne.latitude), r6(sw.longitude)],
  ];
}

/**
 * @param {object} data compacted buildingInsights (solarInsightsCache)
 * @param {{ panelCount?: number }} opts panelCount = how many of the best panels to lay out (default: all, capped)
 */
export function buildRoofLayout(data, { panelCount = null } = {}) {
  const pot = data?.solarPotential;
  if (!pot) return null;
  const segmentsRaw = Array.isArray(pot.roofSegmentStats) ? pot.roofSegmentStats : [];
  const panelsRaw = Array.isArray(pot.solarPanelsCompact) ? pot.solarPanelsCompact : [];
  const panelW = Number(pot.panelWidthMeters) || 1.045;
  const panelH = Number(pot.panelHeightMeters) || 1.879;

  const sunshineValues = segmentsRaw.map((s) => medianSunshine(s.stats)).filter((v) => v != null);
  const sMin = Math.min(...sunshineValues);
  const sMax = Math.max(...sunshineValues);

  const segments = segmentsRaw.map((s, index) => {
    const sunshine = medianSunshine(s.stats);
    const t = sunshine != null && sMax > sMin ? (sunshine - sMin) / (sMax - sMin) : 0.5;
    return {
      index,
      pitchDegrees: s.pitchDegrees != null ? Math.round(s.pitchDegrees) : null,
      azimuthDegrees: s.azimuthDegrees != null ? Math.round(s.azimuthDegrees) : null,
      facing: s.azimuthDegrees != null ? compassLabel(s.azimuthDegrees) : null,
      areaMeters2: s.stats?.areaMeters2 != null ? Math.round(s.stats.areaMeters2) : null,
      sunshineHoursPerYear: sunshine,
      color: rampColor(t),
      center: s.center ? [r6(s.center.latitude), r6(s.center.longitude)] : null,
      polygon: bboxRing(s.boundingBox),
      panelCount: 0,
    };
  });

  const maxAvailable = panelsRaw.length;
  const wanted = panelCount != null && Number(panelCount) > 0 ? Math.round(Number(panelCount)) : maxAvailable;
  const take = Math.min(maxAvailable, wanted, MAX_PANELS);
  const chosen = panelsRaw.slice(0, take);
  const energies = chosen.map((p) => Number(p[4]) || 0);
  const eMin = Math.min(...energies);
  const eMax = Math.max(...energies);

  const w = panelW / 2;
  const h = panelH / 2;
  const corners = [
    [+w, +h],
    [+w, -h],
    [-w, -h],
    [-w, +h],
  ];
  const panels = chosen.map(([lat, lng, portrait, segIdx, kwh]) => {
    const seg = segmentsRaw[segIdx] || {};
    const azimuth = Number(seg.azimuthDegrees) || 0;
    const orientation = portrait ? 90 : 0;
    const polygon = corners.map(([x, y]) =>
      computeOffset(lat, lng, Math.sqrt(x * x + y * y), toDeg(Math.atan2(y, x)) + orientation + azimuth),
    );
    if (segments[segIdx]) segments[segIdx].panelCount += 1;
    return {
      segmentIndex: segIdx,
      yearlyEnergyDcKwh: kwh,
      color: rampColor(eMax > eMin ? (kwh - eMin) / (eMax - eMin) : 0.75),
      polygon,
    };
  });

  const config = (pot.solarPanelConfigs || []).find((c) => c.panelsCount === take) || null;
  return {
    center: data.center ? [r6(data.center.latitude), r6(data.center.longitude)] : null,
    imageryDate: data.imageryDate || null,
    imageryQuality: data.imageryQuality || null,
    panelCapacityWatts: pot.panelCapacityWatts || 400,
    panelWidthMeters: panelW,
    panelHeightMeters: panelH,
    maxPanels: maxAvailable,
    panelCount: take,
    systemKw: Math.round(((take * (pot.panelCapacityWatts || 400)) / 1000) * 10) / 10,
    yearlyEnergyDcKwh: config
      ? Math.round(config.yearlyEnergyDcKwh)
      : Math.round(energies.reduce((s, v) => s + v, 0)),
    segments,
    panels,
  };
}
