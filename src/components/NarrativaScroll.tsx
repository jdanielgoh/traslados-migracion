import { useEffect, useRef, useState } from "react";
import { Box, Typography, Button } from "@mui/material";
import { ImagenShader } from "./ImagenShader";
import { COLOR_ORIGEN, COLOR_DESTINO, rgbToHex } from "../constantes";

// ── Guión ──────────────────────────────────────────────────────────────────
// Índices de escena que se pasan al mapa (App.tsx):
//   0 → imagen autobús     (mapa: blank)
//   1 → imagen van          (mapa: blank)
//   2 → datos / rutas       (mapa: arcos neutros)
//   3 → detención           (mapa: arcos dorado/neutro)
//   4 → sentido             (mapa: arcos origen/destino)
//   5 → menores / teaser    (mapa: arcos infancias animados)

const GUION = [
  {
    id: "bus",
    titulo: null as string | null,
    copy: "Si has viajado en camión por la República, probablemente te ha tocado pasar por algún retén en el que oficiales del Instituto Nacional de Migración (INM), el Ejército o la Guardia Nacional suben para pedir identificación. Quizás incluso has visto cómo bajan a personas racializadas y dejan que el camión siga sin ellas.",
    copy2: null as string | null,
    preguntas: null as string[] | null,
    grafica: null as "total" | "infancias" | null,
    leyendaSentido: false,
    cta: false,
  },
  {
    id: "van",
    titulo: null,
    copy: "Aunque en México no existe oficialmente la detención migratoria, en la práctica muchos mexicanos la han atestiguado.",
    copy2: null,
    preguntas: [
      "¿Qué pasa después?",
      "¿Adónde llevan a estas personas?",
      "¿Qué sucede cuando son familias con niñxs?",
    ],
    grafica: null,
    leyendaSentido: false,
    cta: false,
  },
  {
    id: "datos",
    titulo: null,
    copy: "<b>La dispersión es una política migratoria de desgaste y la principal respuesta del gobierno de México a la presión de Estados Unidos para frenar la migración</b>. Sin mecanismos reales de protección internacional, México recurre a la dispersión para provocar la desesperación y empujar a las personas migrantes de regreso al sur.",
    copy2:
      "Datos obtenidos del INM para el periodo enero 2017 – junio 2024 evidencian cómo <b>el gobierno trasladó a casi medio millón de personas migrantes detenidas</b> dentro de la República a través de 437 distintas rutas terrestres.",
    preguntas: null,
    grafica: null,
    leyendaSentido: false,
    cta: false,
  },
  {
    id: "detencion",
    titulo: null,
    copy: "<b>Un 89.8% de los traslados, ilustrados en dorado, terminaron en municipios con alguna estancia provisional o estación migratoria.</b> La dispersión acerca a las personas en movilidad a estos centros de detención migratoria —aunque no se nombren como tales— desviando sus trayectos y, en muchos casos, privándolas de su libertad.",
    copy2: null,
    preguntas: null,
    grafica: null,
    leyendaSentido: false,
    cta: false,
  },
  {
    id: "sentido",
    titulo: null,
    copy: "En total, 483,190 personas migrantes fueron trasladadas internamente durante el periodo analizado, con un incremento pronunciado a partir de 2023. En aquel año, el último para el que tenemos datos completos, <b>la dispersión afectó a casi 30 veces más personas que en 2017.</b> ",
    copy2: `<b>La mayoría de las personas dispersadas fueron retornadas</b> del norte hacia el sur, pero un 33.3% experimentaron un traslado hacia el norte o hacia algún sitio en paralelo, lo que podría representar la dispersión de:
        <ul>
          <li>Personas detenidas durante una redada o la intercepción de una caravana</li>
          <li>Personas en algún proceso de deportación con escalas en varios puntos</li>
          <li>Personas trasladadas porque las autoridades querían despejar ciudades del sur con alta presencia migrante</li>
        </ul>
      `,
    preguntas: null,
    grafica: "total" as const,
    leyendaSentido: true,
    cta: false,
  },
  {
    id: "menores",
    titulo: null,
    copy: "El análisis de estos datos arroja diversos hallazgos – por ejemplo, que <b> el INM continuó y hasta incrementó en un 759% el traslado de menores de edad en años posteriores al 2020, año en que su alojamiento en estaciones migratorias fue prohibido</b>. La dispersión permitió que la política migratoria en México siguiera castigando y conteniendo a las familias migrantes, afectando a más de 60,000 niños, niñas y adolescentes. En casos específicos, el caos resultante llegó a separar a familias.",
    copy2: null,
    preguntas: null,
    grafica: "infancias" as const,
    leyendaSentido: false,
    cta: true,
  },
];

const SEPARACION = 120; // vh por escena
const INICIO = 80; // primera sentinela a 80vh
const SENSOR = 0.45;

type Props = {
  onEscenaChange: (escena: number) => void;
  onTerminar: () => void;
};

export function NarrativaScroll({ onEscenaChange, onTerminar }: Props) {
  const [escenaActiva, setEscenaActiva] = useState(-1);
  const [scrollProgress, setScrollProgress] = useState(0); // 0-1 dentro de la escena activa
  const sentinelaRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Termina cuando la última viñeta queda a ~30vh del tope del viewport
  const alturaTotal =
    INICIO + (GUION.length - 1) * SEPARACION + (1 - SENSOR) * 100 + 70;

  useEffect(() => {
    const handler = () => {
      const sensorY = window.innerHeight * SENSOR;
      let activa = -1;
      sentinelaRefs.current.forEach((el, i) => {
        if (!el) return;
        if (el.getBoundingClientRect().top < sensorY) activa = i;
      });

      // Calcular progreso dentro de la escena activa (para los shaders)
      if (activa >= 0 && activa < sentinelaRefs.current.length - 1) {
        const curr = sentinelaRefs.current[activa];
        const next = sentinelaRefs.current[activa + 1];
        if (curr && next) {
          const currTop = curr.getBoundingClientRect().top;
          const nextTop = next.getBoundingClientRect().top;
          const prog = Math.max(
            0,
            Math.min(1, (sensorY - currTop) / (nextTop - currTop)),
          );
          setScrollProgress(prog);
        }
      } else if (activa === GUION.length - 1) {
        const last = sentinelaRefs.current[activa];
        if (last) {
          const t = last.getBoundingClientRect().top;
          setScrollProgress(
            Math.max(
              0,
              Math.min(
                1,
                (sensorY - t) / ((window.innerHeight * SEPARACION) / 100),
              ),
            ),
          );
        }
      }

      if (activa !== escenaActiva) {
        setEscenaActiva(activa);
        onEscenaChange(activa);
      }
    };

    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [escenaActiva, onEscenaChange]);

  // Progreso global 0..1 que cubre las escenas 0 y 1 (imágenes)
  const progressImagen =
    escenaActiva < 0
      ? 0
      : escenaActiva === 0
        ? scrollProgress * 0.5
        : escenaActiva === 1
          ? 0.5 + scrollProgress * 0.5
          : 1;

  return (
    <>
      {/* Shader de imágenes full-screen (z-index 2) */}
      <ImagenShader escenaActiva={escenaActiva} progress={progressImagen} />

      {/* Título de landing — visible antes de la primera escena */}
      <TituloLanding visible={escenaActiva < 0} />

      {/* Contenedor scrolleable */}
      <div
        style={{ position: "relative", height: `${alturaTotal}vh`, zIndex: 3 }}
      >
        {/* Sentinelas */}
        {GUION.map((_, i) => (
          <div
            key={i}
            ref={(el) => {
              sentinelaRefs.current[i] = el;
            }}
            style={{
              position: "absolute",
              top: `${INICIO + i * SEPARACION}vh`,
              height: 0,
              width: "100%",
            }}
          />
        ))}

        {/* Viñetas */}
        {GUION.map((item, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: `${INICIO + i * SEPARACION + (1 - SENSOR) * 100}vh`,
              left: 40,
              width: 380,
              zIndex: 20,
            }}
          >
            <Viñeta
              item={item}
              escenaActiva={escenaActiva}
              totalEscenas={GUION.length}
              onTerminar={onTerminar}
            />
          </div>
        ))}

        {/* Indicador scroll (pre-primera escena) */}
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
            <Typography
              sx={{
                color: "rgba(255,255,255,0.45)",
                fontSize: 13,
                letterSpacing: 2.5,
              }}
            >
              DESLIZA PARA CONTINUAR
            </Typography>
            <Box
              sx={{
                width: 0,
                height: 0,
                borderLeft: "7px solid transparent",
                borderRight: "7px solid transparent",
                borderTop: "10px solid rgba(255,255,255,0.35)",
                animation: "pulso 1.4s ease-in-out infinite",
                "@keyframes pulso": {
                  "0%,100%": { opacity: 0.2, transform: "translateY(-5px)" },
                  "50%": { opacity: 0.8, transform: "translateY(5px)" },
                },
              }}
            />
          </div>
        )}
      </div>
    </>
  );
}

// ── Título de landing ──────────────────────────────────────────────────────
function TituloLanding({ visible }: { visible: boolean }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 5,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.7s ease",
      }}
    >
      <div
        style={{
          textAlign: "center",
          maxWidth: 700,
          padding: "0 32px",
          background:
            "radial-gradient(ellipse at center, rgba(8,14,28,0.7) 0%, transparent 75%)",
          paddingTop: 60,
          paddingBottom: 60,
        }}
      >
        <Typography
          sx={{
            color: "white",
            fontWeight: 800,
            fontSize: { xs: 30, md: 44 },
            lineHeight: 1.25,
            letterSpacing: -0.5,
            mb: 1.5,
            textShadow: "0 2px 24px rgba(0,0,0,0.9)",
          }}
        >
          La dispersión como una política migratoria de desgaste
        </Typography>
        <Typography
          sx={{
            color: "rgba(255,255,255,0.55)",
            fontSize: 18,
            fontStyle: "italic",
            textShadow: "0 1px 12px rgba(0,0,0,0.8)",
          }}
        >
          Una aproximación teórica y de análisis de datos
        </Typography>
      </div>
    </div>
  );
}

// ── Viñeta ─────────────────────────────────────────────────────────────────
type ViñetaProps = {
  item: (typeof GUION)[number];
  escenaActiva: number;
  totalEscenas: number;
  onTerminar: () => void;
};

function Viñeta({
  item,
  escenaActiva,
  totalEscenas,
  onTerminar,
}: ViñetaProps) {
  const esImagenScene = item.id === "bus" || item.id === "van";

  return (
    <div
      style={{
        backgroundColor: esImagenScene
          ? "rgba(6,10,22,0.88)"
          : "rgba(8,14,28,0.93)",
        backdropFilter: "blur(10px)",
        borderRadius: 8,
        padding: "20px 22px 16px",
        borderLeft: `3px solid ${esImagenScene ? "rgba(255,255,255,0.2)" : "rgba(30,210,255,0.55)"}`,
        animation: "entrar 0.45s cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      <style>{`
        @keyframes entrar {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Copy principal */}
      {item.copy && (
        <Box
          sx={{
            color: "rgba(255,255,255,0.78)",
            fontSize: 16,
            lineHeight: 1.8,
            mb: 1,
            "& ul, & ol": { pl: 2, my: 0.5 },
            "& li": { mb: 0.25 },
            "& b, & strong": { color: "rgba(255,255,255,0.95)" },
          }}
          dangerouslySetInnerHTML={{ __html: item.copy }}
        />
      )}

      {/* Preguntas (escena van) */}
      {item.preguntas && (
        <Box
          sx={{
            my: 1.5,
            pl: 1,
            borderLeft: "2px solid rgba(255,255,255,0.15)",
          }}
        >
          {item.preguntas.map((p, i) => (
            <Typography
              key={i}
              sx={{
                color: "white",
                fontWeight: 600,
                fontSize: 17,
                lineHeight: 1.6,
              }}
            >
              {p}
            </Typography>
          ))}
        </Box>
      )}

      {/* Copy secundario */}
      {item.copy2 && (
        <Box
          sx={{
            color: "rgba(255,255,255,0.78)",
            fontSize: 16,
            lineHeight: 1.8,
            mt: 1,
            "& ul, & ol": { pl: 2, my: 0.5 },
            "& li": { mb: 0.25 },
            "& b, & strong": { color: "rgba(255,255,255,0.95)" },
          }}
          dangerouslySetInnerHTML={{ __html: item.copy2 }}
        />
      )}

      {/* Leyenda sentido (escena 4) */}
      {item.leyendaSentido && <LeyendaSentido />}

      {/* Gráfica */}

      {/* CTA (escena menores) */}
      {item.cta && (
        <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 1 }}>
          <Button
            component="a"
            href={`${import.meta.env.BASE_URL}informe_borrador.pdf`}
            target="_blank"
            rel="noopener noreferrer"
            variant="outlined"
            size="small"
            sx={{
              color: "rgba(255,255,255,0.85)",
              borderColor: "rgba(255,255,255,0.3)",
              fontSize: 14,
              letterSpacing: 1.2,
              py: 0.75,
              "&:hover": {
                borderColor: "white",
                color: "white",
                backgroundColor: "rgba(255,255,255,0.06)",
              },
            }}
          >
            CONOCE EL INFORME COMPLETO →
          </Button>
          <Button
            onClick={onTerminar}
            size="small"
            sx={{
              color: "rgba(30,210,255,0.9)",
              borderColor: "rgba(30,210,255,0.5)",
              border: "1px solid",
              backdropFilter: "blur(6px)",
              backgroundColor: "rgba(10,15,30,0.6)",
              fontSize: 14,
              letterSpacing: 1.2,
              py: 0.75,
              "&:hover": {
                backgroundColor: "rgba(30,210,255,0.1)",
                borderColor: "rgb(30,210,255)",
              },
            }}
          >
            EXPLORAR EL MAPA →
          </Button>
        </Box>
      )}

      {/* Barra de progreso */}
      <Box sx={{ display: "flex", gap: "4px", mt: 2 }}>
        {Array.from({ length: totalEscenas }).map((_, i) => (
          <Box
            key={i}
            sx={{
              height: 2,
              flex: 1,
              borderRadius: 1,
              backgroundColor:
                i <= escenaActiva
                  ? "rgba(30,210,255,0.75)"
                  : "rgba(255,255,255,0.13)",
              transition: "background-color 0.4s",
            }}
          />
        ))}
      </Box>
    </div>
  );
}

// ── Leyenda sentido ────────────────────────────────────────────────────────
function LeyendaSentido() {
  const labelSx = { color: "rgba(255,255,255,0.6)", fontSize: 14 };
  return (
    <Box sx={{ mt: 1.5, mb: 0.5 }}>
      <Typography
        sx={{
          ...labelSx,
          display: "block",
          mb: 0.75,
          fontWeight: 600,
          fontSize: 15,
        }}
      >
        Sentido del traslado
      </Typography>
      <Box
        sx={{
          height: 10,
          borderRadius: 1,
          background: `linear-gradient(to right, ${rgbToHex(COLOR_ORIGEN)}, ${rgbToHex(COLOR_DESTINO)})`,
          mb: 0.4,
        }}
      />
      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.55)" }}>
          Origen
        </Typography>
        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.55)" }}>
          Destino
        </Typography>
      </Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", mt: 1 }}>
        <Typography sx={labelSx}>Grosor del arco</Typography>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.4 }}>
        <Box
          sx={{
            width: 20,
            height: 2,
            backgroundColor: "rgba(255,255,255,0.5)",
            borderRadius: 1,
          }}
        />
        <Typography sx={{ ...labelSx, fontSize: 13 }}>
          menos personas
        </Typography>
        <Box
          sx={{
            width: 20,
            height: 5,
            backgroundColor: "rgba(255,255,255,0.7)",
            borderRadius: 1,
            ml: 1,
          }}
        />
        <Typography sx={{ ...labelSx, fontSize: 13 }}>más personas</Typography>
      </Box>
    </Box>
  );
}
