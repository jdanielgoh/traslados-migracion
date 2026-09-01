import type {
  Feature,
  Polygon,
  MultiPolygon,
  MultiLineString,
  LineString,
} from "geojson";

export type PropiedadesCarretera = { NOMGEO: string };

export type GrupoEtario = { [key: string]: number };
export type FlujoPorAnio = { [anio: string]: GrupoEtario };

export type PropiedadesMunicipio = {
  NOMGEO: string;
  CVE_ENT: string;
  NOM_ENT: string;
  CVE_MUN: string;
  flujos: Record<string, FlujoPorAnio>;
  centroid: [number, number];
  valor: number;
};

export type Municipio = Feature<Polygon | MultiPolygon, PropiedadesMunicipio>;
export type Ruta = Feature<LineString | MultiLineString, PropiedadesCarretera>;

export type FlujoMigratorio = {
  source: Municipio;
  target: Municipio;
  value: number;
  quantile: number;
};
