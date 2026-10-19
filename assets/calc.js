/* SidewallMath math: pure functions, no DOM. Works in the browser (window.SWCalc) and in Node (require).
   Tire geometry is standard: sidewall = section width x aspect ratio; overall diameter = rim + 2 x sidewall.
   Real tires vary a little by brand and model, and the loaded radius under the vehicle is slightly smaller. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SWCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var MM = 25.4, MILE_IN = 63360;
  var RPM_K = MILE_IN / (60 * Math.PI);                 // 336.1355: rpm = mph x axle x trans x K / tire diameter (in)
  var SPEED_CODES = { A1: 1, A2: 1, A3: 1, A4: 1, A5: 1, A6: 1, A7: 1, A8: 1, B: 1, C: 1, D: 1, E: 1, F: 1, G: 1, J: 1, K: 1, L: 1, M: 1, N: 1, P: 1, Q: 1, R: 1, S: 1, T: 1, U: 1, H: 1, V: 1, W: 1, Y: 1 };
  var ERR = 'Try a size like 265/70R17 or 33x12.50R15';
  var COMMON_RATIOS = [3.08, 3.21, 3.31, 3.42, 3.55, 3.73, 3.92, 4.10, 4.30, 4.56, 4.88, 5.13, 5.38];
  var STD_SPEEDS = [25, 35, 45, 55, 60, 65, 70, 75, 80];

  function r1(x) { return Math.round(x * 10) / 10; }
  function r2(x) { return Math.round(x * 100) / 100; }
  function r3(x) { return Math.round(x * 1000) / 1000; }
  function num(x) { x = parseFloat(x); return isFinite(x) ? x : NaN; }
  function trimNum(x) { return String(+(+x).toFixed(2)); }

  /* ---------- parser ---------- */
  function parseTail(rest) {  // load index (and optional dual load) + speed symbol after the size, e.g. "94W", "121/118S", "112 T"
    var out = { load: null, load2: null, speed: null };
    var m = /^\s*(\d{2,3})(?:\s*\/\s*(\d{2,3}))?\s*(A[1-8]|[A-Z])?(?![A-Z0-9])/.exec(rest || '');
    if (m) {
      var ld = +m[1]; if (ld >= 20 && ld <= 200) { out.load = ld; if (m[2]) out.load2 = +m[2]; if (m[3] && SPEED_CODES[m[3]]) out.speed = m[3]; }
    }
    return out;
  }
  function fail(why) { return { ok: false, error: why || ERR }; }
  function parseSize(str) {
    if (str && typeof str === 'object' && str.ok) return str;
    var s = String(str == null ? '' : str).toUpperCase().replace(/[××]/g, 'X').replace(/\s+/g, ' ').trim();
    if (!s) return fail();
    var m = /^(LT)?\s*(\d{2}(?:\.\d{1,2})?)\s*X\s*(\d{1,2}(?:\.\d{1,2})?)\s*(?:ZR|R|-|\s)\s*(\d{2}(?:\.\d)?)\s*(LT)?(?![A-Z0-9.])(.*)$/.exec(s);
    if (m) {   // flotation: 33x12.50R15, 33X12.5-15, 35x12.50R17LT
      var dia = +m[2], w = +m[3], rim = +m[4];
      if (!(dia >= 20 && dia <= 60 && w >= 5 && w <= 24 && rim >= 10 && rim <= 30 && dia > rim + 4)) return fail();
      var t = parseTail(m[6]);
      var pre = m[1] || m[5] || '';
      return finish({ ok: true, type: 'flotation', prefix: pre, widthIn: w, aspect: null, rim: rim, diaIn: dia, load: t.load, load2: t.load2, speed: t.speed });
    }
    m = /^(P|LT|ST|T)?\s*(\d{3})\s*[\/\s]\s*(\d{2})\s*(?:[\/\s-]\s*)?(ZR|R|-)?\s*(\d{2})(?!\d)(.*)$/.exec(s);
    if (m) {
      var wm = +m[2], asp = +m[3], rm = +m[5];
      if (!(wm >= 105 && wm <= 405 && asp >= 20 && asp <= 95 && rm >= 10 && rm <= 30)) return fail();
      var t2 = parseTail(m[6]);
      return finish({ ok: true, type: 'metric', prefix: m[1] || '', widthMm: wm, aspect: asp, rim: rm, construction: m[4] === '-' ? '' : (m[4] || ''), load: t2.load, load2: t2.load2, speed: t2.speed });
    }
    return fail();
  }
  function finish(p) {
    if (p.type === 'metric') {
      p.sidewallMm = p.widthMm * p.aspect / 100; p.sidewallIn = p.sidewallMm / MM; p.diaIn = p.rim + 2 * p.sidewallIn; p.widthIn = p.widthMm / MM;
      p.label = (p.prefix || '') + p.widthMm + '/' + p.aspect + (p.construction === 'ZR' ? 'ZR' : 'R') + p.rim;
    } else {
      p.sidewallIn = (p.diaIn - p.rim) / 2; p.sidewallMm = p.sidewallIn * MM; p.widthMm = p.widthIn * MM;
      p.label = trimNum(p.diaIn) + 'x' + (+p.widthIn).toFixed(2) + 'R' + p.rim + (p.prefix === 'LT' ? 'LT' : '');
    }
    return p;
  }

  /* ---------- dimensions ---------- */
  function dims(size) {
    var p = parseSize(size); if (!p.ok) return p;
    var circ = Math.PI * p.diaIn;
    return { ok: true, type: p.type, label: p.label, prefix: p.prefix, rim: p.rim, aspect: p.aspect, widthMm: p.widthMm, widthIn: p.widthIn,
      sidewallIn: p.sidewallIn, sidewallMm: p.sidewallMm, diaIn: p.diaIn, diaMm: p.rim * MM + 2 * p.sidewallMm, circIn: circ, revsPerMile: MILE_IN / circ,
      load: p.load, load2: p.load2, speed: p.speed };
  }
  function metricDims(widthMm, aspect, rim) { return dims({ ok: true, type: 'metric', prefix: '', widthMm: widthMm, aspect: aspect, rim: rim, sidewallMm: widthMm * aspect / 100, sidewallIn: widthMm * aspect / 100 / MM, diaIn: rim + 2 * widthMm * aspect / 100 / MM, widthIn: widthMm / MM, label: widthMm + '/' + aspect + 'R' + rim }); }

  /* ---------- comparison ---------- */
  function verdictFor(pct) {
    var a = Math.abs(pct);
    if (a <= 3 + 1e-9) return { level: 'close', verdict: 'Close match', verdictLong: 'Close match' };
    if (a <= 5 + 1e-9) return { level: 'check', verdict: 'Check clearance', verdictLong: 'Check clearance and speedometer' };
    return { level: 'big', verdict: 'Big change', verdictLong: 'Big change' };
  }
  function compare(a, b) {
    var A = dims(a), B = dims(b); if (!A.ok) return A; if (!B.ok) return B;
    var diffIn = B.diaIn - A.diaIn, pct = diffIn / A.diaIn * 100, v = verdictFor(pct);
    return { ok: true, a: A, b: B, diffIn: diffIn, diffPct: pct, verdict: v.verdict, verdictLong: v.verdictLong, level: v.level, rideHeightIn: diffIn / 2,
      widthDiffIn: B.widthIn - A.widthIn, widthDiffMm: B.widthMm - A.widthMm, sidewallDiffIn: B.sidewallIn - A.sidewallIn, circDiffIn: B.circIn - A.circIn,
      revsDiff: B.revsPerMile - A.revsPerMile, speedAt60: trueSpeed(60, A.diaIn, B.diaIn), taller: diffIn > 0 };
  }

  /* ---------- speed and odometer ---------- */
  function trueSpeed(indicated, oldDia, newDia) { return indicated * newDia / oldDia; }
  function speedTable(oldDia, newDia, speeds) {
    return (speeds || STD_SPEEDS).map(function (s) { var t = trueSpeed(s, oldDia, newDia); return { indicated: s, actual: t, error: t - s }; });
  }
  function odometer(miles, oldDia, newDia) { return miles * newDia / oldDia; }
  function effectiveDiaFromGps(speedo, gps, oldDia) {
    if (!(speedo > 0 && gps > 0 && oldDia > 0)) return { ok: false };
    var ratio = gps / speedo; return { ok: true, errorPct: (ratio - 1) * 100, effectiveDiaIn: oldDia * ratio, diffIn: oldDia * (ratio - 1) };
  }

  /* ---------- converter and finder ---------- */
  var WIDTHS = [], ASPECTS = [], q;
  for (q = 155; q <= 355; q += 10) WIDTHS.push(q);
  for (q = 25; q <= 85; q += 5) ASPECTS.push(q);
  function rimRange(a, b) { var o = []; for (var r = a; r <= b; r++) o.push(r); return o; }
  function toMetricOptions(targetDiaIn, rim, tolIn, opts) {
    opts = opts || {}; tolIn = tolIn == null ? 0.5 : tolIn;
    var rims = rim ? [rim] : rimRange(14, 24), widths = opts.widthMm ? [opts.widthMm] : WIDTHS, out = [];
    rims.forEach(function (rm) { widths.forEach(function (w) { ASPECTS.forEach(function (a) {
      var d = rm + 2 * w * a / 100 / MM, diff = d - targetDiaIn;
      if (Math.abs(diff) <= tolIn + 1e-9) out.push({ label: w + '/' + a + 'R' + rm, widthMm: w, aspect: a, rim: rm, diaIn: d, widthIn: w / MM, sidewallIn: w * a / 100 / MM, diffIn: diff }); }); }); });
    out.sort(function (x, y) { return Math.abs(x.diffIn) - Math.abs(y.diffIn) || x.widthMm - y.widthMm; });
    return out;
  }
  function alternates(stock, tolPct, rims, opts) {
    opts = opts || {}; var S = dims(stock); if (!S.ok) return S;
    tolPct = tolPct == null ? 3 : tolPct; rims = rims && rims.length ? rims : [S.rim];
    var maxW = opts.maxWidthDeltaMm, out = [];
    rims.forEach(function (rm) { WIDTHS.forEach(function (w) { ASPECTS.forEach(function (a) {
      var d = rm + 2 * w * a / 100 / MM, pct = (d - S.diaIn) / S.diaIn * 100;
      if (Math.abs(pct) > tolPct + 1e-9) return;
      if (rm === S.rim && S.type === 'metric' && w === S.widthMm && a === S.aspect) return;
      if (maxW != null && Math.abs(w - S.widthMm) > maxW) return;
      out.push({ label: w + '/' + a + 'R' + rm, widthMm: w, aspect: a, rim: rm, rimStep: rm - S.rim, diaIn: d, diffIn: d - S.diaIn, diffPct: pct, widthDiffMm: w - S.widthMm, widthIn: w / MM, sidewallIn: w * a / 100 / MM,
        sidewallDiffIn: w * a / 100 / MM - S.sidewallIn, verdict: verdictFor(pct).verdict }); }); }); });
    out.sort(function (x, y) { return Math.abs(x.diffPct) - Math.abs(y.diffPct) || x.rim - y.rim || x.widthMm - y.widthMm; });
    return out;
  }

  /* ---------- gearing ---------- */
  function nearestRatio(target, ratios) {
    var best = null; (ratios || COMMON_RATIOS).forEach(function (r) { if (best == null || Math.abs(r - target) < Math.abs(best - target)) best = r; }); return best;
  }
  function regear(axle, oldDia, newDia, ratios) {
    var eff = axle * oldDia / newDia, need = axle * newDia / oldDia, list = (ratios && ratios.length ? ratios : COMMON_RATIOS).slice().sort(function (a, b) { return a - b; });
    var near = nearestRatio(need, list), below = null, above = null;
    list.forEach(function (r) { if (r <= need) below = r; if (r >= need && above == null) above = r; });
    return { effective: eff, needed: need, nearest: near, nearestEffective: near * oldDia / newDia, nearestErrorPct: (near * oldDia / newDia / axle - 1) * 100, below: below, above: above, lossPct: (eff / axle - 1) * 100 };
  }
  function rpm(mph, axle, trans, diaIn) { return mph * axle * (trans == null ? 1 : trans) * RPM_K / diaIn; }

  /* ---------- wheel offset ---------- */
  function backspacing(widthIn, offsetMm) { return (widthIn + 1) / 2 + offsetMm / MM; }
  function offset(oldW, oldOff, newW, newOff, opts) {
    opts = opts || {};
    var ob = opts.oldBack != null && opts.oldBack !== '' ? +opts.oldBack : backspacing(oldW, oldOff), nb = opts.newBack != null && opts.newBack !== '' ? +opts.newBack : backspacing(newW, newOff);
    var of = oldW + 1 - ob, nf = newW + 1 - nb;
    return { oldBack: ob, newBack: nb, oldFront: of, newFront: nf, innerIn: ob - nb, outerIn: nf - of, innerMm: (ob - nb) * MM, outerMm: (nf - of) * MM };
  }

  /* ---------- DOT date code (last four digits: week, year) ---------- */
  function dotDate(code, today) {
    var m = /(\d{2})(\d{2})\s*$/.exec(String(code || '').replace(/\s+/g, ''));
    if (!m) return { ok: false, error: 'Enter the last four digits of the DOT code, like 2223.' };
    var wk = +m[1], yy = +m[2]; if (wk < 1 || wk > 53) return { ok: false, error: 'The first two digits are the week (01 to 53).' };
    var year = 2000 + yy, t = today || new Date();
    var start = new Date(Date.UTC(year, 0, 1 + (wk - 1) * 7)), now = t.getTime ? t : new Date(t);
    var months = (now.getUTCFullYear() - start.getUTCFullYear()) * 12 + (now.getUTCMonth() - start.getUTCMonth());
    return { ok: true, week: wk, year: year, ageMonths: months, ageYears: months / 12 };
  }

  return { parseSize: parseSize, dims: dims, metricDims: metricDims, compare: compare, verdictFor: verdictFor, trueSpeed: trueSpeed, speedTable: speedTable, odometer: odometer,
    effectiveDiaFromGps: effectiveDiaFromGps, toMetricOptions: toMetricOptions, alternates: alternates, nearestRatio: nearestRatio, regear: regear, rpm: rpm, backspacing: backspacing,
    offset: offset, dotDate: dotDate, r1: r1, r2: r2, r3: r3, RPM_K: RPM_K, COMMON_RATIOS: COMMON_RATIOS, STD_SPEEDS: STD_SPEEDS, WIDTHS: WIDTHS, ASPECTS: ASPECTS, ERR: ERR };
});
