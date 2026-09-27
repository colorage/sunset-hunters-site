export const TAU = Math.PI * 2;
export const RAD = Math.PI / 180;

// NOAA's fractional-year approximation, including the equation of time.
export function solarPosition(date) {
  const year = date.getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const days = (Date.UTC(year + 1, 0, 1) - start) / 86400000;
  const gamma = TAU / days * ((date.getTime() - start) / 86400000 - .5);
  const equation = 229.18 * (.000075 + .001868 * Math.cos(gamma)
    - .032077 * Math.sin(gamma) - .014615 * Math.cos(2 * gamma)
    - .040849 * Math.sin(2 * gamma));
  const declination = .006918 - .399912 * Math.cos(gamma) + .070257 * Math.sin(gamma)
    - .006758 * Math.cos(2 * gamma) + .000907 * Math.sin(2 * gamma)
    - .002697 * Math.cos(3 * gamma) + .00148 * Math.sin(3 * gamma);
  const minutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const longitude = (720 - minutes - equation) / 4;
  return { declination, equation, vector: unitVector(declination / RAD, longitude) };
}

export function unitVector(lat, lon) {
  const p = lat * RAD, l = lon * RAD;
  return { x: Math.cos(p) * Math.sin(l), y: Math.sin(p), z: Math.cos(p) * Math.cos(l) };
}

export function rotate(point, rotation, tilt) {
  const x = point.x * Math.cos(rotation) + point.z * Math.sin(rotation);
  const z = point.z * Math.cos(rotation) - point.x * Math.sin(rotation);
  return { x, y: point.y * Math.cos(tilt) - z * Math.sin(tilt),
    z: point.y * Math.sin(tilt) + z * Math.cos(tilt) };
}

export function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }

// A great circle perpendicular to the Sun vector. No division by declination,
// so the equinox remains well-defined, including at the poles.
export function terminatorPoints(sun, count = 720) {
  const length = Math.hypot(sun.x, sun.z);
  const u = { x: sun.z / length, y: 0, z: -sun.x / length };
  const v = { x: sun.y * u.z, y: sun.z * u.x - sun.x * u.z, z: -sun.y * u.x };
  return Array.from({ length: count + 1 }, (_, i) => {
    const a = TAU * i / count, c = Math.cos(a), s = Math.sin(a);
    return { x: u.x * c + v.x * s, y: v.y * s, z: u.z * c + v.z * s };
  });
}

function inRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function landSampler(geojson) {
  const polygons = geojson.features.flatMap(({ geometry }) =>
    geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  ).map(rings => {
    const xs = rings[0].map(p => p[0]), ys = rings[0].map(p => p[1]);
    return { rings, west: Math.min(...xs), east: Math.max(...xs), south: Math.min(...ys), north: Math.max(...ys) };
  });
  return (lat, lon) => polygons.some(p => lon >= p.west && lon <= p.east
    && lat >= p.south && lat <= p.north && inRing(lon, lat, p.rings[0])
    && !p.rings.slice(1).some(ring => inRing(lon, lat, ring)));
}

export function landPoints(geojson, spacing = 1.15) {
  const isLand = landSampler(geojson), points = [];
  // Staggered rows with longitude spacing adjusted by latitude avoid polar crowding.
  let row = 0;
  for (let lat = -89.5; lat < 90; lat += spacing, row++) {
    const count = Math.max(1, Math.round(360 * Math.cos(lat * RAD) / spacing));
    for (let i = 0; i < count; i++) {
      const lon = -180 + (i + (row % 2) / 2) * 360 / count;
      if (isLand(lat, lon)) points.push(unitVector(lat, lon));
    }
  }
  return points;
}
