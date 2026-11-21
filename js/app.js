/* Observatorio de Vivienda de Hermosillo — cálculos y dibujos */

/* ---------- Cálculos ---------- */

dash.calc('shf_ultimo', {
  inputs: ['shf'],
  title: 'Índice SHF: último trimestre',
  description: 'Variación anual del último trimestre publicado y variación del índice a cinco años, por serie.',
  fn: (shf) => {
    const filas = shf.map((r) => ({
      serie: r.serie, anio: +r.anio, trimestre: +r.trimestre, indice: +r.indice_2017_100,
      var_anual_pct: r.var_anual_pct === null || r.var_anual_pct === '' ? null : +r.var_anual_pct,
    }));
    if (!filas.length) return [];
    const k = Math.max(...filas.map((r) => r.anio * 10 + r.trimestre));
    const anio = Math.floor(k / 10);
    const trimestre = k % 10;
    return ['Hermosillo', 'Sonora', 'Nacional', 'Cajeme'].map((serie) => {
      const hoy = filas.find((r) => r.serie === serie && r.anio === anio && r.trimestre === trimestre);
      const antes = filas.find((r) => r.serie === serie && r.anio === anio - 5 && r.trimestre === trimestre);
      return {
        serie, periodo: `${trimestre}T-${anio}`, anio, trimestre,
        indice: hoy ? hoy.indice : null,
        var_anual_pct: hoy ? hoy.var_anual_pct : null,
        var_5a_pct: hoy && antes ? (hoy.indice / antes.indice - 1) * 100 : null,
      };
    });
  },
});

dash.calc('fin_anual', {
  inputs: ['financiamiento'],
  title: 'Créditos por año y organismo',
  description: 'Suma de acciones de financiamiento por año; Infonavit, banca (CNBV), Fovissste y CONAVI por separado y el resto como Otros.',
  fn: (financiamiento) => {
    const grupo = (o) => ({'INFONAVIT': 'Infonavit', 'BANCA (CNBV)': 'Banca', 'FOVISSSTE': 'Fovissste', 'CONAVI': 'CONAVI'})[o] || 'Otros';
    const por = new Map();
    for (const r of financiamiento) {
      const a = +r.anio;
      if (!por.has(a)) por.set(a, {anio: a, meses: new Set(), Infonavit: 0, Banca: 0, CONAVI: 0, Fovissste: 0, Otros: 0, total: 0});
      const o = por.get(a);
      o.meses.add(+r.mes_num);
      o[grupo(r.organismo)] += +r.acciones;
      o.total += +r.acciones;
    }
    return [...por.values()].sort((x, y) => x.anio - y.anio).map((o) => ({...o, meses: o.meses.size}));
  },
});

dash.calc('kpi_fin', {
  inputs: ['fin_anual'],
  title: 'Créditos: último año completo',
  description: 'Total del último año con 12 meses, el año anterior y su cambio; también el año en curso y sus meses.',
  fn: (fin_anual) => {
    const completos = fin_anual.filter((r) => r.meses === 12);
    if (completos.length < 2) return [];
    const u = completos[completos.length - 1];
    const p = completos[completos.length - 2];
    const ultimo = fin_anual[fin_anual.length - 1];
    return [{
      anio: u.anio, total: u.total, anio_prev: p.anio, total_prev: p.total,
      cambio_pct: (u.total / p.total - 1) * 100, anio_parcial: ultimo.anio, meses_parcial: ultimo.meses,
    }];
  },
});

dash.calc('fin_organismo', {
  inputs: ['financiamiento', 'kpi_fin'],
  title: 'Créditos y monto promedio por organismo',
  description: 'Para el último año completo: acciones por organismo, su participación y el monto promedio de los créditos para vivienda nueva y existente.',
  fn: (financiamiento, kpi_fin) => {
    if (!kpi_fin || !kpi_fin.length) return [];
    const anio = kpi_fin[0].anio;
    const grupo = (o) => ({'INFONAVIT': 'Infonavit', 'BANCA (CNBV)': 'Banca', 'FOVISSSTE': 'Fovissste', 'CONAVI': 'CONAVI'})[o] || 'Otros';
    const orden = ['Infonavit', 'Banca', 'CONAVI', 'Fovissste', 'Otros'];
    const g = new Map(orden.map((k) => [k, {acciones: 0, adq_acciones: 0, adq_monto: 0}]));
    let total = 0;
    for (const r of financiamiento) {
      if (+r.anio !== anio) continue;
      const o = g.get(grupo(r.organismo));
      o.acciones += +r.acciones;
      total += +r.acciones;
      if (r.destino_credito === 'Vivienda nueva' || r.destino_credito === 'Vivienda existente') {
        o.adq_acciones += +r.acciones;
        o.adq_monto += +r.monto;
      }
    }
    return orden.map((k) => {
      const o = g.get(k);
      return {grupo: k, anio, acciones: o.acciones, pct: total ? (o.acciones / total) * 100 : null, monto_prom_adq: o.adq_acciones ? o.adq_monto / o.adq_acciones : null};
    });
  },
});

dash.calc('monto_ratio', {
  inputs: ['fin_organismo'],
  title: 'Banca frente a Infonavit: monto promedio',
  description: 'Cuántas veces es el monto promedio de un crédito bancario para comprar vivienda respecto al de Infonavit, último año completo.',
  fn: (fin_organismo) => {
    const b = fin_organismo.find((r) => r.grupo === 'Banca');
    const i = fin_organismo.find((r) => r.grupo === 'Infonavit');
    if (!b || !i || !b.monto_prom_adq || !i.monto_prom_adq) return [];
    return [{anio: b.anio, banca: b.monto_prom_adq, infonavit: i.monto_prom_adq, veces: b.monto_prom_adq / i.monto_prom_adq}];
  },
});

dash.calc('ingreso', {
  inputs: ['perfil', 'kpi_fin'],
  title: 'Créditos por ingreso del acreditado',
  description: 'Acciones del último año completo por rango salarial del acreditado (veces UMA) y su participación.',
  fn: (perfil, kpi_fin) => {
    if (!kpi_fin || !kpi_fin.length) return [];
    const anio = kpi_fin[0].anio;
    const orden = ['2.6 o menos', '2.61 a 4.00', '4.01 a 6.00', '6.01 a 9.00', '9.01 a 12.00', 'Más de 12', 'No disponible'];
    const suma = new Map(orden.map((k) => [k, 0]));
    let total = 0;
    for (const r of perfil) {
      if (+r.anio !== anio) continue;
      suma.set(r.rango_salarial, (suma.get(r.rango_salarial) || 0) + +r.acciones);
      total += +r.acciones;
    }
    return orden.map((rango) => ({rango, anio, acciones: suma.get(rango), pct: total ? (suma.get(rango) / total) * 100 : null}));
  },
});

dash.calc('ingreso_bajo', {
  inputs: ['ingreso'],
  title: 'Créditos a ingresos de hasta 4 UMA',
  description: 'Participación de los rangos 2.6 o menos y 2.61 a 4.00 veces UMA en el total de créditos del año.',
  fn: (ingreso) => {
    if (!ingreso.length) return [];
    const bajo = ingreso.filter((r) => r.rango === '2.6 o menos' || r.rango === '2.61 a 4.00').reduce((s, r) => s + r.acciones, 0);
    const total = ingreso.reduce((s, r) => s + r.acciones, 0);
    return [{anio: ingreso[0].anio, acciones: bajo, total, pct: total ? (bajo / total) * 100 : null}];
  },
});

dash.calc('oferta_anual', {
  inputs: ['oferta'],
  title: 'Oferta de vivienda nueva por año',
  description: 'Viviendas registradas, verificadas y terminadas (producción) por año, y meses con datos.',
  fn: (oferta) => {
    const por = new Map();
    for (const r of oferta) {
      const a = +r.anio;
      if (!por.has(a)) por.set(a, {anio: a, meses: 0, registro: 0, verificacion: 0, produccion: 0});
      const o = por.get(a);
      o[r.etapa] += +r.viviendas;
      o.meses = Math.max(o.meses, +r.mes_num);
    }
    return [...por.values()].sort((x, y) => x.anio - y.anio);
  },
});

dash.calc('kpi_oferta', {
  inputs: ['oferta_anual', 'oferta'],
  title: 'Registro: último año completo',
  description: 'Viviendas registradas en el último año completo, el anterior, su cambio y la parte vertical del registro.',
  fn: (oferta_anual, oferta) => {
    const completos = oferta_anual.filter((r) => r.meses === 12);
    if (completos.length < 2) return [];
    const u = completos[completos.length - 1];
    const p = completos[completos.length - 2];
    const vertical = oferta.filter((r) => r.etapa === 'registro' && +r.anio === u.anio && r.tipo_vivienda === 'Vertical').reduce((s, r) => s + +r.viviendas, 0);
    const ultimo = oferta_anual[oferta_anual.length - 1];
    return [{
      anio: u.anio, registro: u.registro, anio_prev: p.anio, registro_prev: p.registro,
      cambio_pct: (u.registro / p.registro - 1) * 100, vertical, vertical_pct: (vertical / u.registro) * 100,
      anio_parcial: ultimo.anio, meses_parcial: ultimo.meses,
    }];
  },
});

dash.calc('registro_pcu', {
  inputs: ['oferta', 'kpi_oferta'],
  title: 'Registro por perímetro de contención urbana',
  description: 'Viviendas registradas en el último año completo por perímetro de contención urbana (U1, U2, U3 y fuera de contención).',
  fn: (oferta, kpi_oferta) => {
    if (!kpi_oferta || !kpi_oferta.length) return [];
    const anio = kpi_oferta[0].anio;
    const orden = ['U1', 'U2', 'U3', 'FC'];
    const suma = new Map(orden.map((k) => [k, 0]));
    let total = 0;
    for (const r of oferta) {
      if (r.etapa !== 'registro' || +r.anio !== anio) continue;
      suma.set(r.pcu, (suma.get(r.pcu) || 0) + +r.viviendas);
      total += +r.viviendas;
    }
    return orden.map((pcu) => ({pcu, anio, viviendas: suma.get(pcu), pct: total ? (suma.get(pcu) / total) * 100 : null}));
  },
});

dash.calc('inv_mensual', {
  inputs: ['inventario'],
  title: 'Inventario de vivienda nueva por mes',
  description: 'Suma de viviendas en inventario al cierre de cada mes.',
  fn: (inventario) => {
    const por = new Map();
    for (const r of inventario) {
      const fecha = `${r.corte_anio}-${String(r.corte_mes).padStart(2, '0')}`;
      if (!por.has(fecha)) por.set(fecha, {fecha, anio: +r.corte_anio, mes: +r.corte_mes, viviendas: 0});
      por.get(fecha).viviendas += +r.viviendas;
    }
    return [...por.values()].sort((x, y) => (x.fecha < y.fecha ? -1 : 1));
  },
});

dash.calc('kpi_inv', {
  inputs: ['inv_mensual'],
  title: 'Inventario: último mes',
  description: 'Inventario del último mes con datos frente al mismo mes del año anterior.',
  fn: (inv_mensual) => {
    if (!inv_mensual.length) return [];
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const u = inv_mensual[inv_mensual.length - 1];
    const p = inv_mensual.find((r) => r.anio === u.anio - 1 && r.mes === u.mes);
    return [{
      fecha: u.fecha, viviendas: u.viviendas, mes_texto: `${meses[u.mes - 1]} de ${u.anio}`,
      viviendas_prev: p ? p.viviendas : null, prev_texto: p ? `${meses[p.mes - 1]} de ${p.anio}` : '',
      cambio_pct: p ? (u.viviendas / p.viviendas - 1) * 100 : null,
    }];
  },
});

dash.calc('habitabilidad', {
  inputs: ['censo'],
  title: 'Ocupación y habitabilidad, municipio',
  description: 'Porcentajes del Censo 2020 para el municipio: ocupación sobre viviendas particulares; características sobre viviendas particulares habitadas con características.',
  fn: (censo) => {
    const m = censo.find((r) => r.NIVEL === 'municipio');
    if (!m) return [];
    const n = (k) => (m[k] === null || m[k] === '' || m[k] === '*' ? null : +m[k]);
    const fila = (clave, indicador, num, base, base_texto) => ({
      clave, indicador, viviendas: n(num), base: n(base), base_texto,
      pct: n(num) !== null && n(base) ? (n(num) / n(base)) * 100 : null,
    });
    return [
      fila('deshabitadas', 'Deshabitadas', 'VIVPAR_DES', 'TVIVPAR', 'Particulares'),
      fila('uso_temporal', 'De uso temporal', 'VIVPAR_UT', 'TVIVPAR', 'Particulares'),
      fila('piso_tierra', 'Con piso de tierra', 'VPH_PISOTI', 'VIVPARH_CV', 'Habitadas'),
      fila('un_cuarto', 'Con un solo cuarto', 'VPH_1CUART', 'VIVPARH_CV', 'Habitadas'),
      fila('agua', 'Con agua entubada en la vivienda', 'VPH_AGUADV', 'VIVPARH_CV', 'Habitadas'),
      fila('drenaje', 'Con drenaje', 'VPH_DRENAJ', 'VIVPARH_CV', 'Habitadas'),
      fila('servicios', 'Con agua entubada, drenaje y electricidad', 'VPH_C_SERV', 'VIVPARH_CV', 'Habitadas'),
      fila('internet', 'Con internet', 'VPH_INTER', 'VIVPARH_CV', 'Habitadas'),
      fila('sin_tic', 'Sin computadora, internet ni teléfono', 'VPH_SINTIC', 'VIVPARH_CV', 'Habitadas'),
    ];
  },
});

dash.calc('ageb_vacancia', {
  inputs: ['censo'],
  title: 'AGEB por tasa de vivienda deshabitada',
  description: 'AGEB urbanas con 20 o más viviendas particulares, agrupadas por su porcentaje de deshabitadas.',
  fn: (censo) => {
    const rangos = [['<10%', 0, 10], ['10–15%', 10, 15], ['15–20%', 15, 20], ['20–30%', 20, 30], ['≥30%', 30, 101]];
    const out = rangos.map(([rango]) => ({rango, agebs: 0, deshabitadas: 0, alta: false}));
    for (const r of censo) {
      if (r.NIVEL !== 'ageb') continue;
      const tv = +r.TVIVPAR;
      const de = +r.VIVPAR_DES;
      if (!(tv >= 20) || r.VIVPAR_DES === '*' || r.VIVPAR_DES === null || !isFinite(de)) continue;
      const p = (de / tv) * 100;
      const i = rangos.findIndex(([, a, b]) => p >= a && p < b);
      if (i < 0) continue;
      out[i].agebs += 1;
      out[i].deshabitadas += de;
    }
    out.forEach((o, i) => { o.alta = rangos[i][1] >= 20; });
    return out;
  },
});

dash.calc('ageb_resumen', {
  inputs: ['ageb_vacancia'],
  title: 'AGEB con vacancia alta',
  description: 'AGEB con 20% o más de viviendas deshabitadas y la parte de las deshabitadas que concentran.',
  fn: (ageb_vacancia) => {
    if (!ageb_vacancia.length) return [];
    const agebs = ageb_vacancia.reduce((s, r) => s + r.agebs, 0);
    const des = ageb_vacancia.reduce((s, r) => s + r.deshabitadas, 0);
    const altas = ageb_vacancia.filter((r) => r.alta);
    const agebs_20 = altas.reduce((s, r) => s + r.agebs, 0);
    const des_20 = altas.reduce((s, r) => s + r.deshabitadas, 0);
    return [{agebs, agebs_20, deshabitadas: des, deshabitadas_20: des_20, pct_20: des ? (des_20 / des) * 100 : null}];
  },
});

dash.calc('ageb_top', {
  inputs: ['censo'],
  title: 'AGEB con más viviendas deshabitadas',
  description: 'Las 10 AGEB urbanas con más viviendas particulares deshabitadas y su porcentaje.',
  fn: (censo) => censo
    .filter((r) => r.NIVEL === 'ageb' && +r.TVIVPAR >= 20 && isFinite(+r.VIVPAR_DES) && r.VIVPAR_DES !== null && r.VIVPAR_DES !== '*')
    .map((r) => ({CVEGEO: r.CVEGEO, AGEB: r.AGEB, TVIVPAR: +r.TVIVPAR, VIVPAR_DES: +r.VIVPAR_DES, des_pct: (+r.VIVPAR_DES / +r.TVIVPAR) * 100}))
    .sort((a, b) => b.VIVPAR_DES - a.VIVPAR_DES)
    .slice(0, 10),
});

dash.calc('propuesta_resumen', {
  inputs: ['propuesta'],
  title: 'Indicadores por estado',
  description: 'Número de indicadores propuestos en cada estado de disponibilidad.',
  fn: (propuesta) => ['En este tablero', 'Descargable, por integrar', 'Requiere convenio', 'Por construir']
    .map((estado) => ({estado, indicadores: propuesta.filter((r) => r.estado === estado).length})),
});

dash.calc('propuesta_total', {
  inputs: ['propuesta'],
  title: 'Indicadores y dimensiones',
  description: 'Total de indicadores propuestos y número de dimensiones.',
  fn: (propuesta) => [{indicadores: propuesta.length, dimensiones: new Set(propuesta.map((r) => r.dimension)).size}],
});

/* ---------- Utilidades ---------- */

window.OVH = window.OVH || {};
(() => {
  const O = window.OVH;
  O.shfModo = O.shfModo || 'var';
  O.filtro = O.filtro || {dim: '', estado: ''};
  O.MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  // Colores: variables CSS que el tablero llena con dash.colors y el sitio con los tokens del design system
  O.C = {c1: 'var(--ovh-c1)', c2: 'var(--ovh-c2)', c3: 'var(--ovh-c3)', c4: 'var(--ovh-c4)', c5: 'var(--ovh-c5)', c6: 'var(--ovh-c6)', tenue: 'var(--ovh-tenue)', nd: 'var(--ovh-nd)'};
  document.querySelectorAll('.ovh').forEach((el) => (dash.colors || []).slice(0, 6).forEach((c, i) => el.style.setProperty(`--ovh-c${i + 1}`, c)));
  const f0 = d3.format(',.0f');
  const f1 = d3.format(',.1f');
  const s1 = d3.format('+,.1f');
  O.fmt = (v, tipo) => {
    if (tipo === 'text') return v === null || v === undefined || v === '' ? '—' : String(v);
    if (v === null || v === undefined || v === '' || !isFinite(+v)) return '—';
    const n = +v;
    switch (tipo) {
      case 'pct1': return `${f1(n)}%`;
      case 'spct1': return `${s1(n)}%`;
      case 'apct1': return `${f1(Math.abs(n))}%`;
      case 'dec2': return d3.format('.2f')(n);
      case 'dec1': return d3.format('.1f')(n);
      case 'money': return `$${f0(n)}`;
      case 'year': return String(Math.round(n));
      default: return f0(n);
    }
  };
  // Estado de carga: true si hay datos
  O.status = (el, st, texto) => {
    if (st && st.status === 'ok') { el.classList.remove('dash-skeleton'); return true; }
    if (!st || st.status === 'loading') {
      el.classList.add('dash-skeleton');
      if (texto) el.textContent = '—'; else el.replaceChildren();
      return false;
    }
    el.classList.remove('dash-skeleton');
    if (texto) { el.textContent = '—'; return false; }
    el.replaceChildren();
    if (st.status === 'error' || st.status === 'missing') {
      const p = document.createElement('p');
      p.className = 'ovh-error';
      p.textContent = 'No se pudo cargar esta fuente de datos.';
      el.append(p);
    }
    return false;
  };
  O.rows = (st) => (st && Array.isArray(st.data) ? st.data : []);
  O.find = (rows, where) => {
    const conds = where.split('&').map((p) => { const i = p.indexOf('='); return [decodeURIComponent(p.slice(0, i)), decodeURIComponent(p.slice(i + 1))]; });
    return rows.find((r) => conds.every(([k, v]) => String(r[k]) === v));
  };
  // Etiqueta de una serie tomada de la leyenda del mismo bloque
  O.lab = (el, key) => {
    const box = el.closest('section, .ovh-panel') || document;
    for (const n of box.querySelectorAll('[data-serie]')) if (n.dataset.serie === key) return n.textContent.trim();
    return key;
  };
  O.tip = (el) => {
    const t = document.createElement('div');
    t.className = 'ovh-tip';
    t.hidden = true;
    el.append(t);
    return {
      show(titulo, lineas, px, py) {
        const h = document.createElement('div');
        h.className = 'ovh-tip-t';
        h.textContent = titulo;
        const items = lineas.map(([lab, val, col]) => {
          const r = document.createElement('div');
          r.className = 'ovh-tip-r';
          const sw = document.createElement('i');
          sw.style.background = col || 'transparent';
          const l = document.createElement('span');
          l.textContent = lab;
          const v = document.createElement('b');
          v.textContent = val;
          r.append(sw, v, l);
          return r;
        });
        t.replaceChildren(h, ...items);
        t.hidden = false;
        const w = t.offsetWidth;
        const cw = el.clientWidth;
        let left = px + 14;
        if (left + w > cw) left = px - w - 14;
        if (left < 0) left = Math.max(0, cw - w);
        t.style.left = `${left}px`;
        t.style.top = `${Math.max(0, py - 12)}px`;
      },
      hide() { t.hidden = true; },
    };
  };
  const medir = (sel) => d3.max(sel.nodes(), (n) => n.getComputedTextLength()) || 0;
  const svgDe = (el, W, H, aria) => d3.select(el).append('svg').attr('class', 'ovh-svg')
    .attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%').attr('height', H)
    .attr('role', 'img').attr('aria-label', aria);

  // Gráfica de líneas
  O.lineChart = (el, cfg) => {
    const W = Math.max(260, Math.floor(el.clientWidth || 600));
    const H = cfg.height || 260;
    el.replaceChildren();
    const svg = svgDe(el, W, H, cfg.aria);
    const ok = (p) => p.y !== null && p.y !== undefined && isFinite(p.y);
    const todos = cfg.series.flatMap((s) => s.points.filter(ok));
    if (!todos.length) return;
    const top = 12;
    const bottom = 26;
    const x = (cfg.time ? d3.scaleUtc() : d3.scaleLinear()).domain(d3.extent(todos, (p) => p.x));
    let [y0, y1] = d3.extent(todos, (p) => p.y);
    if (cfg.yZero) y0 = Math.min(0, y0);
    const y = d3.scaleLinear().domain([y0, y1]).nice().range([H - bottom, top]);
    const yTicks = y.ticks(Math.max(3, Math.floor((H - top - bottom) / 48)));
    const gy = svg.append('g').attr('class', 'ovh-axis');
    const yt = gy.selectAll('text').data(yTicks).join('text').attr('text-anchor', 'end').attr('dy', '0.32em').attr('y', (d) => y(d)).text(cfg.yTick);
    const left = Math.ceil(medir(yt)) + 10;
    yt.attr('x', left - 6);
    const ends = cfg.series.map((s) => { const pts = s.points.filter(ok); const last = pts[pts.length - 1]; return last ? {s, last} : null; }).filter(Boolean);
    const eg = svg.append('g').attr('class', 'ovh-ends');
    const et = eg.selectAll('text').data(ends).join('text').attr('dy', '0.32em').attr('font-weight', 600).text((d) => cfg.endFmt(d.last.y));
    const ek = eg.selectAll('line').data(ends).join('line').style('stroke', (d) => d.s.color).attr('stroke-width', 3).attr('stroke-linecap', 'round');
    const right = Math.ceil(medir(et)) + 22;
    x.range([left, W - right]);
    svg.insert('g', ':first-child').attr('class', 'ovh-grid').selectAll('line').data(yTicks).join('line')
      .attr('x1', left).attr('x2', W - right).attr('y1', (d) => y(d)).attr('y2', (d) => y(d));
    if (cfg.zeroLine && y0 < 0) svg.append('line').attr('class', 'ovh-ref').attr('x1', left).attr('x2', W - right).attr('y1', y(0)).attr('y2', y(0));
    const nx = Math.max(2, Math.floor((W - left - right) / 64));
    let xTicks = x.ticks(nx);
    if (!cfg.time) xTicks = xTicks.filter(Number.isInteger);
    const gx = svg.append('g').attr('class', 'ovh-axis');
    gx.selectAll('text').data(xTicks).join('text').attr('x', (d) => x(d)).attr('y', H - 7).attr('text-anchor', 'middle').text(cfg.xTick);
    svg.append('line').attr('class', 'ovh-baseline').attr('x1', left).attr('x2', W - right).attr('y1', H - bottom).attr('y2', H - bottom);
    const line = d3.line().defined(ok).x((p) => x(p.x)).y((p) => y(p.y));
    for (const s of cfg.series) {
      const pts = s.points;
      const corte = cfg.partialFrom === undefined || cfg.partialFrom === null ? -1 : pts.findIndex((p) => +p.x >= +cfg.partialFrom);
      const solidos = corte < 0 ? pts : pts.slice(0, corte);
      svg.append('path').attr('fill', 'none').style('stroke', s.color).attr('stroke-width', s.width || 2).attr('stroke-linejoin', 'round').attr('d', line(solidos));
      if (corte > 0) {
        svg.append('path').attr('fill', 'none').style('stroke', s.color).attr('stroke-width', s.width || 2).attr('stroke-dasharray', '4 3').attr('d', line(pts.slice(corte - 1)));
        svg.append('g').selectAll('circle').data(pts.slice(corte).filter(ok)).join('circle')
          .attr('cx', (p) => x(p.x)).attr('cy', (p) => y(p.y)).attr('r', 4).attr('class', 'ovh-hueco').style('stroke', s.color).attr('stroke-width', 2);
      }
    }
    const pos = ends.map((d) => ({d, y: y(d.last.y)})).sort((a, b) => a.y - b.y);
    for (let i = 1; i < pos.length; i++) if (pos[i].y - pos[i - 1].y < 14) pos[i].y = pos[i - 1].y + 14;
    et.attr('x', (d) => x(d.last.x) + 18).attr('y', (d) => pos.find((p) => p.d === d).y);
    ek.attr('x1', (d) => x(d.last.x) + 6).attr('x2', (d) => x(d.last.x) + 13)
      .attr('y1', (d) => pos.find((p) => p.d === d).y).attr('y2', (d) => pos.find((p) => p.d === d).y);
    eg.raise();
    const tip = O.tip(el);
    const foco = svg.append('g').style('display', 'none');
    const regla = foco.append('line').attr('class', 'ovh-rule').attr('y1', top).attr('y2', H - bottom);
    const puntos = foco.selectAll('circle').data(cfg.series).join('circle').attr('class', 'ovh-dot').attr('r', 4.5).style('fill', (s) => s.color);
    const xsU = Array.from(new Set(todos.map((p) => +p.x))).sort((a, b) => a - b);
    const mover = (ev) => {
      const [mx] = d3.pointer(ev, svg.node());
      const xk = xsU[d3.bisectCenter(xsU, +x.invert(mx))];
      const vals = cfg.series.map((s) => s.points.find((p) => +p.x === xk));
      foco.style('display', null);
      regla.attr('x1', x(xk)).attr('x2', x(xk));
      puntos.attr('cx', x(xk)).attr('cy', (s, j) => (vals[j] && ok(vals[j]) ? y(vals[j].y) : -999));
      const k = el.clientWidth / W;
      const conVal = vals.map((p, j) => [p, cfg.series[j]]).filter(([p]) => p && ok(p)).sort((a, b) => b[0].y - a[0].y);
      tip.show(cfg.tipTitle(xk), conVal.map(([p, s]) => [s.label, cfg.tipFmt(p.y), s.color]), x(xk) * k, d3.min(conVal, ([p]) => y(p.y)) * k);
    };
    svg.append('rect').attr('x', left).attr('y', top).attr('width', Math.max(0, W - left - right)).attr('height', H - top - bottom)
      .attr('fill', 'transparent').on('pointermove', mover).on('pointerdown', mover)
      .on('pointerleave', () => { foco.style('display', 'none'); tip.hide(); });
  };

  // Barras apiladas por año
  O.stackedBars = (el, cfg) => {
    const W = Math.max(260, Math.floor(el.clientWidth || 600));
    const H = cfg.height || 280;
    el.replaceChildren();
    const svg = svgDe(el, W, H, cfg.aria);
    const rows = cfg.rows;
    if (!rows.length) return;
    const keys = cfg.keys.map((k) => k.key);
    const top = 20;
    const bottom = 26;
    const y = d3.scaleLinear().domain([0, d3.max(rows, (r) => r.total)]).nice().range([H - bottom, top]);
    const yTicks = y.ticks(Math.max(3, Math.floor((H - top - bottom) / 50)));
    const yt = svg.append('g').attr('class', 'ovh-axis').selectAll('text').data(yTicks).join('text')
      .attr('text-anchor', 'end').attr('dy', '0.32em').attr('y', (d) => y(d)).text((d) => O.fmt(d));
    const left = Math.ceil(medir(yt)) + 10;
    yt.attr('x', left - 6);
    const x = d3.scaleBand().domain(rows.map((r) => r.anio)).range([left, W - 4]).padding(0.2);
    svg.insert('g', ':first-child').attr('class', 'ovh-grid').selectAll('line').data(yTicks).join('line')
      .attr('x1', left).attr('x2', W - 4).attr('y1', (d) => y(d)).attr('y2', (d) => y(d));
    const st = d3.stack().keys(keys)(rows);
    svg.append('g').selectAll('g').data(st).join('g').style('fill', (s, i) => cfg.keys[i].color)
      .selectAll('rect').data((s) => s).join('rect')
      .attr('x', (d) => x(d.data.anio)).attr('width', x.bandwidth())
      .attr('y', (d) => y(d[1])).attr('height', (d) => Math.max(0, y(d[0]) - y(d[1])))
      .attr('opacity', (d) => (d.data.parcial ? 0.5 : 1));
    svg.append('line').attr('class', 'ovh-baseline').attr('x1', left).attr('x2', W - 4).attr('y1', H - bottom).attr('y2', H - bottom);
    const paso = Math.max(1, Math.ceil(36 / x.step()));
    const n = rows.length;
    svg.append('g').attr('class', 'ovh-axis').selectAll('text')
      .data(rows.filter((r, i) => (n - 1 - i) % paso === 0)).join('text')
      .attr('x', (r) => x(r.anio) + x.bandwidth() / 2).attr('y', H - 7).attr('text-anchor', 'middle').text((r) => r.anio);
    const conTotal = x.step() >= 42 ? rows : rows.slice(-2);
    svg.append('g').attr('class', 'ovh-vals').selectAll('text').data(conTotal).join('text')
      .attr('x', (r) => x(r.anio) + x.bandwidth() / 2).attr('y', (r) => y(r.total) - 5).attr('text-anchor', 'middle')
      .text((r) => (x.step() >= 42 ? O.fmt(r.total) : d3.format('.2~s')(r.total).replace('k', ' mil')));
    const tip = O.tip(el);
    svg.append('g').selectAll('rect').data(rows).join('rect')
      .attr('x', (r) => x(r.anio) - (x.step() - x.bandwidth()) / 2).attr('width', x.step()).attr('y', top).attr('height', H - top - bottom)
      .attr('fill', 'transparent')
      .on('pointermove pointerdown', (ev, r) => {
        const k = el.clientWidth / W;
        tip.show(cfg.tipTitle(r), [...cfg.keys].reverse().map((c) => [c.label, O.fmt(r[c.key]), c.color]).concat([[cfg.totalLabel, O.fmt(r.total), null]]),
          (x(r.anio) + x.bandwidth() / 2) * k, y(r.total) * k);
      })
      .on('pointerleave', () => tip.hide());
  };

  // Barras horizontales
  O.hbars = (el, cfg) => {
    const W = Math.max(240, Math.floor(el.clientWidth || 500));
    const rows = cfg.rows;
    const fila = 30;
    const H = rows.length * fila + 6;
    el.replaceChildren();
    const svg = svgDe(el, W, H, cfg.aria);
    if (!rows.length) return;
    const lt = svg.append('g').attr('class', 'ovh-axis ovh-labels').selectAll('text').data(rows).join('text')
      .attr('text-anchor', 'end').attr('dy', '0.32em').attr('y', (r, i) => i * fila + fila / 2).text((r) => r.label);
    const left = Math.min(Math.ceil(medir(lt)) + 10, Math.floor(W * 0.45));
    lt.attr('x', left - 8);
    const vt = svg.append('g').attr('class', 'ovh-vals').selectAll('text').data(rows).join('text')
      .attr('dy', '0.32em').attr('y', (r, i) => i * fila + fila / 2).text((r) => r.text);
    const right = Math.ceil(medir(vt)) + 10;
    const x = d3.scaleLinear().domain([0, d3.max(rows, (r) => r.value) || 1]).range([left, W - right]);
    const barra = (x0, y0, w, h) => {
      const r = Math.max(0, Math.min(4, w / 2, h / 2));
      return `M${x0},${y0}h${Math.max(0, w - r)}a${r},${r} 0 0 1 ${r},${r}v${Math.max(0, h - 2 * r)}a${r},${r} 0 0 1 ${-r},${r}h${-Math.max(0, w - r)}z`;
    };
    svg.insert('g', '.ovh-vals').selectAll('path').data(rows).join('path')
      .attr('d', (r, i) => barra(left, i * fila + 6, Math.max(0, x(r.value || 0) - left), fila - 12)).style('fill', (r) => r.color);
    vt.attr('x', (r) => x(r.value || 0) + 6);
    const tip = O.tip(el);
    svg.append('g').selectAll('rect').data(rows).join('rect')
      .attr('x', 0).attr('y', (r, i) => i * fila).attr('width', W).attr('height', fila).attr('fill', 'transparent')
      .on('pointermove pointerdown', (ev, r) => {
        const i = rows.indexOf(r);
        const k = el.clientWidth / W;
        tip.show(r.label, r.tip, x(r.value || 0) * k, i * fila * k);
      })
      .on('pointerleave', () => tip.hide());
  };
})();

/* ---------- Dibujos ---------- */

// Valor suelto marcado: lee data-source, data-field y data-where / data-row
dash.draw('v', (el) => {
  const st = dash.data(el.dataset.source);
  if (!OVH.status(el, st, true)) return;
  const rows = OVH.rows(st);
  const row = el.dataset.where ? OVH.find(rows, el.dataset.where) : rows[+(el.dataset.row || 0)];
  const v = row ? row[el.dataset.field] : null;
  el.textContent = OVH.fmt(v, el.dataset.fmt);
  if (el.dataset.tone === 'up') {
    el.classList.toggle('ovh-ok', +v > 0);
    el.classList.toggle('ovh-warn', +v < 0);
  }
});

// Minilínea: filas que cumplen data-where (todas), campo data-field; data-completo filtra años de 12 meses; data-n toma los últimos n
dash.draw('spark', (el) => {
  const st = dash.data(el.dataset.source);
  if (!OVH.status(el, st)) return;
  let rows = OVH.rows(st);
  if (el.dataset.where) {
    const conds = el.dataset.where.split('&').map((p) => { const i = p.indexOf('='); return [decodeURIComponent(p.slice(0, i)), decodeURIComponent(p.slice(i + 1))]; });
    rows = rows.filter((r) => conds.every(([k, v]) => String(r[k]) === v));
  }
  if (el.dataset.completo) rows = rows.filter((r) => +r[el.dataset.completo] === 12);
  if (el.dataset.n) rows = rows.slice(-(+el.dataset.n));
  const ys = rows.map((r) => (r[el.dataset.field] === null || r[el.dataset.field] === '' ? null : +r[el.dataset.field]));
  el.replaceChildren();
  if (ys.filter((v) => v !== null).length < 2) return;
  const W = Math.max(120, Math.floor(el.clientWidth || 200));
  const H = 40;
  const x = d3.scaleLinear().domain([0, ys.length - 1]).range([2, W - 6]);
  const y = d3.scaleLinear().domain(d3.extent(ys.filter((v) => v !== null))).nice().range([H - 4, 4]);
  const svg = d3.select(el).append('svg').attr('class', 'ovh-svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%').attr('height', H)
    .attr('role', 'img').attr('aria-label', el.dataset.aria || 'Minilínea de la serie');
  svg.append('path').attr('fill', 'none').style('stroke', OVH.C.c1).attr('stroke-width', 2).attr('stroke-linejoin', 'round')
    .attr('d', d3.line().defined((v) => v !== null).x((v, i) => x(i)).y((v) => y(v))(ys));
  const u = ys.length - 1;
  if (ys[u] !== null) svg.append('circle').attr('class', 'ovh-dot').attr('cx', x(u)).attr('cy', y(ys[u])).attr('r', 3.5).style('fill', OVH.C.c1);
});

dash.draw('lede-verbo', (el) => {
  const st = dash.data('shf_ultimo');
  if (!OVH.status(el, st, true)) return;
  const h = OVH.rows(st).find((r) => r.serie === 'Hermosillo');
  el.textContent = !h || h.var_anual_pct === null ? '—' : h.var_anual_pct >= 0 ? 'subió' : 'bajó';
});

dash.draw('lede-comp', (el) => {
  const st = dash.data('shf_ultimo');
  if (!OVH.status(el, st, true)) return;
  const rows = OVH.rows(st);
  const h = rows.find((r) => r.serie === 'Hermosillo');
  const n = rows.find((r) => r.serie === 'Nacional');
  if (!h || !n || h.var_anual_pct === null || n.var_anual_pct === null) { el.textContent = '—'; return; }
  el.textContent = h.var_anual_pct > n.var_anual_pct ? 'por encima del' : h.var_anual_pct < n.var_anual_pct ? 'por debajo del' : 'igual al';
});

dash.draw('shf-chart', (el) => {
  const st = dash.data('shf');
  if (!OVH.status(el, st)) return;
  const modo = OVH.shfModo;
  const series = [['Hermosillo', OVH.C.c1, 2], ['Nacional', 'var(--ovh-ref)', 2], ['Sonora', OVH.C.c2, 2]].map(([key, color, width]) => ({
    key, color, width, label: OVH.lab(el, key),
    points: OVH.rows(st).filter((r) => r.serie === key).map((r) => ({
      x: new Date(Date.UTC(+r.anio, (+r.trimestre - 1) * 3 + 1, 15)), t: `${r.trimestre}T-${r.anio}`,
      y: modo === 'var' ? (r.var_anual_pct === null || r.var_anual_pct === '' ? null : +r.var_anual_pct) : +r.indice_2017_100,
    })).sort((a, b) => a.x - b.x),
  }));
  const etiquetas = new Map(series[0].points.map((p) => [+p.x, p.t]));
  const fPct = (v) => `${d3.format('+.1f')(v)}%`;
  OVH.lineChart(el, {
    series, time: true, height: 280, yZero: modo === 'var', zeroLine: modo === 'var',
    aria: modo === 'var' ? 'Variación anual del Índice SHF de precios de la vivienda: Hermosillo, Sonora y nacional, por trimestre.' : 'Índice SHF de precios de la vivienda (2017 = 100): Hermosillo, Sonora y nacional, por trimestre.',
    yTick: (v) => (modo === 'var' ? `${d3.format('.0f')(v)}%` : d3.format('.0f')(v)),
    xTick: d3.utcFormat('%Y'),
    endFmt: modo === 'var' ? fPct : d3.format('.1f'),
    tipFmt: modo === 'var' ? fPct : d3.format('.1f'),
    tipTitle: (xk) => etiquetas.get(xk) || d3.utcFormat('%Y')(new Date(xk)),
  });
});

dash.draw('fin-chart', (el) => {
  const st = dash.data('fin_anual');
  if (!OVH.status(el, st)) return;
  const C = OVH.C;
  const keys = [['Infonavit', C.c1], ['Banca', C.c2], ['CONAVI', C.c3], ['Fovissste', C.c4], ['Otros', C.c5]]
    .map(([key, color]) => ({key, color, label: OVH.lab(el, key)}));
  const rows = OVH.rows(st).map((r) => ({...r, parcial: r.meses < 12}));
  OVH.stackedBars(el, {
    rows, keys, height: 290, totalLabel: 'Total',
    aria: 'Créditos para vivienda otorgados en Hermosillo por año y organismo.',
    tipTitle: (r) => (r.parcial ? `${r.anio} (ene–${OVH.MES[r.meses - 1]})` : String(r.anio)),
  });
});

dash.draw('ingreso-chart', (el) => {
  const st = dash.data('ingreso');
  if (!OVH.status(el, st)) return;
  OVH.hbars(el, {
    aria: 'Créditos para vivienda del último año completo por rango de ingreso del acreditado.',
    rows: OVH.rows(st).map((r) => ({
      label: r.rango, value: r.acciones, text: `${OVH.fmt(r.acciones)} · ${OVH.fmt(r.pct, 'pct1')}`,
      color: r.rango === '2.6 o menos' || r.rango === '2.61 a 4.00' ? OVH.C.c1 : r.rango === 'No disponible' ? OVH.C.nd : OVH.C.tenue,
      tip: [['Créditos', OVH.fmt(r.acciones), null], ['Participación', OVH.fmt(r.pct, 'pct1'), null]],
    })),
  });
});

dash.draw('fin-tabla', (tb) => {
  const st = dash.data('fin_organismo');
  tb.replaceChildren();
  if (!st || st.status !== 'ok') return;
  for (const r of OVH.rows(st)) {
    const tr = document.createElement('tr');
    for (const [v, cls] of [[r.grupo, ''], [OVH.fmt(r.acciones), 'ovh-num n'], [OVH.fmt(r.pct, 'pct1'), 'ovh-num n'], [OVH.fmt(r.monto_prom_adq, 'money'), 'ovh-num n']]) {
      const td = document.createElement('td');
      td.textContent = v;
      if (cls) td.className = cls;
      tr.append(td);
    }
    tb.append(tr);
  }
});

dash.draw('oferta-chart', (el) => {
  const st = dash.data('oferta_anual');
  if (!OVH.status(el, st)) return;
  const rows = OVH.rows(st);
  const parcial = rows.find((r) => r.meses < 12);
  const series = [['registro', OVH.C.c1, 2], ['verificacion', OVH.C.c2, 2], ['produccion', OVH.C.c3, 2]].map(([key, color, width]) => ({
    key, color, width, label: OVH.lab(el, key), points: rows.map((r) => ({x: r.anio, y: r[key]})),
  }));
  const meses = new Map(rows.map((r) => [r.anio, r.meses]));
  OVH.lineChart(el, {
    series, height: 270, yZero: true, partialFrom: parcial ? parcial.anio : null,
    aria: 'Viviendas nuevas registradas, verificadas y terminadas en Hermosillo por año.',
    yTick: (v) => OVH.fmt(v), xTick: (v) => String(v), endFmt: (v) => OVH.fmt(v), tipFmt: (v) => OVH.fmt(v),
    tipTitle: (a) => (meses.get(a) < 12 ? `${a} (ene–${OVH.MES[meses.get(a) - 1]})` : String(a)),
  });
});

dash.draw('pcu-chart', (el) => {
  const st = dash.data('registro_pcu');
  if (!OVH.status(el, st)) return;
  OVH.hbars(el, {
    aria: 'Viviendas registradas en el último año completo por perímetro de contención urbana.',
    rows: OVH.rows(st).map((r) => ({
      label: r.pcu, value: r.viviendas, text: `${OVH.fmt(r.viviendas)} · ${OVH.fmt(r.pct, 'pct1')}`,
      color: OVH.C.c1,
      tip: [['Viviendas', OVH.fmt(r.viviendas), null], ['Participación', OVH.fmt(r.pct, 'pct1'), null]],
    })),
  });
});

dash.draw('inv-chart', (el) => {
  const st = dash.data('inv_mensual');
  if (!OVH.status(el, st)) return;
  const series = [{
    key: 'inventario', color: OVH.C.c1, width: 2, label: OVH.lab(el, 'inventario'),
    points: OVH.rows(st).map((r) => ({x: new Date(Date.UTC(r.anio, r.mes - 1, 1)), y: r.viviendas})),
  }];
  OVH.lineChart(el, {
    series, time: true, height: 240, yZero: true,
    aria: 'Inventario de vivienda nueva en Hermosillo al cierre de cada mes.',
    yTick: (v) => OVH.fmt(v), xTick: d3.utcFormat('%Y'), endFmt: (v) => OVH.fmt(v), tipFmt: (v) => OVH.fmt(v),
    tipTitle: (xk) => { const d = new Date(xk); return `${OVH.MES[d.getUTCMonth()]} ${d.getUTCFullYear()}`; },
  });
});

dash.draw('ageb-chart', (el) => {
  const st = dash.data('ageb_vacancia');
  if (!OVH.status(el, st)) return;
  OVH.hbars(el, {
    aria: 'Número de AGEB urbanas por porcentaje de viviendas deshabitadas, Censo 2020.',
    rows: OVH.rows(st).map((r, i) => ({
      label: r.rango, value: r.agebs, text: OVH.fmt(r.agebs), color: OVH.MAPA ? OVH.MAPA[i] : OVH.C.c1,
      tip: [['AGEB', OVH.fmt(r.agebs), null], ['Viviendas deshabitadas', OVH.fmt(r.deshabitadas), null]],
    })),
  });
});

dash.draw('ageb-tabla', (tb) => {
  const st = dash.data('ageb_top');
  tb.replaceChildren();
  if (!st || st.status !== 'ok') return;
  OVH.rows(st).forEach((r, i) => {
    const tr = document.createElement('tr');
    tr.addEventListener('pointerenter', () => { if (OVH.mapaResaltar) OVH.mapaResaltar(String(r.CVEGEO).slice(0, 13)); });
    tr.addEventListener('pointerleave', () => { if (OVH.mapaResaltar) OVH.mapaResaltar(null); });
    tr.addEventListener('click', () => { if (OVH.mapaAcercar) OVH.mapaAcercar(String(r.CVEGEO).slice(0, 13)); });
    for (const [v, cls] of [[String(i + 1), 'ovh-num n ovh-muted'], [r.AGEB, ''], [r.CVEGEO, 'ovh-mono'], [OVH.fmt(r.TVIVPAR), 'ovh-num n'], [OVH.fmt(r.VIVPAR_DES), 'ovh-num n'], [OVH.fmt(r.des_pct, 'pct1'), 'ovh-num n']]) {
      const td = document.createElement('td');
      td.textContent = v;
      if (cls) td.className = cls;
      tr.append(td);
    }
    tb.append(tr);
  });
});

dash.draw('hab-tabla', (tb) => {
  const st = dash.data('habitabilidad');
  tb.replaceChildren();
  if (!st || st.status !== 'ok') return;
  for (const r of OVH.rows(st)) {
    const tr = document.createElement('tr');
    tr.dataset.key = encodeURIComponent(r.clave);
    for (const [v, cls] of [[r.indicador, ''], [OVH.fmt(r.viviendas), 'ovh-num n'], [OVH.fmt(r.pct, 'pct1'), 'ovh-num n'], [r.base_texto, 'ovh-muted']]) {
      const td = document.createElement('td');
      td.textContent = v;
      if (cls) td.className = cls;
      tr.append(td);
    }
    tb.append(tr);
  }
});

dash.draw('prop-dim', (sel) => {
  const st = dash.data('propuesta');
  const dims = st && st.status === 'ok' ? Array.from(new Set(OVH.rows(st).map((r) => r.dimension))) : [];
  sel.replaceChildren(new Option('Todas las dimensiones', ''), ...dims.map((d) => new Option(d, d)));
  sel.value = dims.includes(OVH.filtro.dim) ? OVH.filtro.dim : '';
  sel.onchange = () => { OVH.filtro.dim = sel.value; dash.draw('prop-tabla'); };
});

dash.draw('prop-estado', (sel) => {
  const st = dash.data('propuesta');
  const est = st && st.status === 'ok' ? Array.from(new Set(OVH.rows(st).map((r) => r.estado))) : [];
  sel.replaceChildren(new Option('Todos los estados', ''), ...est.map((d) => new Option(d, d)));
  sel.value = est.includes(OVH.filtro.estado) ? OVH.filtro.estado : '';
  sel.onchange = () => { OVH.filtro.estado = sel.value; dash.draw('prop-tabla'); };
});

dash.draw('prop-tabla', (tb) => {
  const st = dash.data('propuesta');
  tb.replaceChildren();
  if (!st || st.status !== 'ok') return;
  const clase = {'En este tablero': 'ovh-b1', 'Descargable, por integrar': 'ovh-b2', 'Requiere convenio': 'ovh-b3', 'Por construir': 'ovh-b4'};
  const f = OVH.filtro;
  for (const r of OVH.rows(st)) {
    if ((f.dim && r.dimension !== f.dim) || (f.estado && r.estado !== f.estado)) continue;
    const tr = document.createElement('tr');
    const celda = (txt, cls) => { const td = document.createElement('td'); td.textContent = txt; if (cls) td.className = cls; tr.append(td); return td; };
    celda(r.clave, 'ovh-mono');
    const ind = celda(r.indicador, 'ovh-ind');
    const def = document.createElement('span');
    def.className = 'ovh-def';
    def.textContent = r.definicion;
    ind.append(def);
    celda(r.dimension);
    celda(r.fuente);
    celda(r.periodicidad);
    celda(r.desagregacion);
    const te = document.createElement('td');
    const b = document.createElement('span');
    b.className = `ovh-badge ${clase[r.estado] || 'ovh-b4'}`;
    b.textContent = r.estado;
    te.append(b);
    tr.append(te);
    tb.append(tr);
  }
});

/* ---------- Controles ---------- */

document.querySelectorAll('.ovh-seg [data-modo]').forEach((b) => {
  b.addEventListener('click', () => {
    OVH.shfModo = b.dataset.modo;
    document.querySelectorAll('.ovh-seg [data-modo]').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
    document.querySelectorAll('[data-shf-sub]').forEach((s) => { s.hidden = s.dataset.shfSub !== OVH.shfModo; });
    dash.draw('shf-chart');
  });
});
