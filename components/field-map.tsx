"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { setWorkerUrl } from "maplibre-gl";
import Map, { Layer, Marker, NavigationControl, Source, type MapLayerMouseEvent, type MapRef } from "react-map-gl/maplibre";

setWorkerUrl("/maplibre/maplibre-gl-worker.js");
import { LocateFixed, Map as MapIcon, Satellite } from "lucide-react";
import { centroid } from "@/lib/mill";
import "maplibre-gl/dist/maplibre-gl.css";

type MapPlot = {
  id: string;
  name: string;
  color: string;
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
  activeIds,
  onSelect,
}: {
  plots: MapPlot[];
  selectedId: string | null;
  activeIds?: string[];
  onSelect: (id: string | null) => void;
}) {
  const mapRef = useRef<MapRef>(null);
  const [mode, setMode] = useState<"satellite" | "street">("satellite");
  const mapStyle = useMemo(
    () => (mode === "satellite" ? structuredClone(satelliteStyle) : "https://tiles.openfreemap.org/styles/positron"),
    [mode],
  );
  const marked = activeIds ?? (selectedId ? [selectedId] : []);
  const drawn = useMemo(() => plots.filter((plot) => plot.polygon.length >= 4), [plots]);
  const selected = drawn.find((plot) => plot.id === selectedId) ?? null;
  const selectedPoint = selected ? centroid(selected.polygon) : null;

  const data = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: drawn.map((plot) => ({
        type: "Feature" as const,
        properties: { id: plot.id, color: plot.color },
        geometry: { type: "Polygon" as const, coordinates: [plot.polygon] },
      })),
    }),
    [drawn],
  );

  function fit() {
    const map = mapRef.current;
    if (!map || drawn.length === 0) return;
    const lngs = drawn.flatMap((plot) => plot.polygon.map((point) => point[0]));
    const lats = drawn.flatMap((plot) => plot.polygon.map((point) => point[1]));
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 72, duration: 500, maxZoom: 16 },
    );
  }

  useEffect(() => {
    fit();
    // Refit when the plotted set changes, not on every selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawn.map((plot) => plot.id).join("|"), mode]);

  function selectFromMap(event: MapLayerMouseEvent) {
    const id = event.features?.[0]?.properties?.id;
    onSelect(id ? String(id) : null);
  }

  return (
    <div className="relative h-full min-h-0">
      <Map
        ref={mapRef}
        style={{ width: "100%", height: "100%" }}
        initialViewState={{ longitude: 100.124, latitude: 14.521, zoom: 15 }}
        maxZoom={17}
        mapStyle={mapStyle}
        onLoad={fit}
        interactiveLayerIds={["plot-fill"]}
        onClick={selectFromMap}
        cursor="pointer"
      >
        <NavigationControl position="top-right" showCompass={false} />
        <Source id="plots" type="geojson" data={data}>
          <Layer
            id="plot-fill"
            type="fill"
            paint={{ "fill-color": ["get", "color"], "fill-opacity": 0.55 }}
          />
          <Layer
            id="plot-line"
            type="line"
            paint={{
              "line-color": ["case", ["in", ["get", "id"], ["literal", marked]], "#F4C35D", "#ffffff"],
              "line-width": ["case", ["in", ["get", "id"], ["literal", marked]], 3, 1.5],
            }}
          />
        </Source>
        {selected && selectedPoint && (
          <Marker longitude={selectedPoint.lng} latitude={selectedPoint.lat} anchor="bottom">
            <div className="mb-1 rounded-[6px] bg-white px-2 py-1 text-[12px] font-bold text-ink shadow-[0_2px_8px_rgba(0,0,0,0.16)]">
              {selected.name}
            </div>
          </Marker>
        )}
      </Map>
      <div className="absolute left-4 top-4 z-10 flex gap-2">
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
          onClick={fit}
          className="inline-flex h-9 items-center gap-2 rounded-[6px] border-2 border-brand bg-white px-3 text-[14px] font-bold text-brand"
        >
          <LocateFixed size={16} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
