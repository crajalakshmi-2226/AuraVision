import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Eye,
  EyeOff,
  Hand,
  Maximize2,
  Minimize2,
  Move,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Video,
  VideoOff,
  ZoomIn,
  ZoomOut,
  Info,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { GestureType, GestureTarget } from '../../types';

declare global {
  interface Window {
    Hands?: any;
    Camera?: any;
  }
}

export const GestureTracker: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const mediaPipeInstanceRef = useRef<any>(null);

  const {
    gestureState,
    updateGestureState,
    videoTransform,
    updateVideoTransform,
    triggerMapAction,
    addNotification,
    webcamStream,
    startWebcam,
    stopWebcam,
    retryWebcam,
    cameraStatus,
    setCameraStatus,
    cameraError,
    isPreviewVisible,
    setIsPreviewVisible,
  } = useApp();

  const [isVideoReady, setIsVideoReady] = useState<boolean>(false);
  const [engineType, setEngineType] = useState<'MediaPipe Hands' | 'Optical Landmark Engine'>('Optical Landmark Engine');
  const [modelLoading, setModelLoading] = useState<boolean>(false);

  // Tracking heuristics and smoothing state
  const prevCentroidRef = useRef<{ x: number; y: number } | null>(null);
  const lastGestureTimeRef = useRef<number>(0);

  // Cooldown thresholds (ms) between discrete gesture actions to prevent feedback loops
  const ZOOM_COOLDOWN_MS = 380;
  const PAN_COOLDOWN_MS = 140;

  // Process detected gesture action onto selected target (Video OR Map)
  const dispatchGestureAction = useCallback(
    (gesture: GestureType, confidence: number) => {
      const now = Date.now();
      const target = gestureState.target;

      let actionDesc = 'Idle';

      if (gesture === 'pinch_zoom_in') {
        if (now - lastGestureTimeRef.current > ZOOM_COOLDOWN_MS) {
          lastGestureTimeRef.current = now;
          actionDesc = `ZOOM IN applied to ${target.toUpperCase()}`;
          if (target === 'video') {
            updateVideoTransform((prev) => ({ ...prev, zoom: prev.zoom + 0.2 }));
          } else {
            triggerMapAction(1, 0, 0);
          }
        }
      } else if (gesture === 'open_hand_zoom_out') {
        if (now - lastGestureTimeRef.current > ZOOM_COOLDOWN_MS) {
          lastGestureTimeRef.current = now;
          actionDesc = `ZOOM OUT applied to ${target.toUpperCase()}`;
          if (target === 'video') {
            updateVideoTransform((prev) => ({ ...prev, zoom: prev.zoom - 0.2 }));
          } else {
            triggerMapAction(-1, 0, 0);
          }
        }
      } else if (gesture === 'pan_left') {
        if (now - lastGestureTimeRef.current > PAN_COOLDOWN_MS) {
          lastGestureTimeRef.current = now;
          actionDesc = `PAN LEFT applied to ${target.toUpperCase()}`;
          if (target === 'video') {
            updateVideoTransform((prev) => ({ ...prev, panX: prev.panX - 25 }));
          } else {
            triggerMapAction(0, -60, 0);
          }
        }
      } else if (gesture === 'pan_right') {
        if (now - lastGestureTimeRef.current > PAN_COOLDOWN_MS) {
          lastGestureTimeRef.current = now;
          actionDesc = `PAN RIGHT applied to ${target.toUpperCase()}`;
          if (target === 'video') {
            updateVideoTransform((prev) => ({ ...prev, panX: prev.panX + 25 }));
          } else {
            triggerMapAction(0, 60, 0);
          }
        }
      } else if (gesture === 'pan_up') {
        if (now - lastGestureTimeRef.current > PAN_COOLDOWN_MS) {
          lastGestureTimeRef.current = now;
          actionDesc = `PAN UP applied to ${target.toUpperCase()}`;
          if (target === 'video') {
            updateVideoTransform((prev) => ({ ...prev, panY: prev.panY - 20 }));
          } else {
            triggerMapAction(0, 0, -50);
          }
        }
      } else if (gesture === 'pan_down') {
        if (now - lastGestureTimeRef.current > PAN_COOLDOWN_MS) {
          lastGestureTimeRef.current = now;
          actionDesc = `PAN DOWN applied to ${target.toUpperCase()}`;
          if (target === 'video') {
            updateVideoTransform((prev) => ({ ...prev, panY: prev.panY + 20 }));
          } else {
            triggerMapAction(0, 0, 50);
          }
        }
      }

      // Update gesture telemetry
      const isDetected = gesture !== 'none';
      if (isDetected) {
        setCameraStatus('hand_detected');
      } else if (webcamStream) {
        setCameraStatus('searching');
      }

      updateGestureState({
        currentGesture: gesture,
        confidence: Math.round(confidence * 100),
        handDetected: isDetected,
        lastAction: actionDesc !== 'Idle' ? actionDesc : gestureState.lastAction,
        lastActionTime: actionDesc !== 'Idle' ? now : gestureState.lastActionTime,
        debugLogs: actionDesc !== 'Idle'
          ? [
              `[${new Date().toLocaleTimeString()}] ${actionDesc} (Confidence: ${Math.round(confidence * 100)}%)`,
              ...gestureState.debugLogs.slice(0, 8),
            ]
          : gestureState.debugLogs,
      });
    },
    [
      gestureState.target,
      gestureState.lastAction,
      gestureState.lastActionTime,
      gestureState.debugLogs,
      webcamStream,
      setCameraStatus,
      updateGestureState,
      updateVideoTransform,
      triggerMapAction,
    ]
  );

  // Attach webcam stream to HTML <video> element with callback ref & effect
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
            console.warn('Video element play() delayed or error:', err);
          }
        }
      };

      if (videoElement.readyState >= 1) {
        attemptPlay();
      } else {
        videoElement.onloadedmetadata = () => {
          attemptPlay();
        };
      }
    } else {
      videoElement.srcObject = null;
      setIsVideoReady(false);
    }
  }, [setCameraStatus]);

  // Video Ref Callback guarantees stream is attached immediately upon DOM element mounting
  const setVideoRef = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element;
    if (element && webcamStream) {
      attachStreamToVideo(element, webcamStream);
    }
  }, [webcamStream, attachStreamToVideo]);

  // Synchronize effect whenever webcamStream changes
  useEffect(() => {
    if (videoRef.current) {
      attachStreamToVideo(videoRef.current, webcamStream);
    }
  }, [webcamStream, attachStreamToVideo]);

  // Initialize and run Hand-Landmark Tracking Engine (MediaPipe + Optical Fallback)
  useEffect(() => {
    if (!webcamStream || !isVideoReady || !gestureState.isActive) {
      return;
    }

    let isDisposed = false;

    // Check if MediaPipe is available in global window
    if (window.Hands && !mediaPipeInstanceRef.current) {
      try {
        setModelLoading(true);
        const hands = new window.Hands({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        hands.onResults((results: any) => {
          if (isDisposed) return;
          setModelLoading(false);
          setEngineType('MediaPipe Hands');

          const canvas = canvasRef.current;
          if (!canvas) return;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          // Always match canvas internal dimensions with actual video resolution for crisp 1:1 overlay
          if (videoRef.current && videoRef.current.videoWidth > 0) {
            if (canvas.width !== videoRef.current.videoWidth || canvas.height !== videoRef.current.videoHeight) {
              canvas.width = videoRef.current.videoWidth;
              canvas.height = videoRef.current.videoHeight;
            }
          }

          // Clear transparent HUD canvas completely so camera video feed is 100% visible
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
            prevCentroidRef.current = null;
            dispatchGestureAction('none', 0);
            return;
          }

          const landmarks = results.multiHandLandmarks[0];

          // Draw skeleton joints on transparent HUD canvas
          ctx.strokeStyle = '#22d3ee';
          ctx.fillStyle = '#a855f7';
          ctx.lineWidth = 2.5;

          landmarks.forEach((pt: any) => {
            const x = (1 - pt.x) * canvas.width; // Mirror horizontally
            const y = pt.y * canvas.height;
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
          });

          // Connect key finger bones
          const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
            [0, 5], [5, 6], [6, 7], [7, 8], // Index
            [0, 9], [9, 10], [10, 11], [11, 12], // Middle
            [0, 13], [13, 14], [14, 15], [15, 16], // Ring
            [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
            [5, 9], [9, 13], [13, 17], // Palm
          ];

          ctx.beginPath();
          connections.forEach(([i, j]) => {
            const p1 = landmarks[i];
            const p2 = landmarks[j];
            ctx.moveTo((1 - p1.x) * canvas.width, p1.y * canvas.height);
            ctx.lineTo((1 - p2.x) * canvas.width, p2.y * canvas.height);
          });
          ctx.stroke();

          // Calculate Pinch distance (thumb tip 4 to index tip 8)
          const thumbTip = landmarks[4];
          const indexTip = landmarks[8];
          const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);

          // Calculate Hand Extension / Spread (average distance of tips from wrist 0)
          const wrist = landmarks[0];
          const middleTip = landmarks[12];
          const ringTip = landmarks[16];
          const pinkyTip = landmarks[20];

          const avgExtension = (
            Math.hypot(thumbTip.x - wrist.x, thumbTip.y - wrist.y) +
            Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y) +
            Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y) +
            Math.hypot(ringTip.x - wrist.x, ringTip.y - wrist.y) +
            Math.hypot(pinkyTip.x - wrist.x, pinkyTip.y - wrist.y)
          ) / 5;

          // Centroid for directional panning
          const currentCentroid = {
            x: 1 - (wrist.x + landmarks[5].x + landmarks[17].x) / 3, // mirrored
            y: (wrist.y + landmarks[5].y + landmarks[17].y) / 3,
          };

          let detectedGesture: GestureType = 'none';
          let confidence = 0.88;

          // 1. Check Pinch (Zoom IN)
          if (pinchDist < 0.075) {
            detectedGesture = 'pinch_zoom_in';
            confidence = Math.max(0.75, 1 - pinchDist * 10);
          }
          // 2. Check Open / Spread Hand (Zoom OUT)
          else if (avgExtension > 0.44 && pinchDist > 0.18) {
            detectedGesture = 'open_hand_zoom_out';
            confidence = Math.min(0.98, avgExtension * 1.8);
          }
          // 3. Directional Motion Panning
          else if (prevCentroidRef.current) {
            const dx = currentCentroid.x - prevCentroidRef.current.x;
            const dy = currentCentroid.y - prevCentroidRef.current.y;

            const DEADZONE = 0.04;
            if (Math.abs(dx) > DEADZONE || Math.abs(dy) > DEADZONE) {
              if (Math.abs(dx) > Math.abs(dy)) {
                detectedGesture = dx > 0 ? 'pan_right' : 'pan_left';
              } else {
                detectedGesture = dy > 0 ? 'pan_down' : 'pan_up';
              }
              confidence = 0.9;
            }
          }

          prevCentroidRef.current = currentCentroid;
          dispatchGestureAction(detectedGesture, confidence);
        });

        mediaPipeInstanceRef.current = hands;
      } catch (err) {
        console.warn('MediaPipe Hands setup error, using optical fallback:', err);
        setModelLoading(false);
      }
    }

    // Continuous Frame Loop
    const processFrame = async () => {
      if (isDisposed) return;

      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.paused) {
        animFrameRef.current = requestAnimationFrame(processFrame);
        return;
      }

      if (mediaPipeInstanceRef.current) {
        try {
          await mediaPipeInstanceRef.current.send({ image: video });
        } catch (e) {
          // Frame busy, silently continue
        }
      } else {
        // Optical Landmark & Motion Engine Fallback
        setEngineType('Optical Landmark Engine');

        // Use offscreen in-memory canvas for pixel sampling (keeps user canvas completely transparent!)
        if (!offscreenCanvasRef.current) {
          offscreenCanvasRef.current = document.createElement('canvas');
        }
        const offscreen = offscreenCanvasRef.current;
        offscreen.width = 160;
        offscreen.height = 120;
        const offCtx = offscreen.getContext('2d', { willReadFrequently: true });

        const hudCanvas = canvasRef.current;
        const hudCtx = hudCanvas?.getContext('2d');

        if (offCtx && hudCanvas && hudCtx) {
          offCtx.drawImage(video, 0, 0, 160, 120);
          const imgData = offCtx.getImageData(0, 0, 160, 120);
          const d = imgData.data;

          let totalSkinPixels = 0;
          let sumX = 0;
          let sumY = 0;

          for (let i = 0; i < d.length; i += 16) {
            const r = d[i];
            const g = d[i + 1];
            const b = d[i + 2];
            if (r > 95 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15) {
              const pixelIdx = i / 4;
              const px = pixelIdx % 160;
              const py = Math.floor(pixelIdx / 160);
              sumX += px;
              sumY += py;
              totalSkinPixels++;
            }
          }

          // Clear HUD canvas
          hudCtx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);

          if (totalSkinPixels > 150) {
            const normX = 1 - (sumX / totalSkinPixels) / 160; // Mirrored
            const normY = (sumY / totalSkinPixels) / 120;
            const targetX = normX * hudCanvas.width;
            const targetY = normY * hudCanvas.height;

            // Draw glowing optical reticle over the detected hand on HUD
            hudCtx.strokeStyle = '#22d3ee';
            hudCtx.lineWidth = 2.5;
            hudCtx.beginPath();
            hudCtx.arc(targetX, targetY, 22, 0, Math.PI * 2);
            hudCtx.stroke();

            hudCtx.fillStyle = '#a855f7';
            hudCtx.beginPath();
            hudCtx.arc(targetX, targetY, 4, 0, Math.PI * 2);
            hudCtx.fill();

            const currentCentroid = { x: normX, y: normY };
            let detectedGesture: GestureType = 'none';
            let conf = 0.85;

            if (prevCentroidRef.current) {
              const dx = currentCentroid.x - prevCentroidRef.current.x;
              const dy = currentCentroid.y - prevCentroidRef.current.y;
              const DEADZONE = 0.05;

              if (Math.abs(dx) > DEADZONE || Math.abs(dy) > DEADZONE) {
                if (Math.abs(dx) > Math.abs(dy)) {
                  detectedGesture = dx > 0 ? 'pan_right' : 'pan_left';
                } else {
                  detectedGesture = dy > 0 ? 'pan_down' : 'pan_up';
                }
              }
            }

            prevCentroidRef.current = currentCentroid;
            dispatchGestureAction(detectedGesture, conf);
          } else {
            prevCentroidRef.current = null;
            dispatchGestureAction('none', 0);
          }
        }
      }

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
  }, [webcamStream, isVideoReady, gestureState.isActive, dispatchGestureAction]);

  // Clean up mediaPipe instance on unmount
  useEffect(() => {
    return () => {
      if (mediaPipeInstanceRef.current && mediaPipeInstanceRef.current.close) {
        mediaPipeInstanceRef.current.close();
        mediaPipeInstanceRef.current = null;
      }
    };
  }, []);

  // Format Status Message for UI Header
  const getStatusBadge = () => {
    switch (cameraStatus) {
      case 'permission_requested':
        return {
          text: 'Camera permission requested · Check browser prompt',
          color: 'bg-amber-950/80 text-amber-300 border-amber-600/40',
          dot: 'bg-amber-400 animate-ping',
        };
      case 'loading':
        return {
          text: 'Video stream loading · Initializing feed...',
          color: 'bg-cyan-950/80 text-cyan-300 border-cyan-600/40',
          dot: 'bg-cyan-400 animate-pulse',
        };
      case 'hand_detected':
        return {
          text: `Hand detected (${gestureState.confidence}%) · Gesture active`,
          color: 'bg-emerald-950/80 text-emerald-300 border-emerald-600/40',
          dot: 'bg-emerald-400 animate-ping',
        };
      case 'searching':
      case 'connected':
        return {
          text: 'Webcam connected · Hold hand in frame to control',
          color: 'bg-cyan-950/80 text-cyan-300 border-cyan-600/40',
          dot: 'bg-cyan-400 animate-pulse',
        };
      case 'error':
        return {
          text: 'Camera error · Check connection or retry',
          color: 'bg-rose-950/80 text-rose-300 border-rose-600/40',
          dot: 'bg-rose-400',
        };
      default:
        return {
          text: 'Webcam standby · Click "Enable Gesture Control"',
          color: 'bg-slate-900 text-slate-400 border-slate-800',
          dot: 'bg-slate-500',
        };
    }
  };

  const statusBadge = getStatusBadge();

  return (
    <div className="w-full bg-[#070b14] border border-cyan-500/20 rounded-xl p-4 flex flex-col gap-4">
      {/* Header and Toggle Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <Hand className="w-5 h-5 text-cyan-400" />
          <div>
            <h3 className="font-heading font-semibold text-slate-100 text-sm">
              Hand Gesture Control Studio
            </h3>
            <p className="text-xs text-slate-400">
              Touchless computer-vision situational control for maps and tactical video feeds
            </p>
          </div>
        </div>

        {/* Action Buttons: Enable / Disable + Retry */}
        <div className="flex items-center gap-2">
          {gestureState.isCameraActive ? (
            <>
              {/* Retry Camera Button (Requirement 11) */}
              <button
                onClick={retryWebcam}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
                title="Restart and reinitialize webcam stream"
              >
                <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                <span>Retry Camera</span>
              </button>

              {/* Disable Camera Button */}
              <button
                onClick={stopWebcam}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-700 transition-colors"
              >
                <VideoOff className="w-3.5 h-3.5 text-rose-400" />
                <span>Disable Gesture Control</span>
              </button>
            </>
          ) : (
            <button
              onClick={startWebcam}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-slate-950 transition-colors shadow-[0_0_15px_rgba(6,182,212,0.3)]"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Enable Gesture Control</span>
            </button>
          )}
        </div>
      </div>

      {/* Target Selector & Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 p-3 rounded-lg border border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-hud text-slate-300 font-medium">GESTURE TARGET:</span>
          <div className="flex items-center bg-slate-950 border border-slate-700 rounded p-0.5 text-xs">
            <button
              onClick={() => updateGestureState({ target: 'video' })}
              className={`px-3 py-1 rounded transition-colors ${
                gestureState.target === 'video'
                  ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              CCTV Video Player
            </button>
            <button
              onClick={() => updateGestureState({ target: 'map' })}
              className={`px-3 py-1 rounded transition-colors ${
                gestureState.target === 'map'
                  ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Tactical GIS Map
            </button>
          </div>
        </div>

        {/* Informative Status Badge (Requirement 10) */}
        <div className={`px-2.5 py-1 rounded text-xs font-hud border flex items-center gap-2 ${statusBadge.color}`}>
          <span className={`w-2 h-2 rounded-full ${statusBadge.dot}`}></span>
          <span>{statusBadge.text}</span>
        </div>
      </div>

      {/* Camera Error Alert (Requirement 10) */}
      {cameraError && (
        <div className="p-3.5 rounded-lg bg-rose-950/80 border border-rose-800 text-xs text-rose-200 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-rose-100">Camera Access Error:</div>
              <div>{cameraError}</div>
              <div className="text-[11px] text-rose-300 mt-1">
                Tip: Click "Retry Camera" or verify your browser permissions in the URL address bar.
              </div>
            </div>
          </div>
          <button
            onClick={retryWebcam}
            className="px-3 py-1.5 rounded bg-rose-900 hover:bg-rose-800 text-xs text-white shrink-0 font-medium"
          >
            Retry Now
          </button>
        </div>
      )}

      {/* Main Studio Grid: Left Live Webcam Preview + Right Realtime Gesture Cards */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Left Column: Live Webcam Viewport & Landmark Canvas */}
        <div className="md:col-span-5 flex flex-col gap-2">
          {/* Header over preview: Preview Toggle (Requirement 11) */}
          <div className="flex items-center justify-between text-xs font-hud text-slate-400 px-1">
            <span className="flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-cyan-400" />
              <span>LIVE WEBCAM VIEWPORT</span>
            </span>

            {gestureState.isCameraActive && (
              <button
                onClick={() => setIsPreviewVisible(!isPreviewVisible)}
                className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-cyan-300 transition-colors"
                title={isPreviewVisible ? 'Hide camera preview' : 'Show camera preview'}
              >
                {isPreviewVisible ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Hide Preview</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>Show Preview</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* PREVIEW CONTAINER: Fixed visible dimensions, non-zero width/height, object-fit: cover (Requirement 5 & 6) */}
          <div className="relative w-full aspect-[4/3] min-h-[260px] bg-slate-900 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center select-none shadow-inner">
            {gestureState.isCameraActive ? (
              <>
                {/* HTML <video> element: ALWAYS rendered with proper classes, object-fit: cover, and mirrored transform */}
                <video
                  ref={setVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`absolute inset-0 w-full h-full object-cover transform -scale-x-100 z-0 transition-opacity duration-200 ${
                    isPreviewVisible ? 'opacity-100' : 'opacity-0'
                  }`}
                />

                {/* Transparent HUD Canvas Overlay: Cleared every frame, never renders opaque black (Requirement 8) */}
                <canvas
                  ref={canvasRef}
                  width={640}
                  height={480}
                  className={`absolute inset-0 w-full h-full object-cover pointer-events-none z-10 ${
                    isPreviewVisible ? 'opacity-100' : 'opacity-0'
                  }`}
                />

                {/* If preview hidden by user toggle */}
                {!isPreviewVisible && (
                  <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-4 text-center z-20">
                    <EyeOff className="w-8 h-8 text-slate-600 mb-2" />
                    <p className="text-xs text-slate-300 font-medium">Camera Preview Hidden</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Hand gesture tracking continues active in the background.
                    </p>
                    <button
                      onClick={() => setIsPreviewVisible(true)}
                      className="mt-3 px-3 py-1 rounded bg-slate-800 text-cyan-300 text-xs font-hud hover:bg-slate-700"
                    >
                      Restore Preview
                    </button>
                  </div>
                )}

                {/* Loading State Overlay while model prepares */}
                {modelLoading && (
                  <div className="absolute top-2 left-2 z-20 bg-slate-950/85 backdrop-blur-md px-2.5 py-1 rounded border border-cyan-500/40 text-[10px] font-hud text-cyan-300 flex items-center gap-1.5 animate-pulse">
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    <span>Initializing Hand Model...</span>
                  </div>
                )}

                {/* Active Tracking Badge (Top-Left) */}
                {isPreviewVisible && !modelLoading && (
                  <div className="absolute top-2 left-2 z-20 bg-slate-950/85 backdrop-blur-md px-2.5 py-1 rounded border border-slate-700 text-[10px] font-hud flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${gestureState.handDetected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                    <span className="text-slate-200">
                      {gestureState.handDetected ? 'HAND DETECTED' : 'SEARCHING FOR HAND'}
                    </span>
                  </div>
                )}

                {/* Current Gesture HUD Badge (Bottom) */}
                {isPreviewVisible && (
                  <div className="absolute bottom-2 left-2 right-2 z-20 bg-slate-950/90 backdrop-blur-md p-2 rounded border border-cyan-500/30 text-xs font-hud flex items-center justify-between">
                    <span className="text-slate-400">DETECTED:</span>
                    <span className="text-cyan-300 font-bold uppercase truncate px-1">
                      {gestureState.currentGesture.replace(/_/g, ' ')}
                    </span>
                    <span className="text-emerald-400 text-[11px] font-bold">
                      {gestureState.confidence > 0 ? `${gestureState.confidence}%` : '0%'}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center text-slate-500">
                <Camera className="w-10 h-10 mb-2 text-slate-600" />
                <p className="text-xs font-medium text-slate-300 mb-1">Webcam Inactive</p>
                <p className="text-[11px] text-slate-500 max-w-[220px] mb-3">
                  Click "Enable Gesture Control" above to start live hand tracking.
                </p>
                <button
                  onClick={startWebcam}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-slate-950 transition-colors"
                >
                  Start Camera Feed
                </button>
              </div>
            )}
          </div>

          <div className="text-[11px] text-slate-400 font-hud px-1 flex items-center justify-between">
            <span>Video feed strictly local (zero cloud upload)</span>
            <span>Target: <strong className="text-cyan-400 uppercase font-normal">{gestureState.target}</strong></span>
          </div>
        </div>

        {/* Right Column: Six Gesture Reference Cards & Live State */}
        <div className="md:col-span-7 flex flex-col gap-3">
          <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span>Recognized Hand Gestures (6 Actions)</span>
            <span className="text-[11px] font-hud text-slate-400">Dead zone & cooldown enabled</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {/* Gesture 1: Pinch */}
            <div
              className={`p-2.5 rounded-lg border transition-all ${
                gestureState.currentGesture === 'pinch_zoom_in'
                  ? 'bg-cyan-950/80 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                  : 'bg-slate-900/60 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <ZoomIn className="w-4 h-4 text-cyan-400" />
                <span className="text-[10px] font-hud text-slate-400">Action 1</span>
              </div>
              <div className="font-heading font-semibold text-xs text-slate-200">Pinch Together</div>
              <div className="text-[11px] text-cyan-300 font-hud">Zoom IN</div>
              <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                Pinch thumb and index finger together
              </p>
            </div>

            {/* Gesture 2: Open hand */}
            <div
              className={`p-2.5 rounded-lg border transition-all ${
                gestureState.currentGesture === 'open_hand_zoom_out'
                  ? 'bg-cyan-950/80 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                  : 'bg-slate-900/60 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <ZoomOut className="w-4 h-4 text-cyan-400" />
                <span className="text-[10px] font-hud text-slate-400">Action 2</span>
              </div>
              <div className="font-heading font-semibold text-xs text-slate-200">Open Hand Spread</div>
              <div className="text-[11px] text-cyan-300 font-hud">Zoom OUT</div>
              <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                Spread all fingers outward flat
              </p>
            </div>

            {/* Gesture 3: Pan Left */}
            <div
              className={`p-2.5 rounded-lg border transition-all ${
                gestureState.currentGesture === 'pan_left'
                  ? 'bg-cyan-950/80 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                  : 'bg-slate-900/60 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <Move className="w-4 h-4 text-cyan-400" />
                <span className="text-[10px] font-hud text-slate-400">Action 3</span>
              </div>
              <div className="font-heading font-semibold text-xs text-slate-200">Move Left</div>
              <div className="text-[11px] text-cyan-300 font-hud">Pan Left</div>
              <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                Move hand across viewport to the left
              </p>
            </div>

            {/* Gesture 4: Pan Right */}
            <div
              className={`p-2.5 rounded-lg border transition-all ${
                gestureState.currentGesture === 'pan_right'
                  ? 'bg-cyan-950/80 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                  : 'bg-slate-900/60 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <Move className="w-4 h-4 text-cyan-400" />
                <span className="text-[10px] font-hud text-slate-400">Action 4</span>
              </div>
              <div className="font-heading font-semibold text-xs text-slate-200">Move Right</div>
              <div className="text-[11px] text-cyan-300 font-hud">Pan Right</div>
              <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                Move hand across viewport to the right
              </p>
            </div>

            {/* Gesture 5: Pan Up */}
            <div
              className={`p-2.5 rounded-lg border transition-all ${
                gestureState.currentGesture === 'pan_up'
                  ? 'bg-cyan-950/80 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                  : 'bg-slate-900/60 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <Move className="w-4 h-4 text-cyan-400" />
                <span className="text-[10px] font-hud text-slate-400">Action 5</span>
              </div>
              <div className="font-heading font-semibold text-xs text-slate-200">Move Up</div>
              <div className="text-[11px] text-cyan-300 font-hud">Pan Up</div>
              <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                Raise hand vertically in frame
              </p>
            </div>

            {/* Gesture 6: Pan Down */}
            <div
              className={`p-2.5 rounded-lg border transition-all ${
                gestureState.currentGesture === 'pan_down'
                  ? 'bg-cyan-950/80 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                  : 'bg-slate-900/60 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <Move className="w-4 h-4 text-cyan-400" />
                <span className="text-[10px] font-hud text-slate-400">Action 6</span>
              </div>
              <div className="font-heading font-semibold text-xs text-slate-200">Move Down</div>
              <div className="text-[11px] text-cyan-300 font-hud">Pan Down</div>
              <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                Lower hand vertically in frame
              </p>
            </div>
          </div>

          {/* Real-time Diagnostics Log Strip */}
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs font-hud space-y-1">
            <div className="flex items-center justify-between text-slate-400 pb-1 border-b border-slate-900">
              <span>LAST ACTION:</span>
              <span className="text-cyan-300 font-medium">{gestureState.lastAction}</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>CURRENT TARGET:</span>
              <span className="text-slate-200 uppercase font-semibold">{gestureState.target}</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>VIDEO VIEWPORT STATE:</span>
              <span className="text-indigo-300">
                Zoom: {videoTransform.zoom.toFixed(2)}x | Pan: ({videoTransform.panX}, {videoTransform.panY})
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
