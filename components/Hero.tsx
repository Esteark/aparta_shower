"use client";

import { useRef } from "react";
import { gsap, useGSAP, registerGsapPlugins } from "@/lib/gsap";
import PixelIcon from "./PixelIcon";
import Decor, { animateDecor } from "./Decor";
import Sprite from "./Sprite";
import { startNostalgia } from "./NostalgiaBubbles";

export default function Hero() {
  const containerRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const { contextSafe } = useGSAP(
    () => {
      registerGsapPlugins();

      // Hero and the first section stay simple — fade + short slide only,
      // no rotation/scale. Intensity ramps up from CharactersParallax on.
      // Narrative reveal: plays on load (the content already sits past
      // `start`), reverses when scrolled away and replays on the way back.
      // Triggers on the content block, not the 100svh section: the section's
      // edges are far from its centered content, so section-based
      // thresholds fired while the content was already off-screen.
      const tl = gsap.timeline({
        defaults: { ease: "power3.out" },
        // Kicks off the nostalgia bubbles as soon as the intro lands (a
        // no-op on replays: only the first start counts).
        onComplete: () => startNostalgia(0.6),
        scrollTrigger: {
          trigger: contentRef.current,
          start: "top 85%",
          end: "bottom 15%",
          toggleActions: "play reverse play reverse",
        },
      });
      tl.from(".hero-badge", { y: -20, opacity: 0, duration: 0.5 })
        .from(".hero-subtitle", { y: 20, opacity: 0, duration: 0.6 }, "<0.2")
        .from(".hero-date", { y: 20, opacity: 0, duration: 0.5 }, "<0.15")
        .from(
          ".hero-avatar",
          { y: 24, opacity: 0, duration: 0.5, stagger: 0.12 },
          "<0.2"
        )
        .from(".hero-cue", { opacity: 0, duration: 0.4 }, "<0.3");

      // The title PNG gets its own trigger so it reveals/hides based on its
      // own position. Same fade + slide as before; on first load it's
      // already inside the start zone, so it plays immediately.
      gsap.fromTo(
        ".hero-title",
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.7,
          ease: "power3.out",
          scrollTrigger: {
            trigger: ".hero-title",
            start: "top 90%",
            end: "bottom 10%",
            toggleActions: "play reverse play reverse",
          },
        }
      );

      // Avatars "breathe" in a cascade: endless idle on the inner body,
      // independent of the scroll reveal on the outer wrapper. Runs for as
      // long as the hero is mounted.
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.utils.toArray<HTMLElement>(".hero-avatar-body").forEach((el, i) => {
          gsap.to(el, {
            y: "+=8",
            repeat: -1,
            yoyo: true,
            duration: gsap.utils.random(1.8, 2.6, 0.1),
            delay: i * 0.3,
            ease: "sine.inOut",
          });
        });
      }

      // Gentle idle bounce on the arrow only, inviting the click.
      gsap.to(".hero-cue-arrow", {
        y: 6,
        duration: 1.3,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });

      // Background decor: scrubbed parallax + endless idle float, both
      // independent of the content timeline.
      animateDecor(containerRef.current, -40);
    },
    { scope: containerRef }
  );

  // Smooth, short scroll to whatever section follows the hero. contextSafe
  // defers the ref read to the click handler, never during render.
  // eslint-disable-next-line react-hooks/refs
  const scrollToNext = contextSafe(() => {
    // Also switches on the scroll-driven nostalgia bubbles for this visit.
    startNostalgia();
    const next = containerRef.current?.nextElementSibling;
    if (!next) return;
    gsap.to(window, {
      duration: 0.9,
      ease: "power2.inOut",
      scrollTo: { y: next, autoKill: true },
    });
  });

  return (
    <section className="section section-clip hero-section" ref={containerRef}>
      <Decor style={{ top: "8%", right: "7%" }} opacity={0.18}>
        <PixelIcon
          type="plus"
          color="var(--color-black)"
          size={30}
        />
      </Decor>
      <Decor style={{ top: "3%", left: "40%" }} opacity={0.15}>
        <PixelIcon
          type="window"
          color="var(--color-black)"
          size={40}
        />
      </Decor>

      {/* Furniture decor — corners/edges only, never behind the title. */}
      <Decor style={{ bottom: "6%", right: "3%" }} opacity={0.22} depth={1.4}>
        <Sprite name="palmera" className="decor-prop-tall" />
      </Decor>
      <Decor style={{ bottom: "4%", left: "3%" }} opacity={0.2} depth={0.7}>
        <Sprite name="sillonRosado" className="decor-prop-sofa" />
      </Decor>

      <Sprite
        name="logoHabbo"
        alt="Habbo"
        className="hero-badge hero-logo"
        priority
      />

      <div className="container hero-content" ref={contentRef} style={{ textAlign: "center" }}>
        <h1 className="hero-title" style={{ margin: "0 auto" }}>
          <Sprite
            name="titulo"
            alt="¡Aparta Shower Cumpleañero!"
            priority
            className="hero-title-img"
          />
        </h1>

        <p
          className="hero-subtitle"
          style={{
            marginTop: "1.25rem",
            fontSize: "1.05rem",
            lineHeight: 1.6,
            fontWeight: 600,
          }}
        >
          Dos peques y un joven cumplen años y quieren celebrarlo contigo,
          armando el apartamento entre todos.
        </p>

        <div
          className="hero-date"
          style={{
            marginTop: "1.5rem",
            display: "inline-block",
            background: "var(--color-white)",
            border: "var(--border-pixel)",
            boxShadow: "var(--shadow-sm)",
            borderRadius: 4,
            padding: "0.75rem 1.25rem",
          }}
        >
          <p style={{ fontFamily: "var(--font-pixel), monospace", fontSize: "0.85rem" }}>
            Sábado 03 Oct
          </p>
          <p
            style={{
              fontFamily: "var(--font-pixel), monospace",
              fontSize: "0.55rem",
              marginTop: "0.5rem",
              opacity: 0.85,
            }}
          >
            A partir de las 8:00 PM
          </p>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "0.75rem",
            marginTop: "2rem",
            flexWrap: "wrap",
          }}
        >
          {[
            "var(--color-teal)",
            "var(--color-yellow)",
            "var(--color-blue)",
            "var(--color-green)",
          ].map((color, i) => (
            // Outer layer: scroll reveal (timeline). Inner layer: idle
            // breathing — split so the two never fight over `y`.
            <div key={i} className="hero-avatar" aria-hidden="true">
              <div
                className="hero-avatar-body"
                style={{
                  width: 44,
                  height: 56,
                  background: color,
                  border: "3px solid var(--color-black)",
                  boxShadow: "3px 3px 0 var(--color-black)",
                  borderRadius: 4,
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 10,
                    left: 8,
                    width: 8,
                    height: 8,
                    background: "var(--color-black)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 8,
                    width: 8,
                    height: 8,
                    background: "var(--color-black)",
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <button type="button" className="hero-cue" onClick={scrollToNext}>
          <span className="hero-cue-arrow" aria-hidden="true">
            ↓
          </span>
          <span className="hero-cue-label">Desliza para más</span>
        </button>
      </div>
    </section>
  );
}
