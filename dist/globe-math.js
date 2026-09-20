(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GlobeMath = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEG = Math.PI / 180;
  const EPSILON = 1e-9;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const unit = v => {
    const length = Math.hypot(...v);
    return v.map(value => value / length);
  };

  // Geographic axes: Greenwich faces +Z, east is +X, north is +Y.
  function vector(latitude, longitude, radius = 1) {
    const lat = latitude * DEG;
    const lon = longitude * DEG;
    const horizontal = Math.cos(lat) * radius;
    return [horizontal * Math.sin(lon), Math.sin(lat) * radius, horizontal * Math.cos(lon)];
  }

  // Apply the same globe orientation to both the mesh and its geographic overlays.
  function view(point, centerLongitude, centerLatitude) {
    const lon = centerLongitude * DEG;
    const lat = centerLatitude * DEG;
    const x = Math.cos(lon) * point[0] - Math.sin(lon) * point[2];
    const z = Math.sin(lon) * point[0] + Math.cos(lon) * point[2];
    return [
      x,
      Math.cos(lat) * point[1] - Math.sin(lat) * z,
      Math.sin(lat) * point[1] + Math.cos(lat) * z,
    ];
  }

  // Standard equirectangular map, with UNPACK_FLIP_Y_WEBGL enabled on upload.
  function uv(latitude, longitude) {
    return [(longitude + 180) / 360, (latitude + 90) / 180];
  }

  function project(point, camera, layout) {
    const [x, y, z] = view(point, camera.longitude, camera.latitude);
    return {
      x: layout.cx + layout.radius * x,
      y: layout.cy - layout.radius * y,
      z,
      // Elevated routes can remain visible beyond the silhouette on the far side.
      visible: z >= 0 || x * x + y * y > 1 + EPSILON,
    };
  }

  function greatCircle(from, to, steps = 80, lift = 0.08) {
    if (!Number.isInteger(steps) || steps < 1) throw new RangeError('steps must be a positive integer');
    if (!Number.isFinite(lift) || lift < 0) throw new RangeError('lift must be a non-negative number');

    const start = vector(from.latitude, from.longitude);
    const end = vector(to.latitude, to.longitude);
    const cosine = clamp(dot(start, end), -1, 1);
    const angle = Math.acos(cosine);
    const tangent = end.map((value, index) => value - cosine * start[index]);
    const tangentLength = Math.hypot(...tangent);
    let direction;

    if (tangentLength > 1e-10) {
      direction = tangent.map(value => value / tangentLength);
    } else if (cosine < 0) {
      // Antipodal endpoints have many equal shortest paths. Pick a stable plane
      // using the coordinate axis least parallel to the start vector.
      const axisIndex = start.reduce((best, value, index) => Math.abs(value) < Math.abs(start[best]) ? index : best, 0);
      const axis = [0, 0, 0];
      axis[axisIndex] = 1;
      direction = unit(axis.map((value, index) => value - dot(axis, start) * start[index]));
    }

    return Array.from({ length: steps + 1 }, (_, index) => {
      if (index === 0) return start.slice();
      if (index === steps) return end.slice();
      const t = index / steps;
      const surface = direction
        ? start.map((value, coordinate) => value * Math.cos(angle * t) + direction[coordinate] * Math.sin(angle * t))
        : unit(start.map((value, coordinate) => value * (1 - t) + end[coordinate] * t));
      const altitude = 1 + Math.sin(Math.PI * t) * lift;
      return surface.map(value => value * altitude);
    });
  }

  return Object.freeze({ vector, view, uv, project, greatCircle });
});
