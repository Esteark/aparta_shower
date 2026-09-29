"use client";

import { useRef } from "react";
import { gsap, ScrollTrigger, useGSAP, registerGsapPlugins } from "@/lib/gsap";
import { HABBO_NOSTALGIA_PHRASES } from "@/constants/habboPhrases";
import PixelIcon from "./PixelIcon";
import Decor, { animateDecor } from "./Decor";
import Sprite, { SpriteName } from "./Sprite";
import { HOLD_MIN, HOLD_MAX } from "./NostalgiaBubbles";

// Sprite keys follow the PNG file names; `label` is what's shown on screen.
const HEADS: { name: SpriteName; label: string; tilt: number }[] = [
  { name: "cabezaSantiago", label: "Santo", tilt: -12 },
  { name: "cabezaJuan", label: "Chepe", tilt: -7 },
  { name: "cabezaEsteban", label: "Estebark", tilt: 9 },
];

// Each head starts talking on its own beat so they don't speak in unison.
const TALK_OFFSETS = [0, 0.5, 1];

export default function CharactersParallax() {
  const containerRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useGSAP(
    (_context, contextSafe) => {
      registerGsapPlugins();

      // Background decor: scrubbed parallax + endless idle float, both
      // independent of the content reveal below.
      animateDecor(containerRef.current, -70);

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      // Narrative reveal: hides again when scrolled past in either
      // direction and replays on the way back. Triggers on the content
      // block (not the whole section) so the reverse happens while the
      // content is still on screen.
      const tl = gsap.timeline({
        defaults: { ease: "power3.out" },
        scrollTrigger: {
          trigger: contentRef.current,
          start: "top 85%",
          end: "bottom 15%",
          toggleActions: "play reverse play reverse",
        },
      });

      tl.fromTo(".chars-title", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 })
        .fromTo(".chars-text", { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 }, "<0.15")
        // Each head pops in on its own beat, starting tilted and small,
        // then overshoots slightly as it straightens.
        .fromTo(
          ".chars-head",
          {
            y: 40,
            scale: 0.6,
            opacity: 0,
            rotation: (i) => HEADS[i].tilt,
          },
          {
            y: 0,
            scale: 1,
            opacity: 1,
            rotation: 0,
            duration: 0.6,
            ease: "back.out(2)",
            stagger: 0.2,
          },
          "<0.2"
        );

      // Idle float per head, desynced; paused off-screen with the chat below.
      const floats = reduceMotion
        ? []
        : gsap.utils.toArray<HTMLElement>(".chars-head-float").map((el, i) =>
            gsap.to(el, {
              y: "+=18",
              duration: gsap.utils.random(1.8, 2.6, 0.1),
              delay: i * 0.3,
              repeat: -1,
              yoyo: true,
              ease: "sine.inOut",
              paused: true,
            })
          );

      // Endless chat from each head: pop in, hold 1–1.5s (same pace as the
      // site-wide nostalgia waves), fade out, short pause, next phrase.
      // Own loop, independent of the waves; only runs while on screen.
      if (!contextSafe) return;
      const bubbles = gsap.utils.toArray<HTMLElement>(".chars-bubble");
      const current: (gsap.core.Timeline | null)[] = bubbles.map(() => null);
      const saying: string[] = bubbles.map(() => "");
      const lastSaid: string[] = bubbles.map(() => "");
      let visible = false;

      gsap.set(bubbles, { xPercent: -50, transformOrigin: "50% 100%" });

      // Random phrase, never the one this head just said nor one another
      // head currently has up.
      const nextPhrase = (i: number) => {
        const pool = HABBO_NOSTALGIA_PHRASES.filter((p) => p !== lastSaid[i] && !saying.includes(p));
        return pool[Math.floor(Math.random() * pool.length)] ?? HABBO_NOSTALGIA_PHRASES[0];
      };

      const talk = contextSafe((i: number, delay: number) => {
        const el = bubbles[i];
        const tl = gsap.timeline({
          delay,
          paused: !visible,
          onStart: () => {
            saying[i] = nextPhrase(i);
            lastSaid[i] = saying[i];
            el.textContent = saying[i];
          },
          onComplete: () => {
            saying[i] = "";
            talk(i, gsap.utils.random(0.4, 0.9));
          },
        });
        tl.fromTo(
          el,
          { autoAlpha: 0, scale: 0.7, y: 8 },
          { autoAlpha: 1, scale: 1, y: 0, duration: reduceMotion ? 0.15 : 0.35, ease: "back.out(1.8)" }
        )
          .to(el, {
            y: reduceMotion ? 0 : -4,
            duration: gsap.utils.random(HOLD_MIN, HOLD_MAX),
            ease: "sine.inOut",
          })
          .to(el, { autoAlpha: 0, y: reduceMotion ? 0 : -10, duration: 0.3, ease: "power1.in" });
        current[i] = tl;
      });

      bubbles.forEach((_, i) => talk(i, 0.6 + TALK_OFFSETS[i]));

      ScrollTrigger.create({
        trigger: containerRef.current,
        start: "top bottom",
        end: "bottom top",
        onToggle: (self) => {
          visible = self.isActive;
          current.forEach((tl) => (visible ? tl?.play() : tl?.pause()));
          floats.forEach((t) => (visible ? t.play() : t.pause()));
        },
      });
    },
    { scope: containerRef }
  );

  return (
    <section className="section section-clip" ref={containerRef}>
      <Decor style={{ top: "12%", left: "8%" }} opacity={0.18}>
        <PixelIcon
          type="plant"
          color="var(--color-black)"
          size={34}
        />
      </Decor>
      <Decor style={{ bottom: "14%", right: "8%" }} opacity={0.16}>
        <PixelIcon
          type="sofa"
          color="var(--color-black)"
          size={40}
        />
      </Decor>
      <Decor style={{ top: "24%", right: "12%" }} opacity={0.2}>
        <PixelIcon
          type="plus"
          color="var(--color-black)"
          size={24}
        />
      </Decor>

      {/* Furniture decor — no piece repeated from the adjacent sections. */}
      <Decor style={{ bottom: "5%", left: "3%" }} opacity={0.2} depth={1.3}>
        <Sprite name="nevera" className="decor-prop-tall" />
      </Decor>
      <Decor style={{ top: "5%", right: "3%" }} opacity={0.18} depth={0.8}>
        <Sprite name="sillonAzul" className="decor-prop-sofa" />
      </Decor>

      <div className="container" ref={contentRef} style={{ textAlign: "center" }}>
        <h2 className="section-title chars-title">
          Todos armando fiesta
        </h2>
        <p className="chars-text" style={{ marginTop: "0.75rem", fontWeight: 600 }}>
          En Habbo nadie celebra solo — cada invitado suma algo al cuarto.
        </p>

        {/* data-nostalgia-avoid: the site-wide waves keep clear of the heads' own chat. */}
        <ul
          data-nostalgia-avoid
          style={{
            listStyle: "none",
            padding: 0,
            // Extra headroom: each head's chat bubble pops up above it.
            marginTop: "clamp(4rem, 10vw, 5rem)",
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "clamp(0.75rem, 4vw, 2rem)",
            alignItems: "end",
          }}
        >
          {HEADS.map((h) => (
            <li
              key={h.name}
              className="chars-head"
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              {/* Inner layer takes the idle float (the <li> takes the reveal),
                  so the two never fight over `y`. Bubble and badge ride along. */}
              <div
                className="chars-head-float"
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <span className="habbo-bubble chars-bubble" aria-hidden="true" />
                <Sprite
                  name={h.name}
                  style={{ height: "clamp(72px, 20vw, 120px)", width: "auto" }}
                />
                <span
                  className="badge"
                  style={{ marginTop: "0.6rem", background: "var(--color-blue)" }}
                >
                  {h.label}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
