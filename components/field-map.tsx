"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { setWorkerUrl } from "maplibre-gl";
import Map, { Layer, Marker, NavigationControl, Source, type MapLayerMouseEvent, type MapRef } from "react-map-gl/maplibre";

setWorkerUrl("/maplibre/maplibre-gl-worker.js");
import { LocateFixed, Map as MapIcon, Satellite } from "lucide-react";
import { isClosedRing, openRing } from "@/lib/mill";
import "maplibre-gl/dist/maplibre-gl.css";

type MapPlot = {
  id: string;
  name: string;
  color: string;
  muted: boolean;
  polygon: [number, number][];
};

const PREVIEW_SIZE = 256;

const FONT_STACK = ["Noto Sans Bold"] as const;
const GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";

const satelliteStyle = {
  version: 8 as const,
  glyphs: GLYPHS,
  sources: {
    esri: {
      type: "raster" as const,
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      // Real imagery for this area stops at 18. Beyond that Esri returns a blank tile, so keep scaling 18.
      maxzoom: 18,
      attribution: "Esri, Maxar, Earthstar Geographics",
    },
  },
  layers: [{ id: "esri", type: "raster" as const, source: "esri" }],
};

export type FieldMapHandle = {
  capturePreview: (ring?: [number, number][] | null) => Promise<Blob | null>;
};

/** Tip just above the northernmost vertex — a tiny gap outside the fill. */
function labelOutside(polygon: [number, number][]) {
  let best = polygon[0];
  for (const point of polygon) {
    if (point[1] > best[1]) best = point;
  }
  // ~1–2 m north of the edge (not glued, not floating).
  return { lng: best[0], lat: best[1] + 0.000012 };
}

/** Small downward caret for MapLibre symbol icons (no DOM markers). */
function createPinImage(fill: string): { width: number; height: number; data: Uint8Array } {
  const width = 24;
  const height = 14;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { width, height, data: new Uint8Array(width * height * 4) };
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(2, 1);
  ctx.lineTo(width - 2, 1);
  ctx.lineTo(width / 2, height - 1);
  ctx.closePath();
  ctx.fill();
  // Soft edge so it reads on imagery.
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 1;
  ctx.stroke();
  const pixels = ctx.getImageData(0, 0, width, height).data;
  return { width, height, data: new Uint8Array(pixels) };
}

function ensurePinImages(map: { hasImage: (id: string) => boolean; addImage: (id: string, image: { width: number; height: number; data: Uint8Array }, options?: { pixelRatio?: number }) => void }) {
  if (!map.hasImage("plot-pin")) map.addImage("plot-pin", createPinImage("#ffffff"), { pixelRatio: 2 });
  if (!map.hasImage("plot-pin-active")) map.addImage("plot-pin-active", createPinImage("#F4A800"), { pixelRatio: 2 });
}

export const FieldMap = forwardRef<
  FieldMapHandle,
  {
    plots: MapPlot[];
    selectedId: string | null;
    onSelect: (id: string | null) => void;
    draft?: [number, number][] | null;
    onDraftClick?: (lng: number, lat: number) => void;
    bottomInset?: number;
    focus?: { lng: number; lat: number; zoom?: number } | null;
  }
>(function FieldMap(
  { plots, selectedId, onSelect, draft = null, onDraftClick, bottomInset, focus = null },
  ref,
) {
  const mapRef = useRef<MapRef>(null);
  const modeRef = useRef<"satellite" | "street">("satellite");
  const [mode, setMode] = useState<"satellite" | "street">("satellite");
  const [pinsReady, setPinsReady] = useState(false);
  const mapStyle = useMemo(
    () => (mode === "satellite" ? structuredClone(satelliteStyle) : "https://tiles.openfreemap.org/styles/positron"),
    [mode],
  );
  const drawn = useMemo(() => plots.filter((plot) => plot.polygon.length >= 4), [plots]);
  const draftOpen = openRing(draft ?? []);
  const draftClosed = draft != null && isClosedRing(draft);
  const drawing = draft != null;
  const drawingActive = drawing && draftOpen.length > 0;
  const focusKey = focus ? `${focus.lng}:${focus.lat}:${focus.zoom ?? ""}` : "";
  // Use draw phase (off / fresh / active), not point count — placing a point must not recenter.
  const drawPhase = !drawing ? "off" : drawingActive ? "active" : "fresh";
  const frameKey = `${selectedId ?? ""}|${mode}|${drawPhase}|${focusKey}|${drawn.map((plot) => `${plot.id}:${plot.muted ? 1 : 0}`).join(",")}`;
  const draftData = useMemo(() => {
    const ring = draft ?? [];
    const open = openRing(ring);
    if (open.length === 0) return null;
    if (isClosedRing(ring)) {
      return {
        type: "Feature" as const,
        properties: {},
        geometry: { type: "Polygon" as const, coordinates: [ring] },
      };
    }
    return {
      type: "Feature" as const,
      properties: {},
      geometry: { type: "LineString" as const, coordinates: open },
    };
  }, [draft]);

  const data = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: drawn.map((plot) => ({
        type: "Feature" as const,
        properties: { id: plot.id, color: plot.color, muted: plot.muted ? 1 : 0 },
        geometry: { type: "Polygon" as const, coordinates: [plot.polygon] },
      })),
    }),
    [drawn],
  );

  // GPU labels (symbol layer) — unmuted plots only; collision hides clutter when zoomed out.
  const labelData = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: drawn
        .filter((plot) => !plot.muted)
        .map((plot) => {
          const point = labelOutside(plot.polygon);
          return {
            type: "Feature" as const,
            properties: {
              id: plot.id,
              name: plot.name,
              selected: plot.id === selectedId ? 1 : 0,
            },
            geometry: { type: "Point" as const, coordinates: [point.lng, point.lat] },
          };
        }),
    }),
    [drawn, selectedId],
  );

  function bindPinImages() {
    const map = mapRef.current?.getMap();
    if (!map) return;
    ensurePinImages(map);
    setPinsReady(true);
  }

  function flyToFocus() {
    const map = mapRef.current;
    if (!map || !focus) return false;
    map.flyTo({
      center: [focus.lng, focus.lat],
      zoom: focus.zoom ?? 14,
      duration: 500,
    });
    return true;
  }

  function fitFrame() {
    const map = mapRef.current;
    if (!map) return;

    // User is placing vertices — keep their pan/zoom.
    if (drawingActive) return;

    if (drawn.length === 0) {
      flyToFocus();
      return;
    }

    // Group/search with nothing picked → frame the whole filter set.
    // Click a plot → zoom into that plot for detail (close panel to see group again).
    // Fresh edit of an existing ring → stay on that polygon (do not jump to placeCenter).
    // Fresh draw with no ring yet → fall through to place focus below.
    const active = drawn.filter((plot) => !plot.muted);
    const picked = selectedId ? drawn.filter((plot) => plot.id === selectedId) : [];
    if (selectedId && picked.length === 0 && !drawing) {
      flyToFocus();
      return;
    }

    const subject = picked.length > 0 ? picked : drawing ? [] : active;
    if (subject.length === 0) {
      // New boundary (no ring yet): jump to the selected place once.
      if (drawing && focus) {
        flyToFocus();
        return;
      }
    }

    const frame = subject.length > 0 ? subject : active.length > 0 ? active : drawn;
    if (frame.length === 0) {
      flyToFocus();
      return;
    }
    const lngs = frame.flatMap((plot) => plot.polygon.map((point) => point[0]));
    const lats = frame.flatMap((plot) => plot.polygon.map((point) => point[1]));
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: { top: 64, right: 48, bottom: bottomInset ?? (selectedId ? 200 : 64), left: 48 }, duration: 500, maxZoom: 16 },
    );
  }

  useEffect(() => {
    fitFrame();
    // Recenter on selection / place / basemap / draw phase — not on each new vertex.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameKey]);

  // Style swap (satellite ↔ street) drops custom images — re-register pins.
  useEffect(() => {
    if (modeRef.current !== mode) {
      modeRef.current = mode;
      setPinsReady(false);
    }
    const map = mapRef.current?.getMap();
    if (!map) return;
    const onStyle = () => {
      ensurePinImages(map);
      setPinsReady(true);
    };
    map.on("style.load", onStyle);
    return () => {
      map.off("style.load", onStyle);
    };
  }, [mode]);

  useImperativeHandle(ref, () => ({
    async capturePreview(ring) {
      const map = mapRef.current?.getMap();
      if (!map) return null;
      const target = ring && isClosedRing(ring) ? ring : draftClosed ? draft : null;
      const open = target && target.length >= 4 ? openRing(target) : [];
      if (open.length >= 3) {
        const lngs = open.map((point) => point[0]);
        const lats = open.map((point) => point[1]);
        await new Promise<void>((resolve) => {
          map.once("idle", () => resolve());
          map.fitBounds(
            [
              [Math.min(...lngs), Math.min(...lats)],
              [Math.max(...lngs), Math.max(...lats)],
            ],
            // Comfortable frame: plot fills most of the view without feeling cramped.
            { padding: 28, duration: 0, maxZoom: 18 },
          );
        });
        await new Promise<void>((resolve) => {
          map.once("idle", () => resolve());
          map.triggerRepaint();
        });
      }
      const source = map.getCanvas();
      if (!source.width || !source.height) return null;
      const out = document.createElement("canvas");
      out.width = PREVIEW_SIZE;
      out.height = PREVIEW_SIZE;
      const ctx = out.getContext("2d");
      if (!ctx) return null;

      // Crop a square around the plot in screen space (not the whole map center).
      let sx = 0;
      let sy = 0;
      let side = Math.min(source.width, source.height);
      if (open.length >= 3) {
        const projected = open.map((point) => map.project(point as [number, number]));
        const minX = Math.min(...projected.map((point) => point.x));
        const maxX = Math.max(...projected.map((point) => point.x));
        const minY = Math.min(...projected.map((point) => point.y));
        const maxY = Math.max(...projected.map((point) => point.y));
        const boxW = Math.max(1, maxX - minX);
        const boxH = Math.max(1, maxY - minY);
        // ~18% margin so it feels balanced, not glued to the edges.
        const pad = Math.max(16, Math.round(Math.max(boxW, boxH) * 0.18));
        side = Math.max(boxW, boxH) + pad * 2;
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        sx = Math.max(0, Math.min(source.width - side, cx - side / 2));
        sy = Math.max(0, Math.min(source.height - side, cy - side / 2));
        if (side > source.width) {
          side = source.width;
          sx = 0;
        }
        if (side > source.height) {
          side = source.height;
          sy = 0;
        }
      } else {
        sx = (source.width - side) / 2;
        sy = (source.height - side) / 2;
      }

      ctx.drawImage(source, sx, sy, side, side, 0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
      return new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/webp", 0.72));
    },
  }));

  function selectFromMap(event: MapLayerMouseEvent) {
    if (onDraftClick) {
      onDraftClick(event.lngLat.lng, event.lngLat.lat);
      return;
    }
    const id = event.features?.[0]?.properties?.id;
    onSelect(id ? String(id) : null);
  }

  const highlight = selectedId ?? "";

  return (
    <div className="relative h-full min-h-0">
      <Map
        ref={mapRef}
        style={{ width: "100%", height: "100%" }}
        initialViewState={{
          longitude: focus?.lng ?? 100.9925,
          latitude: focus?.lat ?? 15.87,
          zoom: focus?.zoom ?? 6,
        }}
        maxZoom={20}
        mapStyle={mapStyle}
        // Required so getCanvas() can export a preview after drawing.
        {...({ preserveDrawingBuffer: true } as Record<string, unknown>)}
        onLoad={() => {
          bindPinImages();
          fitFrame();
        }}
        interactiveLayerIds={["plot-fill"]}
        onClick={selectFromMap}
        cursor={onDraftClick ? "crosshair" : "pointer"}
      >
        <NavigationControl position="top-right" showCompass={false} />
        <Source id="plots" type="geojson" data={data}>
          <Layer
            id="plot-fill"
            type="fill"
            paint={{
              "fill-color": ["get", "color"],
              "fill-opacity": ["case", ["==", ["get", "id"], highlight], 0.72, ["==", ["get", "muted"], 1], 0.14, 0.55],
            }}
          />
          <Layer
            id="plot-line"
            type="line"
            paint={{
              "line-color": ["case", ["==", ["get", "id"], highlight], "#F4A800", "#ffffff"],
              "line-width": ["case", ["==", ["get", "id"], highlight], 3, 1.5],
              "line-opacity": ["case", ["==", ["get", "muted"], 1], 0.35, 1],
            }}
          />
        </Source>
        {pinsReady && (
          <Source id="plot-labels" type="geojson" data={labelData}>
            <Layer
              id="plot-labels"
              type="symbol"
              filter={["!=", ["get", "selected"], 1]}
              layout={{
                "icon-image": "plot-pin",
                "icon-anchor": "bottom",
                "icon-size": 0.9,
                "icon-allow-overlap": false,
                "text-field": ["get", "name"],
                "text-font": [...FONT_STACK],
                "text-size": ["interpolate", ["linear"], ["zoom"], 11, 10, 15, 12, 18, 13],
                "text-anchor": "bottom",
                "text-offset": [0, -0.85],
                "text-allow-overlap": false,
                "text-optional": true,
              }}
              paint={{
                "text-color": "#1C2430",
                "text-halo-color": "#ffffff",
                "text-halo-width": 1.6,
                "text-halo-blur": 0.2,
                "icon-opacity": 0.95,
              }}
            />
            <Layer
              id="plot-label-selected"
              type="symbol"
              filter={["==", ["get", "selected"], 1]}
              layout={{
                "icon-image": "plot-pin-active",
                "icon-anchor": "bottom",
                "icon-size": 0.95,
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
                "text-field": ["get", "name"],
                "text-font": [...FONT_STACK],
                "text-size": ["interpolate", ["linear"], ["zoom"], 11, 11, 15, 13, 18, 14],
                "text-anchor": "bottom",
                "text-offset": [0, -0.9],
                "text-allow-overlap": true,
                "text-ignore-placement": true,
              }}
              paint={{
                "text-color": "#ffffff",
                "text-halo-color": "#F4A800",
                "text-halo-width": 2,
                "text-halo-blur": 0.2,
              }}
            />
          </Source>
        )}
        {draftData && (
          <Source id="draft" type="geojson" data={draftData}>
            {draftClosed ? (
              <Layer id="draft-fill" type="fill" paint={{ "fill-color": "#F4A800", "fill-opacity": 0.45 }} />
            ) : (
              <Layer id="draft-line" type="line" paint={{ "line-color": "#F4A800", "line-width": 2 }} />
            )}
            {draftClosed && <Layer id="draft-outline" type="line" paint={{ "line-color": "#F4A800", "line-width": 2 }} />}
          </Source>
        )}
        {draftOpen.map((point, index) => (
          <Marker key={`${point[0]}:${point[1]}:${index}`} longitude={point[0]} latitude={point[1]} anchor="center">
            <span className="block h-3 w-3 rounded-full border-2 border-white bg-[#F4A800]" />
          </Marker>
        ))}
      </Map>
      <div className="absolute right-14 top-4 z-10 flex gap-2">
        <button
          type="button"
          onClick={() => setMode("satellite")}
          className={`inline-flex h-9 items-center gap-2 rounded-[6px] px-3 text-[14px] font-bold ${
            mode === "satellite" ? "bg-bar text-white" : "border-2 border-brand bg-white text-brand"
          }`}
        >
          <Satellite size={16} strokeWidth={1.75} />
          ภาพถ่าย
        </button>
        <button
          type="button"
          onClick={() => setMode("street")}
          className={`inline-flex h-9 items-center gap-2 rounded-[6px] px-3 text-[14px] font-bold ${
            mode === "street" ? "bg-bar text-white" : "border-2 border-brand bg-white text-brand"
          }`}
        >
          <MapIcon size={16} strokeWidth={1.75} />
          ถนน
        </button>
        <button
          type="button"
          aria-label="จัดขอบเขตแปลง"
          onClick={fitFrame}
          className="inline-flex h-9 items-center gap-2 rounded-[6px] border-2 border-brand bg-white px-3 text-[14px] font-bold text-brand"
        >
          <LocateFixed size={16} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
});
