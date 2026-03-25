import React, { useState, useMemo, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Map } from "react-map-gl/maplibre";
import { DeckGL } from "@deck.gl/react";
import { GeoJsonLayer, ArcLayer } from "@deck.gl/layers";
import { scaleLinear } from "d3-scale";

import type { PickingInfo, MapViewState } from "@deck.gl/core";
import type {
  Feature,
  Polygon,
  MultiPolygon,
  MultiLineString,
  LineString,
} from "geojson";
import correspondecia_o_d from "./assets/correspondencias_origen_destino.json";
import sentido_o_d from "./assets/sentidos_origen_destino.json";
import {
  Paper,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormLabel,
  FormControl,
  IconButton,
  Collapse,
  Checkbox,
  Box,
  Typography,
  Slider,
} from "@mui/material";
import { ExpandLess, ExpandMore } from "@mui/icons-material";
function valuetext(value: number) {
  return `año ${value}`;
}
const minDistance = 0;

const dict_color_correspondencia = {
  "Dispersion sobre una ruta": [35, 225, 175],
  "Dispersion entre rutas": [252, 219, 83],
  "Dispersión fuera de las rutas": [236, 44, 230],
};
const dict_color_sentido = {
  Retorno: [255, 52, 109],
  Avance: [43, 186, 245],
  Otro: [200, 200, 200],
};
function rgbToHex([r, g, b]: number[]) {
  return `rgb(${r},${g},${b})`;
}
function Nomenclatura({ tipo }: { tipo: string }) {
  const dict =
    tipo === "sentido" ? dict_color_sentido : dict_color_correspondencia;

  return (
    <Box sx={{ mt: 0 }}>
      <FormLabel sx={{ fontSize: 12 }}>Nomenclatura</FormLabel>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mt: 0.5 }}>
        {Object.entries(dict).map(([label, color]) => (
          <Box
            key={label}
            sx={{ display: "flex", alignItems: "center", gap: 1 }}
          >
            <Box
              sx={{
                width: 14,
                height: 14,
                borderRadius: "3px",
                flexShrink: 0,
                backgroundColor: rgbToHex(color),
              }}
            />
            <Typography variant="caption" sx={{ lineHeight: 1 }}>
              {label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
type RoadProperties = {
  NOMGEO: string;
};

const DATA_URL =
  "https://raw.githubusercontent.com/jdanielgoh/traslados-migracion/refs/heads/main/public/flujos-origen-destino_desagregado.json";
const RUTAS_URL =
  "https://raw.githubusercontent.com/jdanielgoh/traslados-migracion/refs/heads/main/public/rutas_migratorias.json";

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: -102,
  latitude: 23,
  zoom: 5,
  maxZoom: 15,
  pitch: 0,
  bearing: 0,
};
const MAP_STYLE =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

type MunicipioProperties = {
  NOMGEO: string;
  CVE_ENT: string;
  cve_mun: string;
  flujos: Record<string, number>;
  centroid: [number, number];
};

type Municipio = Feature<Polygon | MultiPolygon, MunicipioProperties>;
type Ruta = Feature<LineString | MultiLineString, RoadProperties>;

type MigrationFlow = {
  source: Municipio;
  target: Municipio;
  value: number;
  quantile: number;
};

// Calcula arcos

export default function App() {
  const [mostrarRutas, setMostrarRutas] = useState(true);

  const [open, setOpen] = useState(true);
  const [grupoEtario, cambiaGrupoEtario] = useState("total");

  const [tipo_traslado, setTipoTraslado] = useState("sentido");
  const [data, setData] = useState<Municipio[]>();
  const [rutas, setRutas] = useState<Ruta[]>();

  const [hoveredMunicipio, setHoveredMunicipio] = useState<Municipio | null>(
    null,
  );
  const [anios, setAnios] = React.useState<number[]>([2017, 2024]);
  function calculateArcs(
    data: Municipio[] | undefined,
    selectedMunicipio?: Municipio | null,
  ) {
    if (!data || !data.length) return [];

    // Diccionario clave -> municipio
    const featuresById: Record<string, Municipio> = Object.fromEntries(
      data.map((f) => [f.id, f]),
    );

    let arcs: MigrationFlow[] = [];
    let lista_anios = Array.from(
      { length: anios[1] - anios[0] + 1 },
      (_, i) => "" + (anios[0] + i),
    );
    if (!selectedMunicipio) {
      // TODOS los arcos por default

      data.forEach((source) => {
        source.properties.valor = 0;
        Object.entries(source.properties.flujos).forEach(
          ([toId, anidacion]) => {
            const target = featuresById[toId];
            if (!target) return;
            let valor = lista_anios.reduce(
              (acc, a) =>
                acc +
                (Object.keys(anidacion).includes(a)
                  ? anidacion[a][grupoEtario]
                  : 0),
              0,
            );
            if (valor > 0) {
              arcs.push({
                source,
                target,
                value: valor,
                quantile: 0,
              });
            }

            source.properties.valor += valor;
          },
        );
      });
    } else {
      // Solo arcos del municipio seleccionado
      Object.entries(selectedMunicipio.properties.flujos).forEach(
        ([toId, anidacion]) => {
          const target = featuresById[toId];
          if (!target) return;
          let valor = lista_anios.reduce(
            (acc, a) =>
              acc +
              (Object.keys(anidacion).includes(a)
                ? anidacion[a][grupoEtario]
                : 0),
            0,
          );
          if (valor > 0) {
            arcs.push({
              source: selectedMunicipio!,
              target,
              value: valor,
              quantile: 0,
            });
          }
        },
      );
    }

    return arcs;
  }

  // Tooltip simple
  function getTooltip({ object }: PickingInfo<Municipio>) {
    return (
      object && {
        html:
          object &&
          `${object.properties.NOMGEO}</br> <b>${object.properties.valor}</b>`,
        style: {
          backgroundColor: "rgba(0,0,0,0.8)",
          color: "white",
          fontSize: "12px",
          borderRadius: "4px",
          padding: "6px 10px",
        },
      }
    );
  }
  const handleChange2 = (
    event: Event,
    newValue: number[],
    activeThumb: number,
  ) => {
    if (newValue[1] - newValue[0] < minDistance) {
      if (activeThumb === 0) {
        const clamped = Math.min(newValue[0], 1 - minDistance);
        setAnios([clamped, clamped + minDistance]);
      } else {
        const clamped = Math.max(newValue[1], minDistance);
        setAnios([clamped - minDistance, clamped]);
      }
    } else {
      setAnios(newValue);
    }
  };
  // Cargar GeoJSON
  useEffect(() => {
    fetch(DATA_URL)
      .then((resp) => resp.json())
      .then((json) => setData(json.features));
  }, []);
  useEffect(() => {
    fetch(RUTAS_URL)
      .then((resp) => resp.json())
      .then((json) => setRutas(json.features));
  }, []);

  const arcs = useMemo(
    () => calculateArcs(data, hoveredMunicipio),
    [data, hoveredMunicipio, anios, grupoEtario],
  );
  const widthScale = useMemo(() => {
    if (!arcs || arcs.length === 0) return () => 1;
    const values = arcs.map((a) => Math.abs(a.value));
    return scaleLinear()
      .domain([Math.min(...values), Math.max(...values)])
      .range([
        0.5 + 0.006 * Math.min(...values),
        0.5 + 0.006 * Math.max(...values),
      ]); // min 1px, max 10px
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
    mostrarRutas &&
      new GeoJsonLayer({
        id: "rutas",
        data: rutas,
        stroked: true,
        filled: false,
        getLineColor: [255, 100, 0],
        getLineWidth: 2,
        lineWidthUnits: "pixels",
      }),

    new ArcLayer<MigrationFlow>({
      id: "arc",
      data: arcs,
      getSourcePosition: (d) => {
        return d.source.properties.centroid;
      },
      getTargetPosition: (d) => d.target.properties.centroid,
      getSourceColor: (d) => [
        ...(tipo_traslado == "sentido"
          ? dict_color_sentido[sentido_o_d[d.source.id + d.target.id]]
          : dict_color_correspondencia[
              correspondecia_o_d[d.source.id + d.target.id]
            ]),
        50,
      ],
      getTargetColor: (d) => [
        ...(tipo_traslado == "sentido"
          ? dict_color_sentido[sentido_o_d[d.source.id + d.target.id]]
          : dict_color_correspondencia[
              correspondecia_o_d[d.source.id + d.target.id]
            ]),
        200,
      ],
      getWidth: (d) => widthScale(Math.abs(d.value)),
      getHeight: () => 0.5 + Math.random() * 0.001,
      updateTriggers: {
        getSourceColor: [tipo_traslado],
        getTargetColor: [tipo_traslado],
      },
    }),
  ].filter(Boolean);
  const cambioTipoTraslado = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTipoTraslado(event.target.value);
  };
  const cambioPoblacion = (event: React.ChangeEvent<HTMLInputElement>) => {
    cambiaGrupoEtario(event.target.value);
  };

  return (
    <>
      <Paper
        elevation={3}
        sx={{
          position: "absolute",
          top: 16,
          left: 16,
          p: 1,
          borderRadius: 2,
          zIndex: 1,
          backgroundColor: "rgba(255,255,255,0.9)",
          minWidth: 200,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <strong>Controles</strong>
          <IconButton size="small" onClick={() => setOpen(!open)}>
            {open ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>

        <Collapse in={open} timeout="auto" unmountOnExit>
          <FormControl>
            <FormControlLabel
              control={
                <Checkbox
                  checked={mostrarRutas}
                  onChange={(e) => setMostrarRutas(e.target.checked)}
                  size="small"
                  sx={{
                    color: "rgb(255, 100, 0)",
                    "&.Mui-checked": {
                      color: "rgb(255, 100, 0)",
                    },
                  }}
                />
              }
              label="Rutas"
            />
            <FormLabel id="demo-radio-buttons-group-label">
              Tipo de traslado
            </FormLabel>
            <RadioGroup
              aria-labelledby="demo-radio-buttons-group-label"
              defaultValue="sentido"
              name="radio-buttons-group"
            >
              <FormControlLabel
                value="sentido"
                control={<Radio />}
                label="Sentido"
                onChange={cambioTipoTraslado}
              />
              <Nomenclatura tipo={"sentido"} />

              <FormControlLabel
                value="correspondencia"
                control={<Radio />}
                label="Correspondencia"
                onChange={cambioTipoTraslado}
              />
              <Nomenclatura tipo={"correspondencia"} />
            </RadioGroup>
          </FormControl>
          <Typography gutterBottom sx={{ lineHeight: 1, mt: 2 }}>
            Elige un rango temporal
          </Typography>
          <Slider
            getAriaLabel={() => "Minimum distance shift"}
            value={anios}
            onChange={handleChange2}
            valueLabelDisplay="auto"
            getAriaValueText={valuetext}
            disableSwap
            min={2017}
            max={2024}
            step={1}
            sx={{ display: "flex", alignItems: "center" }}
          />
          <FormControl>
            <FormLabel id="demo-radio-buttons-group-label">Población</FormLabel>
            <RadioGroup
              aria-labelledby="demo-radio-buttons-group-label"
              defaultValue="total"
              name="radio-buttons-group"
            >
              <FormControlLabel
                value="total"
                control={<Radio />}
                label="Total"
                onChange={cambioPoblacion}
              />

              <FormControlLabel
                value="total_infancias"
                control={<Radio />}
                label="Menor de edad"
                onChange={cambioPoblacion}
              />
            </RadioGroup>
          </FormControl>
        </Collapse>
      </Paper>
      <DeckGL
        layers={layers}
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        getTooltip={getTooltip}
      >
        <Map reuseMaps mapStyle={MAP_STYLE} />
      </DeckGL>
    </>
  );
}

export function renderToDOM(container: HTMLDivElement) {
  createRoot(container).render(<App />);
}
