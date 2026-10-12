import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Compass,
  Layers,
  Locate,
  Maximize2,
  Navigation,
  RefreshCw,
  ShieldAlert,
  Video,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CameraDevice, Alert } from '../../types';

interface TacticalMapProps {
  heightClass?: string;
  onCameraSelect?: (camera: CameraDevice) => void;
  showOverlayControls?: boolean;
}

export const TacticalMap: React.FC<TacticalMapProps> = ({
  heightClass = 'h-[500px]',
  onCameraSelect,
  showOverlayControls = true,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

  const {
    cameras,
    alerts,
    mapAction,
    gestureState,
    updateGestureState,
    setSelectedCameraId,
    setActiveNav,
    addNotification,
    mapTelemetry,
    setMapTelemetry,
    userLocation,
    setUserLocation,
  } = useApp();

  const [mapStyle, setMapStyle] = useState<'osm_tactical_dark' | 'osm_standard' | 'satellite'>('osm_tactical_dark');
  const [showSatelliteNotice, setShowSatelliteNotice] = useState<boolean>(false);
  const [userLocating, setUserLocating] = useState<boolean>(false);
  const [locationStatus, setLocationStatus] = useState<string>('Default San Francisco Operations Sector');
  const [activeFilter, setActiveFilter] = useState<'all' | 'cameras' | 'alerts'>('all');

  // Default coordinate center (San Francisco tech & safety hub demo sector)
  const defaultCenter: [number, number] = [37.775, -122.419];
  const defaultZoom = 14;

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: defaultZoom,
      zoomControl: false,
      attributionControl: true,
    });

    // Custom attribution
    map.attributionControl.setPrefix(
      '<span class="text-[10px] text-slate-400">AuraVision AI Tactical GIS · &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" class="text-cyan-400 underline">OpenStreetMap contributors</a></span>'
    );

    // Initial tile layer (Free OpenStreetMap tile service)
    const streetTiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c'],
    });

    streetTiles.addTo(map);
    tileLayerRef.current = streetTiles;

    const markersGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markersGroup;

    // Track coordinates and zoom level in real-time
    const handleMapTransformChange = () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      setMapTelemetry({
        lat: Number(center.lat.toFixed(4)),
        lng: Number(center.lng.toFixed(4)),
        zoom: zoom,
      });
    };

    map.on('moveend', handleMapTransformChange);
    map.on('zoomend', handleMapTransformChange);
    handleMapTransformChange();

    mapInstanceRef.current = map;

    return () => {
      map.off('moveend', handleMapTransformChange);
      map.off('zoomend', handleMapTransformChange);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [setMapTelemetry]);

  // Handle tile style switching
  useEffect(() => {
    if (!mapInstanceRef.current || !mapContainerRef.current) return;

    if (mapStyle === 'osm_tactical_dark') {
      mapContainerRef.current.classList.add('leaflet-dark-tiles');
    } else {
      mapContainerRef.current.classList.remove('leaflet-dark-tiles');
    }
  }, [mapStyle]);

  // Handle gesture actions directed at map
  useEffect(() => {
    if (!mapAction || !mapInstanceRef.current || gestureState.target !== 'map') return;

    const map = mapInstanceRef.current;
    if (mapAction.zoomDelta !== 0) {
      const currentZoom = map.getZoom();
      const targetZoom = Math.min(18, Math.max(10, currentZoom + mapAction.zoomDelta));
      map.setZoom(targetZoom, { animate: true });
    }

    if (mapAction.panDeltaX !== 0 || mapAction.panDeltaY !== 0) {
      map.panBy([mapAction.panDeltaX, mapAction.panDeltaY], { animate: true, duration: 0.3 });
    }
  }, [mapAction, gestureState.target]);

  // Keep userLocation marker continuously synchronized
  useEffect(() => {
    if (!userLocation || !mapInstanceRef.current) return;
    const { lat, lng } = userLocation;
    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([lat, lng]);
    } else {
      const userIconHtml = `
        <div class="relative flex items-center justify-center w-8 h-8">
          <div class="absolute inset-0 bg-emerald-500/30 rounded-full animate-ping"></div>
          <div class="w-6 h-6 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-white text-[10px] font-bold">
            YOU
          </div>
        </div>
      `;
      const icon = L.divIcon({
        html: userIconHtml,
        className: 'user-loc-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      const marker = L.marker([lat, lng], { icon }).addTo(mapInstanceRef.current);
      userMarkerRef.current = marker;
    }
  }, [userLocation]);

  // Render camera and alert markers with custom high-tech SVG pins
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    const layer = markersLayerRef.current;
    layer.clearLayers();

    // 1. Draw Cameras
    if (activeFilter === 'all' || activeFilter === 'cameras') {
      cameras.forEach((cam) => {
        const iconHtml = `
          <div class="relative flex items-center justify-center w-8 h-8 group cursor-pointer">
            <div class="absolute inset-0 bg-cyan-500/20 rounded-full animate-ping opacity-60"></div>
            <div class="w-7 h-7 rounded-full bg-[#070b14] border-2 border-cyan-400 flex items-center justify-center shadow-[0_0_12px_rgba(6,182,212,0.8)]">
              <svg class="w-3.5 h-3.5 text-cyan-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m22 8-6 4 6 4V8Z"/>
                <rect width="14" height="12" x="2" y="6" rx="2" ry="2"/>
              </svg>
            </div>
            <div class="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full ${
              cam.status === 'online' ? 'bg-emerald-400 ring-2 ring-slate-950' : 'bg-cyan-400 ring-2 ring-slate-950'
            }"></div>
          </div>
        `;

        const divIcon = L.divIcon({
          html: iconHtml,
          className: 'tactical-cam-marker',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -18],
        });

        const marker = L.marker(cam.coordinates, { icon: divIcon });

        const popupContent = `
          <div style="font-family: 'Inter', sans-serif; background: #070b14; color: #f1f5f9; padding: 12px; border-radius: 8px; border: 1px solid rgba(6, 182, 212, 0.4); min-width: 200px;">
            <div style="font-size: 10px; font-family: monospace; color: #38bdf8; text-transform: uppercase; margin-bottom: 4px;">
              [DEMO PROFILE] CAMERA NODE
            </div>
            <div style="font-weight: 600; font-size: 13px; margin-bottom: 4px; color: #fff;">
              ${cam.name}
            </div>
            <div style="font-size: 11px; color: #94a3b8; margin-bottom: 8px;">
              ${cam.location}
            </div>
            <div style="font-size: 10px; font-family: monospace; margin-bottom: 8px; color: #cbd5e1;">
              Coords: ${cam.coordinates[0].toFixed(4)}, ${cam.coordinates[1].toFixed(4)}
            </div>
            <div style="display: flex; gap: 6px;">
              <button id="view-cam-${cam.id}" style="width: 100%; background: #0284c7; color: white; border: none; padding: 5px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; cursor: pointer;">
                Open in CCTV Explorer
              </button>
            </div>
          </div>
        `;

        marker.bindPopup(popupContent, {
          className: 'tactical-popup',
          closeButton: false,
        });

        marker.on('popupopen', () => {
          const btn = document.getElementById(`view-cam-${cam.id}`);
          if (btn) {
            btn.onclick = () => {
              setSelectedCameraId(cam.id);
              if (onCameraSelect) {
                onCameraSelect(cam);
              } else {
                setActiveNav('camera');
              }
            };
          }
        });

        marker.addTo(layer);
      });
    }

    // 2. Draw Active Incident Markers
    if (activeFilter === 'all' || activeFilter === 'alerts') {
      const activeAlerts = alerts.filter((a) => a.status === 'new');
      activeAlerts.forEach((alert, index) => {
        // Map alert to slightly offset coordinates near corresponding demo nodes
        const baseCam = cameras.find((c) => c.assignedCondition === alert.conditionId) || cameras[index % cameras.length];
        const offsetLat = baseCam ? baseCam.coordinates[0] + 0.0012 : defaultCenter[0];
        const offsetLng = baseCam ? baseCam.coordinates[1] + 0.0012 : defaultCenter[1];

        const isCritical = alert.severity === 'critical';
        const isHigh = alert.severity === 'high';

        const colorClass = isCritical
          ? 'bg-rose-500 border-rose-300 shadow-[0_0_16px_rgba(244,63,94,0.9)]'
          : isHigh
          ? 'bg-amber-500 border-amber-300 shadow-[0_0_16px_rgba(245,158,11,0.9)]'
          : 'bg-indigo-500 border-indigo-300 shadow-[0_0_16px_rgba(99,102,241,0.9)]';

        const iconHtml = `
          <div class="relative flex items-center justify-center w-8 h-8 cursor-pointer">
            <div class="absolute inset-0 ${isCritical ? 'bg-rose-500/30' : 'bg-amber-500/30'} rounded-full animate-ping opacity-75"></div>
            <div class="w-7 h-7 rounded-full ${colorClass} border-2 flex items-center justify-center text-slate-950 font-bold text-xs">
              !
            </div>
          </div>
        `;

        const divIcon = L.divIcon({
          html: iconHtml,
          className: 'tactical-alert-marker',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -18],
        });

        const alertMarker = L.marker([offsetLat, offsetLng], { icon: divIcon });

        const popupContent = `
          <div style="font-family: 'Inter', sans-serif; background: #070b14; color: #f1f5f9; padding: 12px; border-radius: 8px; border: 1px solid rgba(244, 63, 94, 0.5); min-width: 220px;">
            <div style="font-size: 10px; font-family: monospace; color: #f43f5e; text-transform: uppercase; font-weight: bold; margin-bottom: 4px;">
              [SIMULATED INCIDENT] ${alert.severity.toUpperCase()}
            </div>
            <div style="font-weight: 600; font-size: 13px; margin-bottom: 4px; color: #fff;">
              ${alert.conditionTitle}
            </div>
            <div style="font-size: 11px; color: #94a3b8; margin-bottom: 6px;">
              ${alert.location}
            </div>
            <div style="font-size: 11px; color: #e2e8f0; margin-bottom: 8px; line-height: 1.3;">
              ${alert.description}
            </div>
            <button id="alert-btn-${alert.id}" style="width: 100%; background: #be123c; color: white; border: none; padding: 5px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; cursor: pointer;">
              Respond in Alert Centre
            </button>
          </div>
        `;

        alertMarker.bindPopup(popupContent, {
          className: 'tactical-popup',
          closeButton: false,
        });

        alertMarker.on('popupopen', () => {
          const btn = document.getElementById(`alert-btn-${alert.id}`);
          if (btn) {
            btn.onclick = () => {
              setActiveNav('alerts');
            };
          }
        });

        alertMarker.addTo(layer);
      });
    }

    // 3. Draw Tactical Perimeter Polygonal Boundary (Demo Zone)
    const perimeterCoords: [number, number][] = [
      [37.779, -122.424],
      [37.779, -122.414],
      [37.771, -122.414],
      [37.771, -122.424],
    ];

    const perimeterPolygon = L.polygon(perimeterCoords, {
      color: '#06b6d4',
      weight: 1.5,
      opacity: 0.7,
      fillColor: '#06b6d4',
      fillOpacity: 0.05,
      dashArray: '6, 6',
    });

    perimeterPolygon.bindTooltip(
      '<span style="font-family: monospace; font-size: 10px; color: #38bdf8;">Zone Sector Alpha (Demo Perimeter)</span>',
      { permanent: false, direction: 'center' }
    );

    perimeterPolygon.addTo(layer);
  }, [cameras, alerts, activeFilter, onCameraSelect, setSelectedCameraId, setActiveNav]);

  // Helper for Haversine distance
  const getDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const p1 = (lat1 * Math.PI) / 180;
    const p2 = (lat2 * Math.PI) / 180;
    const dp = ((lat2 - lat1) * Math.PI) / 180;
    const dl = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  // Request browser geolocation on user action
  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation API not supported by this browser. Manual navigation active.');
      addNotification('Geolocation unavailable. Using manual coordinates.');
      return;
    }

    setUserLocating(true);
    setLocationStatus('Requesting browser location permission...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocating(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserLocation({ lat, lng, accuracy: pos.coords.accuracy });

        // Calculate nearby configured cameras
        const nearbyCams = cameras
          .map((c) => ({
            ...c,
            distance: getDistanceMeters(lat, lng, c.coordinates[0], c.coordinates[1]),
          }))
          .sort((a, b) => a.distance - b.distance);

        const closest = nearbyCams[0];
        let nearbySummary = '';
        if (closest && closest.distance < 1000) {
          nearbySummary = `Nearest configured camera: "${closest.name}" (${closest.distance}m away).`;
        } else {
          nearbySummary = 'No authorized CCTV cameras configured within 1km of this location.';
        }

        setLocationStatus(`Your Location: ${lat.toFixed(4)}, ${lng.toFixed(4)} (Accuracy ~${Math.round(pos.coords.accuracy)}m). ${nearbySummary}`);
        addNotification(`User location calibrated: ${lat.toFixed(4)}, ${lng.toFixed(4)}. ${nearbySummary}`);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([lat, lng], 16, { animate: true });

          // Update or place user marker
          if (userMarkerRef.current) {
            userMarkerRef.current.setLatLng([lat, lng]);
          } else {
            const userIconHtml = `
              <div class="relative flex items-center justify-center w-8 h-8">
                <div class="absolute inset-0 bg-emerald-500/30 rounded-full animate-ping"></div>
                <div class="w-6 h-6 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-white text-[10px] font-bold">
                  YOU
                </div>
              </div>
            `;
            const icon = L.divIcon({
              html: userIconHtml,
              className: 'user-loc-marker',
              iconSize: [32, 32],
              iconAnchor: [16, 16],
            });
            const marker = L.marker([lat, lng], { icon }).addTo(mapInstanceRef.current);
            const popupHtml = `
              <div style="font-family: sans-serif; font-size: 11px; padding: 6px; min-width: 180px;">
                <div style="font-weight: bold; color: #059669; margin-bottom: 2px;">Verified Device Location</div>
                <div>Coords: ${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
                <div style="margin-top: 4px; color: #64748b; font-size: 10px;">${nearbySummary}</div>
                <div style="margin-top: 4px; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 4px;">
                  Note: Optical detection of people or dogs requires an authorized camera stream covering this area.
                </div>
              </div>
            `;
            marker.bindPopup(popupHtml).openPopup();
            userMarkerRef.current = marker;
          }
        }
      },
      (err) => {
        setUserLocating(false);
        let msg = 'Location permission denied or unavailable. Manual map panning remains fully functional.';
        if (err.code === 1) msg = 'Location access permission was declined. Manual map mode active.';
        else if (err.code === 2) msg = 'Location signal unavailable. Manual map mode active.';
        setLocationStatus(msg);
        addNotification(msg);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleResetMap = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(defaultCenter, defaultZoom, { animate: true });
      setLocationStatus('Map centered on Default Sector (Demo Coords)');
      addNotification('Map reset to default surveillance zone');
    }
  };

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-cyan-500/20 bg-[#070b14] flex flex-col">
      {/* Map Header Toolbar */}
      {showOverlayControls && (
        <div className="p-3 bg-[#070b14]/90 backdrop-blur-md border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 z-10">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-cyan-400" />
            <span className="font-heading text-sm font-semibold text-slate-200">
              Interactive GIS Tactical Map
            </span>
            <span className="text-[10px] font-hud px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30 text-cyan-300">
              OpenStreetMap · Free Layer
            </span>
          </div>

          {/* Quick Segmented Filter */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded p-0.5 text-xs">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeFilter === 'all'
                  ? 'bg-cyan-500/20 text-cyan-300 font-medium border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Entities
            </button>
            <button
              onClick={() => setActiveFilter('cameras')}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeFilter === 'cameras'
                  ? 'bg-cyan-500/20 text-cyan-300 font-medium border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Cameras ({cameras.length})
            </button>
            <button
              onClick={() => setActiveFilter('alerts')}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeFilter === 'alerts'
                  ? 'bg-rose-500/20 text-rose-300 font-medium border border-rose-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Incidents ({alerts.filter((a) => a.status === 'new').length})
            </button>
          </div>

          {/* Gesture Target Selector */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded p-0.5 text-xs font-hud">
            <span className="text-[10px] text-slate-400 px-1 hidden md:inline">TARGET:</span>
            <button
              onClick={() => updateGestureState({ target: 'map' })}
              className={`px-2 py-0.5 rounded transition-colors ${
                gestureState.target === 'map'
                  ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Map
            </button>
            <button
              onClick={() => updateGestureState({ target: 'video' })}
              className={`px-2 py-0.5 rounded transition-colors ${
                gestureState.target === 'video'
                  ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Video
            </button>
          </div>

          {/* Layer Style & Position Controls */}
          <div className="flex items-center gap-2">
            {/* Tile Style Picker */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded p-0.5 text-xs">
              <button
                onClick={() => {
                  setMapStyle('osm_tactical_dark');
                  setShowSatelliteNotice(false);
                }}
                className={`px-2 py-1 rounded transition-colors ${
                  mapStyle === 'osm_tactical_dark'
                    ? 'bg-slate-800 text-cyan-300 font-medium'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="OSM High-Contrast Tactical Dark Filter"
              >
                Tactical Dark
              </button>
              <button
                onClick={() => {
                  setMapStyle('osm_standard');
                  setShowSatelliteNotice(false);
                }}
                className={`px-2 py-1 rounded transition-colors ${
                  mapStyle === 'osm_standard'
                    ? 'bg-slate-800 text-cyan-300 font-medium'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Standard OpenStreetMap Colors"
              >
                Standard
              </button>
              <button
                onClick={() => {
                  setShowSatelliteNotice(true);
                }}
                className="px-2 py-1 rounded text-slate-400 hover:text-slate-200"
                title="Satellite layer status"
              >
                Satellite...
              </button>
            </div>

            {/* Geolocation Button */}
            <button
              onClick={handleUseLocation}
              disabled={userLocating}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 hover:border-cyan-500/40 transition-colors"
              title="Center on device location (requests browser permission)"
            >
              <Locate className={`w-3.5 h-3.5 ${userLocating ? 'animate-spin text-cyan-400' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">My Location</span>
            </button>

            {/* Reset Map Button */}
            <button
              onClick={handleResetMap}
              className="flex items-center gap-1 p-1.5 rounded text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700"
              title="Reset map to default sector"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Satellite Honest Disclosure Banner if triggered */}
      {showSatelliteNotice && (
        <div className="bg-amber-950/90 border-b border-amber-600/40 p-3 text-xs text-amber-200 flex items-start justify-between gap-3 z-20">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-amber-100">Satellite Imagery Layer Status: </span>
              AuraVision operates with 100% free, un-metered OpenStreetMap tiles by default without paid credentials.
              Satellite imagery requires an external imagery provider (e.g., USGS EarthExplorer or commercial enterprise tiles). Street map remains fully functional and unthrottled.
            </div>
          </div>
          <button
            onClick={() => setShowSatelliteNotice(false)}
            className="text-amber-400 hover:text-white font-bold text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Gesture Active Target HUD Indicator */}
      {gestureState.isActive && gestureState.target === 'map' && (
        <div className="absolute top-14 left-4 z-20 bg-[#070b14]/95 border border-cyan-400/60 rounded-lg p-2.5 text-xs font-hud flex flex-col gap-1 shadow-[0_0_20px_rgba(6,182,212,0.4)]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></span>
            <span className="text-cyan-300 font-bold uppercase tracking-wide">GESTURE MAP TARGET ACTIVE</span>
          </div>
          <div className="text-slate-200 text-[11px] flex items-center gap-2">
            <span>Coordinates: <strong className="text-white">{mapTelemetry.lat.toFixed(4)}, {mapTelemetry.lng.toFixed(4)}</strong></span>
            <span className="text-slate-600">·</span>
            <span>Zoom: <strong className="text-cyan-400">{mapTelemetry.zoom}x</strong></span>
          </div>
          <div className="text-slate-400 text-[10px]">
            Pinch = Zoom In | Open Hand = Zoom Out | Hand Move = Pan
          </div>
        </div>
      )}

      {/* Leaflet DOM Canvas Container */}
      <div ref={mapContainerRef} className={`w-full ${heightClass} z-0 outline-none`} />

      {/* Map Bottom Status Strip */}
      <div className="p-2.5 bg-[#070b14] border-t border-slate-900 flex flex-wrap items-center justify-between text-[11px] font-hud text-slate-400 px-3 gap-2">
        <div className="flex items-center gap-2">
          <Navigation className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="truncate max-w-md">{locationStatus}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-300">
            Center: <strong className="text-cyan-400 font-semibold">{mapTelemetry.lat.toFixed(4)}, {mapTelemetry.lng.toFixed(4)}</strong> ({mapTelemetry.zoom}x)
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400">Tile Layer: <strong className="text-slate-200 font-normal">OpenStreetMap (Free)</strong></span>
        </div>
      </div>
    </div>
  );
};
