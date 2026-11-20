/*
 * Motor mínimo para el sitio estático del Observatorio de Vivienda de Hermosillo.
 * Ofrece las mismas funciones que usa el código del tablero (dash.data, dash.calc,
 * dash.draw, dash.onData), pero leyendo los archivos de la carpeta data/.
 */
(function () {
  const FUENTES = {
    shf: {url: 'data/indice_precios_vivienda_hermosillo.csv', format: 'csv'},
    financiamiento: {url: 'data/financiamiento_mensual.csv', format: 'csv'},
    perfil: {url: 'data/financiamiento_perfil_anual.csv', format: 'csv'},
    oferta: {url: 'data/oferta_mensual.csv', format: 'csv'},
    inventario: {url: 'data/inventario_mensual.csv', format: 'csv'},
    censo: {url: 'data/hermosillo_ageb.csv', format: 'csv'},
    propuesta: {url: 'data/propuesta_indicadores.csv', format: 'csv'},
    ageb_geo: {url: 'data/ageb_geometria.json', format: 'json'},
  };
  const estado = {};
  const calcs = {};
  const cache = {};
  const dibujos = {};
  const alCambiar = [];
  let version = 0;
  let programado = false;

  function cargar(id) {
    const f = FUENTES[id];
    estado[id] = {status: 'loading', data: [], v: 0};
    fetch(f.url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return f.format === 'json' ? r.json() : r.text();
      })
      .then((x) => {
        let data;
        if (f.format === 'json') {
          data = Array.isArray(x) ? x : x.rows || x.data || x.results || [];
        } else {
          data = d3.csvParse(x);
          for (const fila of data) for (const k in fila) if (fila[k] === '') fila[k] = null;
        }
        estado[id] = {status: 'ok', data, v: ++version};
      })
      .catch((e) => {
        console.error(`No se pudo cargar ${f.url}`, e);
        estado[id] = {status: 'error', data: [], message: String(e), v: ++version};
      })
      .finally(programar);
  }

  function evaluar(id) {
    const c = calcs[id];
    const entradas = c.inputs.map((i) => dash.data(i));
    const mala = entradas.find((s) => s.status !== 'ok');
    if (mala) return {status: mala.status, data: null, v: 0};
    const clave = entradas.map((s) => s.v).join('|');
    if (cache[id] && cache[id].clave === clave) return cache[id].res;
    let res;
    try {
      res = {status: 'ok', data: c.fn(...entradas.map((s) => s.data)), v: clave};
    } catch (e) {
      console.error(`Error al calcular ${id}`, e);
      res = {status: 'error', data: null, message: String(e), v: clave};
    }
    cache[id] = {clave, res};
    return res;
  }

  function correr(nombre) {
    const d = dibujos[nombre];
    if (!d) return;
    const fn = typeof d === 'function' ? d : d.update || d.mount;
    document.querySelectorAll(`[data-draw="${nombre}"]`).forEach((el) => {
      try { fn(el); } catch (e) { console.error(`Error al dibujar ${nombre}`, e); }
    });
  }

  function correrTodo() {
    programado = false;
    for (const fn of alCambiar) { try { fn(); } catch (e) { console.error(e); } }
    for (const nombre of Object.keys(dibujos)) correr(nombre);
  }

  function programar() {
    if (programado) return;
    programado = true;
    requestAnimationFrame(correrTodo);
  }

  window.dash = {
    colors: ['var(--dato-1)', 'var(--dato-2)', 'var(--dato-3)', 'var(--dato-4)', 'var(--dato-5)', 'var(--dato-6)'],
    data(id) {
      if (FUENTES[id]) {
        if (!estado[id]) cargar(id);
        return estado[id];
      }
      if (calcs[id]) return evaluar(id);
      return {status: 'missing', data: [], v: 0};
    },
    calc(id, cfg) { calcs[id] = cfg; },
    loader() {},
    draw(nombre, fn) {
      if (fn) { dibujos[nombre] = fn; programar(); } else correr(nombre);
    },
    onData(fn) { alCambiar.push(fn); programar(); },
    params() { return {}; },
    setParams() {},
    resetParams() {},
    setLink() {},
    refresh() {},
  };

  let ancho = window.innerWidth;
  let espera = null;
  window.addEventListener('resize', () => {
    if (window.innerWidth === ancho) return;
    ancho = window.innerWidth;
    clearTimeout(espera);
    espera = setTimeout(programar, 150);
  });
})();
