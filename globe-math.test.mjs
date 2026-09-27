import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { solarPosition, unitVector, rotate, dot, terminatorPoints, landSampler, landPoints } from './globe-math.mjs';

const geography = JSON.parse(readFileSync(new URL('./land.geojson', import.meta.url)));
test('real land covers each continent and leaves the oceans empty', () => {
  const isLand = landSampler(geography);
  for (const [name, lat, lon] of [['Europe', 52, 21], ['Africa', 15, 20], ['Asia', 45, 100],
    ['Australia', -25, 135], ['North America', 40, -100], ['South America', -10, -55],
    ['Greenland', 75, -40], ['Antarctica', -85, 0], ['Japan', 36, 138], ['Madagascar', -20, 47]]) {
    assert.ok(isLand(lat, lon), name);
  }
  for (const [lat, lon] of [[0, -140], [0, -30], [-30, 80], [40, -40]]) assert.equal(isLand(lat, lon), false);
});
test('dots are distributed on the unit sphere with realistic land coverage', () => {
  const points = landPoints(geography);
  assert.ok(points.length > 8000 && points.length < 11000, `land count ${points.length}`);
  for (const point of points) assert.ok(Math.abs(dot(point, point) - 1) < 1e-12);
});
test('terminator is continuous, on the sphere, and perpendicular to sunlight at equinox and solstice', () => {
  for (const sun of [unitVector(0, 0), unitVector(0, 179.99), unitVector(23.44, -140), unitVector(-23.44, 70)]) {
    const points = terminatorPoints(sun);
    for (const point of points) {
      assert.ok(Math.abs(dot(point, sun)) < 1e-12);
      assert.ok(Math.abs(dot(point, point) - 1) < 1e-12);
    }
    for (let i = 1; i < points.length; i++) assert.ok(dot(points[i - 1], points[i]) > .9999);
    assert.ok(dot(points[0], points.at(-1)) > .999999);
  }
});
test('rotation preserves the Sun/surface relationship and seasonal declination', () => {
  for (const [date, expected] of [['2026-06-21T12:00:00Z', 23.44], ['2026-12-21T12:00:00Z', -23.44]]) {
    const { vector: sun, declination } = solarPosition(new Date(date));
    assert.ok(Math.abs(declination * 180 / Math.PI - expected) < .15);
    const point = unitVector(52, 21);
    assert.ok(Math.abs(dot(point, sun) - dot(rotate(point, 2, .6), rotate(sun, 2, .6))) < 1e-12);
  }
});
