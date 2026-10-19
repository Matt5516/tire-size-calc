/* SidewallMath UI: one script for all tools (form[data-tool]). Math lives in calc.js. State goes in the URL. */
addEventListener('DOMContentLoaded', function () { 'use strict';
  var C = window.SWCalc, form = document.getElementById('swForm'); if (!form) return;
  var $ = function (i) { return document.getElementById(i); }, n = UI.num, tool = form.dataset.tool, out = $('swOut'), last = '';
  function esc(s) { return UI.esc(s); }
  function f(x, dp) { return (+x).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp }); }
  function sg(x, dp, unit) { var v = +(+x).toFixed(dp); return (v > 0 ? '+' : v < 0 ? '−' : '') + f(Math.abs(v), dp) + (unit || ''); }
  function stat(k, v) { return '<div class="stat"><div class="k">' + k + '</div><div class="v">' + v + '</div></div>'; }
  function enc(s) { return encodeURIComponent(s); }
  function root() { return UI.root(); }
  var ICON = { close: 'check', check: 'alert', big: 'alert' }, CLS = { close: 'good', check: 'warn', big: 'bad' };
  function chip(level, text) { return '<span class="sw-chip ' + CLS[level] + '">' + UI.icon(ICON[level]) + esc(text) + '</span>'; }
  function verdictBox(level, text, big, sub) {
    return '<div class="verdict ' + CLS[level] + '"><span class="vicon">' + UI.icon(ICON[level]) + '</span><div>' + chip(level, text) + '<strong class="big">' + big + '</strong><span>' + sub + '</span></div></div>';
  }
  function empty(msg) { return '<div class="empty">' + UI.icon('chart') + '<p><strong>' + msg + '</strong><br>Live results appear here as you type.</p></div>'; }
  function tbl(cap, head, rows, foot) {
    return '<div class="table-scroll"><table class="cm-tbl"><caption class="sr-only">' + esc(cap) + '</caption><thead><tr>' + head.map(function (h, i) { return '<th scope="col"' + (i ? ' class="r"' : '') + '>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr' + (r.hl ? ' class="hl"' : '') + '>' + r.c.map(function (c, i) { return (i ? '<td class="r">' : '<th scope="row">') + c + (i ? '</td>' : '</th>'); }).join('') + '</tr>'; }).join('') + '</tbody>' + (foot || '') + '</table></div>';
  }
  var CAVEAT = '<p class="hint">Calculated from the sizes you typed. Real tires vary a little by brand and model, and the loaded radius under the vehicle is a bit smaller. A size within about 3% is a rule of thumb (Discount Tire, 1010tires), not a guarantee of fit: confirm the wheel width range, clearance, load index and speed rating. See <a href="' + root() + 'how-to-read-a-tire-size/">how to read a tire size</a> and <a href="' + root() + 'plus-sizing-explained/">plus sizing</a>.</p>';
  function actions(text) {
    last = text; return '<div class="actions no-print"><button type="button" class="btn ghost sm" data-print>' + UI.icon('copy') + 'Print this sheet</button><button type="button" class="btn ghost sm" id="copySum">' + UI.icon('copy') + 'Copy result</button></div>';
  }
  document.addEventListener('click', function (e) { if (e.target.closest('#copySum')) UI.copy(last, 'Result copied'); });

  // ---------- size fields: inline errors and list pickers ----------
  var WIDTHS = [], q; for (q = 125; q <= 355; q += 10) WIDTHS.push(q);
  var RIMS = []; for (q = 13; q <= 24; q++) RIMS.push(q);
  function sizeFields() { return Array.prototype.slice.call(form.querySelectorAll('input.size[type=text]')).filter(function (el) { return el.id !== 'dc'; }); }
  function enhance(el) {
    var d = document.createElement('details'); d.className = 'sw-pick';
    var opt = function (arr, fmt) { return arr.map(function (v) { return '<option value="' + v + '">' + fmt(v) + '</option>'; }).join(''); };
    var asp = []; for (q = 25; q <= 85; q += 5) asp.push(q);
    d.innerHTML = '<summary>Pick from lists</summary><div class="sw-sel"><label>Width<select data-p="w"><option value="">—</option>' + opt(WIDTHS, function (v) { return v + ' mm'; }) + '</select></label><label>Aspect<select data-p="a"><option value="">—</option>' + opt(asp, function (v) { return v; }) +
      '</select></label><label>Wheel<select data-p="r"><option value="">—</option>' + opt(RIMS, function (v) { return v + ' in'; }) + '</select></label></div>';
    var anchor = $(el.id + 'E'); anchor.parentNode.insertBefore(d, anchor.nextSibling);
    d.addEventListener('change', function (e) {
      var s = {}; d.querySelectorAll('select').forEach(function (x) { s[x.dataset.p] = x.value; });
      if (s.w && s.a && s.r) { el.value = s.w + '/' + s.a + 'R' + s.r; el.dispatchEvent(new Event('input', { bubbles: true })); }
    });
  }
  function syncPick(el) {
    var d = el.parentNode.querySelector('.sw-pick'); if (!d) return; var p = C.parseSize(el.value);
    d.querySelectorAll('select').forEach(function (x) { x.value = ''; });
    if (p.ok && p.type === 'metric') { var set = function (k, v) { var s = d.querySelector('[data-p=' + k + ']'); if (s && Array.prototype.some.call(s.options, function (o) { return o.value === String(v); })) s.value = v; }; set('w', p.widthMm); set('a', p.aspect); set('r', p.rim); }
  }
  function parse(id, required) {  // -> parsed size or null (and shows the inline error)
    var el = $(id), p = C.parseSize(el.value), err = $(id + 'E'), blank = !String(el.value).trim();
    var msg = blank ? (required ? 'Enter a tire size, like 265/70R17.' : '') : (p.ok ? '' : p.error);
    err.textContent = msg; el.setAttribute('aria-invalid', msg ? 'true' : 'false'); syncPick(el);
    return p.ok ? p : null;
  }
  function show() { form.querySelectorAll('[data-show]').forEach(function (el) { var p = el.dataset.show.split('='), v = $(p[0]) ? $(p[0]).value : ''; el.hidden = p[1].split('|').indexOf(v) < 0; }); }

  // ---------- diagrams (to scale) ----------
  var TIRE = '#1f2937', RIM = '#cbd5e1';
  function wheel(cx, cy, d, k, stroke, dash) {
    var R = d.diaIn * k / 2, r = d.rim * k / 2;
    return '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + R.toFixed(1) + '" style="fill:' + TIRE + ';stroke:' + stroke + '" stroke-width="3"' + (dash ? ' stroke-dasharray="6 4"' : '') + '/>' +
      '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + r.toFixed(1) + '" style="fill:' + RIM + ';stroke:#64748b" stroke-width="1.5"/><circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + Math.max(2.5, r * 0.18).toFixed(1) + '" style="fill:#64748b"/>';
  }
  function sideBySide(A, B) {
    var mx = Math.max(A.diaIn, B.diaIn), k = Math.min(150 / mx, 6), ground = 176, rA = A.diaIn * k / 2, rB = B.diaIn * k / 2;
    var cxA = 14 + rA, cxB = 346 - rB, topA = ground - 2 * rA, topB = ground - 2 * rB;
    var s = '<svg class="chart sw-dia" viewBox="0 0 360 214" role="img" aria-label="Both tires drawn to the same scale: ' + esc(A.label) + ' is ' + f(A.diaIn, 1) + ' inches tall and ' + esc(B.label) + ' is ' + f(B.diaIn, 1) + ' inches tall."><title>Tires side by side, to scale</title>';
    s += '<line x1="6" x2="354" y1="' + ground + '" y2="' + ground + '" style="stroke:var(--muted)" stroke-width="1.5"/>';
    s += wheel(cxA, ground - rA, A, k, 'var(--brand-2)', false) + wheel(cxB, ground - rB, B, k, 'var(--brand)', false);
    var tt = Math.min(topA, topB), top2 = Math.max(topA, topB);
    if (Math.abs(topA - topB) > 1) s += '<line x1="' + (Math.min(cxA, cxB)).toFixed(1) + '" x2="' + (Math.max(cxA, cxB)).toFixed(1) + '" y1="' + tt.toFixed(1) + '" y2="' + tt.toFixed(1) + '" style="stroke:var(--accent)" stroke-width="2" stroke-dasharray="5 4"/>' +
      '<line x1="' + (Math.min(cxA, cxB)).toFixed(1) + '" x2="' + (Math.max(cxA, cxB)).toFixed(1) + '" y1="' + top2.toFixed(1) + '" y2="' + top2.toFixed(1) + '" style="stroke:var(--accent)" stroke-width="2" stroke-dasharray="5 4"/>';
    s += '<text x="' + cxA.toFixed(1) + '" y="196" text-anchor="middle">' + esc(A.label) + '</text><text x="' + cxA.toFixed(1) + '" y="210" text-anchor="middle">' + f(A.diaIn, 1) + ' in tall</text>';
    s += '<text x="' + cxB.toFixed(1) + '" y="196" text-anchor="middle">' + esc(B.label) + '</text><text x="' + cxB.toFixed(1) + '" y="210" text-anchor="middle">' + f(B.diaIn, 1) + ' in tall</text>';
    return s + '</svg>';
  }
  function overlay(A, B) {
    var mx = Math.max(A.diaIn, B.diaIn), k = Math.min(170 / mx, 6), cx = 180, cy = 100;
    var s = '<svg class="chart sw-dia" viewBox="0 0 360 214" role="img" aria-label="Outline overlay of both tires on the same center: the dashed outline is ' + esc(A.label) + ' and the red outline is ' + esc(B.label) + '. The new tire’s sidewall is ' + f(B.sidewallIn, 1) + ' inches against ' + f(A.sidewallIn, 1) + ' inches.\"><title>Outline overlay, same center</title>';
    var big = A.diaIn >= B.diaIn ? A : B, small = big === A ? B : A, cb = big === A ? 'var(--brand-2)' : 'var(--brand)', cs = big === A ? 'var(--brand)' : 'var(--brand-2)';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (big.diaIn * k / 2).toFixed(1) + '" style="fill:' + TIRE + ';stroke:' + cb + '" stroke-width="3"' + (big === A ? ' stroke-dasharray="6 4"' : '') + '/>';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (small.diaIn * k / 2).toFixed(1) + '" style="fill:#374151;stroke:' + cs + '" stroke-width="3"' + (small === A ? ' stroke-dasharray="6 4"' : '') + '/>';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (A.rim * k / 2).toFixed(1) + '" style="fill:' + RIM + ';stroke:#64748b" stroke-width="1.5"/>';
    if (B.rim !== A.rim) s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (B.rim * k / 2).toFixed(1) + '" style="fill:none;stroke:#64748b" stroke-width="1.5" stroke-dasharray="3 3"/>';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="3" style="fill:#64748b"/>';
    s += '<text x="180" y="200" text-anchor="middle">Same center: dashed = ' + esc(A.label) + ', red = ' + esc(B.label) + '</text></svg>';
    return s;
  }
  function single(A) {
    var k = Math.min(160 / A.diaIn, 6), cx = 180, cy = 92;
    return '<svg class="chart sw-dia" viewBox="0 0 360 214" role="img" aria-label="' + esc(A.label) + ' drawn to scale: ' + f(A.diaIn, 1) + ' inches tall, sidewall ' + f(A.sidewallIn, 1) + ' inches on a ' + A.rim + ' inch wheel."><title>Tire drawn to scale</title>' + wheel(cx, cy, A, k, 'var(--brand)', false) +
      '<text x="180" y="190" text-anchor="middle">' + esc(A.label) + ': ' + f(A.diaIn, 1) + ' in tall, ' + f(A.sidewallIn, 1) + ' in sidewall</text><text x="180" y="206" text-anchor="middle">light grey = the ' + A.rim + ' in wheel</text></svg>';
  }

  // ---------- tools ----------
  var T = {};

  function dimRows(A, B) {
    var rows = [
      ['Overall height (in)', f(A.diaIn, 2), B && f(B.diaIn, 2), B && sg(B.diaIn - A.diaIn, 2, ' in')],
      ['Overall height (mm)', f(A.diaMm, 0), B && f(B.diaMm, 0), B && sg(B.diaMm - A.diaMm, 0, ' mm')],
      ['Width (in)', f(A.widthIn, 2), B && f(B.widthIn, 2), B && sg(B.widthIn - A.widthIn, 2, ' in')],
      ['Width (mm)', f(A.widthMm, 0), B && f(B.widthMm, 0), B && sg(B.widthMm - A.widthMm, 0, ' mm')],
      ['Sidewall height (in)', f(A.sidewallIn, 2), B && f(B.sidewallIn, 2), B && sg(B.sidewallIn - A.sidewallIn, 2, ' in')],
      ['Wheel diameter (in)', f(A.rim, 0), B && f(B.rim, 0), B && sg(B.rim - A.rim, 0, ' in')],
      ['Circumference (in)', f(A.circIn, 1), B && f(B.circIn, 1), B && sg(B.circIn - A.circIn, 1, ' in')],
      ['Revolutions per mile', f(A.revsPerMile, 1), B && f(B.revsPerMile, 1), B && sg(B.revsPerMile - A.revsPerMile, 1)]];
    return rows.map(function (r) { return { c: B ? r : r.slice(0, 2) }; });
  }
  function speedRows(A, B, sp) {
    var list = C.STD_SPEEDS.slice(); if (sp > 0 && list.indexOf(sp) < 0) { list.push(sp); list.sort(function (a, b) { return a - b; }); }
    return C.speedTable(A.diaIn, B.diaIn, list).map(function (r) { return { hl: r.indicated === sp, c: [f(r.indicated, 0) + ' mph', f(r.actual, 1) + ' mph', sg(r.error, 1, ' mph')] }; });
  }
  T.compare = {
    run: function () {
      var A = parse('a', true), hasB = String($('b').value).trim() !== '', B = parse('b', false);
      if (!A) return empty('Enter your current tire size');
      if (hasB && !B) return '<div class="alert err">' + UI.icon('alert') + '<div>Fix the new tire size to compare. ' + esc(C.ERR) + '.</div></div>';
      var a = C.dims(A);
      if (!B) {
        return '<h2>' + UI.icon('chart') + esc(a.label) + ' in inches</h2>' + verdictBox('close', 'One size', f(a.diaIn, 1) + ' in tall, ' + f(a.widthIn, 1) + ' in wide', 'On a ' + a.rim + ' in wheel, with a ' + f(a.sidewallIn, 1) + ' in sidewall. Type a new size above to compare.') +
          '<div class="stats s3">' + stat('Height', f(a.diaIn, 2) + ' in') + stat('Width', f(a.widthIn, 2) + ' in') + stat('Revs per mile', f(a.revsPerMile, 0)) + '</div>' +
          tbl('Dimensions of ' + a.label, ['Measure', a.label], dimRows(a)) + single(a) + CAVEAT +
          '<p class="sw-cta"><a class="btn ghost sm" href="' + root() + 'tire-size-converter/?m=' + enc(a.label) + '">Convert to metric or find a 33 in size</a> <a class="btn ghost sm" href="' + root() + 'tire-size-finder/?s=' + enc(a.label) + '">Sizes that fit my wheel</a></p>' +
          actions(a.label + ' = ' + f(a.diaIn, 1) + ' in tall x ' + f(a.widthIn, 1) + ' in wide, ' + f(a.sidewallIn, 1) + ' in sidewall, ' + f(a.revsPerMile, 0) + ' revs per mile. ' + location.href);
      }
      var c = C.compare(A, B), A1 = c.a, B1 = c.b, sp = n('sp') || 60, mi = n('mi');
      var pct = Math.abs(c.diffPct), dir = c.diffIn > 0 ? 'taller' : 'shorter';
      var same = pct < 0.05, pctT = f(pct, 1) + '% ' + dir;
      var ts = C.trueSpeed(sp, A1.diaIn, B1.diaIn), rh = c.rideHeightIn;
      var sub = same ? 'The two sizes are the same height to within 0.05%. Speedometer and ride height will not change.' :
        'New tire is ' + pctT + ' (' + sg(c.diffIn, 2, ' in') + '). At ' + f(sp, 0) + ' mph on the speedometer you’re going ' + f(ts, 1) + ' mph. Ride height ' + sg(rh, 2, ' in') + '.';
      var h = '<h2>' + UI.icon('chart') + esc(A1.label) + ' vs ' + esc(B1.label) + '</h2>' + verdictBox(c.level, c.verdictLong, same ? 'Same height' : esc(c.verdictLong) + ': ' + pctT, sub);
      h += '<div class="stats s3">' + stat('Height change', same ? '0%' : sg(c.diffPct, 1, '%') + ' <small>' + sg(c.diffIn, 2, ' in') + '</small>') + stat('True speed at ' + f(sp, 0), f(ts, 1) + ' mph') + stat('Ride height', sg(rh, 2, ' in')) + '</div>';
      h += '<h3>Side by side</h3>' + tbl('Dimensions of ' + A1.label + ' and ' + B1.label, ['Measure', A1.label + ' (current)', B1.label + ' (new)', 'Difference'], dimRows(A1, B1));
      h += '<h3>True speed</h3>' + tbl('Indicated and true speed', ['Speedometer shows', 'You are really doing', 'Difference'], speedRows(A1, B1, sp));
      if (mi > 0) h += '<p class="cm-alt"><strong>Odometer:</strong> ' + f(mi, 0) + ' indicated miles = <strong>' + f(C.odometer(mi, A1.diaIn, B1.diaIn), 0) + ' real miles</strong>.</p>';
      h += '<h3>To scale</h3>' + sideBySide(A1, B1) + overlay(A1, B1);
      var base = '?a=' + enc(A1.label) + '&b=' + enc(B1.label);
      h += '<p class="sw-cta"><a class="btn sm" href="' + root() + 'tire-size-finder/?s=' + enc(A1.label) + '">Sizes that fit my wheel</a> <a class="btn ghost sm" href="' + root() + 'gear-ratio-calculator/' + base + '">Regear for this size</a> <a class="btn ghost sm" href="' + root() + 'speedometer-calculator/' + base + '">Speedometer fix</a></p>';
      h += '<p class="hint"><strong>How the verdict works:</strong> within 3% of the original height is a close match, over 3% up to 5% needs a clearance and speedometer check, over 5% is a big change. The 3% rule of thumb is quoted by <a href="https://www.discounttire.com/learn/tire-size-calculator" rel="noopener">Discount Tire</a> and <a href="https://www.1010tires.com/Tools/Tire-Size-Calculator" rel="noopener">1010tires</a>. It is a guideline, not a promise that the tire fits.</p>' + CAVEAT;
      return h + actions('SidewallMath: ' + A1.label + ' to ' + B1.label + ' is ' + (same ? 'the same height' : pctT + ' (' + sg(c.diffIn, 2, ' in') + ')') + ', ' + c.verdictLong.toLowerCase() + '. ' + f(sp, 0) + ' mph indicated = ' + f(ts, 1) + ' mph. Ride height ' + sg(rh, 2, ' in') + '. ' + location.href);
    } };

  T.convert = {
    run: function () {
      var P = parse('m', false), h = '', hh = n('h'), rim = n('r'), wmm = n('w'), tol = n('tl') || 0.5;
      if (P) {
        var d = C.dims(P);
        h += '<h2>' + UI.icon('chart') + 'Size to inches</h2>' + verdictBox('close', 'Converted', esc(d.label) + ' = ' + f(d.diaIn, 1) + ' × ' + f(d.widthIn, 1) + ' R' + d.rim, f(d.diaIn, 1) + ' in tall, ' + f(d.widthIn, 1) + ' in wide on a ' + d.rim + ' in wheel (' + f(d.diaMm, 0) + ' × ' + f(d.widthMm, 0) + ' mm).');
        h += '<div class="stats s3">' + stat('Height', f(d.diaIn, 2) + ' in') + stat('Width', f(d.widthIn, 2) + ' in') + stat('Sidewall', f(d.sidewallIn, 2) + ' in') + '</div>';
        h += tbl('Dimensions of ' + d.label, ['Measure', 'Inches', 'Millimetres'], [{ c: ['Overall height', f(d.diaIn, 2), f(d.diaMm, 0)] }, { c: ['Width', f(d.widthIn, 2), f(d.widthMm, 0)] }, { c: ['Sidewall height', f(d.sidewallIn, 2), f(d.sidewallMm, 0)] }, { c: ['Wheel diameter', f(d.rim, 1), f(d.rim * 25.4, 0)] }]);
        if (d.type === 'flotation') {
          var near = C.toMetricOptions(d.diaIn, d.rim, 0.4).slice(0, 4);
          h += '<p class="cm-alt">Flotation sizes are quoted in inches already. The closest calculated metric sizes on a ' + d.rim + ' in wheel are ' + (near.length ? near.map(function (o) { return '<strong>' + o.label + '</strong> (' + f(o.diaIn, 1) + ' in)'; }).join(', ') : 'not available in the standard steps') + '. Confirm a tire is made in that size.</p>';
        } else h += '<p class="hint">Height = wheel + 2 × (width × aspect ÷ 100 ÷ 25.4) = ' + d.rim + ' + 2 × (' + d.widthMm + ' × ' + d.aspect + ' ÷ 100 ÷ 25.4) = ' + f(d.diaIn, 2) + ' in.</p>';
        h += '<p class="sw-cta"><a class="btn ghost sm" href="' + root() + 'tire-size-calculator/?a=' + enc(d.label) + '">Compare with another size</a></p>';
        last = d.label + ' = ' + f(d.diaIn, 1) + ' x ' + f(d.widthIn, 1) + ' R' + d.rim + ' (' + f(d.diaIn, 1) + ' in tall, ' + f(d.widthIn, 1) + ' in wide). ';
      } else last = '';
      if (hh >= 10) {
        var opts = C.toMetricOptions(hh, rim || 0, tol, { widthMm: wmm || 0 });
        if ($('so').value === 'width') opts.sort(function (a, b) { return a.widthMm - b.widthMm || Math.abs(a.diffIn) - Math.abs(b.diffIn); });
        else if ($('so').value === 'rim') opts.sort(function (a, b) { return a.rim - b.rim || Math.abs(a.diffIn) - Math.abs(b.diffIn); });
        var shown = opts.slice(0, 60);
        h += '<h2>' + UI.icon('search') + 'A ' + f(hh, 1).replace(/\.0$/, '') + ' inch tire in metric sizes</h2>';
        h += verdictBox(opts.length ? 'close' : 'check', opts.length ? 'Calculated' : 'None found', opts.length ? f(opts.length, 0) + ' calculated metric sizes within ±' + f(tol, 2).replace(/0$/, '') + ' in of ' + f(hh, 1) + ' in' : 'No standard-step size within ±' + f(tol, 2).replace(/0$/, '') + ' in',
          (rim ? 'On a ' + rim + ' in wheel' : 'On 14 to 24 in wheels') + (wmm ? ', ' + wmm + ' mm wide' : '') + '. Calculated combinations: check that a tire is actually made in that size.');
        if (opts.length) h += tbl('Metric sizes near ' + hh + ' inches', ['Size', 'Height', 'Off by', 'Width', 'Sidewall'], shown.map(function (o) { return { c: ['<a href="' + root() + 'tire-size-calculator/?a=' + enc(o.label) + '">' + o.label + '</a>', f(o.diaIn, 1) + ' in', sg(o.diffIn, 2, ' in'), f(o.widthIn, 1) + ' in', f(o.sidewallIn, 1) + ' in'] }; }));
        if (opts.length > shown.length) h += '<p class="hint">Showing the first ' + shown.length + ' of ' + opts.length + '. Pick a wheel or a width to narrow the list.</p>';
        last += 'Metric sizes about ' + hh + ' in tall: ' + shown.slice(0, 5).map(function (o) { return o.label + ' (' + f(o.diaIn, 1) + ' in)'; }).join(', ') + '. ' + location.href;
      }
      if (!h) return empty('Enter a tire size or a height in inches');
      return h + CAVEAT + actions(last);
    } };

  T.finder = {
    run: function () {
      var S = parse('s', true); if (!S) return empty('Enter your stock tire size');
      var d = C.dims(S), tol = n('tol') || 3, mw = $('mw').value === '' ? null : n('mw'), steps = $('rs').value.split(',').filter(function (x) { return x !== ''; }).map(Number);
      if (!steps.length) return '<div class="alert">' + UI.icon('alert') + '<div>Tick at least one wheel size.</div></div>';
      var rims = steps.map(function (s) { return d.rim + s; }).filter(function (r) { return r >= 10 && r <= 26; });
      var all = C.alternates(d, tol, rims, mw == null ? {} : { maxWidthDeltaMm: mw });
      var h = '<h2>' + UI.icon('search') + 'Sizes that fit a ' + esc(d.label) + ' wheel and height</h2>';
      var best = all.slice(0, 3).map(function (o) { return o.label + ' (' + sg(o.diffPct, 1, '%') + ')'; }).join(', ');
      h += verdictBox(all.length ? 'close' : 'check', all.length ? 'Calculated' : 'None found', f(all.length, 0) + ' calculated sizes within ±' + tol + '%', all.length ? 'Closest: ' + best + '. Stock is ' + f(d.diaIn, 2) + ' in tall.' : 'Try a wider tolerance or more wheel sizes.');
      h += '<p class="hint"><strong>Calculated sizes.</strong> Check that a tire is sold in that size, that the wheel is the right width for it, and that the load index and speed rating suit your vehicle.</p>';
      rims.forEach(function (r) {
        var rows = all.filter(function (o) { return o.rim === r; }), step = r - d.rim, cap = 25;
        h += '<h3>' + r + ' in wheels <small>' + (step === 0 ? '(same as stock)' : step > 0 ? '(+' + step + ' in)' : '(' + String(step).replace('-', '−') + ' in' + (step === -1 ? ', winter' : '') + ')') + '</small></h3>';
        if (!rows.length) { h += '<p class="hint">No standard-step size within ±' + tol + '% on a ' + r + ' in wheel.</p>'; return; }
        h += tbl(r + ' inch wheel sizes within tolerance', ['Size', 'Height change', 'Height', 'Width change', 'Sidewall'], rows.slice(0, cap).map(function (o) {
          return { c: ['<a href="' + root() + 'tire-size-calculator/?a=' + enc(d.label) + '&amp;b=' + enc(o.label) + '">' + o.label + '</a>', sg(o.diffPct, 1, '%') + ' <small>' + sg(o.diffIn, 2, ' in') + '</small>', f(o.diaIn, 1) + ' in', sg(o.widthDiffMm, 0, ' mm'), f(o.sidewallIn, 1) + ' in'] }; }));
        if (rows.length > cap) h += '<p class="hint">Showing the closest ' + cap + ' of ' + rows.length + ' on this wheel. Narrow the width range to see fewer.</p>';
      });
      h += '<p class="hint">Sizes are built from standard steps (widths 155 to 355 mm in 10 mm steps, aspect ratios 25 to 85 in steps of 5) and are not a list of tires on sale. We make no claim about popularity or availability.</p>' + CAVEAT;
      return h + actions('Sizes within ±' + tol + '% of ' + d.label + ': ' + all.slice(0, 6).map(function (o) { return o.label; }).join(', ') + '. Calculated sizes: confirm they are made. ' + location.href);
    } };

  T.speedo = {
    run: function () {
      var md = $('md').value, h = '';
      if (md === 'gps') {
        var A = parse('a', true); if (!A) return empty('Enter your stock tire size');
        var d = C.dims(A), g = C.effectiveDiaFromGps(n('sd'), n('gp'), d.diaIn);
        if (!g.ok) return empty('Enter your speedometer and GPS speeds');
        var lvl = Math.abs(g.errorPct) <= 3 ? 'close' : Math.abs(g.errorPct) <= 5 ? 'check' : 'big';
        h += '<h2>' + UI.icon('chart') + 'Speedometer vs GPS</h2>' + verdictBox(lvl, Math.abs(g.errorPct) < 0.05 ? 'Accurate' : g.errorPct > 0 ? 'Reads low' : 'Reads high', 'Error ' + sg(g.errorPct, 2, '%') + ': effective tire height ' + f(g.effectiveDiaIn, 2) + ' in',
          'The speedometer says ' + f(n('sd'), 1) + ' and GPS says ' + f(n('gp'), 1) + ', so real speed is ' + f(Math.abs(g.errorPct), 2) + '% ' + (g.errorPct >= 0 ? 'above' : 'below') + ' what the dash shows. Your stock ' + esc(d.label) + ' is ' + f(d.diaIn, 2) + ' in tall; an effective height of ' + f(g.effectiveDiaIn, 2) + ' in is ' + sg(g.diffIn, 2, ' in') + ' (worn tires, pressure, or a different size can all do this).');
        var rows = C.speedTable(1, 1 + g.errorPct / 100, C.STD_SPEEDS).map(function (r) { return { c: [f(r.indicated, 0) + ' mph', f(r.actual, 1) + ' mph', sg(r.error, 1, ' mph')] }; });
        h += tbl('True speed at this error', ['Speedometer shows', 'You are really doing', 'Difference'], rows);
        h += '<p class="sw-cta"><a class="btn ghost sm" href="' + root() + 'tire-size-converter/?h=' + f(g.effectiveDiaIn, 1) + '">Metric sizes about ' + f(g.effectiveDiaIn, 1) + ' in tall</a></p>' + CAVEAT;
        return h + actions('Speedometer ' + f(n('sd'), 1) + ' vs GPS ' + f(n('gp'), 1) + ': error ' + sg(g.errorPct, 2, '%') + ', effective tire height ' + f(g.effectiveDiaIn, 2) + ' in. ' + location.href);
      }
      var oldD, newD, lblA, lblB;
      if (md === 'dia') { oldD = n('da'); newD = n('db'); lblA = f(oldD, 2) + ' in'; lblB = f(newD, 2) + ' in'; if (!(oldD > 0 && newD > 0)) return empty('Enter both tire heights in inches'); }
      else { var a = parse('a', true), b = parse('b', true); if (!a || !b) return empty('Enter both tire sizes'); var c0 = C.compare(a, b); oldD = c0.a.diaIn; newD = c0.b.diaIn; lblA = c0.a.label; lblB = c0.b.label; }
      var pct = (newD / oldD - 1) * 100, sp = n('sp') || 60, mi = n('mi'), ts = C.trueSpeed(sp, oldD, newD), lv = C.verdictFor(pct).level, low = pct > 0;
      h += '<h2>' + UI.icon('chart') + esc(lblA) + ' to ' + esc(lblB) + '</h2>' + verdictBox(lv, Math.abs(pct) < 0.05 ? 'Accurate' : low ? 'Reads low' : 'Reads high', Math.abs(pct) < 0.05 ? 'No speedometer error' : 'Real speed is ' + f(Math.abs(pct), 1) + '% ' + (low ? 'above' : 'below') + ' the speedometer',
        'At ' + f(sp, 0) + ' mph on the speedometer you’re really doing ' + f(ts, 1) + ' mph (' + sg(ts - sp, 1, ' mph') + '). The new tire is ' + f(Math.abs(pct), 1) + '% ' + (low ? 'taller' : 'shorter') + ', so each turn covers ' + (low ? 'more' : 'less') + ' road than the speedometer expects.');
      h += '<div class="stats s3">' + stat('Tire height change', sg(pct, 2, '%')) + stat('True speed at ' + f(sp, 0), f(ts, 1) + ' mph') + stat(f(mi || 10000, 0) + ' indicated miles', f(C.odometer(mi || 10000, oldD, newD), 0) + ' real') + '</div>';
      h += tbl('Indicated and true speed', ['Speedometer shows', 'You are really doing', 'Difference'], speedRows({ diaIn: oldD }, { diaIn: newD }, sp));
      if (mi > 0) h += '<p class="cm-alt"><strong>Odometer:</strong> ' + f(mi, 0) + ' indicated miles = <strong>' + f(C.odometer(mi, oldD, newD), 0) + ' real miles</strong>.</p>';
      h += '<p class="hint">True speed = indicated speed × new height ÷ old height = ' + f(sp, 0) + ' × ' + f(newD, 2) + ' ÷ ' + f(oldD, 2) + ' = ' + f(ts, 2) + ' mph. Many vehicles can be recalibrated with a programmer or at a dealer; ask for the new tire height in inches.</p>' + CAVEAT;
      return h + actions('Speedometer: ' + lblA + ' to ' + lblB + ', ' + f(sp, 0) + ' indicated = ' + f(ts, 1) + ' real mph. ' + location.href);
    } };

  T.gear = {
    run: function () {
      var a = parse('a', true), b = parse('b', true); if (!a || !b) return empty('Enter both tire sizes');
      var ax = n('ax'), tr = n('tr') || 1, sp = n('sp'), list = String($('rl').value).split(/[,\s]+/).map(parseFloat).filter(function (x) { return x > 0; });
      if (!(ax > 0)) return empty('Enter your current axle ratio, like 3.73');
      var c = C.compare(a, b), O = c.a.diaIn, N = c.b.diaIn, r = C.regear(ax, O, N, list), pct = c.diffPct;
      var rpmOf = function (ratio, dia) { return C.rpm(sp, ratio, tr, dia); }, s0 = rpmOf(ax, O);
      var rowsR = [
        { c: ['Stock tires, ' + f(ax, 2) + ' gears', f(ax, 2), f(ax, 2), f(s0, 0), '—'] },
        { c: ['New tires, same gears', f(ax, 2), f(r.effective, 2), f(rpmOf(ax, N), 0), sg(rpmOf(ax, N) - s0, 0)] }];
      if (r.nearest != null) rowsR.push({ hl: true, c: ['New tires, ' + f(r.nearest, 2) + ' gears (nearest to ' + f(r.needed, 2) + ')', f(r.nearest, 2), f(r.nearestEffective, 2), f(rpmOf(r.nearest, N), 0), sg(rpmOf(r.nearest, N) - s0, 0)] });
      var h = '<h2>' + UI.icon('chart') + esc(c.a.label) + ' to ' + esc(c.b.label) + ' with ' + f(ax, 2) + ' gears</h2>';
      h += verdictBox(c.level, c.verdictLong, 'To restore stock: ' + f(r.needed, 2) + ' (nearest in list: ' + (r.nearest != null ? f(r.nearest, 2) : '—') + ')',
        'With the new tires your ' + f(ax, 2) + ' axle acts like <strong>' + f(r.effective, 2) + '</strong> (' + sg(r.lossPct, 1, '%') + '). Tires ' + (pct >= 0 ? 'taller' : 'shorter') + ' by ' + f(Math.abs(pct), 1) + '%. At ' + f(sp, 0) + ' mph, engine speed goes from ' + f(s0, 0) + ' to ' + f(rpmOf(ax, N), 0) + ' rpm.');
      h += '<div class="stats s3">' + stat('Effective ratio, new tires', f(r.effective, 2)) + stat('Ratio to restore stock', f(r.needed, 2)) + stat('RPM at ' + f(sp, 0) + ' mph', f(rpmOf(ax, N), 0)) + '</div>';
      h += tbl('Engine RPM at cruise', ['Setup', 'Axle ratio', 'Acts like', 'RPM at ' + f(sp, 0) + ' mph', 'vs stock'], rowsR);
      if (list.length) {
        var near = list.slice().sort(function (x, y) { return x - y; });
        h += '<h3>Every ratio in your list</h3>' + tbl('Ratios and the effect on the new tires', ['Axle ratio', 'Acts like (with new tires)', 'vs your ' + f(ax, 2), 'RPM at ' + f(sp, 0) + ' mph'], near.map(function (x) {
          var eff = x * O / N; return { hl: x === r.nearest, c: [f(x, 2), f(eff, 2), sg((eff / ax - 1) * 100, 1, '%'), f(rpmOf(x, N), 0)] }; }));
      }
      h += '<p class="hint"><strong>Formulas:</strong> acts like = axle × stock height ÷ new height; ratio to restore stock = axle × new height ÷ stock height; RPM = mph × axle × top gear × 336.13 ÷ tire height (in), where 336.13 = 63,360 ÷ (60 × π). Ratios in the list are common ones: check what is made for your axle, and that gear changes are done in axle pairs.</p>' + CAVEAT;
      return h + actions('Regear: ' + c.a.label + ' to ' + c.b.label + ' on ' + f(ax, 2) + ' gears acts like ' + f(r.effective, 2) + '; ratio to restore stock ' + f(r.needed, 2) + ', nearest ' + (r.nearest != null ? f(r.nearest, 2) : '—') + '. ' + location.href);
    } };

  function offsetSvg(o, ow, nw) {
    var L = Math.max(o.oldBack, o.newBack), R = Math.max(o.oldFront, o.newFront), k = Math.min(300 / (L + R), 40), x0 = 30 + L * k + (300 - (L + R) * k) / 2;
    function box(back, front, y, st, fill, dash) { return '<rect x="' + (x0 - back * k).toFixed(1) + '" y="' + y + '" width="' + ((back + front) * k).toFixed(1) + '" height="44" rx="5" style="fill:' + fill + ';stroke:' + st + '" stroke-width="2.5"' + (dash ? ' stroke-dasharray="6 4"' : '') + '/>'; }
    var s = '<svg class="chart sw-dia" viewBox="0 0 360 200" role="img" aria-label="Cross-section of the wheels from the hub mounting face. Inboard is left, toward the suspension, and outboard is right, toward the fender. Current wheel has ' + f(o.oldBack, 2) + ' inches of backspacing and ' + f(o.oldFront, 2) + ' inches in front. New wheel has ' + f(o.newBack, 2) + ' and ' + f(o.newFront, 2) + '."><title>Wheel cross-section, to scale</title>';
    s += box(o.oldBack, o.oldFront, 44, 'var(--brand-2)', 'none', true) + box(o.newBack, o.newFront, 100, 'var(--brand)', 'color-mix(in srgb,var(--brand) 22%,transparent)', false);
    s += '<line x1="' + x0.toFixed(1) + '" x2="' + x0.toFixed(1) + '" y1="30" y2="160" style="stroke:var(--accent)" stroke-width="3"/>';
    s += '<text x="' + x0.toFixed(1) + '" y="24" text-anchor="middle">Mounting face (hub)</text><text x="12" y="176">◀ Inboard: suspension</text><text x="348" y="176" text-anchor="end">Outboard: fender ▶</text>';
    s += '<text x="' + (x0 - o.oldBack * k + 6).toFixed(1) + '" y="70">Current ' + f(ow, 1) + ' in</text><text x="' + (x0 - o.newBack * k + 6).toFixed(1) + '" y="126">New ' + f(nw, 1) + ' in</text>';
    return s + '<text x="180" y="194" text-anchor="middle">Dashed = current wheel, red = new wheel</text></svg>';
  }
  T.offset = {
    run: function () {
      var ow = n('ow'), oo = n('oo'), nw = n('nw'), no = n('no'), ob = $('ob').value.trim(), nb = $('nb').value.trim();
      if (!(ow > 0 && nw > 0)) return empty('Enter both wheel widths');
      var o = C.offset(ow, oo, nw, no, { oldBack: ob, newBack: nb }), inner = o.innerIn, outer = o.outerIn;
      var txt = 'Sits ' + f(Math.abs(outer), 2) + ' in ' + (outer >= 0 ? 'further out toward the fender' : 'further in, away from the fender') + ' and gives ' + f(Math.abs(inner), 2) + ' in ' + (inner >= 0 ? 'more' : 'less') + ' room on the inside.';
      var lv = (inner < -0.25) ? 'check' : 'close';
      var h = '<h2>' + UI.icon('chart') + f(ow, 1) + ' in ' + sg(oo, 0, ' mm') + ' to ' + f(nw, 1) + ' in ' + sg(no, 0, ' mm') + '</h2>';
      h += verdictBox(lv, inner < -0.25 ? 'Check inner clearance' : 'Compare clearances', txt, 'Inner clearance ' + sg(inner, 2, ' in') + ' (' + sg(o.innerMm, 0, ' mm') + '), outer position ' + sg(outer, 2, ' in') + ' (' + sg(o.outerMm, 0, ' mm') + '). This does not say whether the wheel fits: measure your clearances.');
      h += '<div class="stats s3">' + stat('Inside room', sg(inner, 2, ' in')) + stat('Outer poke', sg(outer, 2, ' in')) + stat('New backspacing', f(o.newBack, 2) + ' in') + '</div>';
      h += tbl('Backspacing and front spacing', ['Measure', 'Current', 'New', 'Change'], [
        { c: ['Backspacing (mounting face to inner edge)', f(o.oldBack, 2) + ' in', f(o.newBack, 2) + ' in', sg(o.newBack - o.oldBack, 2, ' in')] },
        { c: ['Front spacing (mounting face to outer edge)', f(o.oldFront, 2) + ' in', f(o.newFront, 2) + ' in', sg(o.newFront - o.oldFront, 2, ' in')] },
        { c: ['Overall width incl. flanges', f(ow + 1, 1) + ' in', f(nw + 1, 1) + ' in', sg(nw - ow, 1, ' in')] }]);
      h += offsetSvg(o, ow, nw);
      h += '<p class="hint">Backspacing = (width + 1) ÷ 2 + offset ÷ 25.4, assuming about ½ in of flange on each side (most calculators do the same). Positive offset moves the mounting face toward the outside of the wheel, so more of the wheel sits inboard. Enter measured backspacing to override. Check brake, suspension, fender and tire-width clearance before buying: this is geometry, not a fitment guarantee.</p>';
      return h + actions('Wheel offset: ' + f(ow, 1) + ' in ' + oo + ' mm to ' + f(nw, 1) + ' in ' + no + ' mm. ' + txt + ' ' + location.href);
    } };

  T.dot = {
    run: function () {
      var err = $('dcE'), r = C.dotDate($('dc').value, new Date()); err.textContent = '';
      if (!String($('dc').value).trim()) return empty('Enter the last four digits of the DOT code');
      if (!r.ok) { err.textContent = r.error; return '<div class="alert err">' + UI.icon('alert') + '<div>' + esc(r.error) + '</div></div>'; }
      var mo = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      var start = new Date(Date.UTC(r.year, 0, 1 + (r.week - 1) * 7)), mon = mo[start.getUTCMonth()], yrs = Math.floor(r.ageMonths / 12), rem = r.ageMonths % 12;
      var age = r.ageMonths < 0 ? 'a date in the future: check the digits' : (yrs ? yrs + ' year' + (yrs === 1 ? '' : 's') + (rem ? ' ' + rem + ' month' + (rem === 1 ? '' : 's') : '') : rem + ' month' + (rem === 1 ? '' : 's'));
      var h = '<h2>' + UI.icon('clock') + 'Tire date code</h2>' + verdictBox(r.ageMonths < 0 ? 'check' : 'close', 'Made in ' + mon + ' ' + r.year, 'Week ' + r.week + ' of ' + r.year + ': about ' + age + ' old', 'The last four digits of the DOT code are the week (' + String(r.week).padStart(2, '0') + ') and the last two digits of the year (' + String(r.year).slice(2) + '). Week ' + r.week + ' starts around ' + mon + ' ' + start.getUTCDate() + '.');
      h += '<p class="hint">Codes with four digits were used from 2000 onward. See the <a href="' + root() + 'how-to-read-a-tire-size/">tire size guide</a> for the rest of the sidewall.</p>';
      return h + actions('Tire date code ' + $('dc').value + ': week ' + r.week + ' of ' + r.year + ', about ' + age + ' old. ' + location.href);
    } };

  // ---------- wire up ----------
  var tl = T[tool]; if (!tl) return;
  UI.readState();
  sizeFields().forEach(enhance);
  var rsEl = $('rs');
  function syncChecks() { if (!rsEl) return; var v = rsEl.value.split(','); form.querySelectorAll('input[data-rim]').forEach(function (c) { c.checked = v.indexOf(c.dataset.rim) > -1; }); }
  if (rsEl) {
    syncChecks();
    form.addEventListener('change', function (e) { var c = e.target; if (c.dataset && c.dataset.rim != null) { var v = []; form.querySelectorAll('input[data-rim]').forEach(function (x) { if (x.checked) v.push(+x.dataset.rim); }); v.sort(function (a, b) { return a - b; }); rsEl.value = v.join(','); rsEl.dispatchEvent(new Event('input', { bubbles: true })); } });
    form.addEventListener('click', function (e) { var b = e.target.closest('button[data-rs]'); if (b) { rsEl.value = b.dataset.rs; syncChecks(); rsEl.dispatchEvent(new Event('input', { bubbles: true })); } });
  }
  function render() {
    show();
    var bad = 0; form.querySelectorAll('input[type=number]').forEach(function (el) { var b = el.value !== '' && !isFinite(+el.value); el.setAttribute('aria-invalid', b ? 'true' : 'false'); if (b) bad++; });
    history.replaceState(null, '', UI.stateURL());
    out.innerHTML = bad ? '<div class="alert err">' + UI.icon('alert') + '<div>Some numbers are not valid. Fix the highlighted fields.</div></div>' : tl.run();
    UI.syncPresets && UI.syncPresets();
  }
  var deb = UI.debounce(render, 40);
  form.addEventListener('input', deb); form.addEventListener('change', deb);
  render();
});
