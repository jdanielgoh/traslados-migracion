import type { MapViewState } from "@deck.gl/core";

export const COLOR_ORIGEN: [number, number, number] = [30, 210, 255];
export const COLOR_DESTINO: [number, number, number] = [255, 70, 160];
export const COLOR_CON_ESTACION: [number, number, number] = [255, 165, 0];
export const COLOR_SIN_ESTACION: [number, number, number] = [40, 55, 95];

export const DICT_COLOR_CORRESPONDENCIA: Record<string, [number, number, number]> = {
  "Dispersion sobre una ruta": [50, 220, 130],
  "Dispersion entre rutas": [255, 150, 30],
  "Dispersión fuera de las rutas": [255, 75, 75],
};
export const TODAS_CORRESPONDENCIAS = new Set(Object.keys(DICT_COLOR_CORRESPONDENCIA));

export const DATA_URL = `${import.meta.env.BASE_URL}flujos-origen-destino_desagregado.json`;
export const RUTAS_URL = `${import.meta.env.BASE_URL}rutas_migratorias.json`;
export const EM_URL = `${import.meta.env.BASE_URL}estaciones_migratorias_estatus.json`;

export const ESTADO_INICIAL_MAPA: MapViewState = {
  longitude: -102,
  latitude: 23,
  zoom: 5,
  maxZoom: 15,
  pitch: 0,
  bearing: 0,
};

export const ESTILO_MAPA =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

export const DISTANCIA_MINIMA_SLIDER = 0;

export function rgbToHex([r, g, b]: number[]) {
  return `rgb(${r},${g},${b})`;
}
