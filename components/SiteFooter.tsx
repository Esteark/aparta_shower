"use client";

import { useRef } from "react";
import { gsap, useGSAP, registerGsapPlugins } from "@/lib/gsap";
import Sprite from "./Sprite";

export default function SiteFooter() {
  const footerRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      registerGsapPlugins();

      // Outer layer: narrative reveal — fade + slide up when it scrolls in,
      // reverses when scrolled back above it and replays on the way down.
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: ".site-footer-reveal",
          start: "top 95%",
          end: "bottom 5%",
          toggleActions: "play reverse play reverse",
        },
      });
      tl.from(".site-footer-reveal", {
        y: 40,
        scale: 0.9,
        opacity: 0,
        duration: 0.7,
        ease: "power3.out",
      });

      // Inner layer: endless idle float, independent of the reveal (split
      // across two elements so the two never fight over `y`).
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.to(".site-footer-logo", {
          y: "+=10",
          repeat: -1,
          yoyo: true,
          duration: 2.5,
          ease: "sine.inOut",
        });
      }
      // Both tweens (and the ScrollTrigger) are reverted by useGSAP's
      // context when the footer unmounts.
    },
    { scope: footerRef }
  );

  return (
    <footer className="site-footer" ref={footerRef}>
      <div className="site-footer-reveal">
        <Sprite name="logoHabbo" alt="Habbo" className="site-footer-logo" />
      </div>
    </footer>
  );
}
