import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Compass,
  Expand,
  Eye,
  Hand,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
  Move,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

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
  assignedConditionTitle = 'Library Occupancy & Activity',
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
  } = useApp();

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(30);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showSimulatedOverlays, setShowSimulatedOverlays] = useState<boolean>(true);
  const [videoLoadError, setVideoLoadError] = useState<boolean>(false);
  const [useProceduralStream, setUseProceduralStream] = useState<boolean>(false);

  // High quality sample corridor surveillance MP4 URL
  // We use reliable public domain/open licensed surveillance clips or reliable fallback
  const sampleVideoUrl = videoSrc || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

  // Procedural Canvas Animation for guaranteed offline surveillance footage fallback
  useEffect(() => {
    if (!useProceduralStream && !videoLoadError) return;

    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Simulation entities (moving pedestrians / cars)
    const pedestrians = [
      { x: 50, y: 180, speed: 1.2, dir: 1, label: 'Person #102', conf: '94%' },
      { x: 260, y: 190, speed: 0.8, dir: -1, label: 'Person #105', conf: '91%' },
      { x: 140, y: 175, speed: 0.5, dir: 1, label: 'Person #108', conf: '88%' },
    ];

    let frame = 0;

    const render = () => {
      frame++;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Floor & Corridor perspective lines
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      for (let i = 0; i < canvas.width; i += 40) {
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2, 80);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }

      // Corridor walls
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 70, canvas.height);
      ctx.fillRect(canvas.width - 70, 0, 70, canvas.height);

      // Doors
      ctx.fillStyle = '#334155';
      ctx.fillRect(10, 70, 45, 120);
      ctx.fillRect(canvas.width - 55, 70, 45, 120);

      // Simulated security timestamp & overlay
      ctx.fillStyle = '#22d3ee';
      ctx.font = '10px monospace';
      const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
      ctx.fillText(`CAM-01 [PROCEDURAL CCTV GENERATOR] · ${nowStr}`, 80, 25);
      ctx.fillText(`FPS: 30.0 · RESOLUTION: 640x360 · SIMULATED OPTICAL FEED`, 80, 40);

      // Render moving pedestrians
      pedestrians.forEach((p) => {
        p.x += p.speed * p.dir;
        if (p.x > canvas.width - 90) p.dir = -1;
        if (p.x < 80) p.dir = 1;

        // Draw person silhouette
        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.arc(p.x + 12, p.y - 30, 8, 0, Math.PI * 2); // head
        ctx.fill();
        ctx.fillRect(p.x + 6, p.y - 20, 12, 28); // torso
        ctx.fillRect(p.x + 3, p.y + 8, 7, 24); // leg 1
        ctx.fillRect(p.x + 14, p.y + 8, 7, 24); // leg 2

        // Simulated AI bounding box
        if (showSimulatedOverlays) {
          ctx.strokeStyle = '#06b6d4';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(p.x - 2, p.y - 42, 28, 78);

          // Label
          ctx.fillStyle = 'rgba(6, 182, 212, 0.85)';
          ctx.fillRect(p.x - 2, p.y - 54, 76, 12);
          ctx.fillStyle = '#050811';
          ctx.font = 'bold 8px monospace';
          ctx.fillText(`${p.label} [${p.conf}]`, p.x, p.y - 45);
        }
      });

      // Scanlines & subtle noise
      ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
      for (let y = 0; y < canvas.height; y += 4) {
        ctx.fillRect(0, y, canvas.width, 1);
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [useProceduralStream, videoLoadError, showSimulatedOverlays]);

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
      console.warn('External sample video load error, switching to procedural live corridor generator');
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
  }, []);

  const togglePlay = () => {
    if (useProceduralStream || videoLoadError) {
      setIsPlaying(!isPlaying);
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = parseFloat(e.target.value);
    setCurrentTime(target);
    if (videoRef.current) {
      videoRef.current.currentTime = target;
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const changeSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
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

  // Manual transform adjustments (for accessibility and when gestures are not enabled)
  const handleManualZoomIn = () => {
    updateVideoTransform((prev) => ({ ...prev, zoom: Math.min(4.0, prev.zoom + 0.25) }));
  };

  const handleManualZoomOut = () => {
    updateVideoTransform((prev) => ({ ...prev, zoom: Math.max(1.0, prev.zoom - 0.25) }));
  };

  const handleManualPan = (dx: number, dy: number) => {
    updateVideoTransform((prev) => ({ ...prev, panX: prev.panX + dx, panY: prev.panY + dy }));
  };

  // Format MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-xl overflow-hidden border border-cyan-500/20 bg-[#070b14] flex flex-col group"
    >
      {/* Top Video Header Bar (Stably positioned, never shifted by zoom) */}
      <div className="p-3 bg-[#070b14]/90 backdrop-blur-md border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 z-20">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-heading text-sm font-semibold text-slate-200">{cameraName}</span>
          <span className="text-[10px] font-hud px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
            {isCustomUpload ? 'Uploaded File Analysis' : 'Sample Footage — Demo Only'}
          </span>
        </div>

        {/* Video Zoom & Pan HUD State Pill */}
        <div className="flex items-center gap-3 text-xs font-hud">
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
              title="Reset Zoom and Pan to 1.0x"
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

      {/* STABLE OUTER VIEWPORT (Fixed dimensions, never moves or shifts page) */}
      <div className="relative w-full h-[380px] sm:h-[460px] bg-slate-950 overflow-hidden flex items-center justify-center select-none">
        {/* TRANSFORMED INNER CONTENT CONTAINER (Zoom and Pan apply exclusively here) */}
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

          {/* Analytical AI Bounding Box Simulation Layer */}
          {showSimulatedOverlays && !useProceduralStream && (
            <div className="absolute inset-0 pointer-events-none">
              {/* Simulated person detection box */}
              <div className="absolute top-[28%] left-[34%] w-[90px] h-[190px] border-2 border-cyan-400/90 bg-cyan-500/10 rounded-sm">
                <div className="absolute -top-5 left-0 bg-cyan-950/90 border border-cyan-400 text-cyan-300 text-[9px] font-hud px-1 py-0.5 rounded flex items-center gap-1 whitespace-nowrap">
                  <span>PERSON [0.93 CONF]</span>
                </div>
              </div>

              {/* Simulated loitering / zone tag */}
              <div className="absolute bottom-6 right-6 bg-slate-900/90 border border-slate-700 p-2 rounded text-[10px] font-hud text-slate-300">
                <div className="text-cyan-400 font-semibold mb-0.5">ZONE: CORRIDOR ALPHA</div>
                <div>OCCUPANCY: 1 DETECTED</div>
                <div className="text-slate-400 text-[9px] mt-0.5">SIMULATED ANALYTICAL INFERENCE</div>
              </div>
            </div>
          )}
        </div>

        {/* Gesture Active Target Indicator Overlay */}
        {gestureState.isActive && gestureState.target === 'video' && (
          <div className="absolute top-4 left-4 z-20 bg-[#070b14]/90 border border-cyan-400/60 rounded px-3 py-1.5 text-xs font-hud flex items-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.4)] animate-pulse">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
            <span className="text-cyan-300 font-bold">GESTURE VIDEO TARGET ACTIVE</span>
            <span className="text-slate-400 text-[10px]">(Pinch: Zoom | Hand move: Pan)</span>
          </div>
        )}

        {/* Manual Pan & Zoom Navigation Overlay Controls */}
        <div className="absolute right-4 top-4 z-20 flex flex-col gap-1.5 bg-slate-950/80 backdrop-blur-md p-1.5 rounded-lg border border-slate-800 opacity-90 hover:opacity-100 transition-opacity">
          <button
            onClick={handleManualZoomIn}
            className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300"
            title="Manual Zoom In (+0.25x)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleManualZoomOut}
            className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300"
            title="Manual Zoom Out (-0.25x)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="h-px bg-slate-800 my-0.5"></div>
          <button
            onClick={() => handleManualPan(0, 20)}
            className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs flex items-center justify-center"
            title="Pan Up"
          >
            ▲
          </button>
          <div className="flex gap-1">
            <button
              onClick={() => handleManualPan(20, 0)}
              className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs"
              title="Pan Left"
            >
              ◀
            </button>
            <button
              onClick={() => handleManualPan(-20, 0)}
              className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs"
              title="Pan Right"
            >
              ▶
            </button>
          </div>
          <button
            onClick={() => handleManualPan(0, -20)}
            className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs flex items-center justify-center"
            title="Pan Down"
          >
            ▼
          </button>
        </div>

        {/* Toggle Simulated AI HUD Boxes */}
        <button
          onClick={() => setShowSimulatedOverlays(!showSimulatedOverlays)}
          className={`absolute left-4 bottom-4 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-hud transition-colors ${
            showSimulatedOverlays
              ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/40'
              : 'bg-slate-900/80 text-slate-400 border border-slate-800'
          }`}
          title="Toggle Simulated AI Optical Bounding Boxes"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>{showSimulatedOverlays ? 'Simulated AI Boxes: ON' : 'AI Boxes: OFF'}</span>
        </button>

        {/* Video Mode Fallback Notice */}
        {(useProceduralStream || videoLoadError) && (
          <div className="absolute top-16 left-4 z-20 bg-indigo-950/90 border border-indigo-500/40 rounded px-2.5 py-1 text-[11px] font-hud text-indigo-200">
            Procedural 30FPS Corridor Stream Active
          </div>
        )}
      </div>

      {/* BOTTOM PLAYBACK CONTROLS (Stably anchored to player bottom) */}
      <div className="p-3 bg-[#070b14]/95 border-t border-slate-800 flex flex-col gap-2 z-20">
        {/* Scrubber timeline */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-hud text-slate-400 w-12 text-right">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 30}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
          <span className="text-[11px] font-hud text-slate-400 w-12">
            {formatTime(duration || 30)}
          </span>
        </div>

        {/* Action Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* Play / Pause */}
            <button
              onClick={togglePlay}
              className="p-2 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold transition-colors"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            </button>

            {/* Mute */}
            <button
              onClick={toggleMute}
              className="p-2 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 transition-colors border border-slate-800"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
            </button>

            {/* Speed Selector */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded p-0.5 text-xs">
              {[0.5, 1.0, 1.5, 2.0].map((s) => (
                <button
                  key={s}
                  onClick={() => changeSpeed(s)}
                  className={`px-2 py-0.5 rounded text-[11px] font-hud transition-colors ${
                    playbackSpeed === s
                      ? 'bg-slate-800 text-cyan-300 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Gesture Target Toggle */}
            <div className="flex items-center gap-1.5 text-xs font-hud bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
              <span className="text-slate-400">GESTURE TARGET:</span>
              <button
                onClick={() => updateGestureState({ target: 'video' })}
                className={`px-2 py-0.5 rounded transition-colors ${
                  gestureState.target === 'video'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                VIDEO
              </button>
              <button
                onClick={() => updateGestureState({ target: 'map' })}
                className={`px-2 py-0.5 rounded transition-colors ${
                  gestureState.target === 'map'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                MAP
              </button>
            </div>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 transition-colors border border-slate-800"
              title="Fullscreen"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
