import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  CheckSquare,
  Compass,
  Download,
  Eye,
  EyeOff,
  Flame,
  Globe,
  Grid,
  HelpCircle,
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
  Navigation,
  Palette,
  Pause,
  Play,
  RotateCcw,
  Search,
  Share2,
  Shield,
  Sparkles,
  Square,
  SwitchCamera,
  Trash2,
  Upload,
  User,
  Users,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { Universe3DScene } from '../components/ar/Universe3DScene';
import { useARPalmTracker } from '../components/ar/useARPalmTracker';
import {
  DEFAULT_GEOGRAPHIC_TARGET,
  HOLOGRAM_THEMES,
  POPULAR_GEOGRAPHIC_PRESETS,
  PRESET_ANIME_CHARACTERS,
  UNIVERSE_SCALES,
} from '../components/ar/animeCharacters';
import {
  AnimeCharacter,
  CharacterCategory,
  CharacterFormationType,
  CharacterPlacementMode,
  GeographicLocationTarget,
  HologramColorTheme,
  UniverseScaleLevel,
} from '../components/ar/types';
import { hologramAudio } from '../components/ar/audioService';

export const ARPalmUniverseHologramPage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<Universe3DScene | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // AR Palm Tracking Hook (defaults to front camera 'user')
  const {
    videoRef,
    canvasRef,
    isCameraActive,
    facingMode,
    palmAnchor,
    cameraError,
    isModelLoaded,
    isSimulatedPalm,
    fps,
    startCamera,
    stopCamera,
    toggleFacingMode,
    setIsSimulatedPalm,
  } = useARPalmTracker();

  // Multi-Character Selection State
  // Selected IDs set
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([]);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<CharacterCategory>('all');
  const [characterFormation, setCharacterFormation] = useState<CharacterFormationType>('tiered');
  const [characterPlacement, setCharacterPlacement] = useState<CharacterPlacementMode>('in_palm');
  const [characterScale, setCharacterScale] = useState<number>(1.0);
  const [characterRotation, setCharacterRotation] = useState<number>(0);
  const [characterHeightOffset, setCharacterHeightOffset] = useState<number>(0);

  // 13 Scale Level State
  const [selectedTheme, setSelectedTheme] = useState<HologramColorTheme>('cyan');
  const [activeScale, setActiveScale] = useState<UniverseScaleLevel>('earth');
  const [zoomValue, setZoomValue] = useState<number>(2.1); // Earth scale default

  // Total Manual Control State
  const [isAutoRotate, setIsAutoRotate] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Geographic Location Target State
  const [geographicTarget, setGeographicTarget] = useState<GeographicLocationTarget>(DEFAULT_GEOGRAPHIC_TARGET);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchingLocation, setIsSearchingLocation] = useState<boolean>(false);
  const [locationStatusMessage, setLocationStatusMessage] = useState<string | null>(null);
  const [showLocationPanel, setShowLocationPanel] = useState<boolean>(false);
  const [showSatelliteHUD, setShowSatelliteHUD] = useState<boolean>(false);

  // Modals & Drawers
  const [showCharacterDrawer, setShowCharacterDrawer] = useState<boolean>(false);
  const [showThemeModal, setShowThemeModal] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [snapshotSuccess, setSnapshotSuccess] = useState<boolean>(false);

  // Touch Gesture Handling State
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number>(2.1);

  // Mouse drag handling fallback
  const isMouseDownRef = useRef<boolean>(false);
  const mousePosRef = useRef<{ x: number; y: number } | null>(null);

  // Filtered Character List based on Active Category Tab
  const filteredCharacters = PRESET_ANIME_CHARACTERS.filter((c) => {
    if (activeCategoryFilter === 'all') return true;
    return c.category === activeCategoryFilter;
  });

  // Selected Character Objects Array
  const selectedCharacters = PRESET_ANIME_CHARACTERS.filter((c) =>
    selectedCharacterIds.includes(c.id)
  );

  // 1. Initialize Three.js 3D Universe Scene
  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new Universe3DScene(containerRef.current);
    sceneRef.current = scene;

    scene.setAnimeCharacters(selectedCharacters);
    scene.setHologramTheme(selectedTheme);
    scene.setTargetZoom(zoomValue);
    scene.setAutoRotate(isAutoRotate);
    scene.setGeographicTarget(geographicTarget);
    scene.setCharacterFormation(characterFormation);

    hologramAudio.startAmbientHum();
    startCamera('user');

    return () => {
      scene.dispose();
      sceneRef.current = null;
      hologramAudio.stopAmbientHum();
      stopCamera();
    };
  }, []);

  // 2. Feed Live Hand Anchor Coordinates to 3D Scene
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.updatePalmAnchor(palmAnchor);

      const currentZoom = sceneRef.current.getTargetZoom();
      if (Math.abs(currentZoom - zoomValue) > 0.15) {
        setZoomValue(currentZoom);
        const closest = [...UNIVERSE_SCALES].sort(
          (a, b) => Math.abs(a.zoomFactor - currentZoom) - Math.abs(b.zoomFactor - currentZoom)
        )[0];
        if (closest && closest.id !== activeScale) {
          setActiveScale(closest.id);
        }
      }
    }
  }, [palmAnchor]);

  // 3. Audio Mute Sync
  useEffect(() => {
    hologramAudio.setMuted(isMuted);
  }, [isMuted]);

  // 4. Update Selected Characters in 3D Scene
  const updateSceneCharacters = (chars: AnimeCharacter[]) => {
    if (sceneRef.current) {
      sceneRef.current.setAnimeCharacters(chars);
      sceneRef.current.setCharacterPlacement(characterPlacement);
      sceneRef.current.setCharacterScale(characterScale);
      sceneRef.current.setCharacterRotation(characterRotation);
      sceneRef.current.setCharacterOffset({ x: 0, y: characterHeightOffset, z: 0 });
    }
  };

  // Toggle Single Character Selection
  const handleToggleCharacter = (charId: string) => {
    let nextIds: string[];
    if (selectedCharacterIds.includes(charId)) {
      nextIds = selectedCharacterIds.filter((id) => id !== charId);
    } else {
      nextIds = [...selectedCharacterIds, charId];
    }
    setSelectedCharacterIds(nextIds);

    const nextChars = PRESET_ANIME_CHARACTERS.filter((c) => nextIds.includes(c.id));
    updateSceneCharacters(nextChars);
    hologramAudio.playHologramClick();
  };

  // "Summon All Characters" Button (Selects All in Gallery or Category)
  const handleSummonAllCharacters = () => {
    const allIds = PRESET_ANIME_CHARACTERS.map((c) => c.id);
    setSelectedCharacterIds(allIds);
    updateSceneCharacters(PRESET_ANIME_CHARACTERS);
    hologramAudio.playAuraBurst();
  };

  // "Clear Selection" Button
  const handleClearSelection = () => {
    setSelectedCharacterIds([]);
    updateSceneCharacters([]);
    hologramAudio.playHologramClick();
  };

  // Formation change
  const handleFormationChange = (formation: CharacterFormationType) => {
    setCharacterFormation(formation);
    if (sceneRef.current) {
      sceneRef.current.setCharacterFormation(formation);
    }
    hologramAudio.playHologramClick();
  };

  // Placement change
  const handlePlacementChange = (mode: CharacterPlacementMode) => {
    setCharacterPlacement(mode);
    if (sceneRef.current) {
      sceneRef.current.setCharacterPlacement(mode);
    }
    hologramAudio.playHologramClick();
  };

  // Scale & Rotation
  const handleCharacterScaleChange = (scale: number) => {
    setCharacterScale(scale);
    if (sceneRef.current) {
      sceneRef.current.setCharacterScale(scale);
    }
  };

  const handleCharacterRotationChange = (degrees: number) => {
    setCharacterRotation(degrees);
    if (sceneRef.current) {
      sceneRef.current.setCharacterRotation(degrees);
    }
  };

  const handleHeightOffsetChange = (offsetY: number) => {
    setCharacterHeightOffset(offsetY);
    if (sceneRef.current) {
      sceneRef.current.setCharacterOffset({ x: 0, y: offsetY, z: 0 });
    }
  };

  // Import custom 3D model
  const handleCustomModelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const customImport: AnimeCharacter = {
      id: `imported_${Date.now()}`,
      name: file.name.replace(/\.[^/.]+$/, ''),
      category: 'anime',
      series: 'Custom User Asset (.glb/.gltf)',
      title: 'Imported 3D Model',
      quote: 'Loaded from local device into your hand AR formation!',
      auraType: 'pure_magic',
      auraColor: 0x00f0ff,
      primaryColor: 0x38bdf8,
      secondaryColor: 0x818cf8,
      accentColor: 0xfacc15,
      pose: 'heroic',
      energyPower: 99,
      sizeTier: 'medium',
      signatureObject: 'imported_3d',
      avatarEmoji: '📦',
      isImported: true,
      modelUrl: url,
    };

    PRESET_ANIME_CHARACTERS.unshift(customImport);
    handleToggleCharacter(customImport.id);
  };

  // Scale Jump Handler
  const handleScaleSelect = (scaleId: UniverseScaleLevel) => {
    setActiveScale(scaleId);
    const scaleObj = UNIVERSE_SCALES.find((s) => s.id === scaleId);
    if (scaleObj && sceneRef.current) {
      sceneRef.current.setTargetZoom(scaleObj.zoomFactor);
      setZoomValue(scaleObj.zoomFactor);
      hologramAudio.playScaleChime(scaleObj.zoomFactor > zoomValue ? 'in' : 'out');
    }
  };

  const handleZoomSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setZoomValue(val);
    if (sceneRef.current) {
      sceneRef.current.setTargetZoom(val);
    }

    const closest = [...UNIVERSE_SCALES].sort(
      (a, b) => Math.abs(a.zoomFactor - val) - Math.abs(b.zoomFactor - val)
    )[0];
    if (closest && closest.id !== activeScale) {
      setActiveScale(closest.id);
    }
  };

  const handleStepZoom = (direction: 'in' | 'out') => {
    const currentIdx = UNIVERSE_SCALES.findIndex((s) => s.id === activeScale);
    if (direction === 'in' && currentIdx > 0) {
      handleScaleSelect(UNIVERSE_SCALES[currentIdx - 1].id);
    } else if (direction === 'out' && currentIdx < UNIVERSE_SCALES.length - 1) {
      handleScaleSelect(UNIVERSE_SCALES[currentIdx + 1].id);
    }
  };

  // Pause & Reset
  const togglePause = () => {
    const next = !isPaused;
    setIsPaused(next);
    if (sceneRef.current) {
      sceneRef.current.setPaused(next);
    }
    hologramAudio.playHologramClick();
  };

  const toggleAutoRotate = () => {
    const next = !isAutoRotate;
    setIsAutoRotate(next);
    if (sceneRef.current) {
      sceneRef.current.setAutoRotate(next);
    }
    hologramAudio.playHologramClick();
  };

  const handleResetView = () => {
    if (sceneRef.current) {
      sceneRef.current.resetView();
    }
    setZoomValue(2.1);
    setActiveScale('earth');
    setIsPaused(false);
    setIsAutoRotate(false);
    setCharacterRotation(0);
    setCharacterScale(1.0);
    setCharacterHeightOffset(0);
    hologramAudio.playScaleChime('out');
  };

  // "My Location" GPS Geolocation Request
  const handleRequestMyLocation = () => {
    setLocationStatusMessage('Acquiring high-precision GPS satellite fix...');
    setIsSearchingLocation(true);

    if (!navigator.geolocation) {
      setLocationStatusMessage('Geolocation not supported by this browser. Use manual search below.');
      setIsSearchingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setLocationStatusMessage(`GPS Coordinates resolved: [${lat.toFixed(4)}°, ${lon.toFixed(4)}°]. Resolving address...`);

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`
          );
          const data = await res.json();
          const addr = data.address || {};
          const target: GeographicLocationTarget = {
            name: data.display_name?.split(',')[0] || 'My GPS Location',
            street: addr.road || addr.pedestrian || addr.suburb || 'Current Street',
            neighbourhood: addr.neighbourhood || addr.suburb || addr.quarter || 'Local Zone',
            city: addr.city || addr.town || addr.village || 'Local City',
            district: addr.county || addr.state_district || 'District',
            state: addr.state || 'Tamil Nadu',
            country: addr.country || 'India',
            continent: 'Asia',
            latitude: lat,
            longitude: lon,
            source: 'gps',
            accuracyMeters: pos.coords.accuracy,
          };

          setGeographicTarget(target);
          if (sceneRef.current) {
            sceneRef.current.setGeographicTarget(target);
          }
          setLocationStatusMessage(`Target locked: ${target.city}, ${target.state}, ${target.country}`);
          setShowLocationPanel(false);
          hologramAudio.playScaleChime('in');
        } catch {
          const fallbackTarget: GeographicLocationTarget = {
            name: `GPS Point (${lat.toFixed(3)}°, ${lon.toFixed(3)}°)`,
            street: 'Local Street Position',
            neighbourhood: 'Local Area',
            city: 'My Location',
            district: 'Local District',
            state: 'Tamil Nadu',
            country: 'India',
            continent: 'Asia',
            latitude: lat,
            longitude: lon,
            source: 'gps',
          };
          setGeographicTarget(fallbackTarget);
          if (sceneRef.current) {
            sceneRef.current.setGeographicTarget(fallbackTarget);
          }
          setLocationStatusMessage('GPS coordinates locked successfully.');
        } finally {
          setIsSearchingLocation(false);
        }
      },
      (err) => {
        console.warn('Geolocation permission denied or timed out:', err);
        setLocationStatusMessage('Location access denied. Please select from popular presets or type any city/street below.');
        setIsSearchingLocation(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Manual Location Search
  const handleSearchLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearchingLocation(true);
    setLocationStatusMessage(`Searching OpenStreetMap for "${searchQuery}"...`);

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&addressdetails=1&limit=1`
      );
      const results = await res.json();

      if (results && results.length > 0) {
        const item = results[0];
        const addr = item.address || {};
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);

        const newTarget: GeographicLocationTarget = {
          name: item.display_name?.split(',')[0] || searchQuery,
          street: addr.road || addr.pedestrian || searchQuery,
          neighbourhood: addr.neighbourhood || addr.suburb || 'Central Area',
          city: addr.city || addr.town || addr.municipality || 'Urban Zone',
          district: addr.county || addr.state_district || 'District',
          state: addr.state || 'Tamil Nadu',
          country: addr.country || 'India',
          continent: 'Asia',
          latitude: lat,
          longitude: lon,
          source: 'search',
        };

        setGeographicTarget(newTarget);
        if (sceneRef.current) {
          sceneRef.current.setGeographicTarget(newTarget);
        }
        setLocationStatusMessage(`Location locked: ${newTarget.name}`);
        setSearchQuery('');
        setShowLocationPanel(false);
        hologramAudio.playScaleChime('in');
      } else {
        setLocationStatusMessage(`No results found for "${searchQuery}". Try a major city or preset.`);
      }
    } catch {
      setLocationStatusMessage('Network error querying location. Try selecting a preset below.');
    } finally {
      setIsSearchingLocation(false);
    }
  };

  // Touch Gesture Handlers (1-finger drag rotate, 2-finger zoom)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDistRef.current = Math.sqrt(dx * dx + dy * dy);
      pinchStartZoomRef.current = zoomValue;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && touchStartRef.current && sceneRef.current) {
      const dx = e.touches[0].clientX - touchStartRef.current.x;
      const dy = e.touches[0].clientY - touchStartRef.current.y;
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };

      sceneRef.current.addRotation(dy * 0.008, dx * 0.008);
      setCharacterRotation((prev) => (prev + dx * 0.5 + 360) % 360);
    } else if (e.touches.length === 2 && pinchStartDistRef.current !== null && sceneRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const currentDist = Math.sqrt(dx * dx + dy * dy);
      const ratio = currentDist / pinchStartDistRef.current;
      const nextZoom = Math.min(8.5, Math.max(0.2, pinchStartZoomRef.current * ratio));

      setZoomValue(nextZoom);
      sceneRef.current.setTargetZoom(nextZoom);

      const closest = [...UNIVERSE_SCALES].sort(
        (a, b) => Math.abs(a.zoomFactor - nextZoom) - Math.abs(b.zoomFactor - nextZoom)
      )[0];
      if (closest && closest.id !== activeScale) {
        setActiveScale(closest.id);
      }
    }
  };

  const handleTouchEnd = () => {
    touchStartRef.current = null;
    pinchStartDistRef.current = null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    isMouseDownRef.current = true;
    mousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDownRef.current || !mousePosRef.current || !sceneRef.current) return;
    const dx = e.clientX - mousePosRef.current.x;
    const dy = e.clientY - mousePosRef.current.y;
    mousePosRef.current = { x: e.clientX, y: e.clientY };
    sceneRef.current.addRotation(dy * 0.007, dx * 0.007);
    setCharacterRotation((prev) => (prev + dx * 0.4 + 360) % 360);
  };

  const handleMouseUp = () => {
    isMouseDownRef.current = false;
    mousePosRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY * -0.003;
    const nextZoom = Math.min(8.5, Math.max(0.2, zoomValue + delta));
    setZoomValue(nextZoom);
    if (sceneRef.current) {
      sceneRef.current.setTargetZoom(nextZoom);
    }
  };

  // Snapshot photo capture
  const handleCaptureSnapshot = () => {
    if (!sceneRef.current) return;
    hologramAudio.playHologramClick();

    const sceneCanvas = sceneRef.current.getCanvas();
    const compositeCanvas = document.createElement('canvas');
    compositeCanvas.width = sceneCanvas.width;
    compositeCanvas.height = sceneCanvas.height;
    const ctx = compositeCanvas.getContext('2d');
    if (!ctx) return;

    if (isCameraActive && videoRef.current) {
      try {
        ctx.drawImage(videoRef.current, 0, 0, compositeCanvas.width, compositeCanvas.height);
      } catch {}
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, compositeCanvas.height);
      grad.addColorStop(0, '#020617');
      grad.addColorStop(1, '#0b1329');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, compositeCanvas.width, compositeCanvas.height);
    }

    ctx.drawImage(sceneCanvas, 0, 0);

    ctx.fillStyle = '#00f0ff';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('AURAVERSE-UNI // MULTI-CHARACTER AR PALM UNIVERSE', 24, compositeCanvas.height - 30);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px monospace';
    ctx.fillText(
      `${selectedCharacters.length}/${PRESET_ANIME_CHARACTERS.length} Characters Summoned • ${activeScale.toUpperCase()}`,
      24,
      compositeCanvas.height - 14
    );

    const a = document.createElement('a');
    a.download = `auriverse_palm_characters_${Date.now()}.png`;
    a.href = compositeCanvas.toDataURL('image/png');
    a.click();

    setSnapshotSuccess(true);
    setTimeout(() => setSnapshotSuccess(false), 2500);
  };

  const activeScaleInfo = UNIVERSE_SCALES.find((s) => s.id === activeScale) || UNIVERSE_SCALES[5];
  const totalCount = PRESET_ANIME_CHARACTERS.length;
  const summonedCount = selectedCharacters.length;

  return (
    <div
      className={`relative w-full min-h-[calc(100vh-110px)] bg-slate-950 select-none overflow-hidden rounded-2xl border border-cyan-500/30 flex flex-col ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none border-none min-h-screen' : ''
      }`}
    >
      {/* 1. FRONT CAMERA FEED (MAIN BACKGROUND) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-500 ${
          isCameraActive ? 'opacity-90' : 'opacity-0 pointer-events-none'
        }`}
        style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
      />

      {/* 2. 2D AR CYBER RETICLE CANVAS OVERLAY */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full object-cover z-10 pointer-events-none ${
          facingMode === 'user' ? '-scale-x-100' : ''
        }`}
      />

      {/* 3. THREE.JS 3D UNIVERSE & MULTI-CHARACTER CANVAS VIEWPORT */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        className="absolute inset-0 w-full h-full z-20 cursor-grab active:cursor-grabbing touch-none"
      />

      {/* 4. TOP HUD BAR: BRANDING, STATUS, CONTROLS */}
      <header className="relative z-30 p-3 sm:p-4 flex flex-wrap items-center justify-between gap-2.5 bg-gradient-to-b from-slate-950/90 via-slate-950/60 to-transparent backdrop-blur-sm border-b border-cyan-500/20">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-500/20 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
            <Sparkles className="w-5 h-5 text-cyan-300 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading font-black text-lg sm:text-xl text-slate-100 tracking-wide">
                AURAVERSE-UNI
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/40">
                MULTI-CHARACTER AR PALM
              </span>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
              <span className="text-cyan-300 font-mono font-bold">
                {summonedCount}/{totalCount} Characters Summoned
              </span>
              <span className="text-slate-600">•</span>
              <span>{geographicTarget.city}, {geographicTarget.state}</span>
            </p>
          </div>
        </div>

        {/* Live Tracking HUD Badges */}
        <div className="flex items-center flex-wrap gap-2 text-xs font-mono">
          {/* Hand Palm Tracking Status */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border backdrop-blur-md ${
              palmAnchor?.detected
                ? palmAnchor.isStationary
                  ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                  : 'bg-cyan-950/70 border-cyan-500/40 text-cyan-300'
                : 'bg-slate-900/80 border-slate-700 text-slate-400'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                palmAnchor?.detected
                  ? palmAnchor.isStationary
                    ? 'bg-emerald-400 animate-pulse'
                    : 'bg-cyan-400'
                  : 'bg-slate-500'
              }`}
            />
            <span>
              {palmAnchor?.detected
                ? palmAnchor.isTwoHanded
                  ? '2 HANDS TRACKED'
                  : palmAnchor.isStationary
                  ? 'PALM STILL (STOPPED)'
                  : 'PALM ANCHORED'
                : isSimulatedPalm
                ? 'VIRTUAL PALM'
                : 'WAITING FOR HAND'}
            </span>
          </div>

          {/* Camera Trigger & Flip */}
          <button
            onClick={() => (isCameraActive ? stopCamera() : startCamera('user'))}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
              isCameraActive
                ? 'bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold border-cyan-400'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isCameraActive ? 'Camera ON' : 'Start Front Camera'}</span>
          </button>

          {isCameraActive && (
            <button
              onClick={toggleFacingMode}
              className="p-1.5 rounded-lg bg-slate-900/80 border border-slate-700 text-slate-300 hover:text-white"
              title="Flip camera between Front and Back"
            >
              <SwitchCamera className="w-3.5 h-3.5 text-cyan-400" />
            </button>
          )}

          {/* Quick Summon All Action */}
          <button
            onClick={handleSummonAllCharacters}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold border border-indigo-400 shadow-[0_0_12px_rgba(99,102,241,0.3)] transition-all"
            title="Summon all 42 characters in palm"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Summon All ({totalCount})</span>
          </button>

          {/* Character Gallery Drawer Trigger */}
          <button
            onClick={() => setShowCharacterDrawer(true)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-semibold transition-all ${
              summonedCount > 0
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400'
                : 'bg-slate-900 text-slate-300 border-slate-700'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            <span>Select Characters ({summonedCount})</span>
          </button>
        </div>
      </header>

      {/* 5. MULTI-CHARACTER FORMATION FLOATING CONTROLS */}
      {summonedCount > 0 && (
        <div className="absolute top-20 right-4 z-30 bg-slate-900/90 border border-indigo-500/40 rounded-xl p-3 backdrop-blur-md shadow-xl text-xs space-y-2.5 max-w-[270px]">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
            <div className="flex items-center gap-1.5 text-indigo-300 font-bold">
              <Users className="w-4 h-4 text-indigo-400" />
              <span>{summonedCount} Characters in Palm</span>
            </div>
            <button
              onClick={handleClearSelection}
              className="text-slate-400 hover:text-rose-400 p-0.5"
              title="Clear all characters"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Formation Layout Selector */}
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-mono">Formation Style:</span>
            <div className="grid grid-cols-3 gap-1 text-[10px]">
              {(['tiered', 'ring', 'orbit_earth'] as CharacterFormationType[]).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => handleFormationChange(fmt)}
                  className={`py-1 rounded text-center border font-medium ${
                    characterFormation === fmt
                      ? 'bg-indigo-600 text-white border-indigo-400'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  {fmt === 'tiered' ? 'Tiered' : fmt === 'ring' ? 'Cosmic Ring' : 'Orbit Earth'}
                </button>
              ))}
            </div>
          </div>

          {/* Scale Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>Group Scale</span>
              <span>{characterScale.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.3"
              max="2.5"
              step="0.1"
              value={characterScale}
              onChange={(e) => handleCharacterScaleChange(parseFloat(e.target.value))}
              className="w-full accent-indigo-400 h-1 bg-slate-800 rounded cursor-pointer"
            />
          </div>

          {/* Height Float Distance Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>Float Elevation</span>
              <span>{characterHeightOffset > 0 ? `+${characterHeightOffset.toFixed(1)}` : characterHeightOffset.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="-0.5"
              max="0.8"
              step="0.05"
              value={characterHeightOffset}
              onChange={(e) => handleHeightOffsetChange(parseFloat(e.target.value))}
              className="w-full accent-cyan-400 h-1 bg-slate-800 rounded cursor-pointer"
            />
          </div>

          {/* Rotation Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>Formation Rotation</span>
              <span>{Math.round(characterRotation)}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="360"
              step="10"
              value={characterRotation}
              onChange={(e) => handleCharacterRotationChange(parseInt(e.target.value, 10))}
              className="w-full accent-indigo-400 h-1 bg-slate-800 rounded cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* 6. LEFT FLOATING CONTROL HUD: PAUSE, RESET, THEME, LOCATION */}
      <div className="absolute left-4 top-20 z-30 flex flex-col gap-2">
        {/* Pause / Resume */}
        <button
          onClick={togglePause}
          className={`p-2.5 rounded-xl border backdrop-blur-md transition-all ${
            isPaused
              ? 'bg-amber-500/20 text-amber-300 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
              : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:text-white'
          }`}
          title={isPaused ? 'Resume Motion' : 'Pause Hologram'}
        >
          {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
        </button>

        {/* Reset View */}
        <button
          onClick={handleResetView}
          className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/40 backdrop-blur-md"
          title="Reset Universe & Characters to Palm Center"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Auto Rotate Toggle */}
        <button
          onClick={toggleAutoRotate}
          className={`p-2.5 rounded-xl border backdrop-blur-md transition-all ${
            isAutoRotate
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
              : 'bg-slate-900/80 text-slate-400 border-slate-700 hover:text-white'
          }`}
          title={isAutoRotate ? 'Auto-Rotate ON' : 'Hologram Still (Manual Control)'}
        >
          <Compass className="w-4 h-4" />
        </button>

        {/* Location Explorer Button */}
        <button
          onClick={() => setShowLocationPanel(!showLocationPanel)}
          className={`p-2.5 rounded-xl border backdrop-blur-md transition-all ${
            showLocationPanel
              ? 'bg-cyan-600 text-slate-950 font-bold border-cyan-400'
              : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:text-cyan-300'
          }`}
          title="My Location & City Exploration"
        >
          <MapPin className="w-4 h-4" />
        </button>

        {/* Hologram Theme Selector */}
        <button
          onClick={() => setShowThemeModal(true)}
          className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-300 hover:text-purple-300 hover:border-purple-500/40 backdrop-blur-md"
          title="Hologram Color Themes"
        >
          <Palette className="w-4 h-4" />
        </button>

        {/* Audio Mute */}
        <button
          onClick={() => setIsMuted(!isMuted)}
          className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-300 hover:text-white backdrop-blur-md"
          title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* Snapshot Capture */}
        <button
          onClick={handleCaptureSnapshot}
          className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-300 hover:text-cyan-400 backdrop-blur-md"
          title="Capture AR Photo"
        >
          <Download className="w-4 h-4" />
        </button>

        {/* Help & Gesture Guide */}
        <button
          onClick={() => setShowHelpModal(true)}
          className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-300 hover:text-white backdrop-blur-md"
          title="Gesture Guide"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>

      {/* 7. LOCATION TARGET SEARCH & GPS MODAL */}
      {showLocationPanel && (
        <div className="absolute top-20 left-16 z-40 w-80 sm:w-96 bg-slate-900/95 border border-cyan-500/40 rounded-xl p-4 shadow-2xl backdrop-blur-xl text-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2 text-cyan-300 font-bold">
              <MapPin className="w-4 h-4 text-cyan-400" />
              <span>Target Geographic Destination</span>
            </div>
            <button onClick={() => setShowLocationPanel(false)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleRequestMyLocation}
            disabled={isSearchingLocation}
            className="w-full py-2 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-bold flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
          >
            <Navigation className="w-4 h-4" />
            <span>Request My GPS Location</span>
          </button>

          <form onSubmit={handleSearchLocation} className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search e.g. Chennai, Tamil Nadu, Delhi..."
              className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 text-xs"
            />
            <button
              type="submit"
              disabled={isSearchingLocation}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 font-medium border border-slate-700"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          </form>

          {locationStatusMessage && (
            <p className="text-[11px] font-mono text-cyan-300 bg-cyan-950/60 p-2 rounded border border-cyan-800">
              {locationStatusMessage}
            </p>
          )}

          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
              Quick Destination Presets
            </span>
            <div className="grid grid-cols-1 gap-1">
              {POPULAR_GEOGRAPHIC_PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => {
                    setGeographicTarget(p);
                    if (sceneRef.current) sceneRef.current.setGeographicTarget(p);
                    setShowLocationPanel(false);
                    hologramAudio.playScaleChime('in');
                  }}
                  className={`text-left px-2.5 py-1.5 rounded text-xs transition-colors border ${
                    geographicTarget.name === p.name
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-[10px] text-slate-400">{p.street}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 8. BOTTOM NAVIGATION HIERARCHY BAR: STREET TO DEEP UNIVERSE */}
      <footer className="relative z-30 p-3 sm:p-4 bg-gradient-to-t from-slate-950/95 via-slate-950/80 to-transparent backdrop-blur-md border-t border-cyan-500/20 mt-auto space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono text-cyan-400 font-bold text-sm">
              [{activeScaleInfo.levelIndex}/13]
            </span>
            <span className="text-slate-100 font-semibold font-heading text-sm">
              {activeScaleInfo.name}
            </span>
            <span className="text-slate-500 font-mono">({activeScaleInfo.label})</span>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
            <span>{summonedCount > 0 ? `${summonedCount} Characters Active` : 'No Characters Summoned'}</span>
            <span className="text-slate-600">•</span>
            <span className="text-cyan-300">{geographicTarget.name}</span>
          </div>
        </div>

        {/* Scale Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => handleStepZoom('out')}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-cyan-300 font-bold text-xs shrink-0"
            title="Zoom Out towards Space"
          >
            Zoom Out ▲
          </button>

          {UNIVERSE_SCALES.map((scale) => {
            const isActive = scale.id === activeScale;
            return (
              <button
                key={scale.id}
                onClick={() => handleScaleSelect(scale.id)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-all border ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 font-bold shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                    : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <span>{scale.name}</span>
              </button>
            );
          })}

          <button
            onClick={() => handleStepZoom('in')}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-cyan-300 font-bold text-xs shrink-0"
            title="Zoom In towards Street"
          >
            Zoom In ▼
          </button>
        </div>

        {/* Smooth Zoom Slider */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-slate-400 shrink-0 hidden sm:inline">
            COSMIC ZOOM
          </span>
          <input
            type="range"
            min="0.25"
            max="8.0"
            step="0.05"
            value={zoomValue}
            onChange={handleZoomSliderChange}
            className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
          <span className="text-[11px] font-mono text-cyan-300 shrink-0">
            {zoomValue.toFixed(2)}x
          </span>
        </div>
      </footer>

      {/* 9. CHARACTER GALLERY DRAWER (MULTI-SELECT & SUMMON ALL) */}
      {showCharacterDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex justify-end">
          <div className="w-full max-w-xl bg-slate-900 border-l border-cyan-500/30 flex flex-col h-full shadow-2xl animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/40 text-indigo-300">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-heading font-bold text-slate-100 text-base flex items-center gap-2">
                    <span>Character Selection Gallery</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                      {summonedCount}/{totalCount} Summoned
                    </span>
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Select any character or summon all together as a 3D hologram universe in your palm
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCharacterDrawer(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Category Tabs: All, Anime, Pokémon, Cartoons */}
            <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-2 overflow-x-auto scrollbar-none">
              <div className="flex items-center gap-1">
                {(
                  [
                    { id: 'all', label: `All (${totalCount})` },
                    { id: 'anime', label: 'Anime (14)' },
                    { id: 'pokemon', label: 'Pokémon (14)' },
                    { id: 'cartoons', label: 'Cartoons (14)' },
                  ] as { id: CharacterCategory; label: string }[]
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveCategoryFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
                      activeCategoryFilter === tab.id
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Import 3D Model button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-950 border border-indigo-500/40 text-indigo-200 hover:text-white text-xs font-semibold shrink-0"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden sm:inline">Import 3D</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".glb,.gltf"
                onChange={handleCustomModelUpload}
                className="hidden"
              />
            </div>

            {/* Quick Batch Actions: Summon All & Clear Selection */}
            <div className="p-3 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between gap-3 text-xs">
              <button
                onClick={handleSummonAllCharacters}
                className="flex-1 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(99,102,241,0.3)]"
              >
                <Zap className="w-4 h-4" />
                <span>Summon All Characters ({totalCount})</span>
              </button>

              <button
                onClick={handleClearSelection}
                disabled={summonedCount === 0}
                className="py-2 px-3 rounded-lg bg-slate-950 hover:bg-slate-800 disabled:opacity-40 text-rose-300 border border-slate-700 font-semibold flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Selection</span>
              </button>
            </div>

            {/* Character Cards Grid */}
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredCharacters.map((char) => {
                const isSelected = selectedCharacterIds.includes(char.id);
                return (
                  <div
                    key={char.id}
                    onClick={() => handleToggleCharacter(char.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-indigo-950/50 border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.3)]'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-xl shrink-0 shadow-inner">
                            {char.avatarEmoji}
                          </div>
                          <div>
                            <h3 className="font-heading font-bold text-slate-100 text-sm">
                              {char.name}
                            </h3>
                            <p className="text-[10px] text-indigo-300 font-medium">
                              {char.series}
                            </p>
                          </div>
                        </div>

                        {/* Checkbox indicator */}
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-400 text-white'
                              : 'border-slate-700 bg-slate-900 text-transparent'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      </div>

                      <p className="text-[10px] text-slate-300 italic mt-2 line-clamp-2">
                        "{char.quote}"
                      </p>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono">
                      <span className="text-slate-400 uppercase">
                        {char.category}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded font-bold ${
                          isSelected
                            ? 'bg-indigo-500/30 text-indigo-200'
                            : 'text-slate-500'
                        }`}
                      >
                        {isSelected ? 'In Palm ✓' : '+ Tap to Add'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer Summary & Done button */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              <div className="text-xs">
                <span className="text-slate-400">Summoned: </span>
                <span className="text-cyan-300 font-bold font-mono">
                  {summonedCount} / {totalCount} Characters
                </span>
              </div>
              <button
                onClick={() => setShowCharacterDrawer(false)}
                className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs shadow-lg"
              >
                Place Formation in Hand ({summonedCount})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. HOLOGRAM COLOR THEME MODAL */}
      {showThemeModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-purple-500/40 rounded-2xl p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-purple-300 font-bold">
                <Palette className="w-4 h-4 text-purple-400" />
                <span>Hologram Color Themes</span>
              </div>
              <button onClick={() => setShowThemeModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {HOLOGRAM_THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelectedTheme(t.id);
                    if (sceneRef.current) sceneRef.current.setHologramTheme(t.id);
                    setShowThemeModal(false);
                    hologramAudio.playHologramClick();
                  }}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                    selectedTheme === t.id
                      ? 'bg-slate-800 border-cyan-400 text-white font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-4 h-4 rounded-full border border-white/40"
                      style={{ backgroundColor: `#${t.primaryHex.toString(16).padStart(6, '0')}` }}
                    />
                    <span className="text-xs">{t.name}</span>
                  </div>
                  {selectedTheme === t.id && <span className="text-xs text-cyan-400">Active</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 11. GESTURE & MANUAL CONTROL GUIDE MODAL */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-cyan-500/40 rounded-2xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-cyan-300 font-bold">
                <HelpCircle className="w-5 h-5 text-cyan-400" />
                <span>Multi-Character AR Palm Navigation</span>
              </div>
              <button onClick={() => setShowHelpModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <h4 className="font-bold text-cyan-400">Multi-Character Hand Hologram:</h4>
                <p className="text-[11px] text-slate-400">
                  Select as many characters as you want or press <strong>"Summon All Characters"</strong>. They appear as a miniature 3D tiered formation, cosmic ring, or orbit around Earth in your open palm.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <h4 className="font-bold text-slate-100">Hand Gestures:</h4>
                <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
                  <li><strong className="text-cyan-300">Open Palm:</strong> Anchors the entire 3D character formation directly in your palm.</li>
                  <li><strong className="text-cyan-300">Spread Two Hands:</strong> Zooms in smoothly.</li>
                  <li><strong className="text-cyan-300">Bring Two Hands Together:</strong> Zooms out to space.</li>
                  <li><strong className="text-cyan-300">Tilt Hand:</strong> Rotates the character group in 360°.</li>
                  <li><strong className="text-cyan-300">Stop Hand Moving:</strong> The hologram stops completely.</li>
                </ul>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <h4 className="font-bold text-slate-100">Touch & Screen Controls:</h4>
                <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
                  <li><strong className="text-cyan-300">1-Finger Drag:</strong> Freely rotates the formation.</li>
                  <li><strong className="text-cyan-300">Pinch-to-Zoom:</strong> Zooms the universe scales.</li>
                  <li><strong className="text-cyan-300">Group Scale Slider:</strong> Shrinks or expands the characters.</li>
                  <li><strong className="text-cyan-300">Float Elevation:</strong> Adjusts height above the palm.</li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => setShowHelpModal(false)}
              className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs"
            >
              Got It, Return to Hologram
            </button>
          </div>
        </div>
      )}

      {/* Snapshot Success Notification */}
      {snapshotSuccess && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 px-4 py-2 rounded-xl text-xs font-mono shadow-2xl flex items-center gap-2 animate-bounce">
          <span>✓</span>
          <span>AR Hologram Photo Downloaded!</span>
        </div>
      )}
    </div>
  );
};
