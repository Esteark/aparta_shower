"use client";

import { useRef } from "react";
import { gsap, useGSAP, registerGsapPlugins } from "@/lib/gsap";
import PixelIcon from "./PixelIcon";
import Decor, { animateDecor } from "./Decor";
import Sprite from "./Sprite";

const CARDS = [
  {
    color: "var(--color-green)",
    text: "Tu aporte nos ayuda a construir el hogar de nuestros sueños... 🏠✨ (Habbo Hotel Style)",
    rotation: -3,
  },
  {
    color: "var(--color-pink)",
    text: "Ven a soplarnos la vela... y por favor trae cuchillo para partir la torta porque no tenemos 🕯️😢",
    rotation: 3,
  },
  {
    color: "var(--color-blue)",
    text: "Dress code: Pinta de avatar de Habbo, bien azarete y criminal 🕶️⚡",
    rotation: -4,
  },
  {
    color: "var(--color-yellow)",
    text: "¿Dónde? Cra 92 #44-71 — Apto 402 📍",
    rotation: 4,
  },
  {
    color: "var(--color-purple)",
    text: "Abiertos a recibir desde una nevera o lavadora hasta lo que le nazca, mi rey / mi reina. Se le quiere ❤️🔌",
    rotation: -2,
  },
];

export default function RulesCards() {
  const containerRef = useRef<HTMLElement>(null);

  const { contextSafe } = useGSAP(
    () => {
      registerGsapPlugins();

      // Background decor: scrubbed parallax + endless idle float.
      animateDecor(containerRef.current, -50);

      // Narrative reveals: each plays in on entry, reverses when scrolled
      // past in either direction, and replays when it comes back.
      const toggleActions = "play reverse play reverse";

      gsap.fromTo(
        ".rules-title",
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.5,
          ease: "power3.out",
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top 75%",
            end: "bottom 25%",
            toggleActions,
          },
        }
      );

      // Stack-of-cards entrance: each card starts tilted a few degrees and
      // straightens as it settles into place. One trigger per card so
      // cards reveal/hide individually as they cross the viewport.
      gsap.utils.toArray<HTMLElement>(".reveal-card").forEach((card, i) => {
        gsap.fromTo(
          card,
          { opacity: 0, y: 24, rotation: CARDS[i].rotation },
          {
            opacity: 1,
            y: 0,
            rotation: 0,
            duration: 0.5,
            ease: "power2.out",
            scrollTrigger: {
              trigger: card,
              start: "top 85%",
              end: "bottom 15%",
              toggleActions,
            },
          }
        );
      });
    },
    { scope: containerRef }
  );

  const handleCardEnter = contextSafe((el: HTMLElement) => {
    gsap.to(el, { scale: 1.02, duration: 0.15, ease: "power1.out" });
    el.classList.add("is-card-active");
  });

  const handleCardLeave = contextSafe((el: HTMLElement) => {
    gsap.to(el, { scale: 1, duration: 0.15, ease: "power1.out" });
    el.classList.remove("is-card-active");
  });

  return (
    <section className="section section-clip" ref={containerRef}>
      <Decor style={{ top: "6%", left: "10%" }} opacity={0.18}>
        <PixelIcon
          type="plus"
          color="var(--color-black)"
          size={26}
        />
      </Decor>
      <Decor style={{ bottom: "2%", left: "40%" }} opacity={0.15}>
        <PixelIcon
          type="window"
          color="var(--color-black)"
          size={36}
        />
      </Decor>
      <Decor style={{ top: "40%", right: "4%" }} opacity={0.16}>
        <PixelIcon
          type="plant"
          color="var(--color-black)"
          size={30}
        />
      </Decor>

      {/* Furniture decor — no piece repeated from the adjacent sections. */}
      <Decor style={{ top: "28%", left: "1%" }} opacity={0.18} depth={1.2}>
        <Sprite name="sillonRosado" className="decor-prop-sofa" />
      </Decor>
      <Decor style={{ bottom: "1%", right: "4%" }} opacity={0.22} depth={0.75}>
        <Sprite name="sillonRojo" className="decor-prop-sofa" />
      </Decor>

      <div className="container">
        <h2 className="rules-title" style={{ fontSize: "1.15rem", textAlign: "center" }}>
          Info de la fiesta
        </h2>

        <div style={{ display: "grid", gap: "1rem", marginTop: "2rem" }}>
          {CARDS.map((card, i) => (
            <div
              key={i}
              className="card reveal-card"
              style={{
                opacity: 0,
                transform: `translateY(24px) rotate(${card.rotation}deg)`,
                borderTop: `6px solid ${card.color}`,
              }}
              onMouseEnter={(e) => handleCardEnter(e.currentTarget)}
              onMouseLeave={(e) => handleCardLeave(e.currentTarget)}
              onTouchStart={(e) => handleCardEnter(e.currentTarget)}
              onTouchEnd={(e) => handleCardLeave(e.currentTarget)}
            >
              <p style={{ fontWeight: 600, lineHeight: 1.6 }}>{card.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
