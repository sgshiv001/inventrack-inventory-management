const assert = require('node:assert/strict');
const { test } = require('node:test');
const globe = require('../globe-math.js');

function close(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `Expected ${actual} to be within ${tolerance} of ${expected}`);
}

function closeVector(actual, expected) {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => close(value, expected[index]));
}

test('cardinal geography uses east +X, north +Y and Greenwich +Z', () => {
  closeVector(globe.vector(0, 0), [0, 0, 1]);
  closeVector(globe.vector(0, 90), [1, 0, 0]);
  closeVector(globe.vector(0, -90), [-1, 0, 0]);
  closeVector(globe.vector(90, 0), [0, 1, 0]);
  closeVector(globe.vector(-90, 0), [0, -1, 0]);
  closeVector(globe.vector(0, 180), [0, 0, -1]);
  closeVector(globe.vector(0, 0, 1.2), [0, 0, 1.2]);
});

test('texture coordinates align geographic landmarks to an equirectangular map', () => {
  closeVector(globe.uv(0, 0), [0.5, 0.5]);
  closeVector(globe.uv(90, -180), [0, 1]);
  closeVector(globe.uv(-90, 180), [1, 0]);
  closeVector(globe.uv(0, 90), [0.75, 0.5]);
  closeVector(globe.uv(0, -90), [0.25, 0.5]);
});

test('camera centers a geographic location consistently at any longitude and latitude', () => {
  for (const [latitude, longitude] of [[0, 0], [20, 78], [40.7128, -74.006], [-33.8688, 151.2093], [0, 179.9]]) {
    closeVector(globe.view(globe.vector(latitude, longitude), longitude, latitude), [0, 0, 1]);
  }
});

test('projection keeps north up and east right while rotating with the globe', () => {
  const camera = { latitude: 20, longitude: 78 };
  const layout = { cx: 350, cy: 250, radius: 200 };
  const center = globe.project(globe.vector(20, 78), camera, layout);
  close(center.x, 350);
  close(center.y, 250);
  close(center.z, 1);
  assert.ok(center.visible);
  const north = globe.project(globe.vector(30, 78), camera, layout);
  const east = globe.project(globe.vector(20, 88), camera, layout);
  assert.ok(north.y < center.y);
  close(north.x, center.x);
  assert.ok(east.x > center.x);
});

test('opaque earth hides the far hemisphere and occludes arcs behind its disk', () => {
  const camera = { latitude: 0, longitude: 0 };
  const layout = { cx: 0, cy: 0, radius: 100 };
  assert.equal(globe.project(globe.vector(0, 180), camera, layout).visible, false);
  assert.equal(globe.project(globe.vector(0, 180, 1.5), camera, layout).visible, false);
  assert.equal(globe.project(globe.vector(0, 95), camera, layout).visible, false);
  assert.equal(globe.project(globe.vector(0, 95, 1.1), camera, layout).visible, true);
  assert.equal(globe.project(globe.vector(0, 70), camera, layout).visible, true);
});

test('dateline routes take the short path instead of crossing Greenwich', () => {
  const route = globe.greatCircle({ latitude: 0, longitude: 170 }, { latitude: 0, longitude: -170 }, 20, 0);
  assert.equal(route.length, 21);
  closeVector(route[10], [0, 0, -1]);
  assert.ok(route.every(point => point[2] < -0.98));
});

test('great-circle endpoints stay anchored and altitude peaks at the midpoint', () => {
  const from = { latitude: 19.076, longitude: 72.8777 };
  const to = { latitude: 51.5074, longitude: -0.1278 };
  const route = globe.greatCircle(from, to, 80, 0.12);
  closeVector(route[0], globe.vector(from.latitude, from.longitude));
  closeVector(route[80], globe.vector(to.latitude, to.longitude));
  close(Math.hypot(...route[40]), 1.12);
  route.forEach((point, index) => close(Math.hypot(...point), 1 + Math.sin(Math.PI * index / 80) * 0.12));
});

test('coincident, antipodal and polar routes remain finite and continuous', () => {
  const pairs = [
    [{ latitude: 15, longitude: 25 }, { latitude: 15, longitude: 25 }],
    [{ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 180 }],
    [{ latitude: 15, longitude: 25 }, { latitude: -15, longitude: -155 }],
    [{ latitude: 90, longitude: 0 }, { latitude: -90, longitude: 0 }],
    [{ latitude: 0, longitude: 0 }, { latitude: 0.000001, longitude: 179.999999 }],
  ];
  for (const [from, to] of pairs) {
    const route = globe.greatCircle(from, to, 80, 0);
    closeVector(route[0], globe.vector(from.latitude, from.longitude));
    closeVector(route.at(-1), globe.vector(to.latitude, to.longitude));
    route.forEach((point, index) => {
      assert.ok(point.every(Number.isFinite));
      close(Math.hypot(...point), 1);
      if (index > 0) assert.ok(Math.hypot(...point.map((value, axis) => value - route[index - 1][axis])) < 0.05);
    });
  }
});
