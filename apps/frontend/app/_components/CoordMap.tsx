"use client";

import { useEffect, useRef } from "react";

interface Props {
  lat: number;
  lon: number;
  onChange: (lat: number, lon: number) => void;
}

export function CoordMap({ lat, lon, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const markerRef = useRef<unknown>(null);
  useEffect(() => {
    if (!containerRef.current) return;

    // React's development double-invoke runs this effect twice. The guard
    // cannot live on mapRef alone, because mapRef is only assigned once the
    // dynamic import resolves — by which time the second run has already
    // started its own import, and Leaflet throws "Map container is already
    // initialized" with two maps bound to one element.
    //
    // A per-run cancelled flag, checked AFTER the await, is what actually
    // closes it: the first run's callback sees that its effect was torn
    // down and builds nothing.
    let cancelled = false;

    // Leaflet must be imported client-side only
    import("leaflet").then((L) => {
      if (cancelled || mapRef.current) return;

      // Fix default icon paths (broken by bundlers)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      const map = L.map(containerRef.current!).setView([lat, lon], 5);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker([lat, lon], { draggable: true }).addTo(map);
      marker.on("dragend", () => {
        const { lat: la, lng: ln } = marker.getLatLng();
        onChange(parseFloat(la.toFixed(4)), parseFloat(ln.toFixed(4)));
      });
      map.on("click", (e: unknown) => {
        const ev = e as { latlng: { lat: number; lng: number } };
        marker.setLatLng([ev.latlng.lat, ev.latlng.lng]);
        onChange(parseFloat(ev.latlng.lat.toFixed(4)), parseFloat(ev.latlng.lng.toFixed(4)));
      });

      mapRef.current = map;
      markerRef.current = marker;
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        (mapRef.current as { remove: () => void }).remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update marker when lat/lon props change externally (city select)
  useEffect(() => {
    if (!markerRef.current || !mapRef.current) return;
    import("leaflet").then((L) => {
      const marker = markerRef.current as InstanceType<typeof L.Marker>;
      const map = mapRef.current as InstanceType<typeof L.Map>;
      const pos = L.latLng(lat, lon);
      marker.setLatLng(pos);
      map.setView(pos, Math.max(map.getZoom(), 8));
    });
  }, [lat, lon]);

  return <div ref={containerRef} className="w-full h-64 rounded-xl overflow-hidden border border-mist-200 z-0" />;
}
