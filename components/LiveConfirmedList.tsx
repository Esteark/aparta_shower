"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { gsap, ScrollTrigger, useGSAP, registerGsapPlugins } from "@/lib/gsap";
import { supabase } from "@/lib/supabase";
import { Rsvp } from "@/types/rsvp";
import PixelIcon from "./PixelIcon";
import Decor, { animateDecor } from "./Decor";
import Sprite, { SPRITES, SpriteName } from "./Sprite";
import { HABBO_NOSTALGIA_PHRASES } from "@/constants/habboPhrases";

type LoadState = "loading" | "loaded" | "error";
type Guest = { id: string; nombre: string };

const MAX_LINES = 5;

const HEADS: SpriteName[] = ["cabezaSantiago", "cabezaEsteban", "cabezaJuan"];

const MESSAGES = [
  "¡Ahí estaré!",
  "¡Confirmado!",
  "¡Nos vemos el 3!",
  "¡Cuenten conmigo!",
  "¡Voy con todo!",
  "¡Ahí nos vemos!",
  // Nostalgia phrases that still read as "yes, I'm coming".
  ...[
    "seeeh cuenten conmigo",
    "nos vemos en la sala!",
    "sisi ahi voy",
    "vale bkn nos vemos",
    "no me falla xD",
    "ke emoción!! :)",
  ].filter((p) => HABBO_NOSTALGIA_PHRASES.includes(p)),
];

// While nobody has confirmed, the same chat cycle rotates these instead
// (heads rotate too, for visual consistency with real guests).
const EMPTY_STATE_MESSAGES = [
  "Aún no hay nadie... 🥺",
  "No viene nadie :(",
  "¡Por favor ven!",
  "La sala está muy sola...",
  "¡Sé el primero en confirmar!",
];

// Seeded by the guest's name so the same person always gets the same head,
// across re-renders and Realtime reconnects.
function headFor(nombre: string): SpriteName {
  let sum = 0;
  for (let i = 0; i < nombre.length; i++) sum += nombre.charCodeAt(i);
  return HEADS[sum % HEADS.length];
}

// Different hash than headFor on purpose: with the same char-code sum the
// message would be fully determined by the head.
function messageFor(nombre: string): string {
  let h = 5381;
  for (let i = 0; i < nombre.length; i++) h = ((h * 33) ^ nombre.charCodeAt(i)) >>> 0;
  return MESSAGES[h % MESSAGES.length];
}

// Everything in the room is laid out in the floor image's own pixel space
// (habbo_0001_piso.png is 928×608) and converted to % of the floor box, so
// furniture and characters stay glued to the same tiles at any stage size.
const FLOOR_W = 928;
const FLOOR_H = 608;
const px = (u: number) => `${(u / FLOOR_W) * 100}%`;
const py = (u: number) => `${(u / FLOOR_H) * 100}%`;

// cx = horizontal center, base = y where the sprite touches the floor,
// w = rendered width. Depth follows screen position: lower base → higher z.
const FURNITURE: { name: SpriteName; cx: number; base: number; w: number }[] = [
  { name: "sillonRojo", cx: 300, base: 222, w: 180 },
  { name: "sillonAzul", cx: 650, base: 222, w: 170 },
  { name: "neveraPalmera", cx: 128, base: 305, w: 165 },
];

const zFor = (base: number) => Math.round(base / 10);

// Characters stand side by side in the .room-cast row (see globals.css),
// centered on the stage and sharing one rendered height. Their feet line
// sits at this floor y, so the depth order still follows screen position.
const FEET_Y = 440;
const CHAR_Z = zFor(FEET_Y);

// gemelos-parados.png has transparent padding (content spans y 22–1052 of
// 1067); scale it up and drop it by the bottom padding so the visible kids
// match chepe's height and stand on the same line.
const GEMELOS_STYLE: CSSProperties = {
  position: "relative",
  height: `${(1067 / 1030) * 100}%`,
  top: `${(15 / 1030) * 100}%`,
  width: "auto",
  zIndex: CHAR_Z,
};

// Pulls chepe into the gemelos image's transparent right padding.
const CHEPE_STYLE: CSSProperties = {
  position: "relative",
  marginLeft: "-2%",
  height: "100%",
  width: "auto",
  zIndex: CHAR_Z,
};

export default function LiveConfirmedList() {
  const containerRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const guestsRef = useRef<Guest[]>([]);
  const cursorRef = useRef(0);
  // Set by the chat cycle below; Realtime calls it when the guest list
  // goes empty ↔ non-empty so the switch happens right away.
  const kickRef = useRef<(() => void) | null>(null);

  const [guests, setGuests] = useState<Guest[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [refreshKey, setRefreshKey] = useState(0);

  useGSAP(
    (_context, contextSafe) => {
      registerGsapPlugins();

      // Background decor: scrubbed parallax + endless idle float.
      animateDecor(containerRef.current, -40);

      const stage = stageRef.current;
      const chat = chatRef.current;
      if (loadState !== "loaded" || !stage || !chat || !contextSafe) return;

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      // Idle "breathing", anchored at the feet so nobody lifts off the tiles.
      const idles = reduceMotion
        ? []
        : gsap.utils.toArray<HTMLElement>(".room-char", stage).map((el, i) =>
            gsap.fromTo(
              el,
              { scaleY: 1, transformOrigin: "50% 100%" },
              {
                scaleY: 1.02,
                duration: 2,
                ease: "sine.inOut",
                yoyo: true,
                repeat: -1,
                delay: i * 0.9,
                paused: true,
              }
            )
          );

      // Newest first. Each line is absolutely stacked from the column's
      // bottom; `y` pushes it up by the heights of the lines below it.
      let lines: HTMLElement[] = [];

      const gapFor = (el: HTMLElement) => el.offsetHeight * 0.18;

      // Which list is feeding the chat. Lines from the two never share the
      // column: switching mode clears whatever is up first.
      let mode: "guests" | "empty" | null = null;
      let emptyCursor = 0;
      const currentMode = () => (guestsRef.current.length > 0 ? "guests" : "empty");

      const retire = contextSafe((el: HTMLElement, y: number) => {
        gsap.to(el, {
          y: y - el.offsetHeight * 0.6,
          autoAlpha: 0,
          duration: 0.4,
          ease: "power1.in",
          overwrite: "auto",
          onComplete: () => el.remove(),
        });
      });

      // Positions every line; anything past MAX_LINES — or that would poke
      // out of the top of the stage (long wrapped names) — fades out.
      const layout = contextSafe((animate: boolean) => {
        const room =
          chat.getBoundingClientRect().bottom - stage.getBoundingClientRect().top - 8;
        let offset = 0;
        const kept: HTMLElement[] = [];

        lines.forEach((el, i) => {
          const h = el.offsetHeight;
          const y = -offset;
          const fits = i < MAX_LINES && offset + h <= room;
          if (!fits && i > 0) {
            retire(el, y);
          } else {
            kept.push(el);
            if (i > 0) {
              if (animate) {
                gsap.to(el, { y, duration: 0.45, ease: "power2.out", overwrite: "auto" });
              } else {
                gsap.set(el, { y });
              }
            }
          }
          offset += h + gapFor(el);
        });

        lines = kept;
      });

      const clearLines = contextSafe(() => {
        lines.forEach((el) => retire(el, Number(gsap.getProperty(el, "y"))));
        lines = [];
      });

      const spawn = contextSafe(() => {
        const list = guestsRef.current;
        const nowMode = currentMode();
        if (mode !== null && nowMode !== mode) clearLines();
        mode = nowMode;

        const line = document.createElement("div");
        line.className = "habbo-bubble room-chat-line";

        const head = document.createElement("img");
        head.alt = "";
        head.className = "room-chat-head";
        head.draggable = false;

        const text = document.createElement("p");
        text.className = "room-chat-text";

        if (nowMode === "guests") {
          const guest = list[cursorRef.current % list.length];
          cursorRef.current = (cursorRef.current + 1) % list.length;
          head.src = SPRITES[headFor(guest.nombre)].src;
          const name = document.createElement("strong");
          name.textContent = `${guest.nombre}:`;
          text.append(name, ` ${messageFor(guest.nombre)}`);
        } else {
          head.src = SPRITES[HEADS[emptyCursor % HEADS.length]].src;
          text.textContent = EMPTY_STATE_MESSAGES[emptyCursor % EMPTY_STATE_MESSAGES.length];
          emptyCursor++;
        }

        line.append(head, text);
        chat.append(line);
        lines.unshift(line);
        layout(true);

        // Born behind the characters at head height, pops and rises into
        // the bottom slot of the column.
        gsap.fromTo(
          line,
          { y: stage.offsetHeight * 0.07, scale: 0.7, autoAlpha: 0 },
          {
            y: 0,
            scale: 1,
            autoAlpha: 1,
            duration: reduceMotion ? 0.2 : 0.55,
            ease: "back.out(1.6)",
          }
        );
      });

      // Self-rescheduling delayedCall instead of setInterval: it belongs to
      // this context (killed on revert) and can be paused off-screen.
      let visible = false;
      let next: gsap.core.Tween | null = null;
      const schedule = contextSafe((delay: number) => {
        next = gsap.delayedCall(delay, () => {
          spawn();
          schedule(gsap.utils.random(2, 3, 0.1));
        });
        next.paused(!visible);
      });
      schedule(0.6);

      // Empty ↔ non-empty switch: don't wait out the 2–3s gap, the next
      // line (from the other list) comes right away.
      kickRef.current = contextSafe(() => {
        if (mode === null || currentMode() === mode) return;
        next?.kill();
        schedule(0.3);
      });

      ScrollTrigger.create({
        trigger: stage,
        start: "top bottom",
        end: "bottom top",
        onToggle: (self) => {
          visible = self.isActive;
          next?.paused(!visible);
          idles.forEach((t) => (visible ? t.play() : t.pause()));
        },
      });

      // Line heights follow the stage (cqw font sizes) — re-stack instantly.
      const ro = new ResizeObserver(() => layout(false));
      ro.observe(stage);

      return () => {
        ro.disconnect();
        kickRef.current = null;
        chat.replaceChildren();
      };
    },
    { scope: containerRef, dependencies: [loadState], revertOnUpdate: true }
  );

  useEffect(() => {
    let active = true;

    supabase
      .from("rsvps")
      .select("id, nombre, created_at")
      .eq("asistencia", true)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setLoadState("error");
          return;
        }
        const initial: Guest[] = (data ?? []).map((r: { id: string; nombre: string }) => ({
          id: r.id,
          nombre: r.nombre,
        }));
        guestsRef.current = initial;
        cursorRef.current = 0;
        setGuests(initial);
        setLoadState("loaded");
      });

    return () => {
      active = false;
    };
  }, [refreshKey]);

  // Subscribes once for the component's lifetime — never resubscribe on re-render.
  useEffect(() => {
    const commit = (next: Guest[]) => {
      guestsRef.current = next;
      setGuests(next);
      kickRef.current?.();
    };

    const addGuest = (row: Rsvp) => {
      const list = guestsRef.current;
      if (list.some((g) => g.id === row.id)) return;
      // Joins the cycle right at the cursor, so it's the next to talk.
      const next = [...list];
      next.splice(cursorRef.current, 0, { id: row.id, nombre: row.nombre });
      commit(next);
    };

    const removeGuest = (id: string) => {
      const list = guestsRef.current;
      const index = list.findIndex((g) => g.id === id);
      if (index === -1) return;
      // Keep the cursor on the same upcoming guest.
      if (index < cursorRef.current) cursorRef.current -= 1;
      commit(list.filter((g) => g.id !== id));
    };

    // DELETE payloads only carry the primary key, which is all we need.
    const channel = supabase
      .channel("rsvps-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "rsvps" },
        (payload) => {
          const row = payload.new as Rsvp;
          if (row.asistencia) addGuest(row);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rsvps" },
        (payload) => {
          const row = payload.new as Rsvp;
          if (row.asistencia) addGuest(row);
          else removeGuest(row.id);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "rsvps" },
        (payload) => {
          const id = (payload.old as Partial<Rsvp>).id;
          if (id) removeGuest(id);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  return (
    <section className="section section-clip" ref={containerRef} data-nostalgia-quiet>
      <Decor style={{ bottom: "12%", left: "7%" }} opacity={0.18}>
        <PixelIcon type="plus" color="var(--color-black)" size={24} />
      </Decor>

      <div className="container" style={{ maxWidth: 880 }}>
        <h2 style={{ fontSize: "1.15rem", textAlign: "center" }}>Quiénes ya confirmaron</h2>

        <div style={{ marginTop: "1.5rem" }}>
          {loadState === "loading" && <div className="skeleton room-skeleton" />}

          {loadState === "error" && (
            <div className="card" style={{ textAlign: "center" }}>
              <p style={{ fontWeight: 700, color: "var(--color-pink)" }}>
                No pudimos cargar la lista de confirmados.
              </p>
              <button
                type="button"
                className="btn"
                style={{ marginTop: "1rem" }}
                onClick={() => {
                  setLoadState("loading");
                  setRefreshKey((k) => k + 1);
                }}
              >
                Reintentar
              </button>
            </div>
          )}

          {loadState === "loaded" && (
            <div className="room-stage" ref={stageRef}>
              <div className="room-floor">
                <Sprite
                  name="piso"
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 1 }}
                />

                {FURNITURE.map((f) => (
                  <Sprite
                    key={f.name}
                    name={f.name}
                    style={{
                      position: "absolute",
                      left: px(f.cx - f.w / 2),
                      bottom: py(FLOOR_H - f.base),
                      width: px(f.w),
                      height: "auto",
                      zIndex: zFor(f.base),
                    }}
                  />
                ))}

                {/* Chat sits one layer under the characters: lines are born behind them. */}
                <div className="room-chat" ref={chatRef} aria-hidden="true" style={{ zIndex: CHAR_Z - 1 }} />

                <div className="room-cast" style={{ bottom: py(FLOOR_H - FEET_Y) }}>
                  <Sprite name="gemelosParados" className="room-char" style={GEMELOS_STYLE} />
                  <Sprite name="chepe" className="room-char" style={CHEPE_STYLE} />
                </div>
              </div>

              {guests.length === 0 ? (
                <p className="visually-hidden">Aún no hay confirmados. ¡Sé el primero!</p>
              ) : (
                <ul className="visually-hidden">
                  {guests.map((g) => (
                    <li key={g.id}>{g.nombre}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
