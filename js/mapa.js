/* Mapa de vivienda deshabitada por AGEB */

dash.calc('ageb_mapa', {
  inputs: ['censo'],
  title: 'Vivienda deshabitada por AGEB',
  description: 'Porcentaje de viviendas particulares deshabitadas en cada AGEB urbana con 20 o más viviendas particulares; clave de 13 caracteres para unirla con los límites del mapa.',
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
OVH.mapaAcercar = (cv) => { OVH.mapaZoom = cv || null; dash.draw('ageb-mapa'); };
OVH.MAPA = ['#E6EEF8', '#BCD0EA', '#8DB0DE', '#4377BC', '#F0B47C', '#D9792A'];
OVH.binDes = (p) => (p < 5 ? 0 : p < 10 ? 1 : p < 15 ? 2 : p < 20 ? 3 : p < 30 ? 4 : 5);

dash.draw('ageb-mapa', (el) => {
  const fuentes = [dash.data('ageb_geo'), dash.data('ageb_mapa'), dash.data('ageb_top')];
  const pendiente = fuentes.find((s) => !s || s.status !== 'ok');
  if (pendiente && !OVH.status(el, pendiente)) { OVH.mapaResaltar = null; return; }
  el.classList.remove('dash-skeleton');
  const geo = OVH.rows(fuentes[0]);
  if (!geo.length) { el.replaceChildren(); return; }
  const valores = new Map(OVH.rows(fuentes[1]).map((r) => [r.CVEGEO, r]));
  const lugar = new Map(OVH.rows(fuentes[2]).map((r, i) => [String(r.CVEGEO).slice(0, 13), i + 1]));
  // d3-geo espera el anillo exterior en sentido horario; se corrige si viene al revés
  const enderezar = (g) => {
    const polis = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    return {type: 'MultiPolygon', coordinates: polis.map((anillos) => (d3.geoArea({type: 'Polygon', coordinates: anillos}) > 2 * Math.PI ? anillos.map((a) => a.slice().reverse()) : anillos))};
  };
  const feats = geo.map((r) => ({
    type: 'Feature', id: r.CVEGEO, properties: {ageb: r.AGEB},
    geometry: enderezar(typeof r.geometry === 'string' ? JSON.parse(r.geometry) : r.geometry),
  }));
  const top = feats.filter((f) => lugar.has(f.id)).sort((a, b) => lugar.get(a.id) - lugar.get(b.id));
  const todas = {type: 'FeatureCollection', features: feats};
  const W = Math.max(260, Math.floor(el.clientWidth || 600));
  const b = d3.geoPath(d3.geoMercator().fitWidth(W - 24, todas)).bounds(todas);
  const H = Math.round(Math.min(Math.max(b[1][1] - b[0][1] + 24, 300), 640));
  const foco = OVH.mapaZoom ? feats.find((f) => f.id === OVH.mapaZoom) : null;
  document.querySelectorAll('[data-mapa-reset]').forEach((bt) => { bt.disabled = !foco; });
  // Con una AGEB elegida, ocupa el centro del mapa y se ven sus vecinas
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
  const lineas = (f) => {
    const v = valores.get(f.id);
    if (!v) return [['Sin datos del Censo 2020', '', null]];
    return [
      ['Viviendas particulares', OVH.fmt(v.TVIVPAR), null],
      ['Deshabitadas', OVH.fmt(v.VIVPAR_DES), null],
      ['Porcentaje deshabitado', OVH.fmt(v.des_pct, 'pct1'), OVH.MAPA[OVH.binDes(v.des_pct)]],
    ];
  };
  const titulo = (f) => (lugar.has(f.id) ? `AGEB ${f.properties.ageb} · lugar ${lugar.get(f.id)}` : `AGEB ${f.properties.ageb}`);
  capas.on('pointermove pointerdown', (ev, f) => {
    const [x, y] = d3.pointer(ev, el);
    resalte.attr('d', path(f)).style('display', null);
    tip.show(titulo(f), lineas(f), x, y);
  }).on('pointerleave', () => { resalte.style('display', 'none'); tip.hide(); })
    .on('click', (ev, f) => OVH.mapaAcercar(f.id));
  OVH.mapaResaltar = (cv) => {
    const f = cv ? feats.find((x) => x.id === cv) : null;
    if (!f) { resalte.style('display', 'none'); tip.hide(); return; }
    resalte.attr('d', path(f)).style('display', null);
    const c = path.centroid(f);
    const k = el.clientWidth / W;
    tip.show(titulo(f), lineas(f), c[0] * k, c[1] * k);
  };
});

document.querySelectorAll('[data-mapa-reset]').forEach((b) => {
  b.addEventListener('click', () => OVH.mapaAcercar(null));
});
