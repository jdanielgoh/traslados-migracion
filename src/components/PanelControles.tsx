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
import {
  COLOR_ORIGEN,
  COLOR_CON_ESTACION,
  COLOR_SIN_ESTACION,
  DICT_COLOR_CORRESPONDENCIA,
  rgbToHex,
} from "../constantes";

const COLOR_DESTINO_LABEL = rgbToHex([255, 70, 160]);
void COLOR_DESTINO_LABEL;

const labelSx = { color: "rgba(255,255,255,0.65)", fontSize: 12 };
const radioSx = {
  color: "rgba(255,255,255,0.4)",
  "&.Mui-checked": { color: "rgba(255,255,255,0.95)" },
  padding: "2px 6px",
};

function textoAnio(value: number) {
  return `año ${value}`;
}

function NomenclaturaGradiente() {
  return (
    <Box sx={{ mb: 0.5 }}>
      <Typography sx={{ ...labelSx, display: "block", mb: 0.75 }}>
        Nomenclatura
      </Typography>
      <Box
        sx={{
          height: 10,
          borderRadius: 1,
          background: `linear-gradient(to right, ${rgbToHex(COLOR_ORIGEN)}, rgb(255,70,160))`,
        }}
      />
      <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.25 }}>
        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>
          Origen
        </Typography>
        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>
          Destino
        </Typography>
      </Box>
    </Box>
  );
}

function NomenclaturaCorrespondencia({
  active,
  onToggle,
}: {
  active: Set<string>;
  onToggle: (key: string) => void;
}) {
  return (
    <Box sx={{ mb: 0.5 }}>
      <Typography sx={{ ...labelSx, display: "block", mb: 0.25 }}>
        Nomenclatura
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column" }}>
        {Object.entries(DICT_COLOR_CORRESPONDENCIA).map(([label, color]) => {
          const isActive = active.has(label);
          return (
            <FormControlLabel
              key={label}
              sx={{ ml: -0.5, mr: 0, my: 0 }}
              control={
                <Checkbox
                  size="small"
                  checked={isActive}
                  onChange={() => onToggle(label)}
                  sx={{
                    color: "rgba(255,255,255,0.2)",
                    "&.Mui-checked": { color: rgbToHex(color) },
                    p: "3px 5px",
                  }}
                />
              }
              label={
                <Typography
                  variant="caption"
                  sx={{
                    color: isActive
                      ? "rgba(255,255,255,0.9)"
                      : "rgba(255,255,255,0.3)",
                    lineHeight: 1,
                    transition: "color 0.15s",
                  }}
                >
                  {label}
                </Typography>
              }
            />
          );
        })}
      </Box>
    </Box>
  );
}

function NomenclaturaEstaciones() {
  const items = [
    { color: COLOR_CON_ESTACION, label: "Ha contado con estación migratoria" },
    { color: COLOR_SIN_ESTACION, label: "Sin estación migratoria" },
  ];
  return (
    <Box sx={{ mt: 1.5 }}>
      <Typography sx={{ ...labelSx, display: "block", mb: 0.5 }}>
        Estaciones migratorias
      </Typography>
      {items.map(({ color, label }) => (
        <Box
          key={label}
          sx={{ display: "flex", alignItems: "center", mb: 0.4 }}
        >
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: 0.5,
              backgroundColor: rgbToHex(color),
              flexShrink: 0,
              mr: 0.75,
            }}
          />
          <Typography
            variant="caption"
            sx={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.3 }}
          >
            {label}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

type Props = {
  panelAbierto: boolean;
  setPanelAbierto: (v: boolean) => void;
  mostrarRutas: boolean;
  setMostrarRutas: (v: boolean) => void;
  tipoTraslado: string;
  setTipoTraslado: (v: string) => void;
  correspondenciasActivas: Set<string>;
  toggleCorrespondencia: (key: string) => void;
  anios: number[];
  cambioAnios: (
    event: Event,
    value: number | number[],
    activeThumb: number,
  ) => void;
  grupoEtario: string;
  setGrupoEtario: (v: string) => void;
};

export function PanelControles({
  panelAbierto,
  setPanelAbierto,
  mostrarRutas,
  setMostrarRutas,
  tipoTraslado,
  setTipoTraslado,
  correspondenciasActivas,
  toggleCorrespondencia,
  anios,
  cambioAnios,

  setGrupoEtario,
}: Props) {
  return (
    <Paper
      elevation={6}
      sx={{
        position: "absolute",
        top: 16,
        left: 16,
        p: 1.5,
        borderRadius: 2,
        zIndex: 1,
        backgroundColor: "rgba(10,15,30,0.93)",
        minWidth: 215,
        backdropFilter: "blur(4px)",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 0.25,
        }}
      >
        <Typography sx={{ color: "white", fontWeight: 600, fontSize: 13 }}>
          Controles
        </Typography>
        <IconButton
          size="small"
          onClick={() => setPanelAbierto(!panelAbierto)}
          sx={{ color: "rgba(255,255,255,0.6)", p: 0.25 }}
        >
          {panelAbierto ? (
            <ExpandLess fontSize="small" />
          ) : (
            <ExpandMore fontSize="small" />
          )}
        </IconButton>
      </Box>

      <Collapse in={panelAbierto} timeout="auto" unmountOnExit>
        <FormControl fullWidth>
          <FormControlLabel
            sx={{ ml: -0.5, mb: 0.25 }}
            control={
              <Checkbox
                checked={mostrarRutas}
                onChange={(e) => setMostrarRutas(e.target.checked)}
                size="small"
                sx={{
                  color: "rgba(255,255,255,0.5)",
                  "&.Mui-checked": { color: "rgb(255,255,255)" },
                  p: "4px",
                }}
              />
            }
            label={
              <Typography sx={{ color: "rgba(255,255,255,0.9)", fontSize: 12 }}>
                Rutas de menor resistencia
              </Typography>
            }
          />

          <FormLabel sx={{ ...labelSx, mt: 0.5 }}>Tipo de traslado</FormLabel>
          <RadioGroup defaultValue="sentido" name="tipo-traslado">
            <FormControlLabel
              value="sentido"
              sx={{ ml: -0.5, mb: 0 }}
              control={
                <Radio
                  size="small"
                  sx={radioSx}
                  onChange={(e) => setTipoTraslado(e.target.value)}
                />
              }
              label={
                <Typography
                  sx={{ color: "rgba(255,255,255,0.9)", fontSize: 12 }}
                >
                  Sentido
                </Typography>
              }
            />

            {tipoTraslado === "sentido" && <NomenclaturaGradiente />}

            <FormControlLabel
              value="correspondencia"
              sx={{ ml: -0.5, mb: 0 }}
              control={
                <Radio
                  size="small"
                  sx={radioSx}
                  onChange={(e) => setTipoTraslado(e.target.value)}
                />
              }
              label={
                <Typography
                  sx={{ color: "rgba(255,255,255,0.9)", fontSize: 12 }}
                >
                  Correspondencia
                </Typography>
              }
            />

            {tipoTraslado === "correspondencia" && (
              <NomenclaturaCorrespondencia
                active={correspondenciasActivas}
                onToggle={toggleCorrespondencia}
              />
            )}
          </RadioGroup>
        </FormControl>

        <Typography sx={{ ...labelSx, mt: 1.5, mb: 0.5, display: "block" }}>
          Rango temporal
        </Typography>
        <Slider
          getAriaLabel={() => "Rango de años"}
          value={anios}
          onChange={cambioAnios}
          valueLabelDisplay="auto"
          getAriaValueText={textoAnio}
          disableSwap
          min={2017}
          max={2024}
          step={1}
          sx={{
            color: rgbToHex(COLOR_ORIGEN),
            "& .MuiSlider-thumb": { width: 14, height: 14 },
          }}
        />

        <FormControl fullWidth sx={{ mt: 0.5 }}>
          <FormLabel sx={labelSx}>Población</FormLabel>
          <RadioGroup defaultValue="total" name="grupo-etario">
            <FormControlLabel
              value="total"
              sx={{ ml: -0.5 }}
              control={
                <Radio
                  size="small"
                  sx={radioSx}
                  onChange={(e) => setGrupoEtario(e.target.value)}
                />
              }
              label={
                <Typography
                  sx={{ color: "rgba(255,255,255,0.9)", fontSize: 12 }}
                >
                  Total
                </Typography>
              }
            />
            <FormControlLabel
              value="total_infancias"
              sx={{ ml: -0.5 }}
              control={
                <Radio
                  size="small"
                  sx={radioSx}
                  onChange={(e) => setGrupoEtario(e.target.value)}
                />
              }
              label={
                <Typography
                  sx={{ color: "rgba(255,255,255,0.9)", fontSize: 12 }}
                >
                  Menor de edad
                </Typography>
              }
            />
          </RadioGroup>
        </FormControl>

        <NomenclaturaEstaciones />
      </Collapse>
    </Paper>
  );
}
