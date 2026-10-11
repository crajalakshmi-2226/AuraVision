import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Compass,
  Dog,
  Expand,
  Eye,
  Hand,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  User,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
  Move,
  CheckCircle2,
  HelpCircle,
  X,
  Crosshair,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DetectedObject } from '../../types';
import {
  detectPeopleAndDogsInVideo,
  initObjectDetectionModel,
  getModelStatus,
  isModelReady,
} from './VideoObjectDetectionService';

interface VideoPlayerProps {
  videoSrc?: string;
  isCustomUpload?: boolean;
  onRemoveUpload?: () => void;
  assignedConditionTitle?: string;
  cameraName?: string;
}

export const GestureControlledVideoPlayer: React.FC<VideoPlayerProps> = ({
  videoSrc,
  isCustomUpload = false,
  onRemoveUpload,
  assignedConditionTitle = 'Corridor Activity & Safety Monitoring',
  cameraName = 'Main Corridor Camera (Node 01)',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    videoTransform,
    updateVideoTransform,
    resetVideoTransform,
    gestureState,
    updateGestureState,
    addNotification,
  } = useApp();

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(30);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [videoLoadError, setVideoLoadError] = useState<boolean>(false);
  const [useProceduralStream, setUseProceduralStream] = useState<boolean>(false);

  // Optical Object Detection (People & Dogs) State
  const [enableObjectDetection, setEnableObjectDetection] = useState<boolean>(true);
  const [modelStatus, setModelStatus] = useState<'ready' | 'loading' | 'unavailable' | 'error'>('loading');
  const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [showModelGuide, setShowModelGuide] = useState<boolean>(false);
  const [isRealModelActive, setIsRealModelActive] = useState<boolean>(false);
  const [engineInfoText, setEngineInfoText] = useState<string>('Initializing optical neural network...');

  // Optional benchmark synthetic targets toggle (ONLY used when explicitly requested by user in offline demo mode)
  const [showSyntheticBenchmark, setShowSyntheticBenchmark] = useState<boolean>(false);

  // Reliable public domain / open sample surveillance video clip
  const sampleVideoUrl =
    videoSrc || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

  // Procedural Canvas Animation for offline fallback
  useEffect(() => {
    if (!useProceduralStream && !videoLoadError) return;

    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pedestrians = [
      { x: 70, y: 180, speed: 1.1, dir: 1, label: 'Person', conf: 92.4 },
      { x: 300, y: 190, speed: 0.9, dir: -1, label: 'Person', conf: 89.1 },
    ];

    let frame = 0;

    const render = () => {
      frame++;
      ctx.fillStyle = '#070b14';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Floor & Corridor perspective lines
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      for (let i = 0; i < canvas.width; i += 40) {
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2, 70);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }

      // Walls
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 75, canvas.height);
      ctx.fillRect(canvas.width - 75, 0, 75, canvas.height);

      // Timestamp overlay
      ctx.fillStyle = '#22d3ee';
      ctx.font = '10px monospace';
      const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
      ctx.fillText(`CAM-01 [LOCAL SYNTHETIC FEED] · ${nowStr}`, 90, 25);
      ctx.fillText(`STATUS: 30 FPS · ACTIVE SIMULATION`, 90, 40);

      // Render pedestrian figures
      pedestrians.forEach((p) => {
        p.x += p.speed * p.dir;
        if (p.x > canvas.width - 110) p.dir = -1;
        if (p.x < 90) p.dir = 1;

        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.arc(p.x + 12, p.y - 30, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(p.x + 6, p.y - 20, 12, 28);
        ctx.fillRect(p.x + 3, p.y + 8, 7, 24);
        ctx.fillRect(p.x + 14, p.y + 8, 7, 24);
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [useProceduralStream, videoLoadError]);

  // Video element event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => {
      setDuration(video.duration || 30);
      setVideoLoadError(false);
    };
    const handleError = () => {
      console.warn('Video failed to load from remote CDN, activating procedural canvas stream.');
      setVideoLoadError(true);
      setUseProceduralStream(true);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('error', handleError);
    };
  }, [sampleVideoUrl]);

  // Playback control toggles
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Manual transform adjustments (accessible buttons for zoom and pan)
  const handleManualZoomIn = () => {
    updateVideoTransform((prev) => ({ ...prev, zoom: Math.min(4.0, prev.zoom + 0.25) }));
  };

  const handleManualZoomOut = () => {
    updateVideoTransform((prev) => ({ ...prev, zoom: Math.max(1.0, prev.zoom - 0.25) }));
  };

  const handleManualPan = (dx: number, dy: number) => {
    updateVideoTransform((prev) => ({ ...prev, panX: prev.panX + dx, panY: prev.panY + dy }));
  };

  // Center pan directly onto selected object in viewport
  const focusOnObject = (obj: DetectedObject) => {
    const video = videoRef.current;
    const vw = video?.videoWidth || 640;
    const vh = video?.videoHeight || 360;

    const centerX = obj.bbox[0] + obj.bbox[2] / 2;
    const centerY = obj.bbox[1] + obj.bbox[3] / 2;

    const targetPanX = -((centerX - vw / 2) / (vw / 2)) * 120;
    const targetPanY = -((centerY - vh / 2) / (vh / 2)) * 90;

    updateVideoTransform((prev) => ({
      ...prev,
      zoom: Math.max(1.75, prev.zoom),
      panX: targetPanX,
      panY: targetPanY,
    }));
    addNotification(`Centered CCTV viewport on ${obj.class.toUpperCase()} (${obj.score}% confidence)`);
  };

  // Initialize COCO-SSD Object Detection Model on component mount
  const handleInitModel = async () => {
    setModelStatus('loading');
    setEngineInfoText('Downloading MobileNet v2 neural network weights...');
    const res = await initObjectDetectionModel();
    if (res.success) {
      setModelStatus('ready');
      setIsRealModelActive(true);
      setEngineInfoText('COCO-SSD Optical Neural Network active (inferencing people and dogs)');
      addNotification('COCO-SSD model initialized successfully for client-side object detection.');
    } else {
      setModelStatus('unavailable');
      setIsRealModelActive(false);
      setEngineInfoText(res.error || 'Model weights unavailable. Check network or view setup guide.');
      addNotification('COCO-SSD model initialization paused: ' + (res.error || 'Network offline'));
    }
  };

  useEffect(() => {
    handleInitModel();
  }, []);

  // Periodic frame inference loop for detecting people and dogs
  useEffect(() => {
    if (!enableObjectDetection || !isPlaying) return;

    let timer: any;
    const runInference = async () => {
      const video = videoRef.current;
      const targetElement = video || canvasRef.current;

      if (targetElement) {
        const result = await detectPeopleAndDogsInVideo(targetElement);
        setModelStatus(result.status);
        setIsRealModelActive(result.isRealInference);
        setEngineInfoText(result.engineInfo);

        if (result.status === 'ready' && result.isRealInference) {
          setDetectedObjects(result.detections);
        } else if (result.status === 'unavailable' || result.status === 'error') {
          // DO NOT FABRICATE DETECTIONS!
          // If real model is not ready, we clear detectedObjects unless user explicitly toggled benchmark mode
          if (showSyntheticBenchmark) {
            setDetectedObjects([
              {
                id: 'benchmark-person-1',
                class: 'person',
                score: 91.2,
                bbox: [210, 90, 80, 160],
                timestamp: 'Benchmark Simulation Only',
              },
              {
                id: 'benchmark-dog-1',
                class: 'dog',
                score: 84.7,
                bbox: [320, 190, 70, 55],
                timestamp: 'Benchmark Simulation Only',
              },
            ]);
          } else {
            setDetectedObjects([]);
          }
        }
      }
    };

    timer = setInterval(runInference, 380);
    return () => clearInterval(timer);
  }, [enableObjectDetection, isPlaying, showSyntheticBenchmark]);

  // Selected Object Telemetry Data
  const selectedObject = detectedObjects.find((o) => o.id === selectedObjectId);

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-xl overflow-hidden border border-cyan-500/20 bg-[#070b14] flex flex-col group"
    >
      {/* 1. Top Video Header Bar (Stably positioned, NEVER shifted by zoom or pan) */}
      <div className="p-3 bg-[#070b14]/90 backdrop-blur-md border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 z-20">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-heading text-sm font-semibold text-slate-200">{cameraName}</span>
          <span className="text-[10px] font-hud px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
            {isCustomUpload ? 'Uploaded Video Stream' : 'Authorized Optical CCTV Feed'}
          </span>
        </div>

        {/* Video Zoom & Pan HUD State Pill + Target Switcher */}
        <div className="flex items-center gap-2.5 text-xs font-hud">
          {/* Target Toggle Indicator */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded p-0.5 text-xs">
            <button
              onClick={() => updateGestureState({ target: 'video' })}
              className={`px-2 py-0.5 rounded transition-colors ${
                gestureState.target === 'video'
                  ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              CCTV Target
            </button>
            <button
              onClick={() => updateGestureState({ target: 'map' })}
              className={`px-2 py-0.5 rounded transition-colors ${
                gestureState.target === 'map'
                  ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Map Target
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-cyan-300 bg-slate-900/90 px-2.5 py-1 rounded border border-cyan-500/30">
            <Move className="w-3 h-3 text-cyan-400" />
            <span>ZOOM: {videoTransform.zoom.toFixed(2)}x</span>
            <span className="text-slate-600">|</span>
            <span>PAN: ({videoTransform.panX}, {videoTransform.panY})</span>
          </div>

          {/* Reset View Button */}
          {(videoTransform.zoom > 1.0 || videoTransform.panX !== 0 || videoTransform.panY !== 0) && (
            <button
              onClick={resetVideoTransform}
              className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 border border-slate-700 transition-colors"
              title="Reset Zoom and Pan to 1.0x centered"
            >
              <RotateCcw className="w-3 h-3 text-cyan-400" />
              <span>Reset View</span>
            </button>
          )}

          {isCustomUpload && onRemoveUpload && (
            <button
              onClick={onRemoveUpload}
              className="px-2.5 py-1 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/80 text-xs transition-colors"
            >
              Remove Video
            </button>
          )}
        </div>
      </div>

      {/* 2. STABLE OUTER VIEWPORT (Fixed dimensions, never moves or shifts page) */}
      <div className="relative w-full h-[380px] sm:h-[460px] bg-slate-950 overflow-hidden flex items-center justify-center select-none">
        {/* TRANSFORMED INNER CONTENT CONTAINER (Zoom and Pan apply strictly to video image contents) */}
        <div
          className="w-full h-full relative flex items-center justify-center transition-transform duration-100 ease-out will-change-transform"
          style={{
            transform: `scale(${videoTransform.zoom}) translate(${videoTransform.panX / videoTransform.zoom}px, ${videoTransform.panY / videoTransform.zoom}px)`,
            transformOrigin: 'center center',
          }}
        >
          {useProceduralStream || videoLoadError ? (
            <canvas
              ref={canvasRef}
              width={640}
              height={360}
              className="w-full h-full object-contain"
            />
          ) : (
            <video
              ref={videoRef}
              src={sampleVideoUrl}
              autoPlay
              loop
              muted={isMuted}
              playsInline
              className="w-full h-full object-contain"
            />
          )}

          {/* Dynamic People & Dog Optical Detection Bounding Boxes */}
          {enableObjectDetection && (
            <div className="absolute inset-0 pointer-events-auto">
              {detectedObjects.map((obj) => {
                const isSelected = selectedObjectId === obj.id;
                const isPerson = obj.class === 'person';
                const video = videoRef.current;
                const vw = video?.videoWidth || 640;
                const vh = video?.videoHeight || 360;

                const leftPct = (obj.bbox[0] / vw) * 100;
                const topPct = (obj.bbox[1] / vh) * 100;
                const widthPct = (obj.bbox[2] / vw) * 100;
                const heightPct = (obj.bbox[3] / vh) * 100;

                return (
                  <div
                    key={obj.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedObjectId(obj.id);
                    }}
                    style={{
                      left: `${leftPct}%`,
                      top: `${topPct}%`,
                      width: `${widthPct}%`,
                      height: `${heightPct}%`,
                    }}
                    className={`absolute cursor-pointer border-2 transition-all group/box ${
                      isPerson
                        ? isSelected
                          ? 'border-cyan-300 bg-cyan-400/20 ring-2 ring-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.8)]'
                          : 'border-cyan-400/90 bg-cyan-500/10 hover:border-cyan-200'
                        : isSelected
                        ? 'border-amber-300 bg-amber-400/20 ring-2 ring-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.8)]'
                        : 'border-amber-400/90 bg-amber-500/10 hover:border-amber-200'
                    }`}
                  >
                    {/* Bounding Box Label with Real Confidence Score */}
                    <div
                      className={`absolute -top-6 left-0 px-1.5 py-0.5 rounded text-[9px] font-hud flex items-center gap-1 font-bold whitespace-nowrap shadow-md ${
                        isPerson
                          ? 'bg-cyan-950/95 text-cyan-300 border border-cyan-400'
                          : 'bg-amber-950/95 text-amber-300 border border-amber-400'
                      }`}
                    >
                      {isPerson ? <User className="w-2.5 h-2.5" /> : <Dog className="w-2.5 h-2.5" />}
                      <span>
                        {obj.class.toUpperCase()} [{obj.score}% CONF]
                      </span>
                    </div>

                    {/* Corner Reticles for Selected Target */}
                    {isSelected && (
                      <div className="absolute inset-0 pointer-events-none border border-dashed border-white/70 animate-pulse">
                        <Crosshair className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-white/80" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Viewport Overlay: Gesture Active Target Indicator */}
        {gestureState.isActive && gestureState.target === 'video' && (
          <div className="absolute top-3 left-3 z-10 bg-[#070b14]/90 border border-cyan-400/50 rounded-lg p-2.5 text-xs font-hud flex items-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
            <div>
              <div className="text-cyan-300 font-bold uppercase tracking-wider text-[11px]">
                GESTURE VIDEO TARGET ACTIVE
              </div>
              <div className="text-slate-400 text-[10px]">
                Pinch = Zoom In | Open Hand = Zoom Out | Hand Move = Pan
              </div>
            </div>
          </div>
        )}

        {/* Viewport Manual Navigation Floater (Bottom-Right overlay inside viewport) */}
        <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1 bg-[#070b14]/90 backdrop-blur-md p-1.5 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={handleManualZoomIn}
            className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 transition-colors"
            title="Manual Zoom In (+0.25x)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleManualZoomOut}
            className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 transition-colors"
            title="Manual Zoom Out (-0.25x)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <div className="h-4 w-px bg-slate-800 mx-0.5"></div>
          <button
            onClick={() => handleManualPan(-30, 0)}
            className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 transition-colors"
            title="Manual Pan Left"
          >
            <Move className="w-3.5 h-3.5 rotate-180" />
          </button>
          <button
            onClick={() => handleManualPan(30, 0)}
            className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 transition-colors"
            title="Manual Pan Right"
          >
            <Move className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={resetVideoTransform}
            className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 transition-colors"
            title="Reset View"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 3. Bottom Playback Controls Strip */}
      <div className="p-3 bg-[#070b14] border-t border-slate-900 flex flex-wrap items-center justify-between gap-3 text-xs font-hud z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            className="p-2 rounded bg-slate-900 hover:bg-slate-800 text-cyan-400 hover:text-cyan-300 border border-slate-700 transition-colors"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          <button
            onClick={toggleMute}
            className="p-2 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <div className="text-slate-400 text-[11px]">
            <span>{Math.floor(currentTime)}s</span>
            <span className="text-slate-600"> / </span>
            <span>{Math.floor(duration)}s</span>
          </div>
        </div>

        {/* Optical Detection Controls & Model Status Pill */}
        <div className="flex items-center gap-2">
          {/* Object Detection Toggle */}
          <button
            onClick={() => setEnableObjectDetection(!enableObjectDetection)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs transition-colors border ${
              enableObjectDetection
                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}
          >
            <User className="w-3.5 h-3.5 text-cyan-400" />
            <Dog className="w-3.5 h-3.5 text-amber-400" />
            <span>People & Dogs AI: {enableObjectDetection ? 'ON' : 'OFF'}</span>
          </button>

          {/* Model Status Pill */}
          <div
            className={`px-2.5 py-1 rounded text-[11px] border flex items-center gap-1.5 ${
              modelStatus === 'ready'
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/40'
                : modelStatus === 'loading'
                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-600/40'
                : 'bg-amber-950/80 text-amber-300 border-amber-600/40'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                modelStatus === 'ready'
                  ? 'bg-emerald-400'
                  : modelStatus === 'loading'
                  ? 'bg-cyan-400 animate-spin'
                  : 'bg-amber-400'
              }`}
            ></span>
            <span>COCO-SSD: {modelStatus.toUpperCase()}</span>
          </div>

          {/* Model Guide Button */}
          <button
            onClick={() => setShowModelGuide(!showModelGuide)}
            className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800"
            title="COCO-SSD Optical Pipeline Guide"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800"
            title="Fullscreen"
          >
            {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 4. Optical Inference Telemetry Strip & Object Inspector */}
      {enableObjectDetection && (
        <div className="p-3 bg-[#0b1221] border-t border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-hud">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">DETECTED ENTITIES:</span>
              <span className="text-cyan-300 font-bold">{detectedObjects.length}</span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-400 truncate max-w-sm">{engineInfoText}</span>
            </div>

            {/* Offline benchmark toggle for testing when network blocks CDN model */}
            {modelStatus !== 'ready' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleInitModel}
                  className="px-2.5 py-1 rounded bg-cyan-900/60 hover:bg-cyan-800 text-cyan-200 border border-cyan-700 text-xs font-hud"
                >
                  Retry Model Init
                </button>
                <label className="flex items-center gap-1.5 text-[11px] text-amber-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showSyntheticBenchmark}
                    onChange={(e) => setShowSyntheticBenchmark(e.target.checked)}
                    className="accent-amber-400"
                  />
                  <span>Show Benchmark Targets (Demo Only)</span>
                </label>
              </div>
            )}
          </div>

          {/* List of Detected Objects with Click-to-Select */}
          {detectedObjects.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {detectedObjects.map((obj) => {
                const isSelected = selectedObjectId === obj.id;
                const isPerson = obj.class === 'person';
                return (
                  <button
                    key={obj.id}
                    onClick={() => setSelectedObjectId(isSelected ? null : obj.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-hud border transition-all ${
                      isSelected
                        ? isPerson
                          ? 'bg-cyan-950 text-cyan-200 border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                          : 'bg-amber-950 text-amber-200 border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.4)]'
                        : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    {isPerson ? (
                      <User className="w-3.5 h-3.5 text-cyan-400" />
                    ) : (
                      <Dog className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span className="font-semibold">{obj.class.toUpperCase()}</span>
                    <span className="text-[10px] text-emerald-400 font-bold">{obj.score}% CONF</span>
                    {isSelected && <span className="text-[10px] text-cyan-300 font-bold">● SELECTED</span>}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-[11px] font-hud text-slate-500 flex items-center justify-between">
              <span>No people or dogs detected in current optical frame.</span>
              <span className="text-slate-600">Model inference runs at 3Hz locally</span>
            </div>
          )}

          {/* Selected Object Detail Panel */}
          {selectedObject && (
            <div className="p-3 bg-slate-950 rounded-lg border border-cyan-500/40 text-xs font-hud space-y-2 flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-cyan-400 font-bold uppercase">SELECTED TARGET:</span>
                  <span className="text-white font-semibold">{selectedObject.class.toUpperCase()}</span>
                  <span className="text-emerald-400 font-bold">({selectedObject.score}% Actual Model Confidence)</span>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-3">
                  <span>Bounding Box: [{selectedObject.bbox.join(', ')} px]</span>
                  <span>Detected at: {selectedObject.timestamp}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => focusOnObject(selectedObject)}
                  className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>Center Pan on Target</span>
                </button>
                <button
                  onClick={() => setSelectedObjectId(null)}
                  className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-400"
                  title="Close target inspector"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. COCO-SSD Optical Pipeline Setup Guide & Disclosure Modal */}
      {showModelGuide && (
        <div className="p-4 bg-slate-950/95 border-t border-slate-800 text-xs text-slate-300 space-y-3 z-30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-heading font-semibold text-slate-100">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>CCTV Optical Object-Detection Pipeline Architecture</span>
            </div>
            <button
              onClick={() => setShowModelGuide(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2 text-[11px] text-slate-400 leading-relaxed">
            <p>
              <strong>1. In-Browser Local Inference:</strong> AuraVision AI runs lightweight MobileNet V2 COCO-SSD
              models directly inside the browser using TensorFlow.js. Video streams never leave your device and are never
              uploaded to paid external cloud APIs.
            </p>
            <p>
              <strong>2. Person & Dog Classes:</strong> The optical pipeline inspects candidate bounding boxes and filters
              exclusively for class identities <code>person</code> and <code>dog</code>. Scores shown are raw model
              confidences (e.g. 92.4%).
            </p>
            <p>
              <strong>3. GIS Map Boundary Disclosure:</strong> The Tactical Map provides geospatial situational awareness
              and camera deployment locations. Optical person and dog detection is performed exclusively inside camera
              video streams, never fabricated on the map itself.
            </p>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-900">
            <button
              onClick={() => setShowModelGuide(false)}
              className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-hud"
            >
              Close Guide
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
