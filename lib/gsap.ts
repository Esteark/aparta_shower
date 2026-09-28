"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { useGSAP } from "@gsap/react";

// Never call gsap.registerPlugin at module scope — Next.js can evaluate
// this module during a server render pass. Components call this from
// inside their useGSAP() callback instead, which only runs on the client.
let registered = false;
export function registerGsapPlugins() {
  if (!registered) {
    gsap.registerPlugin(ScrollTrigger, ScrollToPlugin, useGSAP);
    registered = true;
  }
}

export { gsap, ScrollTrigger, useGSAP };
