import React, { useState, useMemo, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Map } from "react-map-gl/maplibre";
import { DeckGL } from "@deck.gl/react";
import { GeoJsonLayer, ArcLayer } from "@deck.gl/layers";
import { scaleLinear } from "d3-scale";

import type { PickingInfo } from "@deck.gl/core";
import type { Layer } from "@deck.gl/core";
import correspondecia_o_d from "./assets/correspondencias_origen_destino.json";
import sentido_o_d from "./assets/sentidos_origen_destino.json";

import type { Municipio, FlujoMigratorio, PropiedadesMunicipio } from "./types";
import {
  COLOR_ORIGEN,
  COLOR_DESTINO,
  COLOR_CON_ESTACION,
  COLOR_SIN_ESTACION,
  DICT_COLOR_CORRESPONDENCIA,
  TODAS_CORRESPONDENCIAS,
  ESTADO_INICIAL_MAPA,
  ESTILO_MAPA,
  DISTANCIA_MINIMA_SLIDER,
  rgbToHex,
} from "./constantes";
import { useDatos } from "./hooks/useDatos";
import { PanelControles } from "./components/PanelControles";
import { NarrativaScroll } from "./components/NarrativaScroll";

function escalaAnchoDeArcos(arcos: FlujoMigratorio[]) {
  if (arcos.length === 0) return () => 0.6;
  const valores = arcos.map((a) => Math.abs(a.value));
  const minV = Math.min(...valores);
  const maxV = Math.max(...valores);
  return scaleLinear()
    .domain([minV, maxV])
    .range([0.5 + 0.006 * minV, 0.5 + 0.006 * maxV]);
}

// Calcula arcos sin mutar las propiedades de los municipios —
// usado en la narrativa donde no necesitamos el valor acumulado por municipio.
function calcularArcosPuro(
  data: Municipio[],
  anioRange: [number, number],
  grupo: string,
): FlujoMigratorio[] {
  const porId: Record<string, Municipio> = Object.fromEntries(
    data.map((f) => [f.id, f]),
  );
  const listaAnios = Array.from(
    { length: anioRange[1] - anioRange[0] + 1 },
    (_, i) => String(anioRange[0] + i),
  );
  const resultado: FlujoMigratorio[] = [];

  data.forEach((source) => {
    Object.entries(source.properties.flujos).forEach(([toId, anidacion]) => {
      const target = porId[toId];
      if (!target) return;
      const valor = listaAnios.reduce(
        (acc, a) =>
          acc + ((anidacion[a] as Record<string, number>)?.[grupo] ?? 0),
        0,
      );
      if (valor > 0)
        resultado.push({ source, target, value: valor, quantile: 0 });
    });
  });

  return resultado;
}

export default function App() {
  const { municipios, rutas, dictEstaciones } = useDatos();

  // — Estado de navegación —
  const [modoInteractivo, setModoInteractivo] = useState(false);
  const [escenaActiva, setEscenaActiva] = useState(-1);
  const [anioMaxNarrativa, setAnioMaxNarrativa] = useState(2017);

  // — Estado interactivo —
  const [mostrarRutas, setMostrarRutas] = useState(true);
  const [panelAbierto, setPanelAbierto] = useState(true);
  const [grupoEtario, setGrupoEtario] = useState("total");
  const [tipoTraslado, setTipoTraslado] = useState("sentido");
  const [hoveredMunicipio, setHoveredMunicipio] = useState<Municipio | null>(
    null,
  );
  const [claveArcHover, setClaveArcHover] = useState<string | null>(null);
  const [anios, setAnios] = React.useState<number[]>([2017, 2024]);
  const [correspondenciasActivas, setCorrespondenciasActivas] = useState<
    Set<string>
  >(new Set(TODAS_CORRESPONDENCIAS));

  // Al entrar en modo interactivo: desbloquear scroll de DeckGL
  useEffect(() => {
    document.body.style.overflow = modoInteractivo ? "hidden" : "auto";
    return () => {
      document.body.style.overflow = "hidden";
    };
  }, [modoInteractivo]);

  // Animar el rango de años en escenas 1 y 4
  useEffect(() => {
    if (![1, 4].includes(escenaActiva)) {
      setAnioMaxNarrativa(2017);
      return;
    }
    setAnioMaxNarrativa(2017);
    let anio = 2017;
    const intervalo = setInterval(() => {
      anio++;
      setAnioMaxNarrativa(anio);
      if (anio >= 2024) clearInterval(intervalo);
    }, 500);
    return () => clearInterval(intervalo);
  }, [escenaActiva]);

  // Al cambiar a modo correspondencia, se restauran todos los filtros activos
  useEffect(() => {
    if (tipoTraslado === "correspondencia") {
      setCorrespondenciasActivas(new Set(TODAS_CORRESPONDENCIAS));
    }
  }, [tipoTraslado]);

  function toggleCorrespondencia(key: string) {
    setCorrespondenciasActivas((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const cambioAnios = (
    _event: Event,
    newValue: number | number[],
    activeThumb: number,
  ) => {
    const valor = newValue as number[];
    if (valor[1] - valor[0] < DISTANCIA_MINIMA_SLIDER) {
      if (activeThumb === 0) {
        const clamped = Math.min(valor[0], 1 - DISTANCIA_MINIMA_SLIDER);
        setAnios([clamped, clamped + DISTANCIA_MINIMA_SLIDER]);
      } else {
        const clamped = Math.max(valor[1], DISTANCIA_MINIMA_SLIDER);
        setAnios([clamped - DISTANCIA_MINIMA_SLIDER, clamped]);
      }
    } else {
      setAnios(valor);
    }
  };

  // — Cálculo de arcos para modo interactivo —
  function calcularArcos(
    data: Municipio[] | undefined,
    selectedMunicipio?: Municipio | null,
  ): FlujoMigratorio[] {
    if (!data || !data.length) return [];

    const municipiosPorId: Record<string, Municipio> = Object.fromEntries(
      data.map((f) => [f.id, f]),
    );
    const arcos: FlujoMigratorio[] = [];
    const listaAnios = Array.from(
      { length: anios[1] - anios[0] + 1 },
      (_, i) => "" + (anios[0] + i),
    );

    if (!selectedMunicipio) {
      data.forEach((source) => {
        source.properties.valor = 0;
        Object.entries(source.properties.flujos).forEach(
          ([toId, anidacion]) => {
            const target = municipiosPorId[toId];
            if (!target) return;
            const valor = listaAnios.reduce(
              (acc, a) =>
                acc +
                (Object.keys(anidacion).includes(a)
                  ? anidacion[a][grupoEtario]
                  : 0),
              0,
            );
            if (valor > 0)
              arcos.push({ source, target, value: valor, quantile: 0 });
            source.properties.valor += valor;
          },
        );
      });
    } else {
      Object.entries(selectedMunicipio.properties.flujos).forEach(
        ([toId, anidacion]) => {
          const target = municipiosPorId[toId];
          if (!target) return;
          const valor = listaAnios.reduce(
            (acc, a) =>
              acc +
              (Object.keys(anidacion).includes(a)
                ? anidacion[a][grupoEtario]
                : 0),
            0,
          );
          if (valor > 0) {
            arcos.push({
              source: selectedMunicipio!,
              target,
              value: valor,
              quantile: 0,
            });
          }
        },
      );
    }

    return arcos;
  }

  const arcos = useMemo(
    () => calcularArcos(municipios, hoveredMunicipio),
    [municipios, hoveredMunicipio, anios, grupoEtario],
  );

  // Flujos de llegada de todos los municipios para el tooltip (independiente del municipio seleccionado)
  const mapaLlegadas = useMemo(() => {
    if (!municipios) return {} as Record<string, number>;
    const todosArcos = calcularArcos(municipios, null);
    const mapa: Record<string, number> = {};
    todosArcos.forEach((arc) => {
      const id = String(arc.target.id);
      mapa[id] = (mapa[id] || 0) + arc.value;
    });
    return mapa;
  }, [municipios, anios, grupoEtario]);

  // Filtra arcos según las correspondencias activas cuando está en modo correspondencia
  const arcosFiltrados = useMemo(() => {
    if (tipoTraslado !== "correspondencia") return arcos;
    return arcos.filter((arc) => {
      const key = String(arc.source.id) + String(arc.target.id);
      const correspondencia =
        correspondecia_o_d[key as keyof typeof correspondecia_o_d];
      return correspondenciasActivas.has(correspondencia);
    });
  }, [arcos, tipoTraslado, correspondenciasActivas]);

  const idsConectados = useMemo(() => {
    if (!hoveredMunicipio) return null;
    const ids = new Set<unknown>();
    ids.add(hoveredMunicipio.id);
    arcos.forEach((arc) => ids.add(arc.target.id));
    return ids;
  }, [hoveredMunicipio, arcos]);

  const escalaAncho = useMemo(() => {
    if (!arcosFiltrados || arcosFiltrados.length === 0) return () => 1;
    const valores = arcosFiltrados.map((a) => Math.abs(a.value));
    return scaleLinear()
      .domain([Math.min(...valores), Math.max(...valores)])
      .range([
        0.5 + 0.006 * Math.min(...valores),
        0.5 + 0.006 * Math.max(...valores),
      ]);
  }, [arcosFiltrados]);

  // — Colores de municipio (compartido entre modos) —
  function colorMunicipio(d: {
    properties: PropiedadesMunicipio;
  }): [number, number, number, number] {
    const conEstacion =
      dictEstaciones[d.properties.CVE_ENT + d.properties.CVE_MUN] == 1;
    return conEstacion
      ? [...COLOR_CON_ESTACION, 220]
      : [...COLOR_SIN_ESTACION, 150];
  }

  // — Tooltip modo interactivo —
  function getTooltip({ object, layer }: PickingInfo) {
    if (!object) return null;

    const estiloBase = {
      backgroundColor: "rgba(8,14,28,0.92)",
      color: "white",
      fontSize: "12px",
      borderRadius: "6px",
      padding: "8px 12px",
      lineHeight: "1.6",
      pointerEvents: "none" as const,
    };

    if (layer?.id === "arc" || layer?.id === "arc-interactivo") {
      const flujo = object as FlujoMigratorio;
      const key = String(flujo.source.id) + String(flujo.target.id);
      const correspondencia =
        correspondecia_o_d[key as keyof typeof correspondecia_o_d];
      const sentido = sentido_o_d[key as keyof typeof sentido_o_d];
      return {
        html: `
          <div style="font-weight:600;margin-bottom:4px;white-space:nowrap">
            <b style="color:${rgbToHex(COLOR_ORIGEN)}">${flujo.source.properties.NOMGEO}</b>
            <span style="color:rgba(255,255,255,0.45)"> → </span>
            <b style="color:${rgbToHex(COLOR_DESTINO)}">${flujo.target.properties.NOMGEO}</b>
          </div>
          <div>Traslados: <b>${flujo.value.toLocaleString("en")}</b></div>
          ${sentido ? `<div style="color:rgba(255,255,255,0.7)">Sentido: ${sentido}</div>` : ""}
          ${correspondencia ? `<div style="color:rgba(255,255,255,0.7)">Correspondencia: ${correspondencia}</div>` : ""}
        `,
        style: { ...estiloBase, maxWidth: "260px" },
      };
    }

    const municipio = object as Municipio;
    const salidas = municipio.properties.valor || 0;
    const llegadas = mapaLlegadas[String(municipio.id)] || 0;
    const etiquetaGrupo = grupoEtario === "total" ? "Total" : "Menores de edad";
    return {
      html: `
        <div style="font-weight:600;margin-bottom:4px">
          ${municipio.properties.NOMGEO},
          <span style="font-weight:400;color:rgba(255,255,255,0.65)">${municipio.properties.NOM_ENT}</span>
        </div>
        <div style="color:rgba(255,255,255,0.5);font-size:11px;margin-bottom:2px">${etiquetaGrupo}</div>
        <div>
          <span style="color:${rgbToHex(COLOR_ORIGEN)}">↑</span>
          Traslados de salida: <b>${salidas.toLocaleString("en")}</b>
        </div>
        <div>
          <span style="color:${rgbToHex(COLOR_DESTINO)}">↓</span>
          Traslados de llegada: <b>${llegadas.toLocaleString("en")}</b>
        </div>
      `,
      style: estiloBase,
    };
  }

  // — Capas para el modo narrativa —
  const capasNarrativa = useMemo((): Layer[] => {
    if (!municipios) return [];

    const capaBase = new GeoJsonLayer<PropiedadesMunicipio>({
      id: "geojson-narrativa",
      data: municipios,
      stroked: true,
      filled: true,
      getFillColor: colorMunicipio,
      updateTriggers: { getFillColor: [dictEstaciones] },
      getLineColor: [75, 105, 160, 100],
      getLineWidth: 1,
      lineWidthUnits: "pixels",
      pickable: false,
    });

    const capaRutas = mostrarRutas
      ? new GeoJsonLayer({
          id: "rutas-narrativa",
          data: rutas,
          stroked: true,
          filled: false,
          getLineColor: [255, 255, 255],
          getLineWidth: 2,
          lineWidthUnits: "pixels",
          pickable: false,
        })
      : null;

    // Escenas 0 y -1: solo mapa base, sin arcos
    if (escenaActiva <= 0) {
      return [capaBase, capaRutas].filter(Boolean) as Layer[];
    }

    // Escenas 1 y 4: todos los arcos, animados por año
    if (escenaActiva === 1 || escenaActiva === 4) {
      const grupo = escenaActiva === 4 ? "total_infancias" : "total";
      const arcosAnim = calcularArcosPuro(
        municipios,
        [2017, anioMaxNarrativa],
        grupo,
      );
      const escala = escalaAnchoDeArcos(arcosAnim);
      const capaArcos = new ArcLayer<FlujoMigratorio>({
        id: `arc-narrativa-${escenaActiva}`,
        data: arcosAnim,
        pickable: false,
        getSourcePosition: (d) => d.source.properties.centroid,
        getTargetPosition: (d) => d.target.properties.centroid,
        getSourceColor: [...COLOR_ORIGEN, 130] as [
          number,
          number,
          number,
          number,
        ],
        getTargetColor: [...COLOR_DESTINO, 240] as [
          number,
          number,
          number,
          number,
        ],
        getWidth: (d) => escala(Math.abs(d.value)),
        getHeight: 0.5,
      });
      return [capaBase, capaRutas, capaArcos].filter(Boolean) as Layer[];
    }

    // Escena 2: solo arcos con destino en municipio con estación migratoria
    if (escenaActiva === 2) {
      const todosArcos = calcularArcosPuro(municipios, [2017, 2024], "total");
      const arcosEstacion = todosArcos.filter(
        (arc) =>
          dictEstaciones[
            arc.target.properties.CVE_ENT + arc.target.properties.CVE_MUN
          ] == 1,
      );
      const idsDestino = new Set(arcosEstacion.map((a) => a.target.id));

      const capaMunicipiosFiltrada = new GeoJsonLayer<PropiedadesMunicipio>({
        id: "geojson-narrativa-2",
        data: municipios,
        stroked: true,
        filled: true,
        getFillColor: (d) => {
          const conEstacion =
            dictEstaciones[d.properties.CVE_ENT + d.properties.CVE_MUN] == 1;
          if (conEstacion) return [...COLOR_CON_ESTACION, 230];
          return [20, 28, 55, 60]; // muy atenuado
        },
        updateTriggers: { getFillColor: [dictEstaciones] },
        getLineColor: [75, 105, 160, 60],
        getLineWidth: 1,
        lineWidthUnits: "pixels",
        pickable: false,
      });

      const escala2 = escalaAnchoDeArcos(arcosEstacion);
      const capaArcos = new ArcLayer<FlujoMigratorio>({
        id: "arc-narrativa-2",
        data: arcosEstacion,
        pickable: false,
        getSourcePosition: (d) => d.source.properties.centroid,
        getTargetPosition: (d) => d.target.properties.centroid,
        getSourceColor: [255, 180, 30, 120] as [number, number, number, number],
        getTargetColor: [255, 165, 0, 220] as [number, number, number, number],
        getWidth: (d) => escala2(Math.abs(d.value)),
        getHeight: 0.5,
      });
      void idsDestino;
      return [capaMunicipiosFiltrada, capaRutas, capaArcos].filter(
        Boolean,
      ) as Layer[];
    }

    // Escena 3: solo arcos fuera de ruta
    if (escenaActiva === 3) {
      const todosArcos = calcularArcosPuro(municipios, [2017, 2024], "total");
      const arcosFueraRuta = todosArcos.filter((arc) => {
        const key = String(arc.source.id) + String(arc.target.id);
        return (
          correspondecia_o_d[key as keyof typeof correspondecia_o_d] ===
          "Dispersión fuera de las rutas"
        );
      });
      const escala3 = escalaAnchoDeArcos(arcosFueraRuta);
      const capaArcos = new ArcLayer<FlujoMigratorio>({
        id: "arc-narrativa-3",
        data: arcosFueraRuta,
        pickable: false,
        getSourcePosition: (d) => d.source.properties.centroid,
        getTargetPosition: (d) => d.target.properties.centroid,
        getSourceColor: [255, 75, 75, 130] as [number, number, number, number],
        getTargetColor: [255, 75, 75, 220] as [number, number, number, number],
        getWidth: (d) => escala3(Math.abs(d.value)),
        getHeight: 0.5,
      });
      return [capaBase, capaRutas, capaArcos].filter(Boolean) as Layer[];
    }

    return [capaBase, capaRutas].filter(Boolean) as Layer[];
  }, [escenaActiva, municipios, rutas, dictEstaciones, anioMaxNarrativa]);

  // — Capas para el modo interactivo —
  const capasInteractivas: Layer[] = [
    new GeoJsonLayer<PropiedadesMunicipio>({
      id: "geojson",
      data: municipios,
      opacity: hoveredMunicipio ? 0.08 : 1,
      stroked: true,
      filled: true,
      getFillColor: colorMunicipio,
      updateTriggers: { getFillColor: [dictEstaciones] },
      getLineColor: [75, 105, 160, 210],
      getLineWidth: 1,
      lineWidthUnits: "pixels",
      pickable: true,
      onHover: ({ object }) => setHoveredMunicipio(object || null),
      onClick: ({ object }) => setHoveredMunicipio(object || null),
    }),
    idsConectados &&
      new GeoJsonLayer<PropiedadesMunicipio>({
        id: "geojson-active",
        data: municipios?.filter((d) => idsConectados.has(d.id)),
        opacity: 1,
        stroked: true,
        filled: true,
        getFillColor: colorMunicipio,
        updateTriggers: { getFillColor: [dictEstaciones] },
        getLineColor: [75, 105, 160, 210],
        getLineWidth: 1,
        lineWidthUnits: "pixels",
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
        getLineColor: [255, 255, 255],
        getLineWidth: 2,
        lineWidthUnits: "pixels",
      }),
    new ArcLayer<FlujoMigratorio>({
      id: "arc-interactivo",
      data: arcosFiltrados,
      pickable: true,
      onHover: ({ object }) => {
        setClaveArcHover(
          object ? String(object.source.id) + String(object.target.id) : null,
        );
      },
      getSourcePosition: (d) => d.source.properties.centroid,
      getTargetPosition: (d) => d.target.properties.centroid,
      getSourceColor: (d) => {
        const arcKey = String(d.source.id) + String(d.target.id);
        const esHover = claveArcHover === arcKey;
        const hayHover = claveArcHover !== null;
        const alpha = hayHover ? (esHover ? 210 : 18) : 130;
        if (tipoTraslado === "sentido") {
          return [...COLOR_ORIGEN, alpha] as [number, number, number, number];
        }
        const correspondencia =
          correspondecia_o_d[arcKey as keyof typeof correspondecia_o_d];
        const color = DICT_COLOR_CORRESPONDENCIA[correspondencia] ?? [
          150, 150, 150,
        ];
        return [...color, hayHover ? (esHover ? 160 : 18) : 75] as [
          number,
          number,
          number,
          number,
        ];
      },
      getTargetColor: (d) => {
        const arcKey = String(d.source.id) + String(d.target.id);
        const esHover = claveArcHover === arcKey;
        const hayHover = claveArcHover !== null;
        const alpha = hayHover ? (esHover ? 255 : 22) : 240;
        if (tipoTraslado === "sentido") {
          return [...COLOR_DESTINO, alpha] as [number, number, number, number];
        }
        const correspondencia =
          correspondecia_o_d[arcKey as keyof typeof correspondecia_o_d];
        const color = DICT_COLOR_CORRESPONDENCIA[correspondencia] ?? [
          150, 150, 150,
        ];
        return [...color, hayHover ? (esHover ? 255 : 22) : 240] as [
          number,
          number,
          number,
          number,
        ];
      },
      getWidth: (d) => {
        const arcKey = String(d.source.id) + String(d.target.id);
        const base = escalaAncho(Math.abs(d.value));
        return claveArcHover === arcKey ? Math.max(base * 2, 3) : base;
      },
      getHeight: () => 0.5 + Math.random() * 0.001,
      updateTriggers: {
        getSourceColor: [tipoTraslado, claveArcHover],
        getTargetColor: [tipoTraslado, claveArcHover],
        getWidth: [claveArcHover],
      },
    }),
  ].filter(Boolean) as Layer[];

  const capasActivas = modoInteractivo ? capasInteractivas : capasNarrativa;

  return (
    <>
      {/* Mapa siempre fijo en el fondo */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0 }}>
        <DeckGL
          layers={capasActivas}
          initialViewState={ESTADO_INICIAL_MAPA}
          controller={modoInteractivo}
          getTooltip={modoInteractivo ? getTooltip : undefined}
        >
          <Map reuseMaps mapStyle={ESTILO_MAPA} />
        </DeckGL>
      </div>

      {/* Narrativa scrollable (encima del mapa, fondo transparente) */}
      {!modoInteractivo && (
        <NarrativaScroll
          onEscenaChange={setEscenaActiva}
          onTerminar={() => {
            setModoInteractivo(true);
            window.scrollTo(0, 0);
          }}
        />
      )}

      {/* Indicador de rango de años — escenas 1 y 4 */}
      {!modoInteractivo && [1, 4].includes(escenaActiva) && (
        <div
          style={{
            position: "fixed",
            bottom: 40,
            right: 40,
            zIndex: 20,
            fontFamily: "monospace",
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: 3,
            color:
              escenaActiva === 4
                ? "rgba(255,70,160,0.9)"
                : "rgba(30,210,255,0.9)",
            textShadow: "0 2px 16px rgba(0,0,0,0.9)",
            pointerEvents: "none",
            transition: "color 0.3s",
          }}
        >
          {anioMaxNarrativa === 2017 ? "2017" : `2017–${anioMaxNarrativa}`}
        </div>
      )}

      {/* Panel de controles — solo en modo interactivo */}
      {modoInteractivo && (
        <div style={{ position: "fixed", zIndex: 10, top: 0, left: 0 }}>
          <PanelControles
            panelAbierto={panelAbierto}
            setPanelAbierto={setPanelAbierto}
            mostrarRutas={mostrarRutas}
            setMostrarRutas={setMostrarRutas}
            tipoTraslado={tipoTraslado}
            setTipoTraslado={setTipoTraslado}
            correspondenciasActivas={correspondenciasActivas}
            toggleCorrespondencia={toggleCorrespondencia}
            anios={anios}
            cambioAnios={cambioAnios}
            grupoEtario={grupoEtario}
            setGrupoEtario={setGrupoEtario}
          />
        </div>
      )}
    </>
  );
}

export function renderToDOM(container: HTMLDivElement) {
  createRoot(container).render(<App />);
}
