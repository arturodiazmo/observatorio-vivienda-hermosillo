# Observatorio de Vivienda de Hermosillo — Propuesta de indicadores

Sitio web estático con la línea base del Observatorio de Vivienda de Hermosillo, Sonora: precios, financiamiento, oferta de vivienda nueva, vivienda deshabitada por AGEB, habitabilidad y un catálogo de 37 indicadores propuestos.

**Sitio:** https://arturodiazmo.github.io/observatorio-vivienda-hermosillo/

## Contenido

| Ruta | Qué es |
| --- | --- |
| `index.html` | Página del tablero |
| `js/app.js` | Cálculos de indicadores y gráficas |
| `js/mapa.js` | Mapa de vivienda deshabitada por AGEB, con calles de fondo |
| `js/dash-runtime.js` | Motor que carga los datos y dibuja la página |
| `css/tablero.css` | Estilos base del tablero |
| `css/observatorio.css` | Ajustes del tablero al design system |
| `assets/hcv/` | Design system Hermosillo ¿Cómo Vamos?: `tokens.css`, `bundle.css`, `bundle.js` (menú y componentes `hcv-`), tipografías, logotipo e isotipo |
| `assets/fonts/` | Archivo, Source Sans 3 e IBM Plex Mono en woff2 (SIL Open Font License 1.1, licencias incluidas) |
| `js/d3.min.js` | D3 v7 (ISC, © Mike Bostock) |
| `js/maplibre-gl.js`, `css/maplibre-gl.css` | MapLibre GL JS v5 (BSD-3-Clause) |
| `data/` | Datos usados por la página, en CSV y JSON |

## Datos

| Archivo | Fuente | Periodo |
| --- | --- | --- |
| `indice_precios_vivienda_hermosillo.csv` | SHF, Índice SHF de Precios de la Vivienda | 1T-2005 a 3T-2026 |
| `financiamiento_mensual.csv` | SEDATU, SNIIV (financiamiento) | ene 2013 a ago 2026 |
| `financiamiento_perfil_anual.csv` | SEDATU, SNIIV (financiamiento) | 2013 a 2026 (ene–ago) |
| `oferta_mensual.csv` | SEDATU, SNIIV (RUV: registro, verificación, producción) | ene 2013 a ago 2026 |
| `inventario_mensual.csv` | SEDATU, SNIIV (RUV: inventario) | ene 2014 a ago 2026 |
| `hermosillo_ageb.csv` | INEGI, Censo de Población y Vivienda 2020 (resultados por AGEB) | 2020 |
| `ageb_geometria.json` | INEGI, Marco Geoestadístico (AGEB urbanas, localidad 0001), simplificado a ~4 m | dic 2025 |
| `propuesta_indicadores.csv` | Elaboración propia | — |

El diseño usa el design system de Hermosillo ¿Cómo Vamos?: paleta naranja, ámbar y carbón del logotipo; tema Papel y, si el lector prefiere modo oscuro, tema Inverso (carbón); Hermosillo en `dato-1`, el promedio nacional en `dato-referencia` y rampa `secuencial` naranja para el mapa. Logotipo e isotipo oficiales de HCV en `assets/hcv/`.

El mapa base es de [OpenFreeMap](https://openfreemap.org) (estilos Positron y Dark, © OpenMapTiles, datos © colaboradores de OpenStreetMap), gratuito y sin clave de acceso.

Datos descargados el 19 de noviembre de 2026. Son datos abiertos de uso libre con atribución a INEGI, SHF y SEDATU.

## Actualizar los datos

1. Reemplaza el archivo correspondiente en `data/`, con el mismo nombre y las mismas columnas.
2. Haz commit en la rama `main`. GitHub Pages vuelve a publicar el sitio en uno o dos minutos.

Las cifras del texto (último año completo, último mes, último trimestre) se calculan solas a partir de los datos, así que no hay que editar la página.

## Ver el sitio en tu computadora

```bash
python3 -m http.server 8000
# abre http://localhost:8000
```
