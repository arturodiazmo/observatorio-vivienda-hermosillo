/* @ds-bundle: {"format":4,"namespace":"HCV","components":[]} */
/* Hermosillo ¿Cómo Vamos? — librería web sin dependencias: window.HCV.
   Gráficas SVG accesibles (barras, líneas, Likert, matriz de calor, spark) con tooltip,
   teclado y vista de tabla; comportamientos de pestañas, tabla ordenable, menú y chips.
   Los colores salen de tokens.css y bundle.css por clase: este archivo no contiene colores.
   Uso: <link tokens.css> <link bundle.css> <script bundle.js>; marcado con data-hcv-*. */
(function () {
  'use strict';
  var SVG = 'http://www.w3.org/2000/svg';
  var uid = 0;

  /* ---------- utilidades ---------- */
  function s(tag, attrs, parent) {
    var n = document.createElementNS(SVG, tag);
    for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function h(tag, cls, parent, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  function vacio(v) { return v == null || v === '' || isNaN(v); }
  function num(v, d) {
    if (vacio(v)) return 'Sin dato';
    return Number(v).toLocaleString('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function cambio(v, d) {
    if (vacio(v)) return 'Sin dato';
    var t = num(Math.abs(v), d);
    return v > 0 ? '+' + t : v < 0 ? '−' + t : t;
  }
  function suf(o) { return o.sufijo != null ? o.sufijo : (o.unidad === '%' ? '%' : ''); }
  function dec(o) { return o.decimales == null ? 1 : o.decimales; }
  function barraH(x, y, w, hh, r) {
    r = Math.min(r, hh / 2, w);
    if (w <= 0) return '';
    return 'M' + x + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) +
      'V' + (y + hh - r) + 'Q' + (x + w) + ',' + (y + hh) + ' ' + (x + w - r) + ',' + (y + hh) + 'H' + x + 'Z';
  }
  function pasos(min, max, n) {
    var span = max - min || 1, raw = span / (n || 4), mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var opts = [1, 2, 2.5, 5, 10], step = mag;
    for (var i = 0; i < opts.length; i++) if (opts[i] * mag >= raw) { step = opts[i] * mag; break; }
    var lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step, out = [];
    for (var v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v * 1e6) / 1e6);
    return out;
  }
  function recortar(textNode, maxW) {
    var full = textNode.textContent;
    if (!textNode.getComputedTextLength || textNode.getComputedTextLength() <= maxW) return;
    var t = full;
    while (t.length > 3 && textNode.getComputedTextLength() > maxW) { t = t.slice(0, -1); textNode.textContent = t + '…'; }
  }
  /* contraste: elige la etiqueta legible dentro de un relleno de datos */
  function rgb(c) {
    var m = /rgba?\(([^)]+)\)/.exec(c || '');
    if (m) return m[1].split(',').slice(0, 3).map(Number);
    m = /^#([0-9a-f]{6})$/i.exec((c || '').trim());
    return m ? [0, 2, 4].map(function (i) { return parseInt(m[1].substr(i, 2), 16); }) : null;
  }
  function lum(c) {
    var v = rgb(c); if (!v) return null;
    v = v.map(function (x) { x /= 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  }
  function ratio(a, b) { var x = lum(a), y = lum(b); if (x == null || y == null) return 0; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function etiquetaSobre(nodoRelleno, texto, cont) {
    var fill = getComputedStyle(nodoRelleno).fill;
    var cs = getComputedStyle(cont);
    var claro = cs.getPropertyValue('--sobre-dato-claro').trim(), oscuro = cs.getPropertyValue('--sobre-dato-oscuro').trim();
    var a = ratio(claro, fill), b = ratio(oscuro, fill);
    if (Math.max(a, b) < 4.5) { texto.parentNode && texto.parentNode.removeChild(texto); return; }
    texto.setAttribute('class', 'hcv-svg__dentro ' + (a >= b ? 'sobre-claro' : 'sobre-oscuro'));
  }

  /* ---------- tooltip (uno para toda la página) ---------- */
  var tip;
  function tooltip() {
    if (!tip) { tip = h('div', 'hcv-tip', document.body); tip.setAttribute('aria-hidden', 'true'); }
    return tip;
  }
  function mostrar(c, x, y) {
    var t = tooltip(); t.textContent = '';
    if (c.titulo) h('p', 'hcv-tip__titulo', t, c.titulo);
    (c.filas || []).forEach(function (f) {
      var r = h('p', 'hcv-tip__fila' + (f.activa ? ' activa' : ''), t);
      if (f.clave) h('i', 'hcv-tip__clave ' + f.clave, r);
      h('b', null, r, f.valor);
      if (f.etiqueta) h('span', null, r, f.etiqueta);
    });
    t.classList.add('visible');
    var vw = document.documentElement.clientWidth, w = t.offsetWidth, hh = t.offsetHeight;
    var left = Math.min(Math.max(8, x + 14), vw - w - 8), top = y - hh - 14;
    if (top < 8) top = y + 18;
    t.style.left = left + 'px'; t.style.top = top + 'px';
  }
  function ocultar() { if (tip) tip.classList.remove('visible'); }
  function texto(c) {
    return (c.titulo ? c.titulo + ': ' : '') + (c.filas || []).map(function (f) { return (f.etiqueta ? f.etiqueta + ' ' : '') + f.valor; }).join(', ');
  }

  /* navegación con teclado: una sola parada de tabulación por gráfica */
  function navegable(svg, total, activar, cols, ayuda) {
    var i = 0;
    svg.setAttribute('tabindex', '0');
    svg.setAttribute('aria-roledescription', 'gráfica interactiva');
    if (ayuda) svg.setAttribute('aria-description', ayuda);
    function ir(n) { i = Math.max(0, Math.min(total - 1, n)); activar(i, null); }
    svg.addEventListener('focus', function () { ir(i); });
    svg.addEventListener('blur', function () { activar(-1); ocultar(); });
    svg.addEventListener('keydown', function (e) {
      var k = e.key, c = cols || 1;
      if (k === 'ArrowRight') ir(cols ? i + 1 : i + 1);
      else if (k === 'ArrowLeft') ir(i - 1);
      else if (k === 'ArrowDown') ir(cols ? i + c : i + 1);
      else if (k === 'ArrowUp') ir(cols ? i - c : i - 1);
      else if (k === 'Home') ir(0);
      else if (k === 'End') ir(total - 1);
      else if (k === 'Escape') { activar(-1); ocultar(); return; }
      else return;
      e.preventDefault();
    });
    return function (n) { i = n; };
  }
  function vivo(cont) {
    var r = cont.querySelector(':scope > .hcv-oculto[aria-live]');
    if (!r) { r = h('p', 'hcv-oculto', cont); r.setAttribute('aria-live', 'polite'); }
    return r;
  }
  function leyenda(cont, items, forma) {
    var ul = h('ul', 'hcv-leyenda', cont);
    items.forEach(function (it) {
      var li = h('li', null, ul);
      h('i', 'hcv-leyenda__clave ' + (forma || 'linea') + ' ' + it.clave, li);
      li.appendChild(document.createTextNode(it.nombre));
    });
    return ul;
  }

  /* ---------- barras horizontales ---------- */
  function barras(cont, o) {
    var d = o.datos || [], dc = dec(o), sx = suf(o);
    var W = Math.max(280, cont.clientWidth || 560);
    var labelW = Math.min(220, Math.round(W * 0.42)), bh = 20, gap = 12, valW = 64, plot = W - labelW - valW;
    var max = o.max || Math.max.apply(null, d.map(function (x) { return vacio(x.valor) ? 0 : x.valor; })) || 1;
    var H = d.length * (bh + gap) - gap;
    var svg = s('svg', { viewBox: '0 -4 ' + W + ' ' + (H + 8), width: W, height: H + 8, role: 'img', class: 'hcv-svg', 'aria-label': o.descripcion || 'Gráfica de barras' }, cont);
    s('line', { x1: labelW, x2: labelW, y1: -4, y2: H + 4, class: 'hcv-svg__cero' }, svg);
    var marcas = [], hits = [], live = vivo(cont);
    d.forEach(function (x, i) {
      var y = i * (bh + gap), w = vacio(x.valor) ? 0 : Math.max(1, x.valor / max * plot);
      var et = s('text', { x: labelW - 12, y: y + bh / 2 + 4, 'text-anchor': 'end' }, svg); et.textContent = x.etiqueta;
      recortar(et, labelW - 16);
      var cls = 'hcv-m ' + (o.destacar && x.etiqueta !== o.destacar ? 's-contexto' : 's1');
      marcas.push(s('path', { d: barraH(labelW, y, w, bh, 4), class: cls }, svg));
      var v = s('text', { x: labelW + w + 6, y: y + bh / 2 + 4, class: 'hcv-svg__valor' }, svg);
      v.textContent = vacio(x.valor) ? 'Sin dato' : num(x.valor, dc) + sx;
      hits.push(s('rect', { x: 0, y: y - gap / 2, width: W, height: bh + gap, class: 'hcv-hit' }, svg));
    });
    function contenido(i) {
      var x = d[i];
      return { titulo: x.etiqueta, filas: [{ valor: vacio(x.valor) ? 'Sin dato' : num(x.valor, dc) + sx, etiqueta: o.medida || '', clave: o.destacar && x.etiqueta !== o.destacar ? 'k-contexto' : 'k1' }] };
    }
    function activar(i, pos) {
      marcas.forEach(function (m, j) { m.classList.toggle('activa', j === i); });
      if (i < 0) return;
      var c = contenido(i);
      if (!pos) { var r = marcas[i].getBoundingClientRect(); pos = { x: r.right, y: r.top }; live.textContent = texto(c); }
      mostrar(c, pos.x, pos.y);
    }
    var fijar = navegable(svg, d.length, activar, 0, 'Usa las flechas para recorrer las barras.');
    hits.forEach(function (hit, i) {
      hit.addEventListener('pointermove', function (e) { fijar(i); activar(i, { x: e.clientX, y: e.clientY }); });
      hit.addEventListener('pointerleave', function () { activar(-1); ocultar(); });
    });
  }

  /* ---------- líneas con cruceta ---------- */
  function lineas(cont, o) {
    var P = o.periodos || [], S = o.series || [], dc = dec(o), sx = suf(o);
    var n0 = 0, sf = S.map(function (x) { return x.referencia ? '-ref' : String(++n0); });
    if (S.length > 1) leyenda(cont, S.map(function (x, j) { return { nombre: x.nombre, clave: 'k' + sf[j] }; }), 'linea');
    var W = Math.max(300, cont.clientWidth || 560), H = o.alto || 260;
    var nameW = Math.max.apply(null, S.map(function (x) { return x.nombre.length; })) * 7 + 64;
    var L = 44, R = Math.min(nameW, W * 0.4), T = 10, B = 30, pw = W - L - R, ph = H - T - B;
    var all = []; S.forEach(function (x) { x.valores.forEach(function (v) { if (!vacio(v)) all.push(+v); }); });
    var lo = o.min != null ? o.min : Math.min.apply(null, all), hi = o.max != null ? o.max : Math.max.apply(null, all);
    var ticks = pasos(o.min != null ? o.min : lo - (hi - lo) * 0.1, o.max != null ? o.max : hi + (hi - lo) * 0.1, 4);
    var y0 = ticks[0], y1 = ticks[ticks.length - 1];
    function X(i) { return L + (P.length < 2 ? pw / 2 : i * pw / (P.length - 1)); }
    function Y(v) { return T + (y1 - v) / (y1 - y0 || 1) * ph; }
    var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', class: 'hcv-svg', 'aria-label': o.descripcion || 'Gráfica de líneas' }, cont);
    ticks.forEach(function (v, k) {
      s('line', { x1: L, x2: L + pw, y1: Y(v), y2: Y(v), class: k === 0 ? 'hcv-svg__cero' : 'hcv-svg__ret' }, svg);
      var t = s('text', { x: L - 8, y: Y(v) + 4, 'text-anchor': 'end', class: 'hcv-svg__eje' }, svg); t.textContent = num(v, v % 1 ? 1 : 0);
    });
    var cada = Math.max(1, Math.ceil(56 / (pw / Math.max(1, P.length - 1))));
    P.forEach(function (p, i) {
      if (i % cada && i !== P.length - 1) return;
      var t = s('text', { x: X(i), y: T + ph + 20, 'text-anchor': 'middle', class: 'hcv-svg__eje' }, svg); t.textContent = p;
    });
    var cruz = s('line', { x1: 0, x2: 0, y1: T, y2: T + ph, class: 'hcv-cruz' }, svg);
    var fin = [];
    S.forEach(function (x, j) {
      var dd = '', pen = false;
      x.valores.forEach(function (v, i) { if (vacio(v)) { pen = false; return; } dd += (pen ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(v).toFixed(1); pen = true; });
      s('path', { d: dd, class: 'hcv-l l' + sf[j] }, svg);
      for (var i = x.valores.length - 1; i >= 0; i--) if (!vacio(x.valores[i])) { fin.push({ j: j, i: i, v: x.valores[i], y: Y(x.valores[i]) }); break; }
    });
    fin.sort(function (a, b) { return a.y - b.y; });
    for (var k = 1; k < fin.length; k++) if (fin[k].y - fin[k - 1].y < 16) fin[k].y = fin[k - 1].y + 16;
    fin.forEach(function (f) {
      s('circle', { cx: X(f.i), cy: Y(f.v), r: 5, class: 'hcv-p p' + sf[f.j] }, svg);
      var t = s('text', { x: X(f.i) + 10, y: f.y + 4, class: 'hcv-svg__valor' }, svg); t.textContent = num(f.v, dc) + sx;
      var n = s('text', { x: X(f.i) + 10 + (t.getComputedTextLength ? t.getComputedTextLength() : 40) + 6, y: f.y + 4 }, svg); n.textContent = S[f.j].nombre;
    });
    var puntos = S.map(function (x, j) { return s('circle', { r: 5, class: 'hcv-p p' + sf[j] + ' hcv-oculta' }, svg); });
    var hit = s('rect', { x: L, y: T, width: pw, height: ph, class: 'hcv-hit' }, svg);
    var live = vivo(cont);
    function contenido(i) {
      return { titulo: P[i], filas: S.map(function (x, j) { return { valor: vacio(x.valores[i]) ? 'Sin dato' : num(x.valores[i], dc) + sx, etiqueta: x.nombre, clave: 'k' + sf[j] }; }) };
    }
    function activar(i, pos) {
      if (i < 0) { cruz.classList.remove('visible'); puntos.forEach(function (p) { p.classList.add('hcv-oculta'); }); return; }
      cruz.setAttribute('x1', X(i)); cruz.setAttribute('x2', X(i)); cruz.classList.add('visible');
      S.forEach(function (x, j) {
        var v = x.valores[i];
        if (vacio(v)) { puntos[j].classList.add('hcv-oculta'); return; }
        puntos[j].setAttribute('cx', X(i)); puntos[j].setAttribute('cy', Y(v)); puntos[j].classList.remove('hcv-oculta');
      });
      var c = contenido(i);
      if (!pos) { var r = svg.getBoundingClientRect(), sc = r.width / W; pos = { x: r.left + X(i) * sc, y: r.top + T * sc + 8 }; live.textContent = texto(c); }
      mostrar(c, pos.x, pos.y);
    }
    var fijar = navegable(svg, P.length, activar, 0, 'Usa las flechas izquierda y derecha para recorrer los periodos.');
    hit.addEventListener('pointermove', function (e) {
      var r = svg.getBoundingClientRect(), sc = r.width / W, xx = (e.clientX - r.left) / sc;
      var i = Math.round((xx - L) / (pw / Math.max(1, P.length - 1)));
      i = Math.max(0, Math.min(P.length - 1, i)); fijar(i); activar(i, { x: e.clientX, y: e.clientY });
    });
    hit.addEventListener('pointerleave', function () { activar(-1); ocultar(); });
  }

  /* ---------- escala Likert divergente ---------- */
  function likert(cont, o) {
    var C = o.categorias || ['Muy mal', 'Mal', 'Regular', 'Bien', 'Muy bien'], F = o.filas || [], dc = o.decimales == null ? 0 : o.decimales;
    leyenda(cont, C.map(function (c, k) { return { nombre: c, clave: 'kd' + k }; }), 'bloque');
    var W = Math.max(300, cont.clientWidth || 560), labelW = Math.min(180, Math.round(W * 0.3)), bh = 24, gap = 14, pad = 8;
    var izq = 0, der = 0;
    F.forEach(function (f) { var v = f.valores; izq = Math.max(izq, v[0] + v[1] + v[2] / 2); der = Math.max(der, v[4] + v[3] + v[2] / 2); });
    var plot = W - labelW - pad, k = plot / (izq + der || 1), cx = labelW + izq * k;
    var H = F.length * (bh + gap) - gap;
    var svg = s('svg', { viewBox: '0 -6 ' + W + ' ' + (H + 12), width: W, height: H + 12, role: 'img', class: 'hcv-svg', 'aria-label': o.descripcion || 'Escala de valoración' }, cont);
    var filas = [], live = vivo(cont);
    s('line', { x1: cx, x2: cx, y1: -6, y2: H + 6, class: 'hcv-svg__cero' }, svg);
    F.forEach(function (f, i) {
      var y = i * (bh + gap), v = f.valores, x = cx - (v[0] + v[1] + v[2] / 2) * k, segs = [];
      var et = s('text', { x: labelW - 12, y: y + bh / 2 + 4, 'text-anchor': 'end' }, svg); et.textContent = f.etiqueta; recortar(et, labelW - 16);
      v.forEach(function (val, c) {
        var w = val * k;
        var r = s('rect', { x: x + 1, y: y, width: Math.max(0, w - 2), height: bh, class: 'hcv-m d' + c }, svg);
        segs.push(r);
        if (w >= 36) { var t = s('text', { x: x + w / 2, y: y + bh / 2 + 4, 'text-anchor': 'middle' }, svg); t.textContent = num(val, dc); etiquetaSobre(r, t, cont); }
        x += w;
      });
      filas.push(segs);
      s('rect', { x: 0, y: y - gap / 2, width: W, height: bh + gap, class: 'hcv-hit', 'data-i': i }, svg);
    });
    function contenido(i) {
      return { titulo: F[i].etiqueta, filas: C.map(function (c, j) { return { valor: num(F[i].valores[j], dc) + '%', etiqueta: c, clave: 'kd' + j }; }) };
    }
    function activar(i, pos) {
      filas.forEach(function (segs, j) { segs.forEach(function (r) { r.classList.toggle('activa', j === i); }); });
      if (i < 0) return;
      var c = contenido(i);
      if (!pos) { var r = filas[i][4].getBoundingClientRect(); pos = { x: r.right, y: r.top }; live.textContent = texto(c); }
      mostrar(c, pos.x, pos.y);
    }
    var fijar = navegable(svg, F.length, activar, 0, 'Usa las flechas para recorrer las filas.');
    svg.querySelectorAll('.hcv-hit').forEach(function (hit) {
      var i = +hit.getAttribute('data-i');
      hit.addEventListener('pointermove', function (e) { fijar(i); activar(i, { x: e.clientX, y: e.clientY }); });
      hit.addEventListener('pointerleave', function () { activar(-1); ocultar(); });
    });
  }

  /* ---------- matriz de calor (rampa secuencial) ---------- */
  function calor(cont, o) {
    var Fi = o.filas || [], Co = o.columnas || [], V = o.valores || [], dc = dec(o), sx = suf(o);
    var all = []; V.forEach(function (r) { r.forEach(function (v) { if (!vacio(v)) all.push(+v); }); });
    var mn = Math.min.apply(null, all), mx = Math.max.apply(null, all);
    var cortes = o.cortes || [1, 2, 3, 4].map(function (q) { return mn + (mx - mn) * q / 5; });
    function paso(v) { if (vacio(v)) return 0; var q = 1; cortes.forEach(function (c) { if (v > c) q++; }); return o.invertir ? 6 - q : q; }
    var W = Math.max(300, cont.clientWidth || 560), labelW = Math.min(160, Math.round(W * 0.26)), top = 24, ch = 36;
    var cw = (W - labelW) / Co.length, H = top + Fi.length * ch;
    var id = 'hcv-trama-' + (++uid);
    var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', class: 'hcv-svg', 'aria-label': o.descripcion || 'Matriz de calor' }, cont);
    var pat = s('pattern', { id: id, width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, s('defs', {}, svg));
    s('rect', { width: 6, height: 6, class: 'q0' }, pat); s('line', { x1: 0, y1: 0, x2: 0, y2: 6, class: 'hcv-trama' }, pat);
    Co.forEach(function (c, j) { var t = s('text', { x: labelW + cw * j + cw / 2, y: 14, 'text-anchor': 'middle', class: 'hcv-svg__eje' }, svg); t.textContent = c; });
    var celdas = [], live = vivo(cont);
    Fi.forEach(function (f, i) {
      var et = s('text', { x: labelW - 12, y: top + ch * i + ch / 2 + 4, 'text-anchor': 'end' }, svg); et.textContent = f; recortar(et, labelW - 16);
      Co.forEach(function (c, j) {
        var v = (V[i] || [])[j], q = paso(v);
        var r = s('rect', { x: labelW + cw * j + 1, y: top + ch * i + 1, width: cw - 2, height: ch - 2, class: 'hcv-m ' + (q ? 'q' + q : 'qs'), fill: q ? null : 'url(#' + id + ')' }, svg);
        celdas.push({ r: r, i: i, j: j });
        if (q && cw >= 40) { var t = s('text', { x: labelW + cw * j + cw / 2, y: top + ch * i + ch / 2 + 4, 'text-anchor': 'middle' }, svg); t.textContent = num(v, dc); etiquetaSobre(r, t, cont); }
        r.addEventListener('pointermove', function (e) { fijar(i * Co.length + j); activar(i * Co.length + j, { x: e.clientX, y: e.clientY }); });
        r.addEventListener('pointerleave', function () { activar(-1); ocultar(); });
      });
    });
    var ley = h('ul', 'hcv-leyenda', cont), lims = [mn].concat(cortes, [mx]);
    for (var q = 1; q <= 5; q++) {
      var li = h('li', null, ley); h('i', 'hcv-leyenda__clave bloque ks' + (o.invertir ? 6 - q : q), li);
      li.appendChild(document.createTextNode(num(lims[q - 1], dc) + '–' + num(lims[q], dc) + sx));
    }
    if (all.length < Fi.length * Co.length) { var li0 = h('li', null, ley); h('i', 'hcv-leyenda__clave bloque ks0', li0); li0.appendChild(document.createTextNode('Sin dato')); }
    function contenido(n) {
      var c = celdas[n], v = (V[c.i] || [])[c.j];
      return { titulo: Fi[c.i] + ' · ' + Co[c.j], filas: [{ valor: vacio(v) ? 'Sin dato' : num(v, dc) + sx, etiqueta: o.medida || '', clave: 'ks' + paso(v) }] };
    }
    function activar(n, pos) {
      celdas.forEach(function (c, k) { c.r.classList.toggle('activa', k === n); });
      if (n < 0) return;
      var c = contenido(n);
      if (!pos) { var r = celdas[n].r.getBoundingClientRect(); pos = { x: r.left + r.width / 2, y: r.top }; live.textContent = texto(c); }
      mostrar(c, pos.x, pos.y);
    }
    var fijar = navegable(svg, celdas.length, activar, Co.length, 'Usa las flechas para recorrer las celdas.');
  }

  /* ---------- spark (minilínea para tarjetas KPI) ---------- */
  function spark(cont, o) {
    var v = o.valores || [], W = Math.max(80, cont.clientWidth || 200), H = o.alto || 40;
    var ok = v.filter(function (x) { return !vacio(x); }), lo = Math.min.apply(null, ok), hi = Math.max.apply(null, ok);
    function X(i) { return 5 + i * (W - 10) / Math.max(1, v.length - 1); }
    function Y(x) { return 5 + (hi - x) / (hi - lo || 1) * (H - 10); }
    var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, class: 'hcv-svg', 'aria-hidden': 'true' }, cont);
    var d = ''; v.forEach(function (x, i) { if (!vacio(x)) d += (d ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(x).toFixed(1); });
    s('path', { d: d, class: 'hcv-l l1' }, svg);
    var last = v.length - 1; while (last > 0 && vacio(v[last])) last--;
    s('circle', { cx: X(last), cy: Y(v[last]), r: 4, class: 'hcv-p p1' }, svg);
  }

  /* ---------- tabla y CSV a partir de los mismos datos ---------- */
  function filasDe(tipo, o) {
    if (tipo === 'barras') return [['Categoría', o.medida || 'Valor']].concat((o.datos || []).map(function (x) { return [x.etiqueta, x.valor]; }));
    if (tipo === 'lineas') return [['Periodo'].concat(o.series.map(function (x) { return x.nombre; }))].concat(o.periodos.map(function (p, i) { return [p].concat(o.series.map(function (x) { return x.valores[i]; })); }));
    if (tipo === 'likert') return [[''].concat(o.categorias)].concat(o.filas.map(function (f) { return [f.etiqueta].concat(f.valores); }));
    if (tipo === 'calor') return [[''].concat(o.columnas)].concat(o.filas.map(function (f, i) { return [f].concat(o.valores[i]); }));
    return [];
  }
  function tabla(cont, tipo, o) {
    var rows = filasDe(tipo, o), dc = tipo === 'likert' ? (o.decimales || 0) : dec(o);
    var t = h('table', 'hcv-tabla tabla hcv-num', cont), thead = h('thead', null, t), tb = h('tbody', null, t);
    var tr = h('tr', null, thead);
    rows[0].forEach(function (c, j) { var th = h('th', j ? 'n' : null, tr, c); th.setAttribute('scope', 'col'); });
    rows.slice(1).forEach(function (r) {
      var tr2 = h('tr', null, tb);
      r.forEach(function (c, j) { if (j === 0) { var th = h('th', null, tr2, c); th.setAttribute('scope', 'row'); } else h('td', 'n', tr2, num(c, dc)); });
    });
    return t;
  }
  function csv(tipo, o) {
    return filasDe(tipo, o).map(function (r) {
      return r.map(function (c) { c = c == null ? '' : String(c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(',');
    }).join('\n');
  }

  /* ---------- registro y montaje declarativo ---------- */
  var tipos = { barras: barras, lineas: lineas, likert: likert, calor: calor, spark: spark };
  function datosDe(el) {
    if (el._hcvDatos) return el._hcvDatos;
    var sc = el.querySelector('script[type="application/json"]');
    try { el._hcvDatos = sc ? JSON.parse(sc.textContent) : null; } catch (e) { el._hcvDatos = null; }
    return el._hcvDatos;
  }
  function dibujar(el) {
    var tipo = el.getAttribute('data-hcv-grafica'), o = datosDe(el), fn = tipos[tipo];
    if (!fn || !o) return;
    var lienzo = el.querySelector(':scope > .hcv-lienzo') || h('div', 'hcv-lienzo', el);
    if (!el.offsetParent && el.getClientRects().length === 0) { el._hcvPendiente = true; return; }
    lienzo.textContent = '';
    fn(lienzo, o);
    el._hcvAncho = lienzo.clientWidth; el._hcvPendiente = false;
  }
  var ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(function (ents) {
    ents.forEach(function (e) {
      var el = e.target, w = Math.round(e.contentRect.width);
      if (w && (el._hcvPendiente || Math.abs(w - (el._hcvAncho || 0)) > 4)) dibujar(el);
    });
  }) : null;

  function pestanas(root) {
    var tabs = [].slice.call(root.querySelectorAll('[role="tab"]'));
    function sel(t, foco) {
      tabs.forEach(function (x) {
        var on = x === t, p = document.getElementById(x.getAttribute('aria-controls'));
        x.setAttribute('aria-selected', on ? 'true' : 'false'); x.tabIndex = on ? 0 : -1;
        if (p) { p.hidden = !on; if (on) p.querySelectorAll('[data-hcv-grafica]').forEach(function (g) { if (g._hcvPendiente || !g._hcvAncho) dibujar(g); }); }
      });
      if (foco) t.focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { sel(t); });
      t.addEventListener('keydown', function (e) {
        var n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null;
        if (n == null) return; e.preventDefault(); sel(tabs[(n + tabs.length) % tabs.length], true);
      });
    });
    var actual = tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0] || tabs[0];
    if (actual) sel(actual);
  }
  function ordenable(t) {
    t.querySelectorAll('thead th').forEach(function (th, col) {
      var b = th.querySelector('button'); if (!b) return;
      b.addEventListener('click', function () {
        var asc = th.getAttribute('aria-sort') !== 'ascending';
        t.querySelectorAll('thead th').forEach(function (x) { x.removeAttribute('aria-sort'); });
        th.setAttribute('aria-sort', asc ? 'ascending' : 'descending');
        var tb = t.tBodies[0], rows = [].slice.call(tb.rows);
        rows.sort(function (a, b2) {
          var x = a.cells[col].textContent.trim(), y = b2.cells[col].textContent.trim();
          var nx = parseFloat(x.replace(/[^0-9.\-−]/g, '').replace('−', '-')), ny = parseFloat(y.replace(/[^0-9.\-−]/g, '').replace('−', '-'));
          var r = (!isNaN(nx) && !isNaN(ny)) ? nx - ny : x.localeCompare(y, 'es');
          return asc ? r : -r;
        });
        rows.forEach(function (r) { tb.appendChild(r); });
      });
    });
  }
  function menu(btn) {
    var nav = document.getElementById(btn.getAttribute('aria-controls')); if (!nav) return;
    function poner(abierto) { btn.setAttribute('aria-expanded', abierto ? 'true' : 'false'); nav.classList.toggle('abierto', abierto); }
    btn.addEventListener('click', function () { poner(btn.getAttribute('aria-expanded') !== 'true'); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') { poner(false); btn.focus(); } });
  }
  function chips(g) {
    var unico = g.hasAttribute('data-unico');
    g.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        var on = b.getAttribute('aria-pressed') !== 'true';
        if (unico) { g.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); on = true; }
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        var vals = [].slice.call(g.querySelectorAll('button[aria-pressed="true"]')).map(function (x) { return x.value || x.textContent.trim(); });
        g.dispatchEvent(new CustomEvent('hcv:cambio', { bubbles: true, detail: vals }));
      });
    });
  }
  function una(el, marca, fn) { if (el['_hcv' + marca]) return; el['_hcv' + marca] = true; fn(el); }

  function init(root) {
    root = root || document;
    root.querySelectorAll('[data-hcv-grafica]').forEach(function (el) {
      una(el, 'G', function () { dibujar(el); if (ro) ro.observe(el); });
    });
    root.querySelectorAll('[data-hcv-tabla]').forEach(function (el) {
      una(el, 'T', function () {
        var g = document.getElementById(el.getAttribute('data-hcv-tabla')); if (!g) return;
        var o = datosDe(g); if (o) tabla(el, g.getAttribute('data-hcv-grafica'), o);
      });
    });
    root.querySelectorAll('a[data-hcv-csv]').forEach(function (a) {
      una(a, 'C', function () {
        a.addEventListener('click', function (e) {
          var g = document.getElementById(a.getAttribute('data-hcv-csv')); if (!g) return;
          e.preventDefault();
          var blob = new Blob(['﻿' + csv(g.getAttribute('data-hcv-grafica'), datosDe(g))], { type: 'text/csv;charset=utf-8' });
          var u = URL.createObjectURL(blob), tmp = h('a', null, document.body);
          tmp.href = u; tmp.download = a.getAttribute('download') || 'datos.csv'; tmp.click(); tmp.remove();
          setTimeout(function () { URL.revokeObjectURL(u); }, 1000);
        });
      });
    });
    root.querySelectorAll('[data-hcv="pestanas"]').forEach(function (el) { una(el, 'P', pestanas); });
    root.querySelectorAll('table[data-hcv="ordenable"]').forEach(function (el) { una(el, 'O', ordenable); });
    root.querySelectorAll('[data-hcv="menu"]').forEach(function (el) { una(el, 'M', menu); });
    root.querySelectorAll('[data-hcv="chips"]').forEach(function (el) { una(el, 'X', chips); });
  }

  window.HCV = {
    version: '1.0.0',
    init: init,
    graficas: { barras: barras, lineas: lineas, likert: likert, calor: calor, spark: spark },
    dibujar: dibujar,
    tabla: tabla,
    csv: csv,
    formato: { numero: num, cambio: cambio },
    tooltip: { mostrar: mostrar, ocultar: ocultar }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(document); });
  else init(document);
})();
