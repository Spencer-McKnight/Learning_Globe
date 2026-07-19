import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import type { Country, LonLat, World } from "../lib/geo";
import type { ProjectionId } from "../lib/storage";
import { MapEngine } from "../map/MapEngine";
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
}

export function MapView(props: MapViewProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tapRef = useRef(props.onTap);
  const hoverRef = useRef(props.onHover);
  tapRef.current = props.onTap;
  hoverRef.current = props.onHover;

  const { world, engineRef } = props;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new MapEngine(canvas, world, {
      onTap: (ll, px) => tapRef.current(ll, px),
      onHover: (c) => hoverRef.current?.(c),
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

  return <canvas ref={canvasRef} className="map-canvas" role="img" aria-label={STR.a11y.map} />;
}
