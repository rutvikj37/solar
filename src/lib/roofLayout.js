/**
 * Project [lat, lng] onto a Google Static Maps frame (Web Mercator, 256px tiles).
 * frame: { centerLat, centerLng, zoom, width, height } in logical (scale=1) pixels.
 */
function worldPoint(lat, lng) {
  const siny = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
  return {
    x: 256 * (0.5 + lng / 360),
    y: 256 * (0.5 - Math.log((1 + siny) / (1 - siny)) / (4 * Math.PI)),
  };
}

export function projectToFrame(lat, lng, frame) {
  const scale = 2 ** frame.zoom;
  const c = worldPoint(frame.centerLat, frame.centerLng);
  const p = worldPoint(lat, lng);
  return {
    x: frame.width / 2 + (p.x - c.x) * scale,
    y: frame.height / 2 + (p.y - c.y) * scale,
  };
}

export function ringToSvgPoints(ring, frame) {
  return ring
    .map(([lat, lng]) => {
      const { x, y } = projectToFrame(lat, lng, frame);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}
