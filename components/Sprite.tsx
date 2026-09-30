import type { CSSProperties, Ref } from "react";
import { preload } from "react-dom";

export const SPRITES = {
  chepe: { src: "/sprites/habbo_0000_chepe.png", width: 202, height: 484 },
  gemelos: { src: "/sprites/habbo_0001_gemelos.png", width: 564, height: 491 },
  gemelosParados: { src: "/sprites/habbo_0001_gemelos-parados.png", width: 928, height: 1067 },
  piso: { src: "/sprites/habbo_0001_piso.png", width: 928, height: 608 },
  nevera: { src: "/sprites/habbo_0002_nevera.png", width: 108, height: 181 },
  sillonAzul: { src: "/sprites/habbo_0003_sillon-azul.png", width: 150, height: 161 },
  sillonRojo: { src: "/sprites/habbo_0004_sillon-rojo.png", width: 159, height: 148 },
  palmera: { src: "/sprites/habbo_0005_palmera.png", width: 111, height: 173 },
  logoHabbo: { src: "/sprites/habbo_0006_logo-habbo.png", width: 257, height: 252 },
  cabezaSantiago: { src: "/sprites/habbo_0007_santiago-cabeza.png", width: 116, height: 140 },
  cabezaEsteban: { src: "/sprites/habbo_0008_esteban-cabeza.png", width: 115, height: 147 },
  cabezaJuan: { src: "/sprites/habbo_0009_cabeza-juan-.png", width: 136, height: 154 },
  neveraPalmera: { src: "/sprites/habbo_0011_nevera-y-palmera-.png", width: 160, height: 251 },
  titulo: { src: "/sprites/habbo_0010_aparta-shower-.png", width: 478, height: 255 },
  sillonRosado: { src: "/sprites/habbo_0012_sillon-rosado.png", width: 156, height: 143 },
} as const;

export type SpriteName = keyof typeof SPRITES;

// Plain <img> on purpose: these are pre-sized pixel-art PNGs that must stay
// crisp (imageRendering: pixelated) and are animated as a whole element via
// GSAP transform/opacity — next/image's optimizer would resample them.
export default function Sprite({
  name,
  alt = "",
  className,
  style,
  ref,
  priority = false,
}: {
  name: SpriteName;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  ref?: Ref<HTMLImageElement>;
  priority?: boolean;
}) {
  const { src, width, height } = SPRITES[name];
  // Above-the-fold sprites: emit <link rel="preload"> in <head> so they're
  // fetched with the HTML, not after layout.
  if (priority) preload(src, { as: "image", fetchPriority: "high" });
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      width={width}
      height={height}
      alt={alt}
      aria-hidden={alt === "" ? true : undefined}
      className={className}
      draggable={false}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      style={{ imageRendering: "pixelated", display: "block", ...style }}
    />
  );
}
