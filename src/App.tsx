import React, { useState, useMemo, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Map } from "react-map-gl/maplibre";
import { DeckGL } from "@deck.gl/react";
import { GeoJsonLayer, ArcLayer } from "@deck.gl/layers";
import { scaleLinear } from "d3-scale";

import type { Color, PickingInfo, MapViewState } from "@deck.gl/core";
import type { Feature, Polygon, MultiPolygon } from "geojson";

const DATA_URL =
  "https://raw.githubusercontent.com/jdanielgoh/traslados-migracion/refs/heads/main/public/flujos-origen-destino_desagregado.json";

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: -102,
  latitude: 23,
  zoom: 5,
  maxZoom: 15,
  pitch: 100,
  bearing: 0,
};
const grupoEtario = "total_infancias";
const anios = ["2018", "2019", "2020", "2021"];
const MAP_STYLE =
  "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

type MunicipioProperties = {
  NOMGEO: string;
  CVE_ENT: string;
  cve_mun: string;
  flujos: Record<string, number>;
  centroid: [number, number];
};

type Municipio = Feature<Polygon | MultiPolygon, MunicipioProperties>;

type MigrationFlow = {
  source: Municipio;
  target: Municipio;
  value: number;
  quantile: number;
};

// Calcula arcos
function calculateArcs(
  data: Municipio[] | undefined,
  selectedMunicipio?: Municipio | null,
) {
  if (!data || !data.length) return [];

  // Diccionario cve_mun -> municipio
  const featuresById: Record<string, Municipio> = Object.fromEntries(
    data.map((f) => [f.properties.cve_mun, f]),
  );

  let arcs: MigrationFlow[] = [];

  if (!selectedMunicipio) {
    // TODOS los arcos por default
    data.forEach((source) => {
      Object.entries(source.properties.flujos).forEach(([toId, anidacion]) => {
        const target = featuresById[toId];
        if (!target) return;
        arcs.push({
          source,
          target,
          value: anios.reduce(
            (acc, a) =>
              acc +
              (Object.keys(anidacion).includes(a)
                ? anidacion[a][grupoEtario]
                : 0),
            0,
          ),
          quantile: 0,
        });
      });
    });
  } else {
    // Solo arcos del municipio seleccionado
    Object.entries(selectedMunicipio.properties.flujos).forEach(
      ([toId, value]) => {
        const target = featuresById[toId];
        if (!target) return;
        arcs.push({ source: selectedMunicipio!, target, value, quantile: 0 });
      },
    );
  }

  return arcs;
}

// Tooltip simple
function getTooltip({ object }: PickingInfo<Municipio>) {
  return object && `${object.properties.NOMGEO}, ${object.properties.CVE_ENT}`;
}

export default function App() {
  const [data, setData] = useState<Municipio[]>();
  const [hoveredMunicipio, setHoveredMunicipio] = useState<Municipio | null>(
    null,
  );

  // Cargar GeoJSON
  useEffect(() => {
    fetch(DATA_URL)
      .then((resp) => resp.json())
      .then((json) => setData(json.features));
  }, []);

  const arcs = useMemo(
    () => calculateArcs(data, hoveredMunicipio),
    [data, hoveredMunicipio],
  );
  const widthScale = useMemo(() => {
    if (!arcs || arcs.length === 0) return () => 1;
    const values = arcs.map((a) => Math.abs(a.value));
    return scaleLinear()
      .domain([Math.min(...values), Math.max(...values)])
      .range([1, 8]); // min 1px, max 10px
  }, [arcs]);

  const layers = [
    new GeoJsonLayer<MunicipioProperties>({
      id: "geojson",
      data,
      stroked: true,
      filled: true,
      getFillColor: [200, 200, 200, 240],
      pickable: true,
      onHover: ({ object }) => setHoveredMunicipio(object || null),
      onClick: ({ object }) => setHoveredMunicipio(object || null),
    }),
    new ArcLayer<MigrationFlow>({
      id: "arc",
      data: arcs,
      getSourcePosition: (d) => d.source.properties.centroid,
      getTargetPosition: (d) => d.target.properties.centroid,
      getSourceColor: [100, 70, 250, 200],
      getTargetColor: [250, 30, 50, 200],
      getWidth: (d) => widthScale(Math.abs(d.value)),
      getHeight: 0.7,
    }),
  ];

  return (
    <DeckGL
      layers={layers}
      initialViewState={INITIAL_VIEW_STATE}
      controller={true}
      getTooltip={getTooltip}
    >
      <Map reuseMaps mapStyle={MAP_STYLE} />
    </DeckGL>
  );
}

export function renderToDOM(container: HTMLDivElement) {
  createRoot(container).render(<App />);
}
