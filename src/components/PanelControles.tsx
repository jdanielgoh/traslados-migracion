import {
  Paper,
  FormControlLabel,
  FormLabel,
  FormControl,
  IconButton,
  Collapse,
  Checkbox,
  Box,
  Typography,
  Slider,
  RadioGroup,
  Radio,
} from "@mui/material";
import { ExpandLess, ExpandMore } from "@mui/icons-material";
import {
  COLOR_ORIGEN,
  COLOR_DESTINO,
  COLOR_CON_ESTACION,
  COLOR_SIN_ESTACION,
  rgbToHex,
} from "../constantes";

const labelSx = { color: "rgba(255,255,255,0.65)", fontSize: 15 };
const radioSx = {
  color: "rgba(255,255,255,0.4)",
  "&.Mui-checked": { color: "rgba(255,255,255,0.95)" },
  padding: "2px 6px",
};

function textoAnio(value: number) {
  return `año ${value}`;
}

function NomenclaturaSentido() {
  return (
    <Box sx={{ mb: 0.5 }}>
      <Typography sx={{ ...labelSx, display: "block", mb: 0.75 }}>
        Sentido
      </Typography>
      <Box
        sx={{
          height: 10,
          borderRadius: 1,
          background: `linear-gradient(to right, ${rgbToHex(COLOR_ORIGEN)}, ${rgbToHex(COLOR_DESTINO)})`,
        }}
      />
      <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.25 }}>
        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
          Origen
        </Typography>
        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
          Destino
        </Typography>
      </Box>
    </Box>
  );
}

function NomenclaturaEstaciones() {
  const items = [
    { color: COLOR_CON_ESTACION, label: "Ha contado con estación migratoria o estancia provisional" },
    { color: COLOR_SIN_ESTACION, label: "Sin infraestructuras oficiales de detención migratoria" },
  ];
  return (
    <Box sx={{ mt: 1.5 }}>
      <Typography sx={{ ...labelSx, display: "block", mb: 0.5 }}>
        Municipios con infraestructura de detención migratoria
      </Typography>
      {items.map(({ color, label }) => (
        <Box key={label} sx={{ display: "flex", alignItems: "flex-start", mb: 0.6, gap: 0.75 }}>
          <Box
            sx={{
              width: 12, height: 12, borderRadius: 0.5,
              backgroundColor: rgbToHex(color),
              flexShrink: 0, mt: "2px",
            }}
          />
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.4, fontSize: 14 }}>
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
  mostrarTodosArcos: boolean;
  setMostrarTodosArcos: (v: boolean) => void;
  anios: number[];
  cambioAnios: (event: Event, value: number | number[], activeThumb: number) => void;
  grupoEtario: string;
  setGrupoEtario: (v: string) => void;
};

export function PanelControles({
  panelAbierto,
  setPanelAbierto,
  mostrarRutas,
  setMostrarRutas,
  mostrarTodosArcos,
  setMostrarTodosArcos,
  anios,
  cambioAnios,
  setGrupoEtario,
}: Props) {
  return (
    <Paper
      elevation={6}
      sx={{
        position: "absolute",
        top: 16, left: 16,
        p: 1.5,
        borderRadius: 2,
        zIndex: 1,
        backgroundColor: "rgba(10,15,30,0.93)",
        minWidth: 220,
        backdropFilter: "blur(4px)",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.25 }}>
        <Typography sx={{ color: "white", fontWeight: 600, fontSize: 16 }}>
          Controles
        </Typography>
        <IconButton
          size="small"
          onClick={() => setPanelAbierto(!panelAbierto)}
          sx={{ color: "rgba(255,255,255,0.6)", p: 0.25 }}
        >
          {panelAbierto ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
        </IconButton>
      </Box>

      <Collapse in={panelAbierto} timeout="auto" unmountOnExit>
        {/* Todos los traslados */}
        <FormControlLabel
          sx={{ ml: -0.5, mb: 0.25 }}
          control={
            <Checkbox
              checked={mostrarTodosArcos}
              onChange={(e) => setMostrarTodosArcos(e.target.checked)}
              size="small"
              sx={{
                color: "rgba(255,255,255,0.5)",
                "&.Mui-checked": { color: "rgb(255,255,255)" },
                p: "4px",
              }}
            />
          }
          label={
            <Typography sx={{ color: "rgba(255,255,255,0.9)", fontSize: 15 }}>
              Mostrar todos los traslados
            </Typography>
          }
        />

        {/* Rutas migratorias */}
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
            <Typography sx={{ color: "rgba(255,255,255,0.9)", fontSize: 15 }}>
              Rutas migratorias históricas
            </Typography>
          }
        />

        {/* Gradiente de sentido */}
        <Box sx={{ mt: 0.5 }}>
          <NomenclaturaSentido />
        </Box>

        {/* Rango temporal */}
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

        {/* Población */}
        <FormControl fullWidth sx={{ mt: 0.5 }}>
          <FormLabel sx={labelSx}>Población</FormLabel>
          <RadioGroup defaultValue="total" name="grupo-etario">
            <FormControlLabel
              value="total"
              sx={{ ml: -0.5 }}
              control={
                <Radio size="small" sx={radioSx} onChange={(e) => setGrupoEtario(e.target.value)} />
              }
              label={
                <Typography sx={{ color: "rgba(255,255,255,0.9)", fontSize: 15 }}>Total</Typography>
              }
            />
            <FormControlLabel
              value="total_infancias"
              sx={{ ml: -0.5 }}
              control={
                <Radio size="small" sx={radioSx} onChange={(e) => setGrupoEtario(e.target.value)} />
              }
              label={
                <Typography sx={{ color: "rgba(255,255,255,0.9)", fontSize: 15 }}>Menor de edad</Typography>
              }
            />
          </RadioGroup>
        </FormControl>

        <NomenclaturaEstaciones />

        <Typography sx={{ ...labelSx, mt: 1.5, fontSize: 14, lineHeight: 1.5, display: "block" }}>
          Haz clic en un municipio para ver sus traslados.
        </Typography>
      </Collapse>
    </Paper>
  );
}
