import { useEffect, useRef } from "react";
import * as d3 from "d3";

type Dato = { anio: number; total: number };

type Props = {
  datos: Dato[];
  color: string;
  activa: boolean;
  etiqueta: string;
};

const MARGEN = { top: 6, right: 4, bottom: 22, left: 28 };
const ANCHO = 312;
const ALTO = 110;
const ANCHO_INNER = ANCHO - MARGEN.left - MARGEN.right;
const ALTO_INNER = ALTO - MARGEN.top - MARGEN.bottom;

export function GraficaBarras({ datos, color, activa, etiqueta }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || datos.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg
      .append("g")
      .attr("transform", `translate(${MARGEN.left},${MARGEN.top})`);

    const x = d3
      .scaleBand()
      .domain(datos.map((d) => String(d.anio)))
      .range([0, ANCHO_INNER])
      .padding(0.25);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(datos, (d) => d.total) ?? 0])
      .nice()
      .range([ALTO_INNER, 0]);

    // Eje X — solo años
    g.append("g")
      .attr("transform", `translate(0,${ALTO_INNER})`)
      .call(
        d3
          .axisBottom(x)
          .tickFormat((d) => `'${String(d).slice(2)}`),
      )
      .call((axis) => {
        axis.select(".domain").remove();
        axis.selectAll(".tick line").remove();
        axis
          .selectAll("text")
          .style("fill", "rgba(255,255,255,0.4)")
          .style("font-size", "9px");
      });

    // Eje Y — 3 ticks con formato compacto
    g.append("g")
      .call(
        d3
          .axisLeft(y)
          .ticks(3)
          .tickFormat((d) => d3.format(".2s")(d as number).replace("G", "B")),
      )
      .call((axis) => {
        axis.select(".domain").remove();
        axis
          .selectAll(".tick line")
          .attr("x2", ANCHO_INNER)
          .style("stroke", "rgba(255,255,255,0.07)");
        axis
          .selectAll("text")
          .style("fill", "rgba(255,255,255,0.35)")
          .style("font-size", "9px");
      });

    // Barras — entran desde abajo con delay escalonado
    g.selectAll(".barra")
      .data(datos)
      .join("rect")
      .attr("class", "barra")
      .attr("x", (d) => x(String(d.anio)) ?? 0)
      .attr("width", x.bandwidth())
      .attr("y", ALTO_INNER)
      .attr("height", 0)
      .attr("rx", 2)
      .attr("fill", color)
      .attr("opacity", 0)
      .transition()
      .delay((_, i) => (activa ? i * 180 + 60 : 0))
      .duration(380)
      .ease(d3.easeCubicOut)
      .attr("y", (d) => y(d.total))
      .attr("height", (d) => ALTO_INNER - y(d.total))
      .attr("opacity", 0.85);

    // Etiqueta
    svg
      .append("text")
      .attr("x", MARGEN.left)
      .attr("y", ALTO - 2)
      .style("fill", "rgba(255,255,255,0.3)")
      .style("font-size", "9px")
      .text(etiqueta);
  }, [datos, color, activa]);

  if (datos.length === 0) return null;

  return (
    <svg
      ref={svgRef}
      width={ANCHO}
      height={ALTO}
      style={{ marginTop: 14, display: "block", overflow: "visible" }}
    />
  );
}
