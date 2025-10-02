import { useEffect, useState, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { Map } from "react-map-gl/maplibre";
import { DeckGL } from "@deck.gl/react";
import { GeoJsonLayer, ArcLayer } from "@deck.gl/layers";
import { scaleQuantile } from "d3-scale";

import { load } from "@loaders.gl/core";
import { JSONLoader } from "@loaders.gl/json";

import type { Color, PickingInfo, MapViewState } from "@deck.gl/core";
import type { Feature, Polygon, MultiPolygon } from "geojson";

const DATA_URL =
  "https://raw.githubusercontent.com/visgl/deck.gl-data/master/examples/arc/counties.json";

export const inFlowColors: Color[] = [
  [255, 255, 204],
  [199, 233, 180],
  [127, 205, 187],
  [65, 182, 196],
  [29, 145, 192],
  [34, 94, 168],
  [12, 44, 132],
];
export const outFlowColors: Color[] = [
  [255, 255, 178],
  [254, 217, 118],
  [254, 178, 76],
  [253, 141, 60],
  [252, 78, 42],
  [227, 26, 28],
  [177, 0, 38],
];

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: -100,
  latitude: 40.7,
  zoom: 3,
  maxZoom: 15,
  pitch: 30,
  bearing: 30,
};
const MAP_STYLE =
  "https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json";

type CountyProperties = {
  name: string;
  flows: Record<string, number>;
  centroid: [number, number];
};
type County = Feature<Polygon | MultiPolygon, CountyProperties>;
type MigrationFlow = {
  source: County;
  target: County;
  value: number;
  quantile: number;
};

function calculateArcs(data: County[] | undefined, selectedCounty?: County) {
  if (!data || !data.length) return null;
  if (!selectedCounty)
    selectedCounty = data.find((f) => f.properties.name === "Los Angeles, CA")!;
  const { flows } = selectedCounty.properties;

  const arcs: MigrationFlow[] = Object.keys(flows).map((toId) => {
    const f = data[Number(toId)];
    return {
      source: selectedCounty!,
      target: f,
      value: flows[toId],
      quantile: 0,
    };
  });

  const scale = scaleQuantile()
    .domain(arcs.map((a) => Math.abs(a.value)))
    .range(inFlowColors.map((_, i) => i));

  arcs.forEach((a) => {
    a.quantile = scale(Math.abs(a.value));
  });

  return arcs;
}

function getTooltip({ object }: PickingInfo<County>) {
  return object && object.properties.name;
}

export default function App() {
  const [data, setData] = useState<County[] | undefined>();
  const [selectedCounty, selectCounty] = useState<County>();

  useEffect(() => {
    // Carga de GeoJSON usando loaders.gl
    load(DATA_URL, JSONLoader)
      .then((json) => {
        console.log("GeoJSON cargado:", json);
        setData(json.features); // setea solo features
      })
      .catch((err) => console.error("Error cargando GeoJSON:", err));
  }, []);

  const arcs = useMemo(
    () => calculateArcs(data, selectedCounty),
    [data, selectedCounty]
  );

  const layers = useMemo(() => {
    if (!data) return [];
    return [
      new GeoJsonLayer<CountyProperties>({
        id: "geojson",
        data,
        stroked: false,
        filled: true,
        getFillColor: [0, 0, 0, 0],
        pickable: true,
        onClick: ({ object }) => selectCounty(object),
      }),
      new ArcLayer<MigrationFlow>({
        id: "arc",
        data: arcs,
        getSourcePosition: (d) => d.source.properties.centroid,
        getTargetPosition: (d) => d.target.properties.centroid,
        getSourceColor: (d) =>
          (d.value > 0 ? inFlowColors : outFlowColors)[d.quantile],
        getTargetColor: (d) =>
          (d.value > 0 ? outFlowColors : inFlowColors)[d.quantile],
        getWidth: 1,
      }),
    ];
  }, [data, arcs]);

  return (
    <DeckGL
      layers={layers}
      initialViewState={INITIAL_VIEW_STATE}
      controller
      getTooltip={getTooltip}
    >
      <Map reuseMaps mapStyle={MAP_STYLE} />
    </DeckGL>
  );
}

export function renderToDOM(container: HTMLDivElement) {
  createRoot(container).render(<App />);
}
