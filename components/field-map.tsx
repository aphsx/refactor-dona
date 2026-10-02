"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { setWorkerUrl } from "maplibre-gl";
import Map, { Layer, Marker, NavigationControl, Source, type MapLayerMouseEvent, type MapRef } from "react-map-gl/maplibre";

setWorkerUrl("/maplibre/maplibre-gl-worker.js");
import { LocateFixed, Map as MapIcon, Satellite } from "lucide-react";
import { centroid, isClosedRing, openRing } from "@/lib/mill";
import "maplibre-gl/dist/maplibre-gl.css";

type MapPlot = {
  id: string;
  name: string;
  color: string;
  muted: boolean;
  polygon: [number, number][];
};

const satelliteStyle = {
  version: 8 as const,
  sources: {
    esri: {
      type: "raster" as const,
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      attribution: "Esri, Maxar, Earthstar Geographics",
    },
  },
  layers: [{ id: "esri", type: "raster" as const, source: "esri" }],
};

export function FieldMap({
  plots,
  selectedId,
  onSelect,
  draft = null,
  onDraftClick,
  bottomInset,
}: {
  plots: MapPlot[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  draft?: [number, number][] | null;
  onDraftClick?: (lng: number, lat: number) => void;
  bottomInset?: number;
}) {
  const mapRef = useRef<MapRef>(null);
  const [mode, setMode] = useState<"satellite" | "street">("satellite");
  const mapStyle = useMemo(
    () => (mode === "satellite" ? structuredClone(satelliteStyle) : "https://tiles.openfreemap.org/styles/positron"),
    [mode],
  );
  const drawn = useMemo(() => plots.filter((plot) => plot.polygon.length >= 4), [plots]);
  const selected = drawn.find((plot) => plot.id === selectedId) ?? null;
  const selectedPoint = selected ? centroid(selected.polygon) : null;
  const frameKey = `${selectedId ?? ""}|${mode}|${drawn.map((plot) => `${plot.id}:${plot.muted ? 1 : 0}`).join(",")}`;

  const draftRing = draft ?? [];
  const draftClosed = isClosedRing(draftRing);
  const draftOpen = openRing(draftRing);
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

  function fitFrame() {
    const map = mapRef.current;
    if (!map || drawn.length === 0) return;
    const picked = selectedId ? drawn.filter((plot) => plot.id === selectedId) : [];
    const subject = picked.length > 0 ? picked : drawn.filter((plot) => !plot.muted);
    const frame = subject.length > 0 ? subject : drawn;
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
    // Recenter when the working set, the selection, or the basemap changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameKey]);

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
        initialViewState={{ longitude: 100.124, latitude: 14.521, zoom: 15 }}
        maxZoom={17}
        mapStyle={mapStyle}
        onLoad={fitFrame}
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
              "line-color": ["case", ["==", ["get", "id"], highlight], "#F4C35D", "#ffffff"],
              "line-width": ["case", ["==", ["get", "id"], highlight], 3, 1.5],
              "line-opacity": ["case", ["==", ["get", "muted"], 1], 0.35, 1],
            }}
          />
        </Source>
        {draftData && (
          <Source id="draft" type="geojson" data={draftData}>
            {draftClosed ? (
              <Layer id="draft-fill" type="fill" paint={{ "fill-color": "#F4C35D", "fill-opacity": 0.45 }} />
            ) : (
              <Layer id="draft-line" type="line" paint={{ "line-color": "#F4C35D", "line-width": 2 }} />
            )}
            {draftClosed && <Layer id="draft-outline" type="line" paint={{ "line-color": "#F4C35D", "line-width": 2 }} />}
          </Source>
        )}
        {draftOpen.map((point, index) => (
          <Marker key={`${point[0]}:${point[1]}:${index}`} longitude={point[0]} latitude={point[1]} anchor="center">
            <span className="block h-3 w-3 rounded-full border-2 border-white bg-[#F4C35D]" />
          </Marker>
        ))}
        {selected && selectedPoint && (
          <Marker longitude={selectedPoint.lng} latitude={selectedPoint.lat} anchor="bottom">
            <div className="mb-1 rounded-[6px] bg-white px-2 py-1 text-[12px] font-bold text-ink shadow-[0_2px_8px_rgba(0,0,0,0.16)]">
              {selected.name}
            </div>
          </Marker>
        )}
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
}
