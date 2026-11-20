/* Mapa de vivienda deshabitada por AGEB — versión del sitio, con calles de fondo.
 * Mapa base: OpenFreeMap (estilos Positron y Dark, datos de OpenStreetMap) con MapLibre GL.
 * Si el navegador no puede dibujar el mapa base, se usa el mapa en SVG sin calles. */

dash.calc('ageb_mapa', {
  inputs: ['censo'],
  title: 'Vivienda deshabitada por AGEB',
  description: 'Porcentaje de viviendas particulares deshabitadas en cada AGEB urbana con 20 o más viviendas particulares.',
  fn: (censo) => censo
    .filter((r) => r.NIVEL === 'ageb' && +r.TVIVPAR >= 20 && r.VIVPAR_DES !== null && r.VIVPAR_DES !== '*' && isFinite(+r.VIVPAR_DES))
    .map((r) => ({CVEGEO: r.CVEGEO.slice(0, 13), AGEB: r.AGEB, TVIVPAR: +r.TVIVPAR, VIVPAR_DES: +r.VIVPAR_DES, des_pct: (+r.VIVPAR_DES / +r.TVIVPAR) * 100})),
});

dash.calc('ageb_top_resumen', {
  inputs: ['ageb_top', 'ageb_resumen'],
  title: 'Peso de las 10 AGEB con más deshabitadas',
  description: 'Viviendas deshabitadas que suman las 10 AGEB y su parte del total de deshabitadas en AGEB urbanas.',
  fn: (ageb_top, ageb_resumen) => {
    if (!ageb_top.length || !ageb_resumen.length) return [];
    const suma = ageb_top.reduce((s, r) => s + r.VIVPAR_DES, 0);
    const total = ageb_resumen[0].deshabitadas;
    return [{deshabitadas: suma, pct: total ? (suma / total) * 100 : null}];
  },
});

window.OVH = window.OVH || {};
OVH.mapaZoom = OVH.mapaZoom || null;
OVH.MAPA = ['#E6EEF8', '#BCD0EA', '#8DB0DE', '#4377BC', '#F0B47C', '#D9792A'];
OVH.binDes = (p) => (p < 5 ? 0 : p < 10 ? 1 : p < 15 ? 2 : p < 20 ? 3 : p < 30 ? 4 : 5);

(() => {
  const ESTILOS = {claro: 'https://tiles.openfreemap.org/styles/positron', oscuro: 'https://tiles.openfreemap.org/styles/dark'};
  const oscuro = window.matchMedia('(prefers-color-scheme: dark)');
  const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)');
  let mapa = null; // {map, limites, todo, resaltar}

  const botones = () => document.querySelectorAll('[data-mapa-reset]').forEach((b) => { b.disabled = !OVH.mapaZoom; });

  // Une límites, valores del censo y lugar en el top 10
  const preparar = (fuentes) => {
    const valores = new Map(OVH.rows(fuentes[1]).map((r) => [r.CVEGEO, r]));
    const lugar = new Map(OVH.rows(fuentes[2]).map((r, i) => [String(r.CVEGEO).slice(0, 13), i + 1]));
    const enderezar = (g) => {
      const polis = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
      return {type: 'MultiPolygon', coordinates: polis.map((a) => (d3.geoArea({type: 'Polygon', coordinates: a}) > 2 * Math.PI ? a.map((r) => r.slice().reverse()) : a))};
    };
    const feats = OVH.rows(fuentes[0]).map((r) => ({
      type: 'Feature', id: r.CVEGEO, properties: {ageb: r.AGEB},
      geometry: enderezar(typeof r.geometry === 'string' ? JSON.parse(r.geometry) : r.geometry),
    }));
    return {feats, valores, lugar};
  };

  const lineas = (cv, valores) => {
    const v = valores.get(cv);
    if (!v) return [['Sin datos del Censo 2020', '', null]];
    return [
      ['Viviendas particulares', OVH.fmt(v.TVIVPAR), null],
      ['Deshabitadas', OVH.fmt(v.VIVPAR_DES), null],
      ['Porcentaje deshabitado', OVH.fmt(v.des_pct, 'pct1'), OVH.MAPA[OVH.binDes(v.des_pct)]],
    ];
  };
  const titulo = (ageb, n) => (n ? `AGEB ${ageb} · lugar ${n}` : `AGEB ${ageb}`);
  const contenido = (t, filas) => {
    const caja = document.createElement('div');
    const h = document.createElement('div');
    h.className = 'ovh-tip-t';
    h.textContent = t;
    caja.append(h);
    for (const [lab, val, col] of filas) {
      const r = document.createElement('div');
      r.className = 'ovh-tip-r';
      const sw = document.createElement('i');
      sw.style.background = col || 'transparent';
      const l = document.createElement('span');
      l.textContent = lab;
      const b = document.createElement('b');
      b.textContent = val;
      r.append(sw, l, b);
      caja.append(r);
    }
    return caja;
  };

  function crearMapa(el, datos) {
    const {feats, valores, lugar} = datos;
    const fc = {type: 'FeatureCollection', features: feats.map((f) => {
      const v = valores.get(f.id);
      return {type: 'Feature', geometry: f.geometry, properties: {
        cvegeo: f.id, ageb: f.properties.ageb, lugar: lugar.get(f.id) || 0,
        color: v ? OVH.MAPA[OVH.binDes(v.des_pct)] : '#000000', con_datos: v ? 1 : 0,
      }};
    })};
    const caja2 = (b) => [[b[0][0], b[0][1]], [b[1][0], b[1][1]]];
    const limites = new Map(fc.features.map((f) => [f.properties.cvegeo, caja2(d3.geoBounds(f))]));
    const todo = caja2(d3.geoBounds(fc));
    el.replaceChildren();
    const lienzo = document.createElement('div');
    lienzo.className = 'ovh-mapa-gl';
    el.append(lienzo);
    const map = new maplibregl.Map({
      container: lienzo,
      style: oscuro.matches ? ESTILOS.oscuro : ESTILOS.claro,
      bounds: todo,
      fitBoundsOptions: {padding: 16},
      attributionControl: false,
      cooperativeGestures: true,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      maxZoom: 17,
      locale: {
        'CooperativeGesturesHandler.WindowsHelpText': 'Usa Ctrl + rueda del ratón para acercar el mapa',
        'CooperativeGesturesHandler.MacHelpText': 'Usa ⌘ + rueda o el panel táctil para acercar el mapa',
        'CooperativeGesturesHandler.MobileHelpText': 'Usa dos dedos para mover el mapa',
        'NavigationControl.ZoomIn': 'Acercar',
        'NavigationControl.ZoomOut': 'Alejar',
        'AttributionControl.ToggleAttribution': 'Créditos del mapa',
      },
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({showCompass: false}), 'top-right');
    map.addControl(new maplibregl.AttributionControl({compact: true, customAttribution: 'Límites de AGEB: INEGI'}), 'bottom-right');

    const capas = () => {
      const oscuroAhora = oscuro.matches;
      const fg = oscuroAhora ? '#E6EAF0' : '#1F2328';
      if (!map.getSource('agebs')) map.addSource('agebs', {type: 'geojson', data: fc, promoteId: 'cvegeo'});
      const capasEstilo = map.getStyle().layers;
      // Relleno debajo de edificios y calles; contornos debajo de los nombres de calles
      const iCalles = capasEstilo.findIndex((l) => l.id === 'building' || l['source-layer'] === 'transportation');
      const bajoCalles = iCalles >= 0 ? capasEstilo[iCalles].id : undefined;
      const bajoEtiquetas = (capasEstilo.find((l, i) => i > iCalles && l.type === 'symbol') || {}).id;
      map.addLayer({id: 'ageb-relleno', type: 'fill', source: 'agebs',
        paint: {'fill-color': ['get', 'color'], 'fill-opacity': ['case', ['==', ['get', 'con_datos'], 1], oscuroAhora ? 0.68 : 0.78, 0]}}, bajoCalles);
      map.addLayer({id: 'ageb-borde', type: 'line', source: 'agebs',
        paint: {'line-color': oscuroAhora ? '#0F1620' : '#FFFFFF', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.4, 15, 1.2], 'line-opacity': 0.8}}, bajoCalles);
      map.addLayer({id: 'ageb-top', type: 'line', source: 'agebs', filter: ['>', ['get', 'lugar'], 0],
        paint: {'line-color': fg, 'line-width': 2.2}}, bajoEtiquetas);
      map.addLayer({id: 'ageb-hover', type: 'line', source: 'agebs',
        paint: {'line-color': fg, 'line-width': 3, 'line-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0]}}, bajoEtiquetas);
      map.addLayer({id: 'ageb-foco', type: 'line', source: 'agebs', filter: ['==', ['get', 'cvegeo'], OVH.mapaZoom || ''],
        paint: {'line-color': '#E3913F', 'line-width': 3.5}}, bajoEtiquetas);
    };
    map.on('style.load', capas);

    // Número de lugar sobre cada una de las 10 AGEB
    for (const f of fc.features.filter((x) => x.properties.lugar > 0)) {
      const m = document.createElement('div');
      m.className = 'ovh-rank';
      m.textContent = f.properties.lugar;
      new maplibregl.Marker({element: m}).setLngLat(d3.geoCentroid(f)).addTo(map);
    }

    const popup = new maplibregl.Popup({closeButton: false, closeOnClick: false, className: 'ovh-popup', offset: 14, maxWidth: '280px'});
    let marcado = null;
    const marcar = (cv) => {
      if (marcado && map.getSource('agebs')) map.setFeatureState({source: 'agebs', id: marcado}, {hover: false});
      marcado = cv;
      if (cv && map.getSource('agebs')) map.setFeatureState({source: 'agebs', id: cv}, {hover: true});
    };
    const props = new Map(fc.features.map((f) => [f.properties.cvegeo, f]));
    const mostrar = (cv, lngLat) => {
      const f = props.get(cv);
      if (!f) return;
      popup.setLngLat(lngLat).setDOMContent(contenido(titulo(f.properties.ageb, f.properties.lugar), lineas(cv, valores))).addTo(map);
    };
    map.on('mousemove', 'ageb-relleno', (e) => {
      const cv = e.features[0].properties.cvegeo;
      map.getCanvas().style.cursor = 'pointer';
      if (cv !== marcado) marcar(cv);
      mostrar(cv, e.lngLat);
    });
    map.on('mouseleave', 'ageb-relleno', () => { map.getCanvas().style.cursor = ''; marcar(null); popup.remove(); });
    map.on('click', 'ageb-relleno', (e) => OVH.mapaAcercar(e.features[0].properties.cvegeo));

    oscuro.addEventListener('change', () => map.setStyle(oscuro.matches ? ESTILOS.oscuro : ESTILOS.claro, {diff: false}));

    mapa = {map, limites, todo};
    OVH.mapaResaltar = (cv) => {
      if (!cv) { marcar(null); popup.remove(); return; }
      marcar(cv);
      const f = props.get(cv);
      if (f) mostrar(cv, d3.geoCentroid(f));
    };
  }

  OVH.mapaAcercar = (cv) => {
    OVH.mapaZoom = cv || null;
    botones();
    if (!mapa) { dash.draw('ageb-mapa'); return; }
    const {map, limites, todo} = mapa;
    if (map.getLayer('ageb-foco')) map.setFilter('ageb-foco', ['==', ['get', 'cvegeo'], OVH.mapaZoom || '']);
    const c = map.getContainer();
    const pad = OVH.mapaZoom ? {top: c.clientHeight * 0.28, bottom: c.clientHeight * 0.28, left: c.clientWidth * 0.3, right: c.clientWidth * 0.3} : 16;
    map.fitBounds(OVH.mapaZoom ? limites.get(OVH.mapaZoom) || todo : todo, {padding: pad, maxZoom: 16, duration: sinMovimiento.matches ? 0 : 900});
  };

  dash.draw('ageb-mapa', (el) => {
    if (mapa && el.contains(mapa.map.getContainer())) { mapa.map.resize(); return; }
    const fuentes = [dash.data('ageb_geo'), dash.data('ageb_mapa'), dash.data('ageb_top')];
    const pendiente = fuentes.find((s) => !s || s.status !== 'ok');
    if (pendiente && !OVH.status(el, pendiente)) return;
    el.classList.remove('dash-skeleton');
    if (!OVH.rows(fuentes[0]).length) { el.replaceChildren(); return; }
    const datos = preparar(fuentes);
    if (!el.dataset.sinCalles && window.maplibregl) {
      try { crearMapa(el, datos); return; } catch (e) {
        console.error('No se pudo crear el mapa con calles; se usa el mapa sin calles.', e);
        mapa = null;
        el.dataset.sinCalles = '1';
      }
    }
    mapaSvg(el, datos);
  });

  // Mapa de respaldo en SVG, sin calles (el mismo del tablero)
  function mapaSvg(el, datos) {
    const {feats, valores, lugar} = datos;
    const top = feats.filter((f) => lugar.has(f.id)).sort((a, b) => lugar.get(a.id) - lugar.get(b.id));
    const todas = {type: 'FeatureCollection', features: feats};
    const W = Math.max(260, Math.floor(el.clientWidth || 600));
    const b = d3.geoPath(d3.geoMercator().fitWidth(W - 24, todas)).bounds(todas);
    const H = Math.round(Math.min(Math.max(b[1][1] - b[0][1] + 24, 300), 640));
    const foco = OVH.mapaZoom ? feats.find((f) => f.id === OVH.mapaZoom) : null;
    botones();
    const proj = foco
      ? d3.geoMercator().fitExtent([[W * 0.38, H * 0.38], [W * 0.62, H * 0.62]], foco)
      : d3.geoMercator().fitExtent([[12, 12], [W - 12, H - 12]], todas);
    const path = d3.geoPath(proj);
    el.replaceChildren();
    const svg = d3.select(el).append('svg').attr('class', 'ovh-svg ovh-map')
      .attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%').attr('height', H).style('overflow', 'hidden')
      .attr('role', 'img').attr('aria-label', 'Mapa de las AGEB urbanas de Hermosillo coloreadas por porcentaje de vivienda deshabitada en 2020, con las 10 AGEB con más viviendas deshabitadas numeradas.');
    const capas = svg.append('g').selectAll('path').data(feats).join('path').attr('class', 'ovh-ageb').attr('d', path)
      .classed('ovh-ageb-nd', (f) => !valores.has(f.id))
      .style('fill', (f) => { const v = valores.get(f.id); return v ? OVH.MAPA[OVH.binDes(v.des_pct)] : 'transparent'; });
    svg.append('g').selectAll('path').data(top).join('path').attr('class', 'ovh-ageb-top').attr('d', path);
    if (foco) svg.append('path').attr('class', 'ovh-ageb-foco').attr('d', path(foco));
    const resalte = svg.append('path').attr('class', 'ovh-ageb-hl').style('display', 'none');
    const et = svg.append('g').attr('class', 'ovh-map-labels').selectAll('g').data(top).join('g')
      .attr('transform', (f) => { const c = path.centroid(f); return `translate(${c[0]},${c[1]})`; });
    et.append('circle').attr('r', 9);
    et.append('text').attr('dy', '0.35em').attr('text-anchor', 'middle').text((f) => lugar.get(f.id));
    const tip = OVH.tip(el);
    capas.on('pointermove pointerdown', (ev, f) => {
      const [x, y] = d3.pointer(ev, el);
      resalte.attr('d', path(f)).style('display', null);
      tip.show(titulo(f.properties.ageb, lugar.get(f.id)), lineas(f.id, valores), x, y);
    }).on('pointerleave', () => { resalte.style('display', 'none'); tip.hide(); })
      .on('click', (ev, f) => OVH.mapaAcercar(f.id));
    OVH.mapaResaltar = (cv) => {
      const f = cv ? feats.find((x) => x.id === cv) : null;
      if (!f) { resalte.style('display', 'none'); tip.hide(); return; }
      resalte.attr('d', path(f)).style('display', null);
      const c = path.centroid(f);
      const k = el.clientWidth / W;
      tip.show(titulo(f.properties.ageb, lugar.get(f.id)), lineas(f.id, valores), c[0] * k, c[1] * k);
    };
  }

  document.querySelectorAll('[data-mapa-reset]').forEach((b) => {
    b.addEventListener('click', () => OVH.mapaAcercar(null));
  });
})();
