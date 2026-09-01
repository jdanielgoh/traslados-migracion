import { useState, useEffect } from "react";
import { DATA_URL, RUTAS_URL, EM_URL } from "../constantes";
import type { Municipio, Ruta } from "../types";

export function useDatos() {
  const [municipios, setMunicipios] = useState<Municipio[]>();
  const [rutas, setRutas] = useState<Ruta[]>();
  const [dictEstaciones, setDictEstaciones] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch(DATA_URL)
      .then((resp) => resp.json())
      .then((json: { features: Municipio[] }) => setMunicipios(json.features));
  }, []);

  useEffect(() => {
    fetch(RUTAS_URL)
      .then((resp) => resp.json())
      .then((json: { features: Ruta[] }) => setRutas(json.features));
  }, []);

  useEffect(() => {
    fetch(EM_URL)
      .then((resp) => resp.json())
      .then((json) => {
        setDictEstaciones(
          Object.fromEntries(
            json.map(({ cve_mun, em }: { cve_mun: string; em: number }) => [
              cve_mun,
              em,
            ]),
          ),
        );
      });
  }, []);

  return { municipios, rutas, dictEstaciones };
}
