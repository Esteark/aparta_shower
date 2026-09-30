"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap, ScrollTrigger, useGSAP, registerGsapPlugins } from "@/lib/gsap";
import { supabase } from "@/lib/supabase";
import { Item, ITEM_CATEGORIAS, Rsvp } from "@/types/rsvp";
import PixelIcon from "./PixelIcon";
import Decor, { animateDecor } from "./Decor";
import Sprite from "./Sprite";

// "farewell" = a "No podré" RSVP was saved and the twins' goodbye is playing
// over the form; the form stays locked until it finishes.
type Status = "idle" | "submitting" | "success" | "farewell" | "error";
type ItemsStatus = "loading" | "loaded" | "error";

// Sentinel for the fixed "Otro (especifica)" option: lives in the same
// selection state as real item ids, but is never sent to claim_item.
const OTRO_ID = "__otro__";

const SAVE_ERROR_MSG =
  "No pudimos guardar tu confirmación — revisa tu internet e intenta de nuevo en un momento";

// Caps every Supabase request, so a dead connection surfaces as an error
// instead of leaving the form stuck on "Enviando...".
const REQUEST_TIMEOUT_MS = 12_000;
const requestTimeout = () => AbortSignal.timeout(REQUEST_TIMEOUT_MS);

// status 0 = the request never got an answer (offline, timeout);
// 5xx = Supabase itself is down or the project is paused.
const isUnavailable = (status: number) => status === 0 || status >= 500;

// Case- and surrounding-whitespace-insensitive name match ("Juan" and
// "juan " are the same guest). ilike with no wildcards is a
// case-insensitive equality; the name's own %, _ and \ are escaped.
async function hasRsvpNamed(nombre: string): Promise<boolean> {
  const pattern = nombre.replace(/[\\%_]/g, (c) => `\\${c}`);
  const { data, error } = await supabase
    .from("rsvps")
    .select("id")
    .ilike("nombre", pattern)
    .limit(1)
    .abortSignal(requestTimeout());
  if (error) throw error;
  return (data ?? []).length > 0;
}

async function insertRsvp(row: Omit<Rsvp, "id" | "created_at">) {
  const { error } = await supabase.from("rsvps").insert(row).abortSignal(requestTimeout());
  if (error) throw error;
}

async function fetchAvailableItems(): Promise<{ items: Item[]; error: boolean }> {
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .order("categoria", { ascending: true })
    .order("nombre", { ascending: true })
    .abortSignal(requestTimeout());

  if (error) return { items: [], error: true };
  return {
    items: (data ?? []).filter((it) => it.cantidad_tomada < it.cantidad_deseada),
    error: false,
  };
}

export default function RsvpForm() {
  const containerRef = useRef<HTMLElement>(null);
  const submitBtnRef = useRef<HTMLButtonElement>(null);
  const comboboxRef = useRef<HTMLDivElement>(null);
  const checkPopRef = useRef<HTMLDivElement>(null);
  const checkRef = useRef<HTMLDivElement>(null);
  const checkPathRef = useRef<SVGPathElement>(null);
  const celebrationRef = useRef<HTMLDivElement>(null);
  const spriteRef = useRef<HTMLImageElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  const itemsFieldRef = useRef<HTMLDivElement>(null);
  const farewellRef = useRef<HTMLDivElement>(null);
  const farewellSpriteRef = useRef<HTMLImageElement>(null);
  const farewellBubbleRef = useRef<HTMLDivElement>(null);
  const farewellTlRef = useRef<gsap.core.Timeline | null>(null);
  const isSubmittingRef = useRef(false);

  const [nombre, setNombre] = useState("");
  const [asistencia, setAsistencia] = useState<boolean | null>(null);
  const [farewellName, setFarewellName] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [otroTexto, setOtroTexto] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const [items, setItems] = useState<Item[]>([]);
  const [itemsStatus, setItemsStatus] = useState<ItemsStatus>("loading");
  const [itemsRefreshKey, setItemsRefreshKey] = useState(0);

  const { contextSafe } = useGSAP(
    () => {
      registerGsapPlugins();

      // Background decor: scrubbed parallax + endless idle float, ~45%
      // livelier than the other sections — this is where guests pick what
      // to bring, so the room gets a bit more energy.
      animateDecor(containerRef.current, -30, 1.45);

      // The quad bike drives across behind the form, tied directly to the
      // scroll position (scrub) — off-screen left before it's in view,
      // off-screen right once it's been scrolled past.
      const driveMoto = (scrollTrigger: ScrollTrigger.Vars) =>
        gsap.fromTo(
          ".rsvp-moto",
          { x: () => -(containerRef.current?.querySelector(".rsvp-moto")?.clientWidth ?? 0) },
          {
            x: () => containerRef.current?.querySelector(".rsvp-moto-lane")?.clientWidth ?? 0,
            ease: "none",
            scrollTrigger: { scrub: 0.6, invalidateOnRefresh: true, ...scrollTrigger },
          }
        );

      const mm = gsap.matchMedia(containerRef.current ?? undefined);
      // Tablet: the bike now sits below the form here too (own lane in
      // globals.css), so it follows the bike like desktop does.
      mm.add("(min-width: 769px) and (max-width: 1023px)", () => {
        driveMoto({ trigger: ".rsvp-moto", start: "bottom bottom", end: "top 15%" });
      });
      // Desktop: the bike now sits below the form, so a section-wide range
      // would finish with it half off the top edge — run the crossing while
      // the bike itself is in view instead.
      mm.add("(min-width: 1024px)", () => {
        driveMoto({ trigger: ".rsvp-moto", start: "bottom bottom", end: "top 15%" });
      });
      // Mobile: the section is taller than the screen, so a section-wide
      // range only brought the bike on screen at the very end, already up
      // against the top edge. Here the crossing runs while the bike itself
      // is fully in view — from entering at the bottom to ~20% from the top.
      mm.add("(max-width: 768px)", () => {
        driveMoto({ trigger: ".rsvp-moto", start: "bottom bottom", end: "top 20%" });
      });

      // One-shot entrance for the form card — never hides again once
      // shown, unlike the narrative sections above it.
      gsap.from(".rsvp-form-card", {
        y: 30,
        opacity: 0,
        duration: 0.5,
        ease: "power2.out",
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 80%",
        },
      });

      // The farewell timeline is created later (contextSafe) and fires
      // setState in its onComplete — kill it explicitly on unmount so no
      // tween outlives the component.
      return () => {
        farewellTlRef.current?.kill();
        farewellTlRef.current = null;
      };
    },
    { scope: containerRef }
  );

  // contextSafe defers the ref read inside this callback to when it's
  // actually invoked (from the effect below, after the success DOM has
  // committed), never during render.
  // eslint-disable-next-line react-hooks/refs
  const playSuccessAnimation = contextSafe(() => {
    if (!checkRef.current) return;
    const tl = gsap.timeline();
    tl.fromTo(
      checkRef.current,
      { scale: 0, rotation: -15, opacity: 0 },
      { scale: 1, rotation: 0, opacity: 1, duration: 0.45, ease: "back.out(2)" }
    );
    if (checkPathRef.current) {
      const length = checkPathRef.current.getTotalLength();
      gsap.set(checkPathRef.current, { strokeDasharray: length, strokeDashoffset: length });
      tl.to(checkPathRef.current, { strokeDashoffset: 0, duration: 0.4, ease: "power1.out" }, "-=0.15");
    }
  });

  // Same as above — reads are deferred to the post-commit effect, never
  // during render.
  // eslint-disable-next-line react-hooks/refs
  const playCelebration = contextSafe(() => {
    if (!spriteRef.current || !celebrationRef.current) return;

    const tl = gsap.timeline();

    // 1. Sprite enters from below.
    tl.fromTo(
      spriteRef.current,
      { y: 40, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.4, ease: "power2.out" }
    );

    // 2. Jump.
    tl.to(spriteRef.current, { y: -18, duration: 0.25, ease: "power1.out" }).to(
      spriteRef.current,
      { y: 0, duration: 0.3, ease: "bounce.out" }
    );

    // 3. The gesture: Chepe's peace sign is already drawn into the PNG, so
    // the whole sprite does a short tilt-and-back beat instead of animating
    // an arm — then the message pops in.
    tl.to(spriteRef.current, {
      rotation: -6,
      duration: 0.15,
      ease: "power1.out",
      transformOrigin: "50% 100%",
    }).to(spriteRef.current, { rotation: 0, duration: 0.3, ease: "back.out(3)" });
    if (messageRef.current) {
      tl.fromTo(
        messageRef.current,
        { scale: 0, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(2)" },
        "<0.1"
      );
    }

    // 4. Hold, then retire on its own — revealing the persistent
    // checkmark/message underneath.
    tl.to({}, { duration: 1.3 });
    tl.to(celebrationRef.current, { autoAlpha: 0, y: -16, duration: 0.4, ease: "power1.in" });
  });

  // Plays once per successful submission, after React has committed the
  // success DOM (refs above are only valid post-commit).
  useEffect(() => {
    if (status === "success") {
      playSuccessAnimation();
      playCelebration();
    }
  }, [status, playSuccessAnimation, playCelebration]);

  // Ends the farewell: clears the form and unlocks it for the next guest.
  const finishFarewell = () => {
    farewellTlRef.current = null;
    isSubmittingRef.current = false;
    resetForm();
    setFarewellName("");
    setStatus("idle");
  };

  // The "No podré" goodbye — deliberately calmer than Chepe's celebration:
  // no jumps, just a soft entrance, a gentle sway while they talk, and a
  // slow fade out. Reads are deferred to the post-commit effect below.
  // eslint-disable-next-line react-hooks/refs
  const playFarewell = contextSafe(() => {
    const overlay = farewellRef.current;
    const twins = farewellSpriteRef.current;
    const bubble = farewellBubbleRef.current;
    if (!overlay || !twins || !bubble) {
      finishFarewell();
      return;
    }

    farewellTlRef.current?.kill();
    const tl = gsap.timeline({ onComplete: finishFarewell });
    farewellTlRef.current = tl;

    tl.fromTo(overlay, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, ease: "power1.out" });

    // a. The twins walk in from the side with a small settle.
    tl.fromTo(
      twins,
      { x: -140, scale: 0.7, opacity: 0, transformOrigin: "50% 100%" },
      { x: 0, scale: 1, opacity: 1, duration: 0.8, ease: "back.out(1.4)" },
      "-=0.1"
    );

    // b. Their chat bubble pops in above them.
    tl.fromTo(
      bubble,
      { scale: 0, opacity: 0, transformOrigin: "50% 100%" },
      { scale: 1, opacity: 1, duration: 0.35, ease: "back.out(2)" },
      "-=0.1"
    );

    // c. A gentle sway while they talk (~3s: 4 half-cycles of 0.75s).
    tl.to(twins, {
      rotation: 1.5,
      y: -3,
      duration: 0.75,
      ease: "sine.inOut",
      yoyo: true,
      repeat: 3,
    });
    tl.to(bubble, { y: -4, duration: 0.75, ease: "sine.inOut", yoyo: true, repeat: 3 }, "<");

    // d. Everyone drifts off; onComplete clears the form.
    tl.to(bubble, { autoAlpha: 0, y: -12, duration: 0.4, ease: "power1.in" });
    tl.to(twins, { autoAlpha: 0, x: 80, duration: 0.6, ease: "power1.in" }, "<0.1");
    tl.to(overlay, { autoAlpha: 0, duration: 0.3, ease: "power1.in" }, "-=0.2");
  });

  useEffect(() => {
    if (status === "farewell") playFarewell();
  }, [status, playFarewell]);

  // The utensil field is derived straight from the current answer on
  // every render — no separate visibility flag that could lag behind.
  const showItemsField = asistencia === true;

  // Expand-in when the field mounts. Height is only locked (overflow
  // hidden) while tweening, then cleared so the absolutely-positioned
  // dropdown panel isn't clipped and the field can grow when items load.
  // eslint-disable-next-line react-hooks/refs
  const playItemsFieldIn = contextSafe(() => {
    const el = itemsFieldRef.current;
    if (!el) return;
    gsap.fromTo(
      el,
      { height: 0, opacity: 0, overflow: "hidden" },
      {
        height: "auto",
        opacity: 1,
        duration: 0.25,
        ease: "power2.out",
        clearProps: "height,overflow,opacity",
      }
    );
  });

  // Layout effect so the field is collapsed before its first paint.
  useLayoutEffect(() => {
    if (showItemsField) playItemsFieldIn();
  }, [showItemsField, playItemsFieldIn]);

  const chooseAsistencia = (value: boolean) => {
    setAsistencia(value);
    if (!value) {
      setSelectedItemId(null);
      setOtroTexto("");
      setIsDropdownOpen(false);
    }
  };

  // contextSafe defers the ref read to invocation time (from the effects
  // below), never during render.
  // eslint-disable-next-line react-hooks/refs
  const playPress = contextSafe(() => {
    if (!submitBtnRef.current) return;
    gsap
      .timeline()
      .to(submitBtnRef.current, { scale: 0.95, duration: 0.08, ease: "power1.in" })
      .to(submitBtnRef.current, { scale: 1, duration: 0.35, ease: "back.out(3)" });
  });

  // eslint-disable-next-line react-hooks/refs
  const playPanelOpen = contextSafe(() => {
    const options = comboboxRef.current?.querySelectorAll(".item-option");
    if (!options || options.length === 0) return;
    gsap.fromTo(
      options,
      { opacity: 0, y: -6 },
      { opacity: 1, y: 0, duration: 0.18, stagger: 0.03, ease: "power1.out" }
    );
  });

  // eslint-disable-next-line react-hooks/refs
  const playCheckPop = contextSafe(() => {
    if (!checkPopRef.current) return;
    gsap.fromTo(checkPopRef.current, { scale: 0 }, { scale: 1, duration: 0.3, ease: "back.out(3)" });
  });

  useEffect(() => {
    if (isDropdownOpen) playPanelOpen();
  }, [isDropdownOpen, playPanelOpen]);

  useEffect(() => {
    if (selectedItemId) playCheckPop();
  }, [selectedItemId, playCheckPop]);

  // Closes the custom dropdown on outside click or Escape.
  useEffect(() => {
    if (!isDropdownOpen) return;

    const handlePointerDown = (e: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsDropdownOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDropdownOpen]);

  useEffect(() => {
    let active = true;

    fetchAvailableItems().then((result) => {
      if (!active) return;
      if (result.error) {
        setItemsStatus("error");
        return;
      }
      setItems(result.items);
      setItemsStatus("loaded");
    });

    return () => {
      active = false;
    };
  }, [itemsRefreshKey]);

  // Subscribes once for the component's lifetime — never resubscribe on re-render.
  useEffect(() => {
    const channel = supabase
      .channel("items-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "items" },
        (payload) => {
          const updated = payload.new as Item;
          setItems((prev) => {
            if (updated.cantidad_tomada >= updated.cantidad_deseada) {
              return prev.filter((it) => it.id !== updated.id);
            }
            return prev.map((it) => (it.id === updated.id ? updated : it));
          });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const resetForm = () => {
    setNombre("");
    setAsistencia(null);
    setSelectedItemId(null);
    setOtroTexto("");
  };

  const selectItem = (id: string) => {
    setSelectedItemId(id);
    setIsDropdownOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmittingRef.current) return;
    // "No podré" only needs a name — there's no utensil to pick.
    const missing =
      !nombre.trim()
        ? "Escribe tu nombre."
        : asistencia === null
          ? "Cuéntanos si asistirás."
          : asistencia && !selectedItemId
            ? "Elige qué vas a llevar."
            : asistencia && selectedItemId === OTRO_ID && !otroTexto.trim()
              ? "Cuéntanos qué vas a traer."
              : "";
    if (missing) {
      setStatus("error");
      setErrorMsg(missing);
      return;
    }

    playPress();

    isSubmittingRef.current = true;
    setStatus("submitting");
    setErrorMsg("");

    const nombreInvitado = nombre.trim();
    // Every failure path leaves the form exactly as the guest filled it
    // (name, answer, utensil) with the button enabled again, ready to retry.
    const fail = (msg: string) => {
      isSubmittingRef.current = false;
      setStatus("error");
      setErrorMsg(msg);
    };

    try {
      // Anti-spam: one RSVP per name. Checked before claim_item so a
      // duplicate never takes an item off the list.
      if (await hasRsvpNamed(nombreInvitado)) {
        fail(
          `Ya registramos tu confirmación antes, ${nombreInvitado} — si necesitas cambiar algo avísale directo al anfitrión`
        );
        return;
      }

      // Declining: nothing to claim, straight insert. Stays locked
      // (isSubmittingRef) until the farewell animation finishes.
      if (!asistencia) {
        await insertRsvp({
          nombre: nombreInvitado,
          asistencia: false,
          utensilio: null,
          item_id: null,
        });
        setFarewellName(nombreInvitado);
        setStatus("farewell");
        return;
      }

      if (selectedItemId === OTRO_ID) {
        // "Otro": free text, no real item to claim.
        await insertRsvp({
          nombre: nombreInvitado,
          asistencia: true,
          utensilio: otroTexto.trim(),
          item_id: null,
        });
      } else {
        const { error: claimError, status: claimStatus } = await supabase
          .rpc("claim_item", { item_id_input: selectedItemId })
          .abortSignal(requestTimeout());

        if (claimError) {
          // Couldn't reach Supabase: a connection problem, not a taken item.
          if (isUnavailable(claimStatus)) throw claimError;
          fail("Uy, alguien más se anotó con ese justo ahora — elige otro");
          setSelectedItemId(null);
          setItemsRefreshKey((k) => k + 1);
          return;
        }

        await insertRsvp({
          nombre: nombreInvitado,
          asistencia: true,
          utensilio: items.find((it) => it.id === selectedItemId)?.nombre ?? "",
          item_id: selectedItemId,
        });
      }
    } catch {
      // Offline, timeout, Supabase down or paused (free tier)…
      fail(SAVE_ERROR_MSG);
      return;
    }

    isSubmittingRef.current = false;
    setStatus("success");
    resetForm();
  };

  const selectedItem = items.find((it) => it.id === selectedItemId) ?? null;
  const isOtro = selectedItemId === OTRO_ID;

  return (
    <section
      className="section rsvp-section"
      ref={containerRef}
    >

      {/* Furniture decor — edges only, behind the form (z-index 0). */}
      <Decor style={{ top: "3%", left: "3%" }} opacity={0.2} depth={1.3}>
        <Sprite name="palmera" className="decor-prop-tall" />
      </Decor>
      <Decor style={{ top: "3%", right: "4%" }} opacity={0.18} depth={0.8}>
        <Sprite name="nevera" className="decor-prop-tall" />
      </Decor>
      <Decor style={{ bottom: "3%", right: "3%" }} opacity={0.22} depth={1.1}>
        <Sprite name="neveraPalmera" className="decor-prop-combo" />
      </Decor>
      <Decor style={{ top: "12%", left: "42%" }} opacity={0.14}>
        <PixelIcon
          type="window"
          color="var(--color-black)"
          size={30}
        />
      </Decor>
      <Decor style={{ bottom: "8%", left: "9%" }} opacity={0.16}>
        <PixelIcon
          type="plus"
          color="var(--color-black)"
          size={22}
        />
      </Decor>

      {/* Background lane for the quad bike: clips the off-screen travel and
          sits below the form (z-index 0 vs 1). Rendered after the decor so
          the bike drives in front of the furniture. */}
      <div
        className="rsvp-moto-lane"
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        <Sprite
          name="gemelos"
          className="rsvp-moto"
          style={{
            position: "absolute",
            left: 0,
            bottom: "1.5rem",
            height: "var(--moto-h)",
            width: "auto",
            transform: "translateX(-100%)",
            willChange: "transform",
          }}
        />
      </div>

      <div className="container" style={{ position: "relative", zIndex: 1 }}>
        <h2 className="section-title">Confirma tu asistencia</h2>

        {status === "success" ? (
          <div
            className="card"
            style={{ marginTop: "2rem", textAlign: "center", position: "relative", minHeight: 280 }}
          >
            <div
              ref={celebrationRef}
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--color-white)",
                borderRadius: 4,
                zIndex: 5,
              }}
            >
              <Sprite
                ref={spriteRef}
                name="chepe"
                style={{ height: 170, width: "auto", opacity: 0 }}
              />

              <div
                ref={messageRef}
                className="badge"
                style={{ marginTop: "0.75rem", opacity: 0, background: "var(--color-pink)", maxWidth: "80%" }}
              >
                ¡Confirmado, nos vemos el 3 de octubre!
              </div>
            </div>

            <div
              ref={checkRef}
              aria-hidden="true"
              style={{
                width: 64,
                height: 64,
                margin: "0 auto 1rem",
                background: "var(--color-green)",
                border: "4px solid var(--color-black)",
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path
                  ref={checkPathRef}
                  d="M6 17 L13 24 L26 8"
                  stroke="var(--color-white)"
                  strokeWidth="4"
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                  fill="none"
                />
              </svg>
            </div>
            <p style={{ fontWeight: 700 }}>¡Confirmación recibida!</p>
            <p style={{ marginTop: "0.5rem" }}>
              Gracias por avisarnos. Nos vemos en la fiesta.
            </p>
            <button
              type="button"
              className="btn"
              style={{ marginTop: "1.25rem" }}
              onClick={() => setStatus("idle")}
            >
              Confirmar otra persona
            </button>
          </div>
        ) : (
          <form
            className="card rsvp-form-card"
            style={{
              marginTop: "2rem",
              position: "relative",
              // Room for the twins + bubble over the (item-less) form.
              minHeight: status === "farewell" ? 300 : undefined,
            }}
            onSubmit={handleSubmit}
          >
            <label className="field-label" htmlFor="nombre">
              Tu nombre
            </label>
            <input
              id="nombre"
              type="text"
              className="text-input"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Escribe tu nombre"
              autoComplete="name"
            />

            <p className="field-label" style={{ marginTop: "1.25rem" }}>
              ¿Asistirás?
            </p>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                type="button"
                className="chip"
                data-selected={asistencia === true}
                onClick={() => chooseAsistencia(true)}
                style={{ flex: 1, textAlign: "center" }}
              >
                Sí, ahí estaré
              </button>
              <button
                type="button"
                className="chip"
                data-selected={asistencia === false}
                onClick={() => chooseAsistencia(false)}
                style={{ flex: 1, textAlign: "center" }}
              >
                No podré
              </button>
            </div>

            {showItemsField && (
              <div ref={itemsFieldRef}>
                <label className="field-label" style={{ marginTop: "1.25rem" }}>
                  ¿Qué vas a llevar?
                </label>

                {itemsStatus === "loading" && (
                  <div className="skeleton" style={{ height: 48 }} />
                )}

                {itemsStatus === "error" && (
                  <div className="card" style={{ textAlign: "center" }}>
                    <p style={{ fontWeight: 700, color: "var(--color-pink)" }}>
                      No pudimos cargar la lista de items.
                    </p>
                    <button
                      type="button"
                      className="btn"
                      style={{ marginTop: "0.75rem" }}
                      onClick={() => setItemsRefreshKey((k) => k + 1)}
                    >
                      Reintentar
                    </button>
                  </div>
                )}

                {itemsStatus === "loaded" && items.length === 0 && (
                  <p style={{ fontWeight: 600, marginBottom: "0.75rem" }}>
                    ¡Ya no quedan items de la lista! Elige “Otro” y cuéntanos qué traes.
                  </p>
                )}

                {itemsStatus === "loaded" && (
                  <div className="item-combobox" ref={comboboxRef}>
                    <button
                      type="button"
                      id="item"
                      className="text-input item-combobox-trigger"
                      aria-haspopup="listbox"
                      aria-expanded={isDropdownOpen}
                      onClick={() => setIsDropdownOpen((v) => !v)}
                    >
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {isOtro
                          ? "Otro (especifica)"
                          : selectedItem
                            ? selectedItem.nombre
                            : "Selecciona un item"}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        {selectedItemId && (
                          <div
                            ref={checkPopRef}
                            aria-hidden="true"
                            style={{
                              width: 18,
                              height: 18,
                              flexShrink: 0,
                              background: "var(--color-green)",
                              border: "2px solid var(--color-black)",
                              borderRadius: 3,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transform: "scale(0)",
                            }}
                          >
                            <svg width="10" height="10" viewBox="0 0 10 10">
                              <path
                                d="M1 5 L4 8 L9 2"
                                stroke="var(--color-white)"
                                strokeWidth="2"
                                fill="none"
                              />
                            </svg>
                          </div>
                        )}
                        <span aria-hidden="true">▾</span>
                      </span>
                    </button>

                    {isDropdownOpen && (
                      <div className="item-combobox-panel" role="listbox">
                        {ITEM_CATEGORIAS.map((categoria) => {
                          const itemsEnCategoria = items.filter((it) => it.categoria === categoria);
                          if (itemsEnCategoria.length === 0) return null;
                          return (
                            <div key={categoria}>
                              <p className="item-combobox-group-label">{categoria}</p>
                              {itemsEnCategoria.map((it) => (
                                <button
                                  key={it.id}
                                  type="button"
                                  role="option"
                                  aria-selected={selectedItemId === it.id}
                                  data-active={selectedItemId === it.id}
                                  className="item-option"
                                  onClick={() => selectItem(it.id)}
                                >
                                  {it.nombre} (quedan {it.cantidad_deseada - it.cantidad_tomada})
                                </button>
                              ))}
                            </div>
                          );
                        })}
                        <button
                          type="button"
                          role="option"
                          aria-selected={isOtro}
                          data-active={isOtro}
                          className="item-option"
                          onClick={() => selectItem(OTRO_ID)}
                        >
                          Otro (especifica)
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {isOtro && (
                  <>
                    <label
                      className="field-label"
                      htmlFor="otro"
                      style={{ marginTop: "1.25rem" }}
                    >
                      ¿Qué vas a traer?
                    </label>
                    <input
                      id="otro"
                      type="text"
                      className="text-input"
                      value={otroTexto}
                      onChange={(e) => setOtroTexto(e.target.value)}
                      placeholder="Escribe qué vas a traer"
                      maxLength={80}
                      aria-required="true"
                    />
                  </>
                )}
              </div>
            )}

            {status === "error" && (
              <p
                role="alert"
                style={{ marginTop: "1rem", color: "var(--color-pink)", fontWeight: 700 }}
              >
                {errorMsg}
              </p>
            )}

            <button
              ref={submitBtnRef}
              type="submit"
              className="btn btn-primary"
              style={{ marginTop: "1.5rem", width: "100%" }}
              disabled={status === "submitting" || status === "farewell"}
            >
              {status === "submitting" ? "Enviando..." : "Confirmar"}
            </button>

            {status === "farewell" && (
              <div
                ref={farewellRef}
                role="status"
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: "0.5rem",
                  padding: "1rem",
                  background: "var(--color-white)",
                  borderRadius: 4,
                  overflow: "hidden",
                  zIndex: 5,
                  visibility: "hidden",
                }}
              >
                {/* Same look as the chat bubbles in the room, plus a tail
                    pointing down at the twins. */}
                <div
                  ref={farewellBubbleRef}
                  style={{
                    position: "relative",
                    maxWidth: 260,
                    background: "var(--color-white)",
                    border: "3px solid var(--color-purple)",
                    boxShadow: "3px 3px 0 var(--color-purple)",
                    borderRadius: 20,
                    padding: "0.5rem 0.9rem",
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    textAlign: "center",
                    opacity: 0,
                  }}
                >
                  Está bien, {farewellName}, mi rey/reina bello(a). ¡En otra ocasión será!
                  <span
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      left: "50%",
                      bottom: -10,
                      width: 12,
                      height: 12,
                      background: "var(--color-white)",
                      borderRight: "3px solid var(--color-purple)",
                      borderBottom: "3px solid var(--color-purple)",
                      transform: "translateX(-50%) rotate(45deg)",
                    }}
                  />
                </div>
                <Sprite
                  ref={farewellSpriteRef}
                  name="gemelosParados"
                  priority
                  style={{ height: 150, width: "auto", opacity: 0, marginTop: "0.4rem" }}
                />
              </div>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
