import React, { useState, useMemo, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Map } from "react-map-gl/maplibre";
import { DeckGL } from "@deck.gl/react";
import { GeoJsonLayer, ArcLayer } from "@deck.gl/layers";
import { scaleLinear } from "d3-scale";

import type { PickingInfo } from "@deck.gl/core";
import type { Layer } from "@deck.gl/core";
import sentido_o_d from "./assets/sentidos_origen_destino.json";

import type {
  Municipio,
  Ruta,
  FlujoMigratorio,
  PropiedadesMunicipio,
  PropiedadesCarretera,
} from "./types";
import {
  COLOR_ORIGEN,
  COLOR_DESTINO,
  COLOR_CON_ESTACION,
  COLOR_SIN_ESTACION,
  COLOR_NEUTRO,
  COLOR_DETENCION,
  COLOR_MENORES,
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
    .range([0.5 + 0.0006 * minV, 0.5 + 0.0006 * maxV]);
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
  const [mostrarRutas, setMostrarRutas] = useState(false);
  const [mostrarTodosArcos, setMostrarTodosArcos] = useState(false);
  const [panelAbierto, setPanelAbierto] = useState(true);
  const [grupoEtario, setGrupoEtario] = useState("total");
  const [hoveredMunicipio, setHoveredMunicipio] = useState<Municipio | null>(
    null,
  );
  const [municipioSeleccionado, setMunicipioSeleccionado] =
    useState<Municipio | null>(null);
  const [claveArcHover, setClaveArcHover] = useState<string | null>(null);
  const [anios, setAnios] = React.useState<number[]>([2017, 2024]);

  // Al entrar en modo interactivo: desbloquear scroll de DeckGL
  useEffect(() => {
    document.body.style.overflow = modoInteractivo ? "hidden" : "auto";
    return () => {
      document.body.style.overflow = "hidden";
    };
  }, [modoInteractivo]);

  // Animar el rango de años en escena 5 (menores)
  useEffect(() => {
    if (escenaActiva !== 5) {
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
      // Mapa en blanco por default: sin arcos hasta que el usuario seleccione un municipio
      return [];
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
    () => calcularArcos(municipios, hoveredMunicipio || municipioSeleccionado),
    [municipios, hoveredMunicipio, municipioSeleccionado, anios, grupoEtario],
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

  const idsConectados = useMemo(() => {
    const activo = hoveredMunicipio || municipioSeleccionado;
    if (!activo) return null;
    const ids = new Set<unknown>();
    ids.add(activo.id);
    arcos.forEach((arc) => ids.add(arc.target.id));
    return ids;
  }, [hoveredMunicipio, municipioSeleccionado, arcos]);

  // Rutas filtradas: hover o selección muestran solo las del municipio activo
  const rutasMunicipio = useMemo(() => {
    const activo = hoveredMunicipio || municipioSeleccionado;
    if (!rutas || !activo) return null;
    const cve = activo.properties.CVE_ENT + activo.properties.CVE_MUN;
    return rutas.filter(
      (r) => r.properties.CVE_ENT + r.properties.CVE_MUN === cve,
    );
  }, [rutas, hoveredMunicipio, municipioSeleccionado]);

  const escalaAncho = useMemo(() => {
    if (!arcos || arcos.length === 0) return () => 1;
    const valores = arcos.map((a) => Math.abs(a.value));
    return scaleLinear()
      .domain([Math.min(...valores), Math.max(...valores)])
      .range([
        0.5 + 0.006 * Math.min(...valores),
        0.5 + 0.006 * Math.max(...valores),
      ]);
  }, [arcos]);

  // Todos los arcos para el modo "mostrar todos los traslados"
  const todosArcosInteractivo = useMemo(() => {
    if (!mostrarTodosArcos || !municipios) return [];
    return calcularArcosPuro(municipios, [anios[0], anios[1]], grupoEtario);
  }, [mostrarTodosArcos, municipios, anios, grupoEtario]);

  const escalaAnchoTodos = useMemo(
    () => escalaAnchoDeArcos(todosArcosInteractivo),
    [todosArcosInteractivo],
  );

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
      fontSize: "14px",
      borderRadius: "6px",
      padding: "8px 12px",
      lineHeight: "1.6",
      pointerEvents: "none" as const,
    };

    if (layer?.id === "rutas-municipio") {
      const ruta = object as Ruta;
      return {
        html: `<div style="font-weight:600;margin-bottom:2px">Ruta migratoria</div><div style="color:rgba(255,255,255,0.6)">Desde ${ruta.properties.NOMGEO}</div>`,
        style: estiloBase,
      };
    }

    if (layer?.id === "arc" || layer?.id === "arc-interactivo" || layer?.id === "arc-todos") {
      const flujo = object as FlujoMigratorio;
      const key = String(flujo.source.id) + String(flujo.target.id);
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
        <div style="color:rgba(255,255,255,0.5);font-size:13px;margin-bottom:2px">${etiquetaGrupo}</div>
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

    // Escena 2 ("datos"): todos los municipios en color neutro uniforme
    const capaBaseNeutra = new GeoJsonLayer<PropiedadesMunicipio>({
      id: "geojson-narrativa-neutra",
      data: municipios,
      stroked: true,
      filled: true,
      getFillColor: [...COLOR_SIN_ESTACION, 150] as [
        number,
        number,
        number,
        number,
      ],
      getLineColor: [75, 105, 160, 100],
      getLineWidth: 1,
      lineWidthUnits: "pixels",
      pickable: false,
    });

    // Escena 3+ ("detencion"): distinción dorado/neutro según em==1
    const capaBaseEstaciones = new GeoJsonLayer<PropiedadesMunicipio>({
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

    const capaRutas = new GeoJsonLayer({
      id: "rutas-narrativa",
      data: rutas,
      stroked: true,
      filled: false,
      getLineColor: [255, 255, 255, 160],
      getLineWidth: 2,
      lineWidthUnits: "pixels",
      pickable: false,
    });

    // Escenas 0 y 1 (imágenes): solo mapa base sin arcos ni rutas
    if (escenaActiva <= 1) {
      return [capaBaseNeutra] as Layer[];
    }

    // Escena 2: todos los arcos en color neutro + rutas
    if (escenaActiva === 2) {
      const todosArcos = calcularArcosPuro(municipios, [2017, 2024], "total");
      const escala2 = escalaAnchoDeArcos(todosArcos);
      const capaArcos = new ArcLayer<FlujoMigratorio>({
        id: "arc-narrativa-2",
        data: todosArcos,
        pickable: false,
        getSourcePosition: (d) => d.source.properties.centroid,
        getTargetPosition: (d) => d.target.properties.centroid,
        getSourceColor: [...COLOR_NEUTRO, 80] as [
          number,
          number,
          number,
          number,
        ],
        getTargetColor: [...COLOR_NEUTRO, 160] as [
          number,
          number,
          number,
          number,
        ],
        getWidth: (d) => escala2(Math.abs(d.value)),
        getHeight: 0.5,
      });
      return [capaBaseNeutra, capaRutas, capaArcos] as Layer[];
    }

    // Escena 3: detención — dorado si destino tiene em=1, neutro si no
    if (escenaActiva === 3) {
      const todosArcos = calcularArcosPuro(municipios, [2017, 2024], "total");
      const escala3 = escalaAnchoDeArcos(todosArcos);
      const capaArcos = new ArcLayer<FlujoMigratorio>({
        id: "arc-narrativa-3",
        data: todosArcos,
        pickable: false,
        getSourcePosition: (d) => d.source.properties.centroid,
        getTargetPosition: (d) => d.target.properties.centroid,
        getSourceColor: (d) => {
          const esDetencion =
            dictEstaciones[
              d.target.properties.CVE_ENT + d.target.properties.CVE_MUN
            ] === 1;
          return esDetencion
            ? ([...COLOR_DETENCION, 110] as [number, number, number, number])
            : ([...COLOR_NEUTRO, 35] as [number, number, number, number]);
        },
        getTargetColor: (d) => {
          const esDetencion =
            dictEstaciones[
              d.target.properties.CVE_ENT + d.target.properties.CVE_MUN
            ] === 1;
          return esDetencion
            ? ([...COLOR_DETENCION, 230] as [number, number, number, number])
            : ([...COLOR_NEUTRO, 55] as [number, number, number, number]);
        },
        getWidth: (d) => escala3(Math.abs(d.value)),
        getHeight: 0.5,
        updateTriggers: {
          getSourceColor: [dictEstaciones],
          getTargetColor: [dictEstaciones],
        },
      });
      return [capaBaseEstaciones, capaRutas, capaArcos] as Layer[];
    }

    // Escena 4: sentido — colores origen/destino estáticos (2017-2024)
    if (escenaActiva === 4) {
      const todosArcos = calcularArcosPuro(municipios, [2017, 2024], "total");
      const escala4 = escalaAnchoDeArcos(todosArcos);
      const capaArcos = new ArcLayer<FlujoMigratorio>({
        id: "arc-narrativa-4",
        data: todosArcos,
        pickable: false,
        getSourcePosition: (d) => d.source.properties.centroid,
        getTargetPosition: (d) => d.target.properties.centroid,
        getSourceColor: [...COLOR_ORIGEN, 120] as [
          number,
          number,
          number,
          number,
        ],
        getTargetColor: [...COLOR_DESTINO, 230] as [
          number,
          number,
          number,
          number,
        ],
        getWidth: (d) => escala4(Math.abs(d.value)),
        getHeight: 0.5,
      });
      return [capaBaseEstaciones, capaRutas, capaArcos] as Layer[];
    }

    // Escena 5: menores — arcos infancias animados por año
    if (escenaActiva === 5) {
      const arcosAnim = calcularArcosPuro(
        municipios,
        [2017, anioMaxNarrativa],
        "total_infancias",
      );
      const escala5 = escalaAnchoDeArcos(arcosAnim);
      const capaArcos = new ArcLayer<FlujoMigratorio>({
        id: "arc-narrativa-5",
        data: arcosAnim,
        pickable: false,
        getSourcePosition: (d) => d.source.properties.centroid,
        getTargetPosition: (d) => d.target.properties.centroid,
        getSourceColor: [...COLOR_MENORES, 120] as [
          number,
          number,
          number,
          number,
        ],
        getTargetColor: [...COLOR_MENORES, 240] as [
          number,
          number,
          number,
          number,
        ],
        getWidth: (d) => escala5(Math.abs(d.value)),
        getHeight: 0.5,
      });
      return [capaBaseEstaciones, capaRutas, capaArcos] as Layer[];
    }

    return [capaBaseEstaciones] as Layer[];
  }, [escenaActiva, municipios, rutas, dictEstaciones, anioMaxNarrativa]);

  // — Capas para el modo interactivo —
  const hayActivo = !!(hoveredMunicipio || municipioSeleccionado);

  // Handler de click: toggle — mismo municipio deselecciona, otro selecciona
  const onClickMunicipio = ({ object }: PickingInfo) => {
    const m = object as Municipio | null | undefined;
    setMunicipioSeleccionado((prev) =>
      m?.id != null && m.id === prev?.id ? null : (m ?? null),
    );
  };

  const capasInteractivas: Layer[] = [
    new GeoJsonLayer<PropiedadesMunicipio>({
      id: "geojson",
      data: municipios,
      opacity: hayActivo ? 0.08 : 1,
      stroked: true,
      filled: true,
      getFillColor: colorMunicipio,
      updateTriggers: { getFillColor: [dictEstaciones] },
      getLineColor: [75, 105, 160, 210],
      getLineWidth: 1,
      lineWidthUnits: "pixels",
      pickable: true,
      onHover: ({ object }) => setHoveredMunicipio(object || null),
      onClick: onClickMunicipio,
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
        onClick: onClickMunicipio,
      }),
    // Rutas: municipio activo → filtradas (pickables si están bloqueadas por click)
    //        checkbox ON sin activo → todas las rutas, tenues
    rutasMunicipio
      ? new GeoJsonLayer<PropiedadesCarretera>({
          id: "rutas-municipio",
          data: rutasMunicipio,
          stroked: true,
          filled: false,
          getLineColor: [255, 255, 255, 220] as [
            number,
            number,
            number,
            number,
          ],
          getLineWidth: 2.5,
          lineWidthUnits: "pixels",
          pickable: !!municipioSeleccionado && !hoveredMunicipio,
        })
      : mostrarRutas &&
        new GeoJsonLayer<Ruta>({
          id: "rutas",
          data: rutas,
          stroked: true,
          filled: false,
          getLineColor: [255, 255, 255, 70] as [number, number, number, number],
          getLineWidth: 1.5,
          lineWidthUnits: "pixels",
          pickable: false,
        }),
    // Todos los traslados — degradado origen/destino con anchos escalados, hoverable
    mostrarTodosArcos &&
      new ArcLayer<FlujoMigratorio>({
        id: "arc-todos",
        data: todosArcosInteractivo,
        pickable: !hayActivo,
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
          const alpha = hayHover ? (esHover ? 210 : 30) : 120;
          return [...COLOR_ORIGEN, alpha] as [number, number, number, number];
        },
        getTargetColor: (d) => {
          const arcKey = String(d.source.id) + String(d.target.id);
          const esHover = claveArcHover === arcKey;
          const hayHover = claveArcHover !== null;
          const alpha = hayHover ? (esHover ? 255 : 40) : 230;
          return [...COLOR_DESTINO, alpha] as [number, number, number, number];
        },
        getWidth: (d) => {
          const arcKey = String(d.source.id) + String(d.target.id);
          const base = escalaAnchoTodos(Math.abs(d.value));
          return claveArcHover === arcKey ? Math.max(base * 2, 3) : base;
        },
        getHeight: 0.5,
        updateTriggers: {
          getSourceColor: [claveArcHover],
          getTargetColor: [claveArcHover],
          getWidth: [claveArcHover],
        },
      }),
    new ArcLayer<FlujoMigratorio>({
      id: "arc-interactivo",
      data: arcos,
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
        return [...COLOR_ORIGEN, alpha] as [number, number, number, number];
      },
      getTargetColor: (d) => {
        const arcKey = String(d.source.id) + String(d.target.id);
        const esHover = claveArcHover === arcKey;
        const hayHover = claveArcHover !== null;
        const alpha = hayHover ? (esHover ? 255 : 22) : 240;
        return [...COLOR_DESTINO, alpha] as [number, number, number, number];
      },
      getWidth: (d) => {
        const arcKey = String(d.source.id) + String(d.target.id);
        const base = escalaAncho(Math.abs(d.value));
        return claveArcHover === arcKey ? Math.max(base * 2, 3) : base;
      },
      getHeight: () => 0.5 + Math.random() * 0.001,
      updateTriggers: {
        getSourceColor: [claveArcHover],
        getTargetColor: [claveArcHover],
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
          onClick={
            modoInteractivo
              ? ({ object }) => {
                  if (!object) setMunicipioSeleccionado(null);
                }
              : undefined
          }
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

      {/* Indicador de rango de años — escena 5 (menores) */}
      {!modoInteractivo && escenaActiva === 5 && (
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
            color: "rgba(180, 100, 255,0.9)",
            textShadow: "0 2px 16px rgba(0,0,0,0.9)",
            pointerEvents: "none",
            transition: "color 0.3s",
          }}
        >
          {anioMaxNarrativa === 2017 ? "2017" : `2017–${anioMaxNarrativa}`}
        </div>
      )}

      {/* Botón volver a narrativa */}
      {modoInteractivo && (
        <button
          onClick={() => {
            setModoInteractivo(false);
            setMunicipioSeleccionado(null);
            setHoveredMunicipio(null);
          }}
          style={{
            position: "fixed",
            top: 16,
            right: 16,
            zIndex: 10,
            background: "rgba(10,15,30,0.88)",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 6,
            color: "rgba(255,255,255,0.75)",
            fontSize: 11,
            letterSpacing: 1.5,
            padding: "6px 14px",
            cursor: "pointer",
            backdropFilter: "blur(4px)",
          }}
        >
          ← VOLVER
        </button>
      )}

      {/* Panel de controles — solo en modo interactivo */}
      {modoInteractivo && (
        <div style={{ position: "fixed", zIndex: 10, top: 0, left: 0 }}>
          <PanelControles
            panelAbierto={panelAbierto}
            setPanelAbierto={setPanelAbierto}
            mostrarRutas={mostrarRutas}
            setMostrarRutas={setMostrarRutas}
            mostrarTodosArcos={mostrarTodosArcos}
            setMostrarTodosArcos={setMostrarTodosArcos}
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
