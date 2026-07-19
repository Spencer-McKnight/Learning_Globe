import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import type { Country, LonLat, World } from "../lib/geo";
import type { ProjectionId } from "../lib/storage";
import { INDICATOR_RING_R, MapEngine } from "../map/MapEngine";
import { STR } from "../content/strings";

interface MapViewProps {
  world: World;
  engineRef: MutableRefObject<MapEngine | null>;
  projection: ProjectionId;
  graticule: boolean;
  highContrast: boolean;
  reduceMotion: boolean;
  interactive: boolean;
  ambient: boolean;
  onTap: (lonlat: LonLat, screen: [number, number]) => void;
  onHover?: (c: Country | null) => void;
  onInteract?: () => void;
}

/** Sync white captions into the indicator ring as the globe moves. */
function syncPinCaptions(engine: MapEngine, root: HTMLDivElement, reduceMotion: boolean): void {
  const captions = engine.pinCaptions();
  const now = performance.now();
  const used = new Set<string>();

  captions.forEach((cap, i) => {
    const key = `${cap.born}-${i}`;
    used.add(key);
    let el = root.querySelector<HTMLElement>(`[data-pin-cap="${key}"]`);
    if (!el) {
      el = document.createElement("div");
      el.className = "pin-caption";
      el.dataset.pinCap = key;
      el.style.maxWidth = `${INDICATOR_RING_R * 1.7}px`;
      const km = document.createElement("div");
      km.className = "pin-caption-km";
      km.textContent = cap.lines[0] ?? "";
      el.appendChild(km);
      if (cap.lines[1]) {
        const sub = document.createElement("div");
        sub.className = "pin-caption-sub";
        sub.textContent = cap.lines[1];
        el.appendChild(sub);
      }
      root.appendChild(el);
    } else {
      const km = el.querySelector(".pin-caption-km");
      if (km && km.textContent !== (cap.lines[0] ?? "")) km.textContent = cap.lines[0] ?? "";
      let sub = el.querySelector<HTMLElement>(".pin-caption-sub");
      if (cap.lines[1]) {
        if (!sub) {
          sub = document.createElement("div");
          sub.className = "pin-caption-sub";
          el.appendChild(sub);
        }
        if (sub.textContent !== cap.lines[1]) sub.textContent = cap.lines[1];
      } else if (sub) {
        sub.remove();
      }
    }

    const screen = engine.screenOf(cap.lonlat);
    if (!screen) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    const fade = reduceMotion ? 1 : Math.min(1, Math.max(0, (now - cap.born - 60) / 280));
    el.style.opacity = String(fade);
    // Top-align so the km line stays put when the secondary line is cleared
    const nestY = screen[1] + INDICATOR_RING_R * 0.12;
    el.style.transform = `translate(${screen[0]}px, ${nestY}px) translate(-50%, 0)`;
  });

  for (const node of Array.from(root.children)) {
    const key = (node as HTMLElement).dataset.pinCap;
    if (key && !used.has(key)) node.remove();
  }
}

export function MapView(props: MapViewProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const captionsRef = useRef<HTMLDivElement>(null);
  const tapRef = useRef(props.onTap);
  const hoverRef = useRef(props.onHover);
  const interactRef = useRef(props.onInteract);
  tapRef.current = props.onTap;
  hoverRef.current = props.onHover;
  interactRef.current = props.onInteract;

  const { world, engineRef } = props;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new MapEngine(canvas, world, {
      onTap: (ll, px) => tapRef.current(ll, px),
      onHover: (c) => hoverRef.current?.(c),
      onInteract: () => interactRef.current?.(),
    });
    engineRef.current = engine;
    if (import.meta.env.DEV) {
      (window as unknown as { __lgEngine?: MapEngine }).__lgEngine = engine;
    }
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [world, engineRef]);

  useEffect(() => {
    engineRef.current?.setProjection(props.projection);
  }, [props.projection, engineRef]);
  useEffect(() => {
    engineRef.current?.setGraticule(props.graticule);
  }, [props.graticule, engineRef]);
  useEffect(() => {
    engineRef.current?.setHighContrast(props.highContrast);
  }, [props.highContrast, engineRef]);
  useEffect(() => {
    engineRef.current?.setReduceMotion(props.reduceMotion);
  }, [props.reduceMotion, engineRef]);
  useEffect(() => {
    engineRef.current?.setInteractive(props.interactive);
  }, [props.interactive, engineRef]);
  useEffect(() => {
    engineRef.current?.setAmbient(props.ambient);
  }, [props.ambient, engineRef]);

  useEffect(() => {
    let raf = 0;
    const tick = (): void => {
      const engine = engineRef.current;
      const root = captionsRef.current;
      if (engine && root) syncPinCaptions(engine, root, props.reduceMotion);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engineRef, props.reduceMotion]);

  return (
    <>
      <canvas ref={canvasRef} className="map-canvas" role="img" aria-label={STR.a11y.map} />
      <div ref={captionsRef} className="pin-captions" aria-hidden="true" />
    </>
  );
}
