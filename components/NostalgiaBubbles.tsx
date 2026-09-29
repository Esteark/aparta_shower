"use client";

import { useRef } from "react";
import { gsap, ScrollTrigger, useGSAP, registerGsapPlugins } from "@/lib/gsap";
import { HABBO_NOSTALGIA_PHRASES } from "@/constants/habboPhrases";

const START_EVENT = "nostalgia:start";

// Called by the hero: when its entrance animation finishes (first wave
// shortly after) and by its "Desliza para más" button (first wave once the
// smooth scroll lands). A DOM event keeps the two components decoupled;
// only the first call counts, then it stays on for the rest of the visit.
export function startNostalgia(firstWaveDelay = 1.2) {
  window.dispatchEvent(new CustomEvent(START_EVENT, { detail: firstWaveDelay }));
}

// Shared budget of decorative elements animating on screen at once
// (section .decor pieces + these bubbles). A wave never skips it: when it
// would go over, the section's own decor is dimmed while the wave lasts.
const DECOR_BUDGET = 14;
const WAVE_MIN = 5;
const WAVE_MAX = 6;
const TRIES = 40;
// Pace: each bubble stays 1–1.5s; the next wave comes after 10–12.5% of
// scroll, or 3–4s if the user stays put on a valid section.
export const HOLD_MIN = 1;
export const HOLD_MAX = 1.5;
const WAVE_STEP_MIN = 0.1;
const WAVE_STEP_MAX = 0.125;
const IDLE_MIN = 3;
const IDLE_MAX = 4;

function visibleDecors() {
  const vh = window.innerHeight;
  return Array.from(document.querySelectorAll<HTMLElement>(".decor")).filter((el) => {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < vh;
  });
}

const SOLID = "img, svg, canvas, button, input, textarea, select, a, label";
const TEXT_AIR = 10;

// Anything that paints a box of its own (cards, panels, chips…).
function paintsBox(el: Element) {
  const cs = getComputedStyle(el);
  const bg = cs.backgroundColor;
  return (
    (bg !== "transparent" && !/rgba\(.*,\s*0\)$/.test(bg)) ||
    cs.backgroundImage !== "none" ||
    parseFloat(cs.borderTopWidth) > 0 ||
    cs.boxShadow !== "none"
  );
}

// Whether the element's actual content (text lines, child boxes) covers
// the point — a full-width <p> or <h2> only "owns" its lines, not the
// blank run beside a short line.
function contentCovers(el: Element, x: number, y: number) {
  const range = document.createRange();
  range.selectNodeContents(el);
  return Array.from(range.getClientRects()).some(
    (r) =>
      x >= r.left - TEXT_AIR &&
      x <= r.right + TEXT_AIR &&
      y >= r.top - TEXT_AIR &&
      y <= r.bottom + TEXT_AIR
  );
}

// Empty space = no visible content under the point: layout wrappers, or
// the blank part of a text block. Images, controls and any painted box
// (cards, form panel) count as content — the bubble would sit behind it —
// and the confirmed room is off-limits entirely. The bubble layer is
// pointer-events: none, so hit-testing skips it.
function isEmptyAt(x: number, y: number) {
  const hit = document.elementFromPoint(x, y);
  if (!hit) return true;
  if (hit.closest("[data-nostalgia-quiet]")) return false;
  if (hit === document.body || hit.matches("html, main, section, .container")) return true;
  for (let el: Element | null = hit; el && !el.matches("section, main, body"); el = el.parentElement) {
    if (el.matches(SOLID) || paintsBox(el)) return false;
  }
  return !contentCovers(hit, x, y);
}

type Rect = { left: number; top: number; right: number; bottom: number };

const SPACING = 14;
const overlaps = (a: Rect, b: Rect) =>
  a.left < b.right + SPACING &&
  a.right + SPACING > b.left &&
  a.top < b.bottom + SPACING &&
  a.bottom + SPACING > b.top;

// Random empty spot (viewport px) anywhere in the visible viewport for a
// bubble of size w×h, away from content and from the wave's other
// bubbles; null if there's none.
function pickSpot(w: number, h: number, taken: Rect[]) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pad = 10;

  for (let t = 0; t < TRIES; t++) {
    const x = pad + Math.random() * Math.max(0, vw - w - pad * 2);
    const y = pad + Math.random() * Math.max(0, vh - h - pad * 2);
    const r = { left: x, top: y, right: x + w, bottom: y + h };
    if (taken.some((o) => overlaps(r, o))) continue;
    // Sampled a bit outside the bubble so it keeps some air around content
    // (headings still sliding in on their reveal, etc.).
    const g = 14;
    const points: [number, number][] = [
      [r.left - g, r.top - g],
      [r.right + g, r.top - g],
      [r.left - g, r.bottom + g],
      [r.right + g, r.bottom + g],
      [x + w / 2, r.top - g],
      [x + w / 2, r.bottom + g],
      [x + w / 2, y + h / 2],
    ];
    if (points.every(([px, py]) => isEmptyAt(px, py))) return r;
  }
  return null;
}

export default function NostalgiaBubbles() {
  const layerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    (_context, contextSafe) => {
      registerGsapPlugins();
      const layer = layerRef.current;
      if (!layer || !contextSafe) return;

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      let started = false;
      let quietZones = 0;
      let waveActive = false;
      let lastWaveProgress = 0;
      let step = gsap.utils.random(WAVE_STEP_MIN, WAVE_STEP_MAX);
      let idleCall: gsap.core.Tween | null = null;
      let waveBubbles: HTMLElement[] = [];
      const dimmed = new Set<HTMLElement>();

      const inViewport = (el: HTMLElement) => {
        const r = el.getBoundingClientRect();
        return r.bottom > 0 && r.top < window.innerHeight;
      };
      const idleLayer = (d: HTMLElement) => d.querySelector<HTMLElement>(".decor-idle") ?? d;

      // Budget: while a wave is on, dim just enough of the sections' own
      // decor to stay within DECOR_BUDGET — re-checked on scroll, since new
      // decor keeps entering the viewport. Restored when the wave ends.
      const enforceBudget = contextSafe(() => {
        const lit = visibleDecors().filter((d) => !dimmed.has(d));
        const excess = lit.length + waveBubbles.filter(inViewport).length - DECOR_BUDGET;
        if (excess <= 0) return;
        const more = lit.slice(0, excess);
        more.forEach((d) => dimmed.add(d));
        gsap.to(more.map(idleLayer), { autoAlpha: 0, duration: 0.3, ease: "power1.out" });
      });

      const restoreDecor = contextSafe(() => {
        if (dimmed.size === 0) return;
        gsap.to([...dimmed].map(idleLayer), { autoAlpha: 1, duration: 0.4, ease: "power1.out" });
        dimmed.clear();
      });

      // If the user stops scrolling on a valid section, the next wave still
      // comes, just on a clock.
      const scheduleIdle = contextSafe((delay: number) => {
        idleCall?.kill();
        idleCall = gsap.delayedCall(delay, () => launchWave());
      });

      const launchWave = contextSafe(() => {
        if (!started || waveActive) return;
        if (quietZones > 0) {
          scheduleIdle(gsap.utils.random(IDLE_MIN, IDLE_MAX));
          return;
        }
        idleCall?.kill();
        lastWaveProgress = pageTrigger.progress;
        step = gsap.utils.random(WAVE_STEP_MIN, WAVE_STEP_MAX);

        // Distinct phrases for the whole wave.
        const phrases = gsap.utils.shuffle([...HABBO_NOSTALGIA_PHRASES]);
        const wanted = gsap.utils.random(WAVE_MIN, WAVE_MAX, 1);
        const placed: HTMLElement[] = [];
        // Areas with their own chat (e.g. the heads' bubbles, which pop up
        // to ~90px above their block) count as already taken.
        const taken: Rect[] = Array.from(
          document.querySelectorAll<HTMLElement>("[data-nostalgia-avoid]")
        ).map((zone) => {
          const r = zone.getBoundingClientRect();
          return { left: r.left, top: r.top - 90, right: r.right, bottom: r.bottom };
        });

        for (let i = 0; i < wanted; i++) {
          const el = document.createElement("div");
          el.className = "habbo-bubble nostalgia-bubble";
          el.textContent = phrases[i];
          layer.append(el);
          // Measured while still hidden (visibility: hidden in CSS).
          const spot = pickSpot(el.offsetWidth, el.offsetHeight, taken);
          if (!spot) {
            el.remove();
            continue;
          }
          taken.push(spot);
          el.style.left = `${spot.left}px`;
          el.style.top = `${spot.top + window.scrollY}px`;
          placed.push(el);
        }

        if (placed.length === 0) {
          scheduleIdle(gsap.utils.random(IDLE_MIN, IDLE_MAX));
          return;
        }
        waveActive = true;
        waveBubbles = placed;
        enforceBudget();

        const hold = gsap.utils.random(HOLD_MIN, HOLD_MAX);
        const wave = gsap.timeline({
          onComplete: () => {
            placed.forEach((el) => el.remove());
            waveBubbles = [];
            restoreDecor();
            waveActive = false;
            scheduleIdle(gsap.utils.random(IDLE_MIN, IDLE_MAX));
          },
        });

        // Staggered pops (0.1–0.2s apart), one shared hold, then they all
        // fade out at roughly the same time.
        let at = 0;
        const starts = placed.map((_, i) => (i === 0 ? at : (at += gsap.utils.random(0.1, 0.2))));
        const popDur = reduceMotion ? 0.2 : 0.45;
        const fadeAt = at + popDur + hold;

        placed.forEach((el, i) => {
          wave
            .fromTo(
              el,
              { autoAlpha: 0, scale: 0.7, y: 8 },
              { autoAlpha: 1, scale: 1, y: 0, duration: popDur, ease: "back.out(1.8)" },
              starts[i]
            )
            .to(
              el,
              { y: reduceMotion ? 0 : -10, duration: fadeAt - starts[i] - popDur, ease: "sine.inOut" },
              starts[i] + popDur
            )
            .to(
              el,
              { autoAlpha: 0, y: reduceMotion ? 0 : -18, duration: 0.4, ease: "power1.in" },
              fadeAt + gsap.utils.random(0, 0.25)
            );
        });
      });

      // The confirmed room keeps only its own guest chat: no waves while
      // it's on screen (and isEmptyAt never places a bubble over it).
      // Queried on the document: a selector string would be scoped to the layer.
      document.querySelectorAll<HTMLElement>("[data-nostalgia-quiet]").forEach((zone) => {
        ScrollTrigger.create({
          trigger: zone,
          start: "top 70%",
          end: "bottom 30%",
          onToggle: (self) => {
            quietZones += self.isActive ? 1 : -1;
          },
        });
      });

      // Scroll-driven: a new wave every 10–12.5% of page progress (either
      // direction) once the previous one is gone; the idle clock above
      // covers users who stop scrolling.
      // Explicit 0 → "max" range: <html> is height: 100%, so a trigger on
      // it would measure a zero-length range.
      const pageTrigger = ScrollTrigger.create({
        start: 0,
        end: "max",
        onUpdate: (self) => {
          if (!started) return;
          if (waveActive) {
            enforceBudget();
            return;
          }
          if (Math.abs(self.progress - lastWaveProgress) < step) return;
          launchWave();
        },
      });

      // The first wave doesn't wait for the scroll/idle thresholds; the
      // ones after it keep the normal pace.
      const onStart = (e: Event) => {
        if (started) return;
        started = true;
        lastWaveProgress = pageTrigger.progress;
        scheduleIdle((e as CustomEvent<number>).detail ?? 1.2);
      };
      window.addEventListener(START_EVENT, onStart);

      return () => {
        window.removeEventListener(START_EVENT, onStart);
        layer.replaceChildren();
      };
    },
    { scope: layerRef }
  );

  // Last in <main> with z-index 0: paints over the sections' .decor (also
  // z-index 0, earlier in the DOM) and under .container content (z-index 1).
  return <div className="nostalgia-layer" ref={layerRef} aria-hidden="true" />;
}
