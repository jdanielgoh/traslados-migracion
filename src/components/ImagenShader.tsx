import { useEffect, useRef } from "react";
import * as THREE from "three";

// ── Vertex (compartido) ────────────────────────────────────────────────────
const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// ── Fragment — displacement transition estilo Tajima / akella ──────────────
//
// uProgress: 0 = completamente autobús, 1 = completamente van
//
// Técnica:
//   uv1 = uv + fbm * intensity *  t       → tex1 se empuja hacia afuera
//   uv2 = uv - fbm * intensity * (1-t)    → tex2 llega desde adentro
//   col = mix(tex1(uv1), tex2(uv2), smoothstep(t))
//
// Los efectos de cada imagen se mezclan con la misma curva.
// ──────────────────────────────────────────────────────────────────────────
const FRAG = /* glsl */ `
precision highp float;

uniform sampler2D uTex1;   // scrolly_1 — autobús
uniform sampler2D uTex2;   // scrolly_2 — van nocturna
uniform float     uProgress; // 0..1  (0=bus, 1=van)
uniform float     uTime;
uniform vec2      uRes;

varying vec2 vUv;

// ── Utilidades ─────────────────────────────────────────────────────────────
float rand(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5); }

float noise(vec2 p){
  vec2 i=floor(p); vec2 f=fract(p);
  float a=rand(i), b=rand(i+vec2(1,0)), c=rand(i+vec2(0,1)), d=rand(i+vec2(1,1));
  vec2 u=f*f*(3.0-2.0*f);
  return mix(a,b,u.x)+(c-a)*u.y*(1.0-u.x)+(d-b)*u.x*u.y;
}

// Multi-octave noise — más orgánico
float fbm(vec2 p){
  float v=0.0, a=0.5;
  for(int i=0;i<4;i++){ v+=a*noise(p); p*=2.1; a*=0.5; }
  return v;
}

// UV cover-fit 16:9
vec2 cover(vec2 uv){
  float imgA=16.0/9.0, vpA=uRes.x/uRes.y;
  if(vpA>imgA){ float s=imgA/vpA; return vec2(uv.x, uv.y*s+(1.0-s)*0.5); }
  else        { float s=vpA/imgA; return vec2(uv.x*s+(1.0-s)*0.5, uv.y); }
}

// ── Efectos autobús ─────────────────────────────────────────────────────────
vec4 fxBus(vec2 uv, float t, float arrival){
  // Leve respiración
  float breathe = 1.0 + 0.004*sin(t*0.38);
  vec2 u = (uv-0.5)*breathe+0.5;

  // Chromatic aberration — más fuerte al entrar
  float ca = (1.0-smoothstep(0.0,0.25,arrival))*0.007 + 0.001;
  vec4 col;
  col.r = texture2D(uTex1, u+vec2( ca,0.0)).r;
  col.g = texture2D(uTex1, u).g;
  col.b = texture2D(uTex1, u-vec2( ca,0.0)).b;
  col.a = 1.0;

  // Film grain
  col.rgb += (rand(uv+fract(t*0.13))-0.5)*0.038;

  // Viñeta
  float vig=1.0-smoothstep(0.3,0.95,length(vUv-0.5)*1.55);
  col.rgb *= 0.58+0.42*vig;

  return clamp(col,0.0,1.0);
}

// ── Efectos van ─────────────────────────────────────────────────────────────
vec4 fxVan(vec2 uv, float t, float arrival){
  // Leve CA permanente en la van — la separación de salida la maneja main
  float ca = 0.0015;
  vec4 col;
  col.r = texture2D(uTex2, uv + vec2( ca, 0.0)).r;
  col.g = texture2D(uTex2, uv).g;
  col.b = texture2D(uTex2, uv - vec2( ca, 0.0)).b;
  col.a = 1.0;

  // Tres focos (posiciones en UV de la imagen)
  vec2 lamps[3];
  lamps[0]=vec2(0.215,0.08);
  lamps[1]=vec2(0.515,0.065);
  lamps[2]=vec2(0.795,0.09);

  float totalGlow=0.0;
  for(int i=0;i<3;i++){
    vec2 lp=lamps[i];
    float flk=0.88+0.12*sin(t*4.2+float(i)*2.6)
             *(0.96+0.04*sin(t*17.1+float(i)*5.3));
    float dy=vUv.y-lp.y, dx=abs(vUv.x-lp.x);
    float hw=dy*0.52+0.014;
    float inCone=smoothstep(hw+0.012,hw-0.012,dx)*step(0.0,dy);
    inCone*=0.55+0.45*noise(vec2(vUv.x*7.0, vUv.y*4.5-t*0.22+float(i)));
    float falloff=exp(-length(vUv-lp)*8.0);
    totalGlow+=(inCone*0.14+falloff*0.09)*flk;
  }
  // Tinte dorado
  col.rgb+=vec3(totalGlow*1.15, totalGlow*0.82, totalGlow*0.36);

  // Grano
  col.rgb+=(rand(uv+fract(t*0.09))-0.5)*0.03;

  // Viñeta más oscura (noche)
  float vig=1.0-smoothstep(0.22,0.88,length(vUv-0.5)*1.7);
  col.rgb*=0.48+0.52*vig;

  return clamp(col,0.0,1.0);
}

// ── Main ────────────────────────────────────────────────────────────────────
void main(){
  vec2 uv = cover(vUv);

  // ── 1. Displacement map procedural (fbm animado) ──────────────────────────
  //   Dos capas de fbm en ángulos distintos → look orgánico / fluido
  vec2 dispST = uv*2.8 + vec2(uTime*0.04, uTime*0.03);
  float d1 = fbm(dispST);
  float d2 = fbm(dispST*1.4 + vec2(3.7,1.9));
  vec2 disp = vec2(d1, d2) - 0.5; // centrado en 0

  float intensity = 0.14;

  // ── 2. Curva de transición suavizada ─────────────────────────────────────
  //   La transición ocurre en el tercio central de uProgress
  float t = smoothstep(0.3, 0.7, uProgress);

  // ── 3. UVs perturbadas — técnica Tajima ──────────────────────────────────
  // exitP: arranca más tarde para solaparse con el fade de salida
  float exitP = smoothstep(0.78, 0.97, uProgress);

  vec2 uv1 = uv + disp * intensity *  t;
  // Van: llega distorsionada desde adentro, sale distorsionada hacia afuera
  vec2 uv2 = uv - disp * intensity * (1.0-t) + disp * intensity * 1.2 * exitP;

  // clamp para no salir de la textura
  uv1 = clamp(uv1, 0.001, 0.999);
  uv2 = clamp(uv2, 0.001, 0.999);

  // ── 4. Efectos por imagen ─────────────────────────────────────────────────
  //   "arrival" = qué tan "asentada" está cada imagen (0=recién llegando, 1=estable)
  vec4 col1 = fxBus(uv1, uTime, uProgress);          // bus con chromab + grain
  vec4 col2 = fxVan(uv2, uTime, 1.0-uProgress);      // van con focos + grano

  // ── 5. Mix displacement ───────────────────────────────────────────────────
  vec4 col = mix(col1, col2, t);

  // ── 6. RGB split durante la transición bus→van (pico en t=0.5) ───────────
  float splitMag = sin(t * 3.14159) * 0.006;
  if(splitMag > 0.0005){
    float r = mix(
      texture2D(uTex1, uv1+vec2(splitMag,0.0)).r,
      texture2D(uTex2, uv2+vec2(splitMag,0.0)).r, t);
    float b = mix(
      texture2D(uTex1, uv1-vec2(splitMag,0.0)).b,
      texture2D(uTex2, uv2-vec2(splitMag,0.0)).b, t);
    col.r = r;
    col.b = b;
  }

  // ── 7. RGB split de salida de la van ─────────────────────────────────────
  // Se aplica después del mix para dominar sobre la CA de fxVan.
  // Offset suficientemente grande (0.028) para ser claramente visible.
  if(exitP > 0.001){
    float es = exitP * 0.014;
    col.r = texture2D(uTex2, clamp(uv2 + vec2(es, 0.0), 0.001, 0.999)).r;
    col.b = texture2D(uTex2, clamp(uv2 - vec2(es, 0.0), 0.001, 0.999)).b;
  }

  // ── 8. Fade global (entrada / salida del bloque de imágenes) ─────────────
  // fadeOut arranca en 0.78 para un desvanecido largo y suave
  float fadeIn  = smoothstep(0.0,  0.08, uProgress);
  float fadeOut = smoothstep(1.0, 0.78, uProgress);
  float alpha   = fadeIn * fadeOut;

  gl_FragColor = vec4(col.rgb, alpha);
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
type Props = {
  escenaActiva: number;
  progress: number; // 0-1 continuo a través de las dos escenas de imagen
};

export function ImagenShader({ escenaActiva, progress }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.OrthographicCamera;
    mat: THREE.ShaderMaterial;
    raf: number;
  } | null>(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    el.appendChild(renderer.domElement);

    const scene  = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const loader = new THREE.TextureLoader();
    const tex1 = loader.load(`${import.meta.env.BASE_URL}imgs/scrolly_1.png`);
    const tex2 = loader.load(`${import.meta.env.BASE_URL}imgs/scrolly_2.png`);
    tex1.colorSpace = THREE.SRGBColorSpace;
    tex2.colorSpace = THREE.SRGBColorSpace;

    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTex1:     { value: tex1 },
        uTex2:     { value: tex2 },
        uProgress: { value: 0 },
        uTime:     { value: 0 },
        uRes:      { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      },
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    scene.add(mesh);

    const clock = new THREE.Clock();
    let raf = -1;

    function animate() {
      raf = requestAnimationFrame(animate);
      mat.uniforms.uTime.value = clock.getElapsedTime();
      renderer.render(scene, camera);
    }
    animate();

    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      mat.uniforms.uRes.value = new THREE.Vector2(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    stateRef.current = { renderer, scene, camera, mat, raf };

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    if (stateRef.current) {
      stateRef.current.mat.uniforms.uProgress.value = progress;
    }
  }, [progress]);

  const visible = escenaActiva === 0 || escenaActiva === 1;

  return (
    <div
      ref={mountRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2,
        pointerEvents: "none",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.9s ease",
      }}
    />
  );
}
