import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Hand,
  Maximize2,
  Minimize2,
  Move,
  RefreshCw,
  Video,
  VideoOff,
  Volume2,
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const {
    gestureState,
    updateGestureState,
    videoTransform,
    updateVideoTransform,
    resetVideoTransform,
    triggerMapAction,
    addNotification,
  } = useApp();

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [engineType, setEngineType] = useState<'MediaPipe Hands' | 'Optical Landmark Engine'>('Optical Landmark Engine');

  // Tracking heuristics and smoothing state
  const prevCentroidRef = useRef<{ x: number; y: number } | null>(null);
  const lastGestureTimeRef = useRef<number>(0);
  const smoothedDeltasRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  // Cooldown threshold (ms) between discrete zoom actions to prevent feedback loops
  const ZOOM_COOLDOWN_MS = 380;
  const PAN_COOLDOWN_MS = 140;

  // Process detected gesture action onto selected target (Video OR Map)
  const dispatchGestureAction = useCallback(
    (gesture: GestureType, confidence: number, rawDx = 0, rawDy = 0) => {
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
      updateGestureState({
        currentGesture: gesture,
        confidence: Math.round(confidence * 100),
        handDetected: gesture !== 'none',
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
    [gestureState.target, gestureState.lastAction, gestureState.lastActionTime, gestureState.debugLogs, updateGestureState, updateVideoTransform, triggerMapAction]
  );

  // Initialize Camera Stream
  const startCamera = async () => {
    setIsInitializing(true);
    setCameraError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('MediaDevices API is not supported in this browser environment.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 320 },
          height: { ideal: 240 },
          facingMode: 'user',
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(() => {});
        };
      }

      updateGestureState({
        isActive: true,
        isCameraActive: true,
      });
      addNotification('Webcam gesture controller initialized successfully');
      setIsInitializing(false);
    } catch (err: any) {
      console.error('Camera access failed:', err);
      let errMsg = 'Failed to access webcam.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errMsg = 'Webcam permission was declined. Click lock icon in browser URL bar to grant permission.';
      } else if (err.name === 'NotFoundError') {
        errMsg = 'No webcam hardware device detected on this system.';
      } else {
        errMsg = err.message || 'Webcam initialization failed.';
      }

      setCameraError(errMsg);
      setIsInitializing(false);
      updateGestureState({
        isActive: false,
        isCameraActive: false,
        debugLogs: [`[Error] ${errMsg}`, ...gestureState.debugLogs],
      });
      addNotification(errMsg);
    }
  };

  // Stop Camera Stream
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    updateGestureState({
      isActive: false,
      isCameraActive: false,
      currentGesture: 'none',
      handDetected: false,
      confidence: 0,
      lastAction: 'Gesture tracking deactivated',
    });
    addNotification('Gesture control tracking disabled');
  };

  // Run Real-Time Frame Tracking Engine
  useEffect(() => {
    if (!gestureState.isActive || !gestureState.isCameraActive) return;

    let mediaPipeInstance: any = null;

    // Check if MediaPipe Hands is loaded in window
    if (window.Hands) {
      try {
        setEngineType('MediaPipe Hands');
        mediaPipeInstance = new window.Hands({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });

        mediaPipeInstance.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        mediaPipeInstance.onResults((results: any) => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
            prevCentroidRef.current = null;
            dispatchGestureAction('none', 0);
            return;
          }

          const landmarks = results.multiHandLandmarks[0];

          // Draw skeleton & landmarks on canvas HUD
          ctx.strokeStyle = '#22d3ee';
          ctx.fillStyle = '#a855f7';
          ctx.lineWidth = 1.5;

          landmarks.forEach((pt: any) => {
            const x = (1 - pt.x) * canvas.width; // Mirror horizontally
            const y = pt.y * canvas.height;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
          });

          // Connect key bones
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

          // Calculate Hand Extension / Spread (distance of tips from wrist 0)
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
          let confidence = 0.85;

          // 1. Check Pinch (Zoom IN)
          if (pinchDist < 0.075) {
            detectedGesture = 'pinch_zoom_in';
            confidence = Math.max(0.7, 1 - pinchDist * 10);
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

            // Dead-zone threshold
            const THRESHOLD = 0.04;
            if (Math.abs(dx) > THRESHOLD || Math.abs(dy) > THRESHOLD) {
              if (Math.abs(dx) > Math.abs(dy)) {
                detectedGesture = dx > 0 ? 'pan_right' : 'pan_left';
              } else {
                detectedGesture = dy > 0 ? 'pan_down' : 'pan_up';
              }
              confidence = 0.88;
            }
          }

          prevCentroidRef.current = currentCentroid;
          dispatchGestureAction(detectedGesture, confidence);
        });
      } catch (e) {
        console.warn('MediaPipe initialization fallback to optical vision engine', e);
      }
    }

    // Continuous Frame Loop
    const processVideoLoop = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(processVideoLoop);
        return;
      }

      if (mediaPipeInstance) {
        try {
          await mediaPipeInstance.send({ image: videoRef.current });
        } catch (e) {
          // Silently recover if frame was busy
        }
      } else {
        // Fallback Optical Difference & Skin Luma Tracker
        setEngineType('Optical Landmark Engine');
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const d = imgData.data;

            let totalSkinPixels = 0;
            let sumX = 0;
            let sumY = 0;

            // Skin color heuristic in RGB (YCrCb approx)
            for (let i = 0; i < d.length; i += 16) {
              const r = d[i];
              const g = d[i + 1];
              const b = d[i + 2];
              if (r > 95 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15) {
                const pixelIdx = i / 4;
                const px = pixelIdx % canvas.width;
                const py = Math.floor(pixelIdx / canvas.width);
                sumX += px;
                sumY += py;
                totalSkinPixels++;
              }
            }

            // Draw HUD indicator
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (totalSkinPixels > 250) {
              const avgX = canvas.width - sumX / totalSkinPixels; // mirrored
              const avgY = sumY / totalSkinPixels;

              ctx.strokeStyle = '#22d3ee';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(avgX, avgY, 20, 0, Math.PI * 2);
              ctx.stroke();

              const currentCentroid = {
                x: avgX / canvas.width,
                y: avgY / canvas.height,
              };

              let detectedGesture: GestureType = 'none';
              let conf = 0.82;

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
      }

      animFrameRef.current = requestAnimationFrame(processVideoLoop);
    };

    animFrameRef.current = requestAnimationFrame(processVideoLoop);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (mediaPipeInstance && mediaPipeInstance.close) {
        mediaPipeInstance.close();
      }
    };
  }, [gestureState.isActive, gestureState.isCameraActive, dispatchGestureAction]);

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
              Control map or surveillance video navigation without physical mouse contact
            </p>
          </div>
        </div>

        {/* Enable / Disable Button */}
        <div className="flex items-center gap-2">
          {gestureState.isActive ? (
            <button
              onClick={stopCamera}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-700 transition-colors"
            >
              <VideoOff className="w-3.5 h-3.5 text-rose-400" />
              <span>Disable Gesture Control</span>
            </button>
          ) : (
            <button
              onClick={startCamera}
              disabled={isInitializing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-slate-950 transition-colors shadow-[0_0_15px_rgba(6,182,212,0.3)]"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{isInitializing ? 'Requesting Permission...' : 'Enable Gesture Control'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Target Selector Bar (Map vs Video) */}
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

        <div className="text-[11px] font-hud text-slate-400 flex items-center gap-2">
          <span>Engine: <strong className="text-slate-200">{engineType}</strong></span>
          <span className="text-slate-600">|</span>
          <span>Permission: <strong className={gestureState.isCameraActive ? 'text-emerald-400' : 'text-slate-400'}>{gestureState.isCameraActive ? 'Granted' : 'Standby'}</strong></span>
        </div>
      </div>

      {/* Error Notice */}
      {cameraError && (
        <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-800 text-xs text-rose-200 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-rose-100">Camera Access Notice:</div>
            <div>{cameraError}</div>
            <div className="text-[11px] text-rose-300 mt-1">
              Manual map and video navigation controls remain 100% functional.
            </div>
          </div>
        </div>
      )}

      {/* Main Studio Grid: Left Webcam Preview + Right Realtime Gesture Cards */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Left Column: Live Webcam Viewport & Landmark Canvas */}
        <div className="md:col-span-5 flex flex-col gap-2">
          <div className="relative w-full aspect-[4/3] bg-slate-950 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center">
            {gestureState.isCameraActive ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover -scale-x-100"
                />
                <canvas
                  ref={canvasRef}
                  width={320}
                  height={240}
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                />

                {/* Tracking Badge */}
                <div className="absolute top-2 left-2 bg-slate-950/80 backdrop-blur-md px-2 py-1 rounded border border-slate-700 text-[10px] font-hud flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${gestureState.handDetected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                  <span className="text-slate-200">{gestureState.handDetected ? 'HAND DETECTED' : 'SEARCHING FOR HAND'}</span>
                </div>

                {/* Current Gesture HUD */}
                <div className="absolute bottom-2 left-2 right-2 bg-slate-950/90 backdrop-blur-md p-1.5 rounded border border-cyan-500/30 text-xs font-hud flex items-center justify-between">
                  <span className="text-slate-400">DETECTED:</span>
                  <span className="text-cyan-300 font-bold uppercase truncate">
                    {gestureState.currentGesture.replace(/_/g, ' ')}
                  </span>
                  <span className="text-emerald-400 text-[10px]">{gestureState.confidence}%</span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center text-slate-500">
                <Camera className="w-10 h-10 mb-2 text-slate-600" />
                <p className="text-xs font-medium text-slate-400 mb-1">Webcam Inactive</p>
                <p className="text-[11px] text-slate-500 max-w-[200px]">
                  Click "Enable Gesture Control" above to start hand landmark tracking
                </p>
              </div>
            )}
          </div>

          <div className="text-[11px] text-slate-400 font-hud px-1 flex items-center justify-between">
            <span>Video feed strictly local (zero cloud upload)</span>
            <span>Target: <span className="text-cyan-400 uppercase">{gestureState.target}</span></span>
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
