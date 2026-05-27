import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { Loader2 } from "lucide-react";

const INVERCARGILL: [number, number] = [-46.4132, 168.3538];
const DEFAULT_ZOOM = 13;

function makeDotIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};width:16px;height:16px;border-radius:50%;border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

const pickupIcon = makeDotIcon("#2563eb");
const dropoffIcon = makeDotIcon("#dc2626");

export const MAP_PANEL_HEIGHT_PX = 400;

export function isValidMapCoord(
  c: { lat: number; lng: number } | null | undefined
): c is { lat: number; lng: number } {
  return !!c && c.lat !== 0 && c.lng !== 0 && !Number.isNaN(c.lat) && !Number.isNaN(c.lng);
}

function isValidCoord(c: { lat: number; lng: number } | null | undefined): c is { lat: number; lng: number } {
  return isValidMapCoord(c);
}

function FitMapView({ points }: { points: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) {
      map.setView(INVERCARGILL, DEFAULT_ZOOM);
      return;
    }
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48] });
  }, [map, points]);

  return null;
}

export default function BookingMapPanel({
  pickup,
  dropoff,
}: {
  pickup: { lat: number; lng: number } | null;
  dropoff: { lat: number; lng: number } | null;
}) {
  const [routeLine, setRouteLine] = useState<[number, number][]>([]);
  const [routeInfo, setRouteInfo] = useState<{ distanceKm: number; durationMin: number } | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);

  const pickOk = isValidCoord(pickup);
  const dropOk = isValidCoord(dropoff);

  useEffect(() => {
    if (!pickOk || !dropOk) {
      setRouteLine([]);
      setRouteInfo(null);
      return;
    }

    const controller = new AbortController();
    setLoadingRoute(true);

    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}` +
      `?overview=full&geometries=geojson`;

    fetch(url, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        const route = data?.routes?.[0];
        if (data?.code !== "Ok" || !route?.geometry?.coordinates) {
          setRouteLine([]);
          setRouteInfo(null);
          return;
        }
        const line: [number, number][] = route.geometry.coordinates.map(
          ([lng, lat]: [number, number]) => [lat, lng]
        );
        setRouteLine(line);
        setRouteInfo({
          distanceKm: route.distance / 1000,
          durationMin: Math.max(1, Math.round(route.duration / 60)),
        });
      })
      .catch(() => {
        setRouteLine([]);
        setRouteInfo(null);
      })
      .finally(() => setLoadingRoute(false));

    return () => controller.abort();
  }, [pickOk, dropOk, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng]);

  const markerPoints = useMemo(() => {
    const pts: [number, number][] = [];
    if (pickOk) pts.push([pickup.lat, pickup.lng]);
    if (dropOk) pts.push([dropoff.lat, dropoff.lng]);
    return pts;
  }, [pickOk, dropOk, pickup, dropoff]);

  const mapKey = `${pickup?.lat ?? 0}-${pickup?.lng ?? 0}-${dropoff?.lat ?? 0}-${dropoff?.lng ?? 0}`;

  return (
    <div
      className="relative w-full rounded-[1.5rem] overflow-hidden border border-border shadow-xl bg-muted/30"
      style={{ height: MAP_PANEL_HEIGHT_PX, minHeight: MAP_PANEL_HEIGHT_PX, zIndex: 0 }}
    >
      <MapContainer
        key={mapKey}
        center={INVERCARGILL}
        zoom={DEFAULT_ZOOM}
        className="z-0"
        style={{ height: MAP_PANEL_HEIGHT_PX, width: "100%", zIndex: 0 }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitMapView points={markerPoints} />
        {pickOk && <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon} />}
        {dropOk && <Marker position={[dropoff.lat, dropoff.lng]} icon={dropoffIcon} />}
        {routeLine.length > 0 && (
          <Polyline positions={routeLine} pathOptions={{ color: "#0a6b6b", weight: 4, opacity: 0.85 }} />
        )}
      </MapContainer>

      <div className="absolute top-3 left-3 z-[1000] flex flex-col gap-1.5 pointer-events-none">
        <span className="inline-flex items-center gap-1.5 bg-white/95 backdrop-blur text-xs font-bold px-2.5 py-1 rounded-full shadow border border-border">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600" /> Pickup
        </span>
        <span className="inline-flex items-center gap-1.5 bg-white/95 backdrop-blur text-xs font-bold px-2.5 py-1 rounded-full shadow border border-border">
          <span className="w-2.5 h-2.5 rounded-full bg-red-600" /> Drop-off
        </span>
      </div>

      {(loadingRoute || routeInfo) && (
        <div className="absolute bottom-3 left-3 right-3 z-[1000] bg-white/95 backdrop-blur rounded-xl px-4 py-2.5 text-sm shadow-lg border border-border">
          {loadingRoute ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Calculating route…
            </span>
          ) : routeInfo ? (
            <span>
              <strong className="text-foreground">{routeInfo.distanceKm.toFixed(1)} km</strong>
              <span className="text-muted-foreground"> · ~{routeInfo.durationMin} min drive</span>
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
