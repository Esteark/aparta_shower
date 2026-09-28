"use client";

import type { CSSProperties, ReactNode } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";

// Background decoration: the outer layer takes the scroll parallax, the
// inner layer takes the idle float — split so the two tweens never fight
// over the same `y`. Sits under the section content (see `.decor` CSS).
export default function Decor({
  children,
  style,
  opacity = 0.2,
  depth = 1,
}: {
  children: ReactNode;
  style?: CSSProperties;
  opacity?: number;
  /** Parallax multiplier: >1 travels further (feels closer), <1 less. */
  depth?: number;
}) {
  return (
    <div className="decor" data-depth={depth} aria-hidden="true" style={{ opacity, ...style }}>
      <div className="decor-idle">{children}</div>
    </div>
  );
}

// Call from inside a section's useGSAP callback. Sets up:
//  - a scrubbed parallax per decor (baseY scaled by its data-depth);
//  - an endless idle float, desynced per element, that only ticks while
//    the section is on screen — caps how many idles run at once.
// `idleIntensity` scales the idle's travel and rotation (1 = default).
export function animateDecor(
  section: HTMLElement | null,
  baseY: number,
  idleIntensity = 1
) {
  if (!section) return;

  const decors = gsap.utils.toArray<HTMLElement>(".decor", section);
  if (decors.length === 0) return;

  decors.forEach((el) => {
    const depth = Number(el.dataset.depth ?? 1);
    gsap.to(el, {
      y: baseY * depth,
      ease: "none",
      scrollTrigger: {
        trigger: section,
        start: "top bottom",
        end: "bottom top",
        scrub: 0.6,
      },
    });
  });

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // Amplitude is deliberately generous: at 15–25% opacity, a few px of
  // drift reads as "static". Rotation always has a real magnitude (random
  // sign × 4–8°) so no element ends up with a near-zero wobble.
  const idles = gsap.utils.toArray<HTMLElement>(".decor-idle", section).map((el) =>
    gsap.to(el, {
      y: `+=${Math.round(gsap.utils.random(12, 20, 1) * idleIntensity)}`,
      rotation: `+=${gsap.utils.random([-1, 1]) * gsap.utils.random(4, 8, 0.5) * idleIntensity}`,
      duration: gsap.utils.random(2.5, 4, 0.1),
      delay: gsap.utils.random(0, 1.5, 0.1),
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
      paused: true,
    })
  );

  ScrollTrigger.create({
    trigger: section,
    start: "top bottom",
    end: "bottom top",
    onToggle: (self) => idles.forEach((t) => (self.isActive ? t.play() : t.pause())),
  });
}
