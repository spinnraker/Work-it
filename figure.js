/*
 * Muscle map drawings (front and back), as SVG strings.
 *
 * Shapes are drawn for the left half of the body as point lists and mirrored,
 * then smoothed into curves, so both sides always match. Every muscle group is
 * outlined; the ones passed in are filled.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Figure = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const mirror = (pts) => pts.map(([x, y]) => [100 - x, y]);

  /** Closed Catmull-Rom curve through the points. */
  function smooth(pts, tension = 1) {
    const n = pts.length;
    const P = (i) => pts[(i + n) % n];
    const f = (v) => Math.round(v * 10) / 10;
    let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
    for (let i = 0; i < n; i++) {
      const [p0, p1, p2, p3] = [P(i - 1), P(i), P(i + 1), P(i + 2)];
      const c1 = [p1[0] + ((p2[0] - p0[0]) / 6) * tension, p1[1] + ((p2[1] - p0[1]) / 6) * tension];
      const c2 = [p2[0] - ((p3[0] - p1[0]) / 6) * tension, p2[1] - ((p3[1] - p1[1]) / 6) * tension];
      d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
    }
    return `${d}Z`;
  }

  const both = (pts, t) => smooth(pts, t) + smooth(mirror(pts).reverse(), t);

  // ---------- silhouette ----------

  const HALF = [
    [45, 27], [45, 33], [38, 35.5], [30, 38.5], [24.5, 43], [22, 50], [21, 60], [19.5, 71], [18.5, 80],
    [16.5, 92], [14.5, 104], [13.5, 113], [12, 120], [13, 127], [16, 127], [17.5, 120], [19, 113],
    [21.5, 102], [24.5, 90], [26.5, 80], [28, 70], [29.5, 62], [31, 70], [32.5, 82], [32, 94], [30, 104],
    [29, 118], [29.5, 134], [32, 148], [31, 158], [32, 172], [35.5, 186], [33.5, 193], [36, 196.5],
    [45, 196.5], [44.5, 188], [45.5, 174], [46.5, 160], [45.5, 149], [47, 134], [48.5, 120], [50, 112],
  ];
  const SILHOUETTE = smooth([...HALF, ...mirror(HALF.slice(0, -1)).reverse()]);
  const HEAD = '<ellipse cx="50" cy="15" rx="9" ry="11.5"/>';

  // ---------- muscles (left half; mirrored) ----------

  const FRONT = {
    shoulders: [[34, 38.5], [28, 39.5], [23.5, 44], [21.8, 51], [22.3, 57], [26, 55.5], [30.5, 50], [34.5, 44]],
    chest: [[35, 41], [41, 40], [48.5, 41.5], [48.5, 50], [47, 56], [40, 58], [34.5, 55.5], [32.5, 49]],
    biceps: [[22.8, 58], [28.6, 56.5], [29.6, 64], [28.6, 72], [25.6, 78.5], [21.4, 72], [21, 63]],
    abs: null, // drawn as a six-pack below
    quads: [[35, 106], [40.5, 110], [46.5, 118], [46.5, 132], [44.5, 144], [39.5, 148], [35.5, 145], [33.8, 132], [33.5, 118]],
    abductors: [[30, 106], [34, 109], [33.6, 124], [33, 138], [31.2, 144], [29.6, 132], [29.4, 118]],
  };
  const FRONT_OUTLINE = {
    forearm: [[18.5, 82], [24.5, 81], [21.5, 98], [18.5, 108], [15.5, 108], [16.5, 95]],
    obliques: [[33, 59], [39.5, 61], [40.5, 75], [40.5, 92], [36, 98], [33, 90], [33.5, 75]],
    adductor: [[47.2, 118], [49.2, 116], [49, 128], [47, 138]],
    shin: [[33.5, 152], [38.5, 156], [42, 160], [41, 176], [37, 184], [34.5, 172], [33, 162]],
    trap: [[44.5, 33.5], [38, 36], [33, 39], [40, 40]],
  };
  const ABS = [[42.4, 61, 48.8, 70], [42.4, 72, 48.8, 81], [42.6, 83, 48.8, 92], [43.4, 94, 48.8, 104]];

  const BACK = {
    lats: [[33, 52], [40, 56], [47, 64], [48, 74], [45, 84], [38, 82], [33.5, 72], [31, 61]],
    triceps: [[21.3, 56], [28.6, 55.5], [29.6, 63], [28.2, 73], [24.6, 78.5], [20.8, 70], [20.8, 61]],
    'lower-back': [[43.5, 78], [48.6, 76], [48.6, 98], [44, 100], [42, 90]],
    glutes: [[32, 102], [40, 99], [48.6, 101], [48.6, 115], [44, 121], [36, 120], [31, 113]],
    hamstrings: [[31.5, 124], [38, 123], [46.5, 125], [46, 138], [43.5, 148], [38, 150], [33, 144], [31, 134]],
    calves: [[32.5, 154], [38, 151], [44.5, 154], [45.5, 165], [43, 176], [38.5, 178], [33.5, 170]],
  };
  const BACK_OUTLINE = {
    trap: [[45, 31], [49, 32], [48.6, 52], [43, 56], [36, 46], [29.5, 40], [37, 36]],
    reardelt: [[30, 40.5], [24.5, 44], [22.5, 51], [27.5, 52.5], [33, 48]],
    forearm: [[18.5, 82], [24.5, 81], [21.5, 98], [18.5, 108], [15.5, 108], [16.5, 95]],
  };

  const ABS_PATH = ABS.map(([x1, y1, x2, y2]) => {
    const r = 2.2;
    const one = (a, b) => `<rect x="${a}" y="${y1}" width="${(b - a).toFixed(1)}" height="${y2 - y1}" rx="${r}"/>`;
    return one(x1, x2) + one(100 - x2, 100 - x1);
  }).join('');

  const VIEW = { front: { on: FRONT, off: FRONT_OUTLINE }, back: { on: BACK, off: BACK_OUTLINE } };
  const PATHS = {};
  for (const v of ['front', 'back']) {
    PATHS[v] = {};
    for (const [id, pts] of Object.entries(VIEW[v].on)) PATHS[v][id] = id === 'abs' ? ABS_PATH : `<path d="${both(pts)}"/>`;
    PATHS[v]._outline = Object.values(VIEW[v].off).map((pts) => `<path d="${both(pts)}"/>`).join('');
  }

  const SIDE = {};
  for (const v of ['front', 'back']) for (const id of Object.keys(VIEW[v].on)) SIDE[id] = v;
  const LOWER = new Set(['quads', 'abductors', 'glutes', 'hamstrings', 'calves']);

  /**
   * levels: { muscleId: 'on' | 'was' }. box: viewBox string or 'auto' (crop to the lit muscles).
   */
  function svg(levels, view, box = '0 0 100 200') {
    const muscles = Object.keys(PATHS[view]).filter((k) => k !== '_outline');
    const parts = muscles.map((m) => {
      const lv = levels[m];
      return `<g class="${lv === 'on' ? 'm on' : lv === 'was' ? 'm was' : 'm'}">${PATHS[view][m]}</g>`;
    }).join('');
    return `<svg class="fig" viewBox="${box}" preserveAspectRatio="xMidYMin slice" aria-hidden="true">`
      + `<path class="body" d="${SILHOUETTE}"/><g class="body">${HEAD}</g>`
      + `<g class="m">${PATHS[view]._outline}</g>${parts}</svg>`;
  }

  /** A square close-up for an exercise: the side and region that show its muscles. */
  function thumb(muscles) {
    const known = muscles.filter((m) => SIDE[m]);
    const back = known.filter((m) => SIDE[m] === 'back').length;
    const view = back > known.length - back ? 'back' : 'front';
    const levels = {};
    known.forEach((m) => { levels[m] = 'on'; });
    const low = known.filter((m) => LOWER.has(m));
    let box = '12 30 76 76'; // shoulders to hips
    if (low.length && low.length === known.length) box = low.includes('calves') && low.length === 1 ? '16 128 68 68' : '14 92 72 72';
    else if (low.length) box = '6 32 88 88';
    return svg(levels, view, box);
  }

  return { svg, thumb, SIDE };
});
