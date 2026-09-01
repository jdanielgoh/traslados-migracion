import { useEffect, useRef, useState } from "react";
import { Box, Typography, Button } from "@mui/material";
import { GraficaBarras } from "./GraficaBarras";

// Patrón basado en SisdaiNarrativa (CentroGeo):
// - Contenedor con altura = (n_escenas + buffer) * 100vh
// - Sentinelas posicionados absolutamente en cada intervalo de 100vh
// - Sensor en 45vh detecta qué escena es activa
// - Viñeta activa se muestra en overlay fijo (bottom-left)

const GUION = [
  {
    titulo: "La dispersión es una política migratoria de desgaste",
    copy: "Entre 2017 y 2024, el INM incrementó su vigilancia a las rutas de tránsito tradicionales y trasladó personas migrantes por todo el país, vulnerando sus derechos.",
    grafica: null as null | "total" | "infancias",
  },
  {
    titulo: "El alcance es enorme y creció exponencialmente entre 2017–2024",
    copy: "En total, más de medio millón de personas se vieron afectadas. Con el cambio de régimen migratorio en Estados Unidos a inicios de 2025, los traslados internos siguen como estrategia para dispersar a personas deportadas de terceros países a México.",
    grafica: "total" as const,
  },
  {
    titulo: "Una política deliberada para alimentar la infraestructura de detención migratoria",
    copy: "La mayoría de los traslados devolvieron a las personas a la frontera sur o las trasladaron a centros de detención. Varios puntos de tránsito terminaron convirtiéndose en estaciones migratorias, ya sea por renovación o por el inicio de sus operaciones.",
    grafica: null,
  },
  {
    titulo: "La dispersión evolucionó de herramienta de deportación hacia la desorientación",
    copy: "Históricamente, el INM justificó los traslados como logística para deportaciones. Pero la diversidad regional de personas a bordo de cada traslado aumentó, reflejando que los traslados funcionaron principalmente para desorientar a las personas en movilidad.",
    grafica: null,
  },
  {
    titulo: "Por un tecnicismo legal, el INM simuló proteger el interés superior de niñas, niños y adolescentes",
    copy: "Mientras el alojamiento de menores en estaciones migratorias fue prohibido en 2020, el INM todavía podía asegurarlos y trasladarlos. Entre 2017 y 2024, el traslado de menores se disparó casi un 900%, resultando también en separación de familias.",
    grafica: "infancias" as const,
  },
];

const URL_TOTAL = `${import.meta.env.BASE_URL}traslados_anio_total.json`;
const URL_INFANCIAS = `${import.meta.env.BASE_URL}traslados_anio_total_infancia.json`;

const SEPARACION = 100;
const INICIO = 100;
const SENSOR = 0.45;

type DatoAnio = { anio: number; total: number };

type Props = {
  onEscenaChange: (escena: number) => void;
  onTerminar: () => void;
};

export function NarrativaScroll({ onEscenaChange, onTerminar }: Props) {
  const [escenaActiva, setEscenaActiva] = useState(-1);
  const [datosTotal, setDatosTotal] = useState<DatoAnio[]>([]);
  const [datosInfancias, setDatosInfancias] = useState<DatoAnio[]>([]);
  const sentinelaRefs = useRef<(HTMLDivElement | null)[]>([]);
  const alturaTotal = INICIO + GUION.length * SEPARACION + 80;

  // Carga de datos para las gráficas
  useEffect(() => {
    fetch(URL_TOTAL)
      .then((r) => r.json())
      .then((json: { anio: number; total: number }[]) => setDatosTotal(json))
      .catch(() => {});

    fetch(URL_INFANCIAS)
      .then((r) => r.json())
      .then((json: { anio: number; total_infancias: number }[]) =>
        setDatosInfancias(json.map((d) => ({ anio: d.anio, total: d.total_infancias }))),
      )
      .catch(() => {});
  }, []);

  // Detección de escena activa por scroll
  useEffect(() => {
    const handler = () => {
      const sensorY = window.innerHeight * SENSOR;
      let activa = -1;
      sentinelaRefs.current.forEach((el, i) => {
        if (!el) return;
        if (el.getBoundingClientRect().top < sensorY) activa = i;
      });
      if (activa !== escenaActiva) {
        setEscenaActiva(activa);
        onEscenaChange(activa);
      }
    };

    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [escenaActiva, onEscenaChange]);

  return (
    <div style={{ position: "relative", height: `${alturaTotal}vh`, zIndex: 1 }}>
      {/* Sentinelas de detección de scroll */}
      {GUION.map((_, i) => (
        <div
          key={i}
          ref={(el) => { sentinelaRefs.current[i] = el; }}
          style={{ position: "absolute", top: `${INICIO + i * SEPARACION}vh`, height: 0, width: "100%" }}
        />
      ))}

      {/* Viñetas — absolutamente posicionadas, suben con el scroll */}
      {GUION.map((item, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: `${INICIO + i * SEPARACION + (1 - SENSOR) * 100}vh`,
            left: 40,
            width: 360,
            zIndex: 20,
          }}
        >
          <ViñetaCard
            titulo={item.titulo}
            copy={item.copy}
            grafica={item.grafica}
            datosTotal={datosTotal}
            datosInfancias={datosInfancias}
            activa={i === escenaActiva}
            escenaActiva={escenaActiva}
            totalEscenas={GUION.length}
          />
        </div>
      ))}

      {/* Indicador de scroll antes de la primera escena */}
      {escenaActiva === -1 && (
        <div
          style={{
            position: "fixed",
            bottom: 40,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 20,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            pointerEvents: "none",
          }}
        >
          <Typography sx={{ color: "rgba(255,255,255,0.5)", fontSize: 11, letterSpacing: 2 }}>
            DESLIZA PARA CONTINUAR
          </Typography>
          <Box
            sx={{
              width: 1,
              height: 40,
              backgroundColor: "rgba(255,255,255,0.3)",
              animation: "pulso 1.5s ease-in-out infinite",
              "@keyframes pulso": {
                "0%, 100%": { opacity: 0.2, transform: "scaleY(0.6)" },
                "50%": { opacity: 0.8, transform: "scaleY(1)" },
              },
            }}
          />
        </div>
      )}

      {/* CTA al llegar a la última escena */}
      {escenaActiva === GUION.length - 1 && (
        <div
          style={{
            position: "fixed",
            bottom: 32,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 20,
          }}
        >
          <Button
            onClick={onTerminar}
            sx={{
              color: "white",
              borderColor: "rgba(30,210,255,0.6)",
              border: "1px solid",
              backdropFilter: "blur(6px)",
              backgroundColor: "rgba(10,15,30,0.75)",
              fontSize: 12,
              letterSpacing: 1.5,
              px: 3,
              py: 1,
              "&:hover": {
                backgroundColor: "rgba(30,210,255,0.12)",
                borderColor: "rgb(30,210,255)",
              },
              transition: "all 0.2s",
            }}
          >
            EXPLORAR EL MAPA →
          </Button>
        </div>
      )}
    </div>
  );
}

type ViñetaProps = {
  titulo: string;
  copy: string;
  grafica: "total" | "infancias" | null;
  datosTotal: DatoAnio[];
  datosInfancias: DatoAnio[];
  activa: boolean;
  escenaActiva: number;
  totalEscenas: number;
};

function ViñetaCard({
  titulo,
  copy,
  grafica,
  datosTotal,
  datosInfancias,
  activa,
  escenaActiva,
  totalEscenas,
}: ViñetaProps) {
  return (
    <div
      style={{
        backgroundColor: "rgba(8,14,28,0.93)",
        backdropFilter: "blur(8px)",
        borderRadius: 8,
        padding: "20px 22px 16px",
        borderLeft: "3px solid rgba(30,210,255,0.55)",
        animation: "entrar 0.45s cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      <style>{`
        @keyframes entrar {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <Typography sx={{ color: "white", fontWeight: 700, fontSize: 13, lineHeight: 1.45, mb: 1.25 }}>
        {titulo}
      </Typography>

      <Typography sx={{ color: "rgba(255,255,255,0.68)", fontSize: 12, lineHeight: 1.75 }}>
        {copy}
      </Typography>

      {grafica === "total" && (
        <GraficaBarras
          datos={datosTotal}
          color="rgb(30,210,255)"
          activa={activa}
          etiqueta="Personas trasladadas por año"
        />
      )}

      {grafica === "infancias" && (
        <GraficaBarras
          datos={datosInfancias}
          color="rgb(255,70,160)"
          activa={activa}
          etiqueta="Menores de edad trasladados por año"
        />
      )}

      {/* Barra de progreso de escenas */}
      <Box sx={{ display: "flex", gap: "4px", mt: 2 }}>
        {Array.from({ length: totalEscenas }).map((_, i) => (
          <Box
            key={i}
            sx={{
              height: 2,
              flex: 1,
              borderRadius: 1,
              backgroundColor:
                i <= escenaActiva ? "rgba(30,210,255,0.75)" : "rgba(255,255,255,0.15)",
              transition: "background-color 0.4s",
            }}
          />
        ))}
      </Box>
    </div>
  );
}
