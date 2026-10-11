import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Compass,
  Crosshair,
  Dog,
  Eye,
  EyeOff,
  Globe,
  Hand,
  HelpCircle,
  Layers,
  Locate,
  Maximize2,
  Move,
  Navigation,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  Sliders,
  Sparkles,
  User,
  Video,
  VideoOff,
  Volume2,
  X,
  ZoomIn,
  ZoomOut,
  Info,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CameraDevice, GestureType, TrackingStatus } from '../types';
import {
  initializeHandLandmarker,
  drawHandSkeleton,
  analyzeHandLandmarks,
  DEFAULT_THRESHOLDS,
  GestureThresholds,
  HandLandmarkPoint,
} from '../services/handTrackingService';
import { detectFaceInVideo, drawFaceReticle, FaceDetectionResult } from '../services/faceDetectionService';
import { searchLocations, parseCoordinates, GeocodingResult, PRESET_LOCATIONS } from '../services/geocodingService';
import { GestureControlledVideoPlayer } from '../components/camera/GestureControlledVideoPlayer';

declare global {
  interface Window {
    Hands?: any;
  }
}

// Tile provider presets
interface TileLayerOption {
  id: string;
  name: string;
  type: 'satellite' | 'street' | 'tactical_dark';
  url: string;
  attribution: string;
  maxZoom: number;
  description: string;
}

const TILE_LAYERS: TileLayerOption[] = [
  {
    id: 'esri_satellite',
    name: 'Satellite Imagery (Esri World Imagery)',
    type: 'satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 19,
    description: 'High-resolution global satellite photography (Public non-commercial evaluation tier)',
  },
  {
    id: 'osm_street',
    name: 'OpenStreetMap (Street Map - Free)',
    type: 'street',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    maxZoom: 19,
    description: '100% free, unmetered, community-maintained global street map',
  },
  {
    id: 'osm_dark',
    name: 'Tactical High-Contrast Dark Filter',
    type: 'tactical_dark',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    maxZoom: 19,
    description: 'OpenStreetMap with dark tactical filter for defense & security command centers',
  },
];

export const SatelliteGesturePilotPage: React.FC = () => {
  // App context states
  const {
    cameras,
    gestureState,
    updateGestureState,
    webcamStream,
    startWebcam,
    stopWebcam,
    retryWebcam,
    cameraStatus,
    setCameraStatus,
    cameraError,
    isPreviewVisible,
    setIsPreviewVisible,
    userLocation,
    setUserLocation,
    addNotification,
    mapTelemetry,
    setMapTelemetry,
  } = useApp();

  // --- 1. WEBCAM & GESTURE REFS & STATES ---
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hudCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const tasksLandmarkerRef = useRef<any>(null);
  const classicHandsRef = useRef<any>(null);
  const lastVideoTimeRef = useRef<number>(-1);
  const isClassicBusyRef = useRef<boolean>(false);

  const [isVideoReady, setIsVideoReady] = useState<boolean>(false);
  const [modelStatus, setModelStatus] = useState<TrackingStatus>('loading_model');
  const [activeEngine, setActiveEngine] = useState<string>('MediaPipe Tasks HandLandmarker');
  const [faceResult, setFaceResult] = useState<FaceDetectionResult>({
    isFaceDetected: false,
    confidence: 0,
    label: 'Face not detected',
  });

  // Gesture calibration settings
  const [isGestureControlEnabled, setIsGestureControlEnabled] = useState<boolean>(true);
  const [gestureSensitivity, setGestureSensitivity] = useState<number>(1.0);
  const [thresholds, setThresholds] = useState<GestureThresholds>(DEFAULT_THRESHOLDS);
  const [showCalibrationDrawer, setShowCalibrationDrawer] = useState<boolean>(false);

  // Tracking heuristics state
  const prevSmoothedCentroidRef = useRef<{ x: number; y: number } | null>(null);
  const lastActionTimeRef = useRef<number>(0);
  const lastTriggeredGestureRef = useRef<GestureType>('none');
  const [lastMapActionText, setLastMapActionText] = useState<string>('Map ready. Waiting for gesture stream.');

  // --- 2. LEAFLET SATELLITE MAP REFS & STATES ---
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const cctvMarkersGroupRef = useRef<L.LayerGroup | null>(null);
  const searchMarkerRef = useRef<L.Marker | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

  // Map layer states
  const [activeLayerId, setActiveLayerId] = useState<string>('esri_satellite');
  const [customTileUrl, setCustomTileUrl] = useState<string>('');
  const [showLayerModal, setShowLayerModal] = useState<boolean>(false);
  const [showNearbyCCTV, setShowNearbyCCTV] = useState<boolean>(true);
  const [selectedCameraForModal, setSelectedCameraForModal] = useState<CameraDevice | null>(null);

  // Search box states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [selectedLocationName, setSelectedLocationName] = useState<string>('San Francisco Command Sector');

  // Geolocation state
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Default coordinate center
  const defaultCenter: [number, number] = [37.7749, -122.4194];
  const defaultZoom = 15;

  // Sync gesture target to 'map' when this page is active
  useEffect(() => {
    updateGestureState({ target: 'map' });
  }, [updateGestureState]);

  // -------------------------------------------------------------
  // MAP INITIALIZATION (Leaflet)
  // -------------------------------------------------------------
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: defaultZoom,
      zoomControl: false,
      attributionControl: true,
    });

    map.attributionControl.setPrefix(
      '<span class="text-[10px] text-slate-400 font-hud">AuraVision Satellite GIS · </span>'
    );

    // Initial tile layer
    const initialConfig = TILE_LAYERS.find((t) => t.id === activeLayerId) || TILE_LAYERS[0];
    const initialTiles = L.tileLayer(initialConfig.url, {
      maxZoom: initialConfig.maxZoom,
      attribution: initialConfig.attribution,
    });

    initialTiles.addTo(map);
    tileLayerRef.current = initialTiles;

    // Apply dark filter if tactical dark is selected
    if (initialConfig.type === 'tactical_dark' && mapContainerRef.current) {
      mapContainerRef.current.classList.add('leaflet-dark-tiles');
    }

    // Nearby CCTV layer group
    const cctvGroup = L.layerGroup().addTo(map);
    cctvMarkersGroupRef.current = cctvGroup;

    // Real-time map telemetry change handlers
    const updateTelemetry = () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      setMapTelemetry({
        lat: Number(center.lat.toFixed(5)),
        lng: Number(center.lng.toFixed(5)),
        zoom: zoom,
      });
    };

    map.on('moveend', updateTelemetry);
    map.on('zoomend', updateTelemetry);
    updateTelemetry();

    mapInstanceRef.current = map;

    return () => {
      map.off('moveend', updateTelemetry);
      map.off('zoomend', updateTelemetry);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Switch Tile Layer when activeLayerId or customTileUrl changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    let urlToUse = '';
    let attributionToUse = '';
    let maxZoomToUse = 19;
    let isTacticalDark = false;

    if (activeLayerId === 'custom' && customTileUrl) {
      urlToUse = customTileUrl;
      attributionToUse = 'Custom Satellite / Aerial Tile Provider';
      maxZoomToUse = 20;
    } else {
      const config = TILE_LAYERS.find((t) => t.id === activeLayerId) || TILE_LAYERS[0];
      urlToUse = config.url;
      attributionToUse = config.attribution;
      maxZoomToUse = config.maxZoom;
      isTacticalDark = config.type === 'tactical_dark';
    }

    const newTiles = L.tileLayer(urlToUse, {
      maxZoom: maxZoomToUse,
      attribution: attributionToUse,
    });

    newTiles.addTo(map);
    tileLayerRef.current = newTiles;

    if (mapContainerRef.current) {
      if (isTacticalDark) {
        mapContainerRef.current.classList.add('leaflet-dark-tiles');
      } else {
        mapContainerRef.current.classList.remove('leaflet-dark-tiles');
      }
    }
  }, [activeLayerId, customTileUrl]);

  // Render Authorized Nearby CCTV Markers on Map
  useEffect(() => {
    if (!mapInstanceRef.current || !cctvMarkersGroupRef.current) return;
    const group = cctvMarkersGroupRef.current;
    group.clearLayers();

    if (!showNearbyCCTV) return;

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
        className: 'tactical-cctv-pin',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18],
      });

      const marker = L.marker(cam.coordinates, { icon: divIcon });

      const popupHtml = `
        <div style="font-family: 'Inter', sans-serif; background: #070b14; color: #f1f5f9; padding: 12px; border-radius: 8px; border: 1px solid rgba(6, 182, 212, 0.4); min-width: 210px;">
          <div style="font-size: 10px; font-family: monospace; color: #38bdf8; text-transform: uppercase; margin-bottom: 4px;">
            [AUTHORIZED NODE] CCTV FEED
          </div>
          <div style="font-weight: 600; font-size: 13px; margin-bottom: 4px; color: #fff;">
            ${cam.name}
          </div>
          <div style="font-size: 11px; color: #94a3b8; margin-bottom: 6px;">
            ${cam.location}
          </div>
          <div style="font-size: 10px; font-family: monospace; margin-bottom: 10px; color: #cbd5e1;">
            Coords: ${cam.coordinates[0].toFixed(4)}, ${cam.coordinates[1].toFixed(4)}
          </div>
          <button id="open-cctv-modal-${cam.id}" style="width: 100%; background: #0284c7; color: white; border: none; padding: 6px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer;">
            Open Optical Person/Dog AI View
          </button>
        </div>
      `;

      marker.bindPopup(popupHtml, { className: 'tactical-popup', closeButton: false });

      marker.on('popupopen', () => {
        const btn = document.getElementById(`open-cctv-modal-${cam.id}`);
        if (btn) {
          btn.onclick = () => {
            setSelectedCameraForModal(cam);
          };
        }
      });

      marker.addTo(group);
    });
  }, [cameras, showNearbyCCTV]);

  // -------------------------------------------------------------
  // LOCATION SEARCH & MY LOCATION
  // -------------------------------------------------------------
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    const results = await searchLocations(searchQuery);
    setIsSearching(false);
    setSearchResults(results);

    // If exact match or first result, jump to it
    if (results.length > 0) {
      selectLocation(results[0]);
    }
  };

  const selectLocation = (loc: GeocodingResult) => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    map.setView([loc.lat, loc.lng], 16, { animate: true });
    setSelectedLocationName(loc.displayName);
    setSearchResults([]);

    // Update search pin
    if (searchMarkerRef.current) {
      searchMarkerRef.current.setLatLng([loc.lat, loc.lng]);
    } else {
      const pinIcon = L.divIcon({
        html: `
          <div class="relative flex items-center justify-center w-8 h-8">
            <div class="absolute inset-0 bg-cyan-400/30 rounded-full animate-ping"></div>
            <div class="w-7 h-7 rounded-full bg-cyan-500 border-2 border-white flex items-center justify-center text-slate-950 font-bold text-xs shadow-lg">
              ★
            </div>
          </div>
        `,
        className: 'search-pin',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      const marker = L.marker([loc.lat, loc.lng], { icon: pinIcon }).addTo(map);
      marker.bindPopup(`<b>${loc.displayName}</b><br/>Lat: ${loc.lat.toFixed(5)}, Lng: ${loc.lng.toFixed(5)}`).openPopup();
      searchMarkerRef.current = marker;
    }

    addNotification(`Centered satellite map on: ${loc.displayName}`);
    setLastMapActionText(`Navigated to: ${loc.displayName.substring(0, 40)}...`);
  };

  // Browser Geolocation Permission Request
  const handleMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation API not supported by this browser.');
      addNotification('Geolocation unavailable in this environment.');
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserLocation({ lat, lng, accuracy: pos.coords.accuracy });
        setSelectedLocationName(`My Verified Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`);

        if (mapInstanceRef.current) {
          const map = mapInstanceRef.current;
          map.setView([lat, lng], 17, { animate: true });

          if (userMarkerRef.current) {
            userMarkerRef.current.setLatLng([lat, lng]);
          } else {
            const userIcon = L.divIcon({
              html: `
                <div class="relative flex items-center justify-center w-9 h-9">
                  <div class="absolute inset-0 bg-emerald-500/30 rounded-full animate-ping"></div>
                  <div class="w-7 h-7 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-slate-950 text-[10px] font-bold shadow-lg">
                    YOU
                  </div>
                </div>
              `,
              className: 'user-marker',
              iconSize: [36, 36],
              iconAnchor: [18, 18],
            });
            const marker = L.marker([lat, lng], { icon: userIcon }).addTo(map);
            marker
              .bindPopup(
                `<div style="font-family: sans-serif; font-size: 11px;">
                  <strong style="color: #059669;">Verified Device Location</strong><br/>
                  Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}<br/>
                  Accuracy: ~${Math.round(pos.coords.accuracy)}m<br/>
                  <span style="font-size: 10px; color: #64748b;">Note: Map provides satellite geospatial view. Live optical detection of people/dogs requires an authorized CCTV feed.</span>
                </div>`
              )
              .openPopup();
            userMarkerRef.current = marker;
          }
        }

        addNotification(`Device location acquired: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        setLastMapActionText(`Map centered on device GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      },
      (err) => {
        setIsLocating(false);
        let msg = 'Location permission denied or unavailable. Manual navigation remains fully operational.';
        if (err.code === 1) msg = 'Location access permission was declined. Manual search mode active.';
        else if (err.code === 2) msg = 'GPS signal unavailable. Manual search mode active.';
        setLocationError(msg);
        addNotification(msg);
      },
      { timeout: 12000, enableHighAccuracy: true }
    );
  };

  // Reset Map View
  const handleResetMap = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(defaultCenter, defaultZoom, { animate: true });
      setSelectedLocationName('San Francisco Command Sector (Default)');
      setLastMapActionText('Map reset to default surveillance coordinates');
      addNotification('Satellite map reset to default center');
    }
  };

  // Manual Zoom Controls
  const handleManualZoom = (delta: number) => {
    if (mapInstanceRef.current) {
      const z = mapInstanceRef.current.getZoom();
      mapInstanceRef.current.setZoom(z + delta, { animate: true });
      setLastMapActionText(`Manual Zoom ${delta > 0 ? 'IN' : 'OUT'} to ${z + delta}x`);
    }
  };

  // -------------------------------------------------------------
  // GESTURE ACTION DISPATCHER ON MAP (Inside Right Panel ONLY)
  // -------------------------------------------------------------
  const executeMapGestureAction = useCallback(
    (gesture: GestureType, confidence: number) => {
      if (!isGestureControlEnabled || !mapInstanceRef.current) return;
      const map = mapInstanceRef.current;
      const now = Date.now();
      const sensitivity = gestureSensitivity;

      const isZoom = gesture === 'pinch_zoom_in' || gesture === 'open_hand_zoom_out';
      const cooldown = isZoom ? thresholds.zoomCooldownMs : thresholds.panCooldownMs;
      const isNewTransition = gesture !== lastTriggeredGestureRef.current;

      if (gesture !== 'none') {
        const timeSince = now - lastActionTimeRef.current;
        if (isNewTransition || timeSince > cooldown) {
          lastActionTimeRef.current = now;
          lastTriggeredGestureRef.current = gesture;

          if (gesture === 'pinch_zoom_in') {
            const currentZoom = map.getZoom();
            if (currentZoom < 19) {
              map.setZoom(currentZoom + 1, { animate: true });
              setLastMapActionText(`PINCH ZOOM IN applied (Zoom: ${currentZoom + 1}x)`);
            }
          } else if (gesture === 'open_hand_zoom_out') {
            const currentZoom = map.getZoom();
            if (currentZoom > 2) {
              map.setZoom(currentZoom - 1, { animate: true });
              setLastMapActionText(`OPEN HAND ZOOM OUT applied (Zoom: ${currentZoom - 1}x)`);
            }
          } else if (gesture === 'pan_left') {
            const step = Math.round(90 * sensitivity);
            map.panBy([-step, 0], { animate: true, duration: 0.25 });
            setLastMapActionText(`PAN LEFT applied (${step}px)`);
          } else if (gesture === 'pan_right') {
            const step = Math.round(90 * sensitivity);
            map.panBy([step, 0], { animate: true, duration: 0.25 });
            setLastMapActionText(`PAN RIGHT applied (${step}px)`);
          } else if (gesture === 'pan_up') {
            const step = Math.round(75 * sensitivity);
            map.panBy([0, -step], { animate: true, duration: 0.25 });
            setLastMapActionText(`PAN UP applied (${step}px)`);
          } else if (gesture === 'pan_down') {
            const step = Math.round(75 * sensitivity);
            map.panBy([0, step], { animate: true, duration: 0.25 });
            setLastMapActionText(`PAN DOWN applied (${step}px)`);
          }
        }
      } else {
        lastTriggeredGestureRef.current = 'none';
      }
    },
    [isGestureControlEnabled, gestureSensitivity, thresholds]
  );

  // -------------------------------------------------------------
  // CAMERA STREAM ATTACHMENT & WEBCAM RUNTIME
  // -------------------------------------------------------------
  const attachStreamToVideo = useCallback((videoElement: HTMLVideoElement | null, stream: MediaStream | null) => {
    if (!videoElement) return;

    if (stream) {
      if (videoElement.srcObject !== stream) {
        videoElement.srcObject = stream;
      }
      videoElement.muted = true;
      videoElement.defaultMuted = true;
      videoElement.playsInline = true;
      videoElement.autoplay = true;

      const attemptPlay = async () => {
        try {
          await videoElement.play();
          setIsVideoReady(true);
          setCameraStatus('connected');
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            console.warn('Webcam play() waiting or error:', err);
          }
        }
      };

      if (videoElement.readyState >= 2) {
        attemptPlay();
      } else {
        videoElement.onloadedmetadata = attemptPlay;
        videoElement.oncanplay = attemptPlay;
      }
    } else {
      videoElement.srcObject = null;
      setIsVideoReady(false);
    }
  }, [setCameraStatus]);

  const setVideoRef = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element;
    if (element && webcamStream) {
      attachStreamToVideo(element, webcamStream);
    }
  }, [webcamStream, attachStreamToVideo]);

  useEffect(() => {
    if (videoRef.current) {
      attachStreamToVideo(videoRef.current, webcamStream);
    }
  }, [webcamStream, attachStreamToVideo]);

  // Model Initialization
  useEffect(() => {
    let isDisposed = false;

    const setupModels = async () => {
      setModelStatus('loading_model');

      // Primary: MediaPipe Tasks HandLandmarker
      try {
        const landmarker = await initializeHandLandmarker();
        if (landmarker && !isDisposed) {
          tasksLandmarkerRef.current = landmarker;
          setActiveEngine('MediaPipe Tasks HandLandmarker');
          setModelStatus('waiting_hand');
          return;
        }
      } catch (err) {
        console.warn('Tasks Landmarker init warning:', err);
      }

      // Secondary: Classic MediaPipe Hands
      if (typeof window !== 'undefined' && window.Hands && !isDisposed) {
        try {
          const classic = new window.Hands({
            locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
          });
          classic.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });
          classicHandsRef.current = classic;
          setActiveEngine('MediaPipe Classic Hands');
          setModelStatus('waiting_hand');
          return;
        } catch (e) {}
      }

      // Tertiary: Optical Reticle
      if (!isDisposed) {
        setActiveEngine('Optical Computer Vision Engine');
        setModelStatus('waiting_hand');
      }
    };

    setupModels();

    return () => {
      isDisposed = true;
    };
  }, []);

  // -------------------------------------------------------------
  // CONTINUOUS WEBCAM FRAME LOOP (Face Detection + Hand Tracking)
  // -------------------------------------------------------------
  useEffect(() => {
    if (!webcamStream || !isVideoReady) return;

    let isDisposed = false;

    const processFrame = async () => {
      if (isDisposed) return;

      const video = videoRef.current;
      const canvas = hudCanvasRef.current;

      if (!video || video.readyState < 2 || video.paused || video.videoWidth === 0 || !canvas) {
        animFrameRef.current = requestAnimationFrame(processFrame);
        return;
      }

      // Sync canvas dimensions
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animFrameRef.current = requestAnimationFrame(processFrame);
        return;
      }

      // CLEAR HUD CANVAS (Keeps live video feed 100% visible, zero black overlay)
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // --- A. FACE DETECTION (Upper Frame Analyzer) ---
      const face = await detectFaceInVideo(video, offscreenCanvasRef.current || undefined);
      setFaceResult(face);
      if (face.isFaceDetected && face.boundingBox) {
        drawFaceReticle(ctx, face.boundingBox, canvas.width, canvas.height, face.confidence);
      }

      // --- B. HAND LANDMARK DETECTION ---
      let detectedHandCount = 0;
      let recognizedGesture: GestureType = 'none';
      let recognizedConfidence = 0;

      // ENGINE 1: Tasks HandLandmarker
      if (tasksLandmarkerRef.current) {
        try {
          const now = performance.now();
          if (video.currentTime !== lastVideoTimeRef.current) {
            lastVideoTimeRef.current = video.currentTime;
            const results = tasksLandmarkerRef.current.detectForVideo(video, now);

            if (results && results.landmarks && results.landmarks.length > 0) {
              detectedHandCount = results.landmarks.length;

              results.landmarks.forEach((handPoints: HandLandmarkPoint[], idx: number) => {
                if (idx === 0) {
                  const analysis = analyzeHandLandmarks(
                    handPoints,
                    prevSmoothedCentroidRef.current,
                    thresholds
                  );
                  prevSmoothedCentroidRef.current = analysis.smoothedCentroid;
                  recognizedGesture = analysis.gesture;
                  recognizedConfidence = analysis.confidence;

                  drawHandSkeleton(ctx, handPoints, canvas.width, canvas.height, analysis.gesture, idx);
                } else {
                  drawHandSkeleton(ctx, handPoints, canvas.width, canvas.height, 'none', idx);
                }
              });
            } else {
              prevSmoothedCentroidRef.current = null;
            }
          }
        } catch (e) {}
      }
      // ENGINE 2: Classic Hands
      else if (classicHandsRef.current) {
        if (!isClassicBusyRef.current) {
          isClassicBusyRef.current = true;
          classicHandsRef.current.onResults((res: any) => {
            isClassicBusyRef.current = false;
            if (isDisposed) return;

            if (res.multiHandLandmarks && res.multiHandLandmarks.length > 0) {
              detectedHandCount = res.multiHandLandmarks.length;
              const primary = res.multiHandLandmarks[0];

              const analysis = analyzeHandLandmarks(primary, prevSmoothedCentroidRef.current, thresholds);
              prevSmoothedCentroidRef.current = analysis.smoothedCentroid;
              recognizedGesture = analysis.gesture;
              recognizedConfidence = analysis.confidence;

              drawHandSkeleton(ctx, primary, canvas.width, canvas.height, analysis.gesture, 0);
            } else {
              prevSmoothedCentroidRef.current = null;
            }
          });

          try {
            classicHandsRef.current.send({ image: video });
          } catch (e) {
            isClassicBusyRef.current = false;
          }
        }
      }

      // Execute gesture action on map
      if (detectedHandCount > 0 && recognizedGesture !== 'none') {
        executeMapGestureAction(recognizedGesture, recognizedConfidence);
        setModelStatus('gesture_recognized');
      } else if (detectedHandCount > 0) {
        setModelStatus('hand_detected');
        executeMapGestureAction('none', 0);
      } else {
        setModelStatus('waiting_hand');
        executeMapGestureAction('none', 0);
      }

      // Update global context gesture telemetry
      updateGestureState({
        currentGesture: recognizedGesture,
        confidence: Math.round(recognizedConfidence * 100),
        handDetected: detectedHandCount > 0,
        faceDetected: face.isFaceDetected,
        faceConfidence: Math.round(face.confidence * 100),
        detectedHandCount: detectedHandCount,
        trackingStatus:
          detectedHandCount > 0
            ? recognizedGesture !== 'none'
              ? 'gesture_recognized'
              : 'hand_detected'
            : 'waiting_hand',
      });

      animFrameRef.current = requestAnimationFrame(processFrame);
    };

    animFrameRef.current = requestAnimationFrame(processFrame);

    return () => {
      isDisposed = true;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [webcamStream, isVideoReady, thresholds, executeMapGestureAction, updateGestureState]);

  // Current active tile layer config
  const currentTileConfig = TILE_LAYERS.find((t) => t.id === activeLayerId) || TILE_LAYERS[0];

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Top Banner Notice: What the map can and cannot reveal */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <Info className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>
            <strong>Satellite Situational Explorer:</strong> Explore any global location with hands-free gesture control.
            Satellite photography provides historic geospatial imagery and does <em>not</em> show live pedestrians or dogs. Optical person and dog detection operates strictly within authorized CCTV video feeds.
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowLayerModal(true)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 font-hud text-[11px]"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Tile Layer Config</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* RESPONSIVE FULL-SCREEN TWO-PANEL INTERFACE (Left: Camera, Right: Map) */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[calc(100vh-210px)] min-h-[640px]">
        {/* ============================================================ */}
        {/* LEFT PANEL — Live Face and Hand Camera                       */}
        {/* ============================================================ */}
        <div className="lg:col-span-5 flex flex-col bg-[#070b14] border border-cyan-500/20 rounded-xl overflow-hidden shadow-2xl">
          {/* Left Panel Header */}
          <div className="p-3.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-400">
                <Camera className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-heading font-bold text-sm text-slate-100 flex items-center gap-2">
                  <span>Live Face & Hand Camera</span>
                  <span className="text-[10px] font-hud px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                    {activeEngine.replace('MediaPipe ', '')}
                  </span>
                </h2>
                <p className="text-[11px] text-slate-400">
                  Touchless pilot camera · Controls satellite map inside right panel
                </p>
              </div>
            </div>

            {/* Camera Enable / Disable & Retry Controls */}
            <div className="flex items-center gap-1.5">
              {gestureState.isCameraActive ? (
                <>
                  <button
                    onClick={retryWebcam}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 border border-slate-700 transition-colors"
                    title="Retry camera stream and model"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={stopWebcam}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-700 transition-colors"
                  >
                    <VideoOff className="w-3 h-3 text-rose-400" />
                    <span>Stop</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={startWebcam}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-slate-950 transition-colors font-heading shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Start Camera</span>
                </button>
              )}
            </div>
          </div>

          {/* Left Panel Status Badges Bar (Face Visible, Hand Detected, etc.) */}
          <div className="p-2.5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs font-hud">
            {/* Face Status Indicator */}
            <div className={`px-2 py-0.5 rounded border flex items-center gap-1.5 ${
              faceResult.isFaceDetected
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/40'
                : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${faceResult.isFaceDetected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></span>
              <span>{faceResult.label}</span>
            </div>

            {/* Hand Status Indicator */}
            <div className={`px-2 py-0.5 rounded border flex items-center gap-1.5 ${
              gestureState.handDetected
                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${gestureState.handDetected ? 'bg-cyan-400 animate-ping' : 'bg-slate-500'}`}></span>
              <span>{gestureState.handDetected ? `Hand Detected (${gestureState.detectedHandCount})` : 'Hand not detected'}</span>
            </div>

            {/* Current Gesture Indicator */}
            <div className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 flex items-center gap-1.5">
              <span className="text-slate-400">GESTURE:</span>
              <strong className="text-cyan-300 uppercase">
                {gestureState.currentGesture !== 'none' ? gestureState.currentGesture.replace(/_/g, ' ') : 'Neutral'}
              </strong>
            </div>
          </div>

          {/* Camera Viewport Container (Mirror-style, Visible Preview, HUD Overlays) */}
          <div className="relative flex-1 bg-slate-950 flex items-center justify-center overflow-hidden select-none min-h-[280px]">
            {gestureState.isCameraActive ? (
              <>
                {/* HTML <video> element (Always visible, -scale-x-100 mirrored) */}
                <video
                  ref={setVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`absolute inset-0 w-full h-full object-cover transform -scale-x-100 z-0 transition-opacity duration-200 ${
                    isPreviewVisible ? 'opacity-100' : 'opacity-0'
                  }`}
                />

                {/* Transparent Hand Skeleton & Face Reticle HUD Canvas Overlay */}
                <canvas
                  ref={hudCanvasRef}
                  width={640}
                  height={480}
                  className={`absolute inset-0 w-full h-full object-cover pointer-events-none z-10 ${
                    isPreviewVisible ? 'opacity-100' : 'opacity-0'
                  }`}
                />

                {/* If preview hidden */}
                {!isPreviewVisible && (
                  <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-4 text-center z-20">
                    <EyeOff className="w-8 h-8 text-slate-600 mb-2" />
                    <p className="text-xs text-slate-300 font-medium">Camera Preview Hidden</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Gesture recognition continues active in background.
                    </p>
                    <button
                      onClick={() => setIsPreviewVisible(true)}
                      className="mt-3 px-3 py-1 rounded bg-slate-800 text-cyan-300 text-xs font-hud hover:bg-slate-700"
                    >
                      Restore Preview
                    </button>
                  </div>
                )}

                {/* Model Loading Badge */}
                {modelStatus === 'loading_model' && (
                  <div className="absolute top-3 left-3 z-20 bg-slate-950/90 backdrop-blur-md px-2.5 py-1 rounded border border-cyan-500/40 text-[10px] font-hud text-cyan-300 flex items-center gap-1.5 animate-pulse">
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    <span>Loading MediaPipe Hand Model...</span>
                  </div>
                )}

                {/* Top-Right Preview Eye Toggle */}
                <button
                  onClick={() => setIsPreviewVisible(!isPreviewVisible)}
                  className="absolute top-3 right-3 z-20 p-1.5 rounded-lg bg-slate-950/80 backdrop-blur-md text-slate-300 hover:text-cyan-300 border border-slate-700 text-xs"
                  title={isPreviewVisible ? 'Hide camera preview' : 'Show camera preview'}
                >
                  {isPreviewVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>

                {/* Bottom HUD Bar inside preview */}
                <div className="absolute bottom-3 left-3 right-3 z-20 bg-slate-950/90 backdrop-blur-md p-2 rounded-lg border border-cyan-500/30 text-xs font-hud flex items-center justify-between">
                  <span className="text-slate-400 text-[11px]">
                    TARGET: <strong className="text-cyan-300 uppercase">Right Satellite Map</strong>
                  </span>
                  <span className="text-emerald-400 text-[11px] font-bold">
                    {gestureState.confidence > 0 ? `${gestureState.confidence}% Confidence` : 'Tracking Active'}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center text-slate-500">
                <Camera className="w-12 h-12 mb-3 text-slate-600" />
                <p className="text-sm font-heading font-semibold text-slate-300 mb-1">Webcam Inactive</p>
                <p className="text-xs text-slate-500 max-w-xs mb-4">
                  Enable webcam to activate live face tracking and hand gesture satellite map navigation.
                </p>
                <button
                  onClick={startWebcam}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-slate-950 transition-colors shadow-lg font-heading"
                >
                  Enable Camera Stream
                </button>
              </div>
            )}
          </div>

          {/* Left Panel Bottom Gesture Telemetry & Sensitivity Drawer */}
          <div className="p-3 bg-slate-900/90 border-t border-slate-800 space-y-2 text-xs font-hud">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-slate-500">LAST MAP ACTION:</span>
              <span className="text-cyan-300 font-semibold truncate max-w-[240px]">{lastMapActionText}</span>
            </div>

            <div className="flex items-center justify-between text-slate-400 pt-1 border-t border-slate-800/80">
              <div className="flex items-center gap-2">
                <span>GESTURE CONTROL:</span>
                <button
                  onClick={() => setIsGestureControlEnabled(!isGestureControlEnabled)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                    isGestureControlEnabled
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/40'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {isGestureControlEnabled ? 'ENABLED' : 'PAUSED'}
                </button>
              </div>

              <button
                onClick={() => setShowCalibrationDrawer(!showCalibrationDrawer)}
                className="text-cyan-400 hover:underline flex items-center gap-1 text-[11px]"
              >
                <Sliders className="w-3 h-3" />
                <span>{showCalibrationDrawer ? 'Hide Settings' : 'Sensitivity & Test'}</span>
              </button>
            </div>

            {/* Gesture Sensitivity & Calibration Drawer */}
            {showCalibrationDrawer && (
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2.5 mt-2 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-bold">Gesture Sensitivity</span>
                  <span className="text-cyan-300 font-mono">{gestureSensitivity.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={gestureSensitivity}
                  onChange={(e) => setGestureSensitivity(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-1 bg-slate-800 rounded"
                />

                {/* Instant Gesture Simulator Test Buttons */}
                <div className="pt-2 border-t border-slate-900">
                  <span className="text-[10px] text-slate-400 block mb-1.5">MANUAL GESTURE VERIFIER:</span>
                  <div className="grid grid-cols-3 gap-1 text-[10px]">
                    <button
                      onClick={() => executeMapGestureAction('pinch_zoom_in', 0.99)}
                      className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-800 flex items-center justify-center gap-1"
                    >
                      <ZoomIn className="w-3 h-3" /> Zoom In
                    </button>
                    <button
                      onClick={() => executeMapGestureAction('open_hand_zoom_out', 0.99)}
                      className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-800 flex items-center justify-center gap-1"
                    >
                      <ZoomOut className="w-3 h-3" /> Zoom Out
                    </button>
                    <button
                      onClick={() => executeMapGestureAction('pan_left', 0.99)}
                      className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 flex items-center justify-center gap-1"
                    >
                      <Move className="w-3 h-3" /> Pan Left
                    </button>
                    <button
                      onClick={() => executeMapGestureAction('pan_right', 0.99)}
                      className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 flex items-center justify-center gap-1"
                    >
                      <Move className="w-3 h-3" /> Pan Right
                    </button>
                    <button
                      onClick={() => executeMapGestureAction('pan_up', 0.99)}
                      className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 flex items-center justify-center gap-1"
                    >
                      <Move className="w-3 h-3" /> Pan Up
                    </button>
                    <button
                      onClick={() => executeMapGestureAction('pan_down', 0.99)}
                      className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 flex items-center justify-center gap-1"
                    >
                      <Move className="w-3 h-3" /> Pan Down
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ============================================================ */}
        {/* RIGHT PANEL — Interactive Satellite Map                     */}
        {/* ============================================================ */}
        <div className="lg:col-span-7 flex flex-col bg-[#070b14] border border-cyan-500/20 rounded-xl overflow-hidden shadow-2xl relative">
          {/* Right Panel Header: Location Search Bar + My Location Button */}
          <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 z-10">
            {/* Search Input Box */}
            <form onSubmit={handleSearch} className="relative flex-1 min-w-[260px]">
              <Search className="w-4 h-4 text-cyan-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search place, address, city, or coordinates (e.g. 37.7749, -122.419)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-lg pl-9 pr-20 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none font-sans"
              />
              <button
                type="submit"
                disabled={isSearching}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-semibold font-hud"
              >
                {isSearching ? '...' : 'Search'}
              </button>

              {/* Search Suggestions Dropdown */}
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-950 border border-slate-800 rounded-lg shadow-2xl z-50 max-h-56 overflow-y-auto">
                  {searchResults.map((res, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => selectLocation(res)}
                      className="w-full text-left p-2.5 hover:bg-slate-900 border-b border-slate-900 text-xs text-slate-200 flex items-start gap-2 transition-colors"
                    >
                      <Crosshair className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                      <div className="truncate">
                        <div className="font-semibold text-white truncate">{res.displayName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {res.lat.toFixed(4)}, {res.lng.toFixed(4)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </form>

            {/* My Location + Reset View + Layer Toggle Toolbar */}
            <div className="flex items-center gap-1.5">
              {/* My Location Button */}
              <button
                onClick={handleMyLocation}
                disabled={isLocating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-hud transition-colors"
                title="Center on device location via browser geolocation"
              >
                <Locate className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin text-cyan-400' : 'text-emerald-400'}`} />
                <span className="hidden sm:inline">My Location</span>
              </button>

              {/* Nearby CCTV Layer Toggle */}
              <button
                onClick={() => setShowNearbyCCTV(!showNearbyCCTV)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-hud border transition-colors ${
                  showNearbyCCTV
                    ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
                title="Toggle authorized CCTV node markers"
              >
                <Video className="w-3 h-3 text-cyan-400" />
                <span className="hidden md:inline">CCTV Nodes</span>
              </button>

              {/* Layer Selection Pill */}
              <button
                onClick={() => setShowLayerModal(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-hud"
                title="Change Map Tile Provider"
              >
                <Layers className="w-3 h-3 text-cyan-400" />
                <span className="hidden xl:inline">{currentTileConfig.type === 'satellite' ? 'Satellite' : 'Street'}</span>
              </button>

              {/* Reset View Button */}
              <button
                onClick={handleResetMap}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700"
                title="Reset Map to Default Coordinates"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Leaflet DOM Map Container (Independent Right Panel) */}
          <div ref={mapContainerRef} className="flex-1 w-full relative z-0 outline-none" />

          {/* Floating On-Map Floating Controls (Zoom Buttons & Floating HUD) */}
          <div className="absolute top-16 right-3 z-10 flex flex-col gap-1 bg-[#070b14]/90 backdrop-blur-md p-1 rounded-lg border border-slate-800 shadow-xl">
            <button
              onClick={() => handleManualZoom(1)}
              className="p-2 rounded bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-cyan-300 transition-colors"
              title="Zoom In (+1)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleManualZoom(-1)}
              className="p-2 rounded bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-cyan-300 transition-colors"
              title="Zoom Out (-1)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
          </div>

          {/* Active Gesture Map Control Overlay Indicator */}
          {gestureState.isActive && isGestureControlEnabled && (
            <div className="absolute top-16 left-3 z-10 bg-[#070b14]/95 border border-cyan-400/60 rounded-lg p-2.5 text-xs font-hud shadow-[0_0_20px_rgba(6,182,212,0.3)] pointer-events-none">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                <span className="text-cyan-300 font-bold uppercase tracking-wide">GESTURE MAP CONTROL ACTIVE</span>
              </div>
              <div className="text-slate-400 text-[10px] mt-0.5">
                Pinch = Zoom In | Open Hand = Zoom Out | Move Hand = Pan
              </div>
            </div>
          )}

          {/* Right Panel Bottom Telemetry Strip */}
          <div className="p-3 bg-[#070b14] border-t border-slate-900 flex flex-wrap items-center justify-between text-xs font-hud text-slate-400 gap-2 z-10">
            <div className="flex items-center gap-2">
              <Navigation className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="text-slate-200 font-semibold truncate max-w-sm">{selectedLocationName}</span>
            </div>

            <div className="flex items-center gap-3">
              <span>
                Coordinates: <strong className="text-white font-mono">{mapTelemetry.lat.toFixed(5)}, {mapTelemetry.lng.toFixed(5)}</strong>
              </span>
              <span className="text-slate-600">|</span>
              <span>
                Zoom: <strong className="text-cyan-400 font-mono">{mapTelemetry.zoom}x</strong>
              </span>
              <span className="text-slate-600">|</span>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-300">
                {currentTileConfig.name}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* MODAL 1: TILE LAYER SELECTION & CUSTOM SATELLITE CONFIGURATION */}
      {/* ============================================================== */}
      {showLayerModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1221] border border-cyan-500/40 rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-cyan-400" />
                <h3 className="font-heading font-bold text-slate-100 text-base">
                  Map Tile Layer & Satellite Configuration
                </h3>
              </div>
              <button
                onClick={() => setShowLayerModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-300 leading-relaxed">
                Select your preferred imagery layer. OpenStreetMap provides 100% free street tiles without any API keys. Satellite photography can be enabled via public evaluation servers or by providing your own tile template.
              </p>

              {/* Layer Options */}
              <div className="space-y-2">
                {TILE_LAYERS.map((layer) => (
                  <div
                    key={layer.id}
                    onClick={() => {
                      setActiveLayerId(layer.id);
                      addNotification(`Switched map layer to: ${layer.name}`);
                    }}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      activeLayerId === layer.id
                        ? 'bg-cyan-950/60 border-cyan-400 ring-1 ring-cyan-400'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-heading font-semibold text-xs text-slate-100">
                        {layer.name}
                      </div>
                      <span className={`text-[10px] font-hud px-1.5 py-0.5 rounded ${
                        layer.type === 'satellite'
                          ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
                          : 'bg-slate-800 text-slate-300'
                      }`}>
                        {layer.type.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                      {layer.description}
                    </p>
                  </div>
                ))}
              </div>

              {/* Custom Tile URL Section */}
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2 text-xs">
                <div className="font-semibold text-slate-200">
                  Custom Satellite Tile URL Template:
                </div>
                <input
                  type="text"
                  placeholder="https://your-tile-server/{z}/{x}/{y}.png"
                  value={customTileUrl}
                  onChange={(e) => {
                    setCustomTileUrl(e.target.value);
                    if (e.target.value.trim()) {
                      setActiveLayerId('custom');
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-400"
                />
                <p className="text-[10px] text-slate-500">
                  Supports standard XYZ Slippy Map tile format templates.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowLayerModal(false)}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold text-xs font-heading"
              >
                Apply Layer & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: DEDICATED CCTV FEED WITH PEOPLE & DOG OBJECT DETECTION */}
      {/* ============================================================== */}
      {selectedCameraForModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0b1221] border border-cyan-500/40 rounded-xl max-w-4xl w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Video className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="font-heading font-bold text-slate-100 text-base">
                    {selectedCameraForModal.name} — CCTV Optical AI Stream
                  </h3>
                  <p className="text-xs text-slate-400">
                    Location: {selectedCameraForModal.location} · COCO-SSD Optical Inference (People & Dogs)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCameraForModal(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <GestureControlledVideoPlayer
                cameraName={selectedCameraForModal.name}
                assignedConditionTitle="Tactical Security CCTV Node"
              />
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setSelectedCameraForModal(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-hud"
              >
                Close CCTV Feed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
