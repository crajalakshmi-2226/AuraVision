import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Compass,
  Eye,
  EyeOff,
  Hand,
  Maximize2,
  Minimize2,
  Move,
  RefreshCw,
  RotateCcw,
  Sliders,
  Sparkles,
  Video,
  VideoOff,
  Volume2,
  ZoomIn,
  ZoomOut,
  Info,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { GestureType, GestureTarget, TrackingStatus } from '../../types';
import {
  initializeHandLandmarker,
  drawHandSkeleton,
  analyzeHandLandmarks,
  DEFAULT_THRESHOLDS,
  GestureThresholds,
  HandLandmarkPoint,
} from '../../services/handTrackingService';

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

  // MediaPipe references
  const tasksLandmarkerRef = useRef<any>(null);
  const classicHandsRef = useRef<any>(null);
  const lastVideoTimeRef = useRef<number>(-1);
  const isProcessingFrameRef = useRef<boolean>(false);

  const {
    gestureState,
    updateGestureState,
    videoTransform,
    updateVideoTransform,
    resetVideoTransform,
    triggerMapAction,
    mapTelemetry,
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
  const [activeEngine, setActiveEngine] = useState<
    'MediaPipe Tasks HandLandmarker' | 'MediaPipe Classic Hands' | 'Optical Reticle Engine'
  >('MediaPipe Tasks HandLandmarker');
  const [modelLoading, setModelLoading] = useState<boolean>(false);
  const [modelError, setModelError] = useState<string | null>(null);

  // Configurable thresholds for fine-tuning
  const [thresholds, setThresholds] = useState<GestureThresholds>(DEFAULT_THRESHOLDS);
  const [showCalibrationPanel, setShowCalibrationPanel] = useState<boolean>(false);

  // Tracking heuristics and smoothing state
  const prevSmoothedCentroidRef = useRef<{ x: number; y: number } | null>(null);
  const lastActionTimeRef = useRef<number>(0);
  const lastTriggeredGestureRef = useRef<GestureType>('none');
  const gestureHoldCounterRef = useRef<number>(0);

  // 1. Process detected gesture action onto selected target (Video OR Map)
  const dispatchGestureAction = useCallback(
    (
      gesture: GestureType,
      confidence: number,
      detectedHands: number,
      rawMetrics?: {
        rawPinchDistance?: number;
        rawPinchRatio?: number;
        rawExtensionScore?: number;
        centroid?: { x: number; y: number };
      }
    ) => {
      const now = Date.now();
      const target = gestureState.target;
      const isNewGestureTransition = gesture !== lastTriggeredGestureRef.current;

      // Determine tracking status accurately based on requirements
      let currentTrackingStatus: TrackingStatus = 'waiting_hand';
      if (modelLoading) {
        currentTrackingStatus = 'loading_model';
      } else if (cameraError || modelError) {
        currentTrackingStatus = 'error';
      } else if (detectedHands > 0) {
        if (gesture !== 'none') {
          currentTrackingStatus = 'gesture_recognized';
        } else {
          currentTrackingStatus = 'hand_detected';
        }
      } else {
        currentTrackingStatus = 'waiting_hand';
      }

      let actionDesc = 'Idle';
      let shouldExecuteAction = false;

      // Anti-jitter gesture transition and cooldown gating
      if (gesture !== 'none') {
        const isZoom = gesture === 'pinch_zoom_in' || gesture === 'open_hand_zoom_out';
        const cooldown = isZoom ? thresholds.zoomCooldownMs : thresholds.panCooldownMs;
        const timeSinceLastAction = now - lastActionTimeRef.current;

        if (isNewGestureTransition) {
          // Immediate execution on gesture state change!
          shouldExecuteAction = true;
          gestureHoldCounterRef.current = 1;
        } else if (timeSinceLastAction > cooldown) {
          // Throttled recurring action while holding gesture steady
          shouldExecuteAction = true;
          gestureHoldCounterRef.current++;
        }
      } else {
        gestureHoldCounterRef.current = 0;
      }

      if (shouldExecuteAction) {
        lastActionTimeRef.current = now;
        lastTriggeredGestureRef.current = gesture;

        if (gesture === 'pinch_zoom_in') {
          actionDesc = `ZOOM IN applied to ${target.toUpperCase()}`;
          if (target === 'video') {
            updateVideoTransform((prev) => ({ ...prev, zoom: Math.min(4.0, prev.zoom + 0.25) }));
          } else {
            triggerMapAction(1, 0, 0);
          }
        } else if (gesture === 'open_hand_zoom_out') {
          actionDesc = `ZOOM OUT applied to ${target.toUpperCase()}`;
          if (target === 'video') {
            updateVideoTransform((prev) => ({ ...prev, zoom: Math.max(1.0, prev.zoom - 0.25) }));
          } else {
            triggerMapAction(-1, 0, 0);
          }
        } else if (gesture === 'pan_left') {
          actionDesc = `PAN LEFT applied to ${target.toUpperCase()}`;
          if (target === 'video') {
            updateVideoTransform((prev) => ({ ...prev, panX: prev.panX - 30 }));
          } else {
            triggerMapAction(0, -70, 0);
          }
        } else if (gesture === 'pan_right') {
          actionDesc = `PAN RIGHT applied to ${target.toUpperCase()}`;
          if (target === 'video') {
            updateVideoTransform((prev) => ({ ...prev, panX: prev.panX + 30 }));
          } else {
            triggerMapAction(0, 70, 0);
          }
        } else if (gesture === 'pan_up') {
          actionDesc = `PAN UP applied to ${target.toUpperCase()}`;
          if (target === 'video') {
            updateVideoTransform((prev) => ({ ...prev, panY: prev.panY - 25 }));
          } else {
            triggerMapAction(0, 0, -60);
          }
        } else if (gesture === 'pan_down') {
          actionDesc = `PAN DOWN applied to ${target.toUpperCase()}`;
          if (target === 'video') {
            updateVideoTransform((prev) => ({ ...prev, panY: prev.panY + 25 }));
          } else {
            triggerMapAction(0, 0, 60);
          }
        }
      }

      if (gesture === 'none') {
        lastTriggeredGestureRef.current = 'none';
      }

      // Update camera status sync
      if (detectedHands > 0) {
        setCameraStatus('hand_detected');
      } else if (webcamStream) {
        setCameraStatus('searching');
      }

      // Update global context gesture state
      updateGestureState({
        currentGesture: gesture,
        confidence: Math.round(confidence * 100),
        handDetected: detectedHands > 0,
        detectedHandCount: detectedHands,
        trackingStatus: currentTrackingStatus,
        rawPinchDistance: rawMetrics?.rawPinchDistance || 0,
        rawExtensionScore: rawMetrics?.rawExtensionScore || 0,
        centroid: rawMetrics?.centroid || { x: 0.5, y: 0.5 },
        lastAction: actionDesc !== 'Idle' ? actionDesc : gestureState.lastAction,
        lastActionTime: actionDesc !== 'Idle' ? now : gestureState.lastActionTime,
        debugLogs:
          actionDesc !== 'Idle'
            ? [
                `[${new Date().toLocaleTimeString()}] ${actionDesc} (${Math.round(confidence * 100)}% conf | Hands: ${detectedHands})`,
                ...gestureState.debugLogs.slice(0, 7),
              ]
            : gestureState.debugLogs,
      });
    },
    [
      gestureState.target,
      gestureState.lastAction,
      gestureState.lastActionTime,
      gestureState.debugLogs,
      modelLoading,
      cameraError,
      modelError,
      thresholds,
      webcamStream,
      setCameraStatus,
      updateGestureState,
      updateVideoTransform,
      triggerMapAction,
    ]
  );

  // 2. Attach webcam stream to HTML <video> element
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

  // 3. Initialize Model on activation
  useEffect(() => {
    if (!gestureState.isActive && !gestureState.isCameraActive) {
      return;
    }

    let isDisposed = false;

    const setupModel = async () => {
      setModelLoading(true);
      setModelError(null);

      // Attempt 1: MediaPipe Tasks Vision HandLandmarker
      try {
        const landmarker = await initializeHandLandmarker();
        if (landmarker && !isDisposed) {
          tasksLandmarkerRef.current = landmarker;
          setActiveEngine('MediaPipe Tasks HandLandmarker');
          setModelLoading(false);
          addNotification('MediaPipe Tasks HandLandmarker ready (GPU/WASM initialized)');
          return;
        }
      } catch (err: any) {
        console.warn('Tasks HandLandmarker initialization failed, checking classic Hands:', err);
      }

      // Attempt 2: MediaPipe Classic Hands from window.Hands
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
          setModelLoading(false);
          addNotification('MediaPipe Classic Hands engine initialized');
          return;
        } catch (err: any) {
          console.warn('Classic Hands init error:', err);
        }
      }

      // Attempt 3: Optical Reticle Fallback Engine
      if (!isDisposed) {
        setActiveEngine('Optical Reticle Engine');
        setModelLoading(false);
        addNotification('Optical Computer Vision tracking engine active (zero external assets required)');
      }
    };

    setupModel();

    return () => {
      isDisposed = true;
    };
  }, [gestureState.isActive, gestureState.isCameraActive, addNotification]);

  // 4. Continuous Frame Processing Loop
  useEffect(() => {
    if (!webcamStream || !isVideoReady || !gestureState.isActive) {
      return;
    }

    let isDisposed = false;

    const processFrame = async () => {
      if (isDisposed) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || video.readyState < 2 || video.paused || video.videoWidth === 0) {
        animFrameRef.current = requestAnimationFrame(processFrame);
        return;
      }

      if (!canvas) {
        animFrameRef.current = requestAnimationFrame(processFrame);
        return;
      }

      // Synchronize internal canvas dimensions to match video stream resolution
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animFrameRef.current = requestAnimationFrame(processFrame);
        return;
      }

      // Always clear canvas each frame so live video remains 100% visible
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // --- ENGINE 1: MediaPipe Tasks HandLandmarker ---
      if (tasksLandmarkerRef.current) {
        try {
          const now = performance.now();
          if (video.currentTime !== lastVideoTimeRef.current) {
            lastVideoTimeRef.current = video.currentTime;
            const results = tasksLandmarkerRef.current.detectForVideo(video, now);

            if (results && results.landmarks && results.landmarks.length > 0) {
              const detectedHands = results.landmarks.length;

              // Draw all detected hands (supports 1 or 2 hands)
              results.landmarks.forEach((handPoints: HandLandmarkPoint[], idx: number) => {
                // Analyze primary hand for gestures
                if (idx === 0) {
                  const analysis = analyzeHandLandmarks(
                    handPoints,
                    prevSmoothedCentroidRef.current,
                    thresholds
                  );
                  prevSmoothedCentroidRef.current = analysis.smoothedCentroid;

                  drawHandSkeleton(ctx, handPoints, canvas.width, canvas.height, analysis.gesture, idx);

                  dispatchGestureAction(analysis.gesture, analysis.confidence, detectedHands, {
                    rawPinchDistance: analysis.rawPinchDistance,
                    rawPinchRatio: analysis.rawPinchRatio,
                    rawExtensionScore: analysis.rawExtensionScore,
                    centroid: analysis.currentCentroid,
                  });
                } else {
                  drawHandSkeleton(ctx, handPoints, canvas.width, canvas.height, 'none', idx);
                }
              });
            } else {
              prevSmoothedCentroidRef.current = null;
              dispatchGestureAction('none', 0, 0);
            }
          }
        } catch (err) {
          // If tasks frame drops, ignore and keep looping
        }
      }
      // --- ENGINE 2: MediaPipe Classic Hands ---
      else if (classicHandsRef.current) {
        if (!isProcessingFrameRef.current) {
          isProcessingFrameRef.current = true;
          classicHandsRef.current.onResults((results: any) => {
            isProcessingFrameRef.current = false;
            if (isDisposed) return;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
              const detectedHands = results.multiHandLandmarks.length;
              const primaryHand = results.multiHandLandmarks[0];

              const analysis = analyzeHandLandmarks(
                primaryHand,
                prevSmoothedCentroidRef.current,
                thresholds
              );
              prevSmoothedCentroidRef.current = analysis.smoothedCentroid;

              drawHandSkeleton(ctx, primaryHand, canvas.width, canvas.height, analysis.gesture, 0);

              dispatchGestureAction(analysis.gesture, analysis.confidence, detectedHands, {
                rawPinchDistance: analysis.rawPinchDistance,
                rawPinchRatio: analysis.rawPinchRatio,
                rawExtensionScore: analysis.rawExtensionScore,
                centroid: analysis.currentCentroid,
              });
            } else {
              prevSmoothedCentroidRef.current = null;
              dispatchGestureAction('none', 0, 0);
            }
          });

          try {
            classicHandsRef.current.send({ image: video });
          } catch (e) {
            isProcessingFrameRef.current = false;
          }
        }
      }
      // --- ENGINE 3: Optical Reticle Fallback ---
      else {
        if (!offscreenCanvasRef.current) {
          offscreenCanvasRef.current = document.createElement('canvas');
        }
        const offscreen = offscreenCanvasRef.current;
        offscreen.width = 160;
        offscreen.height = 120;
        const offCtx = offscreen.getContext('2d', { willReadFrequently: true });

        if (offCtx) {
          offCtx.drawImage(video, 0, 0, 160, 120);
          const imgData = offCtx.getImageData(0, 0, 160, 120);
          const d = imgData.data;

          let skinPixelCount = 0;
          let sumX = 0;
          let sumY = 0;

          for (let i = 0; i < d.length; i += 16) {
            const r = d[i];
            const g = d[i + 1];
            const b = d[i + 2];
            if (r > 95 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15) {
              const pixelIdx = i / 4;
              sumX += pixelIdx % 160;
              sumY += Math.floor(pixelIdx / 160);
              skinPixelCount++;
            }
          }

          if (skinPixelCount > 180) {
            const normX = 1 - (sumX / skinPixelCount) / 160; // Mirrored
            const normY = (sumY / skinPixelCount) / 120;
            const targetX = normX * canvas.width;
            const targetY = normY * canvas.height;

            // Draw optical HUD reticle
            ctx.strokeStyle = '#22d3ee';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(targetX, targetY, 26, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = '#a855f7';
            ctx.beginPath();
            ctx.arc(targetX, targetY, 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#38bdf8';
            ctx.font = '10px monospace';
            ctx.fillText('OPTICAL HAND RETICLE', targetX - 55, targetY - 32);

            const currentCentroid = { x: normX, y: normY };
            let gesture: GestureType = 'none';

            if (prevSmoothedCentroidRef.current) {
              const dx = currentCentroid.x - prevSmoothedCentroidRef.current.x;
              const dy = currentCentroid.y - prevSmoothedCentroidRef.current.y;
              if (Math.abs(dx) > thresholds.deadZone || Math.abs(dy) > thresholds.deadZone) {
                if (Math.abs(dx) > Math.abs(dy)) {
                  gesture = dx > 0 ? 'pan_right' : 'pan_left';
                } else {
                  gesture = dy > 0 ? 'pan_down' : 'pan_up';
                }
              }
            }

            prevSmoothedCentroidRef.current = currentCentroid;
            dispatchGestureAction(gesture, 0.85, 1, { centroid: currentCentroid });
          } else {
            prevSmoothedCentroidRef.current = null;
            dispatchGestureAction('none', 0, 0);
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
  }, [webcamStream, isVideoReady, gestureState.isActive, thresholds, dispatchGestureAction]);

  // Manual gesture simulator buttons for instant testing of all 6 gestures
  const simulateGesture = (gesture: GestureType) => {
    dispatchGestureAction(gesture, 0.98, 1);
  };

  // Status Badge for UI Header showing the 5 required states
  const getStatusBadge = () => {
    switch (gestureState.trackingStatus) {
      case 'loading_model':
        return {
          text: 'Loading model · Initializing WASM & Landmarker...',
          color: 'bg-cyan-950/80 text-cyan-300 border-cyan-600/40',
          dot: 'bg-cyan-400 animate-spin',
        };
      case 'waiting_hand':
        return {
          text: 'Waiting for hand · Hold hand in front of camera',
          color: 'bg-slate-900 text-slate-300 border-slate-700',
          dot: 'bg-amber-400 animate-pulse',
        };
      case 'hand_detected':
        return {
          text: `Hand detected (${gestureState.detectedHandCount} in view) · Ready for gesture`,
          color: 'bg-emerald-950/80 text-emerald-300 border-emerald-600/40',
          dot: 'bg-emerald-400 animate-pulse',
        };
      case 'gesture_recognized':
        return {
          text: `Gesture recognized: ${gestureState.currentGesture.replace(/_/g, ' ').toUpperCase()}`,
          color: 'bg-cyan-950/90 text-cyan-200 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.4)]',
          dot: 'bg-cyan-400 animate-ping',
        };
      case 'error':
        return {
          text: 'Tracking error · Check permissions or click Retry',
          color: 'bg-rose-950/80 text-rose-300 border-rose-600/40',
          dot: 'bg-rose-400',
        };
      default:
        return {
          text: 'Camera Standby · Click "Enable Gesture Control"',
          color: 'bg-slate-900 text-slate-400 border-slate-800',
          dot: 'bg-slate-500',
        };
    }
  };

  const statusBadge = getStatusBadge();

  return (
    <div className="w-full bg-[#070b14] border border-cyan-500/20 rounded-xl p-4 flex flex-col gap-4">
      {/* 1. Header with Title & Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-400">
            <Hand className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-heading font-semibold text-slate-100 text-sm flex items-center gap-2">
              <span>Hand Gesture Tracking Control</span>
              <span className="text-[10px] font-hud px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                {activeEngine}
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Touchless 21-joint skeletal tracking for tactical map and CCTV viewport manipulation
            </p>
          </div>
        </div>

        {/* Action Controls: Enable / Disable + Retry Camera & Model */}
        <div className="flex items-center gap-2">
          {gestureState.isCameraActive ? (
            <>
              {/* Retry Camera & Model Button */}
              <button
                onClick={retryWebcam}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 hover:border-cyan-500/40 transition-colors"
                title="Restart webcam and reinitialize hand-tracking model"
              >
                <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                <span>Retry Camera & Model</span>
              </button>

              {/* Disable Gesture Control */}
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
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-slate-950 transition-colors shadow-[0_0_15px_rgba(6,182,212,0.3)] font-heading"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Enable Gesture Control</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Target Selector & Required 5-State Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 p-3 rounded-lg border border-slate-800">
        {/* Target Switcher: CCTV VIDEO vs MAP */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-hud text-slate-300 font-medium">GESTURE TARGET:</span>
          <div className="flex items-center bg-slate-950 border border-slate-700 rounded p-0.5 text-xs">
            <button
              onClick={() => updateGestureState({ target: 'video' })}
              className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors ${
                gestureState.target === 'video'
                  ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Video className="w-3 h-3 text-cyan-400" />
              <span>CCTV Video Viewport</span>
            </button>
            <button
              onClick={() => updateGestureState({ target: 'map' })}
              className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors ${
                gestureState.target === 'map'
                  ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Compass className="w-3 h-3 text-cyan-400" />
              <span>Tactical GIS Map</span>
            </button>
          </div>
        </div>

        {/* Clear Status Message Display */}
        <div className="flex items-center gap-2">
          <div className={`px-3 py-1 rounded text-xs font-hud border flex items-center gap-2 ${statusBadge.color}`}>
            <span className={`w-2 h-2 rounded-full ${statusBadge.dot}`}></span>
            <span className="font-semibold">{statusBadge.text}</span>
          </div>

          {/* Hand Count Indicator */}
          <div className="px-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-xs font-hud text-slate-300 flex items-center gap-1.5">
            <Hand className="w-3 h-3 text-cyan-400" />
            <span>Hands: <strong className="text-cyan-300">{gestureState.detectedHandCount}</strong></span>
          </div>
        </div>
      </div>

      {/* Camera or Model Error Alert Banner */}
      {(cameraError || modelError) && (
        <div className="p-3.5 rounded-lg bg-rose-950/80 border border-rose-800 text-xs text-rose-200 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-rose-100">Tracking Pipeline Error:</div>
              <div>{cameraError || modelError}</div>
              <div className="text-[11px] text-rose-300 mt-1">
                Tip: Click "Retry Camera & Model" or test with the manual gesture-testing panel below.
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

      {/* 3. Main Two-Column Studio Grid: Left Webcam Viewport + Right Gesture Feedback */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Live Webcam Viewport & Landmark Skeleton Canvas */}
        <div className="lg:col-span-5 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-hud text-slate-400 px-1">
            <span className="flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-cyan-400" />
              <span>LIVE CAMERA STREAM & SKELETON HUD</span>
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

          {/* Viewport Container: Fixed visible dimensions, non-zero height, object-cover */}
          <div className="relative w-full aspect-[4/3] min-h-[270px] bg-slate-900 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center select-none shadow-inner">
            {gestureState.isCameraActive ? (
              <>
                {/* HTML <video> element */}
                <video
                  ref={setVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`absolute inset-0 w-full h-full object-cover transform -scale-x-100 z-0 transition-opacity duration-200 ${
                    isPreviewVisible ? 'opacity-100' : 'opacity-0'
                  }`}
                />

                {/* Transparent 21-Joint HUD Canvas Overlay */}
                <canvas
                  ref={canvasRef}
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
                      Hand tracking continues active in the background.
                    </p>
                    <button
                      onClick={() => setIsPreviewVisible(true)}
                      className="mt-3 px-3 py-1 rounded bg-slate-800 text-cyan-300 text-xs font-hud hover:bg-slate-700"
                    >
                      Restore Preview
                    </button>
                  </div>
                )}

                {/* Loading State Overlay */}
                {modelLoading && (
                  <div className="absolute top-2 left-2 z-20 bg-slate-950/85 backdrop-blur-md px-2.5 py-1 rounded border border-cyan-500/40 text-[10px] font-hud text-cyan-300 flex items-center gap-1.5 animate-pulse">
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    <span>Loading HandLandmarker Model...</span>
                  </div>
                )}

                {/* Top-Right HUD Badge: Target & Hand Count */}
                {isPreviewVisible && !modelLoading && (
                  <div className="absolute top-2 right-2 z-20 bg-slate-950/85 backdrop-blur-md px-2 py-1 rounded border border-slate-700 text-[10px] font-hud flex items-center gap-2">
                    <span className="text-slate-400">TARGET:</span>
                    <strong className="text-cyan-400 uppercase">{gestureState.target}</strong>
                  </div>
                )}

                {/* Bottom HUD Strip: Recognized Gesture and Confidence */}
                {isPreviewVisible && (
                  <div className="absolute bottom-2 left-2 right-2 z-20 bg-slate-950/90 backdrop-blur-md p-2 rounded border border-cyan-500/30 text-xs font-hud flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">GESTURE:</span>
                      <span className="text-cyan-300 font-bold uppercase truncate px-1">
                        {gestureState.currentGesture.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-slate-400">CONFIDENCE:</span>
                      <span className="text-emerald-400 font-bold">
                        {gestureState.confidence > 0 ? `${gestureState.confidence}%` : '0%'}
                      </span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center text-slate-500">
                <Camera className="w-10 h-10 mb-2 text-slate-600" />
                <p className="text-xs font-medium text-slate-300 mb-1">Webcam Inactive</p>
                <p className="text-[11px] text-slate-500 max-w-[240px] mb-3">
                  Click "Enable Gesture Control" to activate webcam and real-time hand landmark tracking.
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
            <span>Client-side inference (100% private)</span>
            <button
              onClick={() => setShowCalibrationPanel(!showCalibrationPanel)}
              className="text-cyan-400 hover:underline flex items-center gap-1"
            >
              <Sliders className="w-3 h-3" />
              <span>{showCalibrationPanel ? 'Hide Thresholds' : 'Calibration & Thresholds'}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Six Gesture Reference Cards & Live State */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span>Recognized Hand Gestures (6 Mapped Actions)</span>
            <span className="text-[11px] font-hud text-slate-400">Transition detection & anti-jitter active</span>
          </div>

          {/* 6 Gesture Action Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {/* Action 1: Pinch */}
            <div
              className={`p-2.5 rounded-lg border transition-all ${
                gestureState.currentGesture === 'pinch_zoom_in'
                  ? 'bg-cyan-950/80 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.4)] ring-1 ring-cyan-400'
                  : 'bg-slate-900/60 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <ZoomIn className="w-4 h-4 text-cyan-400" />
                <span className="text-[10px] font-hud text-slate-400">Action 1</span>
              </div>
              <div className="font-heading font-semibold text-xs text-slate-200">Pinch Fingers</div>
              <div className="text-[11px] text-cyan-300 font-hud">Zoom IN</div>
              <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                Pinch thumb and index finger together
              </p>
            </div>

            {/* Action 2: Open hand */}
            <div
              className={`p-2.5 rounded-lg border transition-all ${
                gestureState.currentGesture === 'open_hand_zoom_out'
                  ? 'bg-cyan-950/80 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.4)] ring-1 ring-cyan-400'
                  : 'bg-slate-900/60 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <ZoomOut className="w-4 h-4 text-cyan-400" />
                <span className="text-[10px] font-hud text-slate-400">Action 2</span>
              </div>
              <div className="font-heading font-semibold text-xs text-slate-200">Open Hand</div>
              <div className="text-[11px] text-cyan-300 font-hud">Zoom OUT</div>
              <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                Spread all fingers outward flat
              </p>
            </div>

            {/* Action 3: Pan Left */}
            <div
              className={`p-2.5 rounded-lg border transition-all ${
                gestureState.currentGesture === 'pan_left'
                  ? 'bg-cyan-950/80 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.4)] ring-1 ring-cyan-400'
                  : 'bg-slate-900/60 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <Move className="w-4 h-4 text-cyan-400" />
                <span className="text-[10px] font-hud text-slate-400">Action 3</span>
              </div>
              <div className="font-heading font-semibold text-xs text-slate-200">Move Hand Left</div>
              <div className="text-[11px] text-cyan-300 font-hud">Pan Left</div>
              <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                Shift hand across viewport to the left
              </p>
            </div>

            {/* Action 4: Pan Right */}
            <div
              className={`p-2.5 rounded-lg border transition-all ${
                gestureState.currentGesture === 'pan_right'
                  ? 'bg-cyan-950/80 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.4)] ring-1 ring-cyan-400'
                  : 'bg-slate-900/60 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <Move className="w-4 h-4 text-cyan-400" />
                <span className="text-[10px] font-hud text-slate-400">Action 4</span>
              </div>
              <div className="font-heading font-semibold text-xs text-slate-200">Move Hand Right</div>
              <div className="text-[11px] text-cyan-300 font-hud">Pan Right</div>
              <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                Shift hand across viewport to the right
              </p>
            </div>

            {/* Action 5: Pan Up */}
            <div
              className={`p-2.5 rounded-lg border transition-all ${
                gestureState.currentGesture === 'pan_up'
                  ? 'bg-cyan-950/80 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.4)] ring-1 ring-cyan-400'
                  : 'bg-slate-900/60 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <Move className="w-4 h-4 text-cyan-400" />
                <span className="text-[10px] font-hud text-slate-400">Action 5</span>
              </div>
              <div className="font-heading font-semibold text-xs text-slate-200">Move Hand Up</div>
              <div className="text-[11px] text-cyan-300 font-hud">Pan Up</div>
              <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                Raise hand vertically in frame
              </p>
            </div>

            {/* Action 6: Pan Down */}
            <div
              className={`p-2.5 rounded-lg border transition-all ${
                gestureState.currentGesture === 'pan_down'
                  ? 'bg-cyan-950/80 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.4)] ring-1 ring-cyan-400'
                  : 'bg-slate-900/60 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <Move className="w-4 h-4 text-cyan-400" />
                <span className="text-[10px] font-hud text-slate-400">Action 6</span>
              </div>
              <div className="font-heading font-semibold text-xs text-slate-200">Move Hand Down</div>
              <div className="text-[11px] text-cyan-300 font-hud">Pan Down</div>
              <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                Lower hand vertically in frame
              </p>
            </div>
          </div>

          {/* Real-time Diagnostics Log Strip */}
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-hud space-y-1.5">
            <div className="flex items-center justify-between text-slate-400 pb-1.5 border-b border-slate-900">
              <span className="text-slate-500 font-medium">LAST ACTION PERFORMED:</span>
              <span className="text-cyan-300 font-semibold">{gestureState.lastAction}</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>ACTIVE TARGET:</span>
              <span className="text-slate-200 uppercase font-semibold">
                {gestureState.target === 'video' ? 'CCTV Video Player' : 'Tactical GIS Map'}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>TARGET STATE:</span>
              {gestureState.target === 'video' ? (
                <span className="text-indigo-300 font-mono">
                  Zoom: {videoTransform.zoom.toFixed(2)}x | Pan: ({videoTransform.panX}, {videoTransform.panY})
                </span>
              ) : (
                <span className="text-cyan-300 font-mono">
                  Coords: {mapTelemetry.lat.toFixed(4)}, {mapTelemetry.lng.toFixed(4)} | Zoom: {mapTelemetry.zoom}x
                </span>
              )}
            </div>
          </div>

          {/* 4. MANUAL GESTURE-TESTING & DEBUG PANEL (Explicitly requested in Requirement 2) */}
          <div className="bg-gradient-to-r from-slate-950 to-slate-900 p-3.5 rounded-lg border border-cyan-500/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-heading font-semibold text-slate-200">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Manual Gesture-Testing & Verification Panel</span>
              </div>
              <span className="text-[10px] font-hud text-slate-400">
                Click any button to test target action directly
              </span>
            </div>

            {/* Trigger buttons for all 6 gestures */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              <button
                onClick={() => simulateGesture('pinch_zoom_in')}
                className="px-2 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 text-[11px] font-hud flex flex-col items-center gap-1 transition-all hover:scale-105"
              >
                <ZoomIn className="w-3.5 h-3.5" />
                <span>Zoom In</span>
              </button>

              <button
                onClick={() => simulateGesture('open_hand_zoom_out')}
                className="px-2 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 text-[11px] font-hud flex flex-col items-center gap-1 transition-all hover:scale-105"
              >
                <ZoomOut className="w-3.5 h-3.5" />
                <span>Zoom Out</span>
              </button>

              <button
                onClick={() => simulateGesture('pan_left')}
                className="px-2 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-[11px] font-hud flex flex-col items-center gap-1 transition-all hover:scale-105"
              >
                <Move className="w-3.5 h-3.5 text-cyan-400" />
                <span>Pan Left</span>
              </button>

              <button
                onClick={() => simulateGesture('pan_right')}
                className="px-2 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-[11px] font-hud flex flex-col items-center gap-1 transition-all hover:scale-105"
              >
                <Move className="w-3.5 h-3.5 text-cyan-400" />
                <span>Pan Right</span>
              </button>

              <button
                onClick={() => simulateGesture('pan_up')}
                className="px-2 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-[11px] font-hud flex flex-col items-center gap-1 transition-all hover:scale-105"
              >
                <Move className="w-3.5 h-3.5 text-cyan-400" />
                <span>Pan Up</span>
              </button>

              <button
                onClick={() => simulateGesture('pan_down')}
                className="px-2 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-[11px] font-hud flex flex-col items-center gap-1 transition-all hover:scale-105"
              >
                <Move className="w-3.5 h-3.5 text-cyan-400" />
                <span>Pan Down</span>
              </button>
            </div>

            {/* Quick Reset for current target */}
            <div className="flex items-center justify-between text-[11px] font-hud pt-1 border-t border-slate-800 text-slate-400">
              <span>Applies immediately to: <strong className="text-cyan-400 uppercase">{gestureState.target}</strong></span>
              {gestureState.target === 'video' ? (
                <button
                  onClick={resetVideoTransform}
                  className="text-cyan-400 hover:underline flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Video (1.0x)</span>
                </button>
              ) : (
                <button
                  onClick={() => triggerMapAction(0, 0, 0)}
                  className="text-cyan-400 hover:underline flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Center Map</span>
                </button>
              )}
            </div>
          </div>

          {/* Configurable Threshold Sliders (shown when toggled) */}
          {showCalibrationPanel && (
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs space-y-2.5">
              <div className="font-heading font-semibold text-slate-200 flex items-center justify-between">
                <span>Gesture Sensitivity & Threshold Calibration</span>
                <button
                  onClick={() => setThresholds(DEFAULT_THRESHOLDS)}
                  className="text-[10px] font-hud text-cyan-400 hover:underline"
                >
                  Reset Defaults
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between text-[11px] font-hud text-slate-400 mb-1">
                    <span>Pinch Threshold:</span>
                    <span className="text-cyan-300 font-bold">{thresholds.pinchThreshold.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.20"
                    max="0.55"
                    step="0.01"
                    value={thresholds.pinchThreshold}
                    onChange={(e) =>
                      setThresholds((prev) => ({ ...prev, pinchThreshold: parseFloat(e.target.value) }))
                    }
                    className="w-full accent-cyan-400 h-1 bg-slate-800 rounded"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-hud text-slate-400 mb-1">
                    <span>Open Hand Spread:</span>
                    <span className="text-cyan-300 font-bold">{thresholds.openHandThreshold.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.50"
                    max="0.90"
                    step="0.01"
                    value={thresholds.openHandThreshold}
                    onChange={(e) =>
                      setThresholds((prev) => ({ ...prev, openHandThreshold: parseFloat(e.target.value) }))
                    }
                    className="w-full accent-cyan-400 h-1 bg-slate-800 rounded"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-hud text-slate-400 mb-1">
                    <span>Pan Dead Zone:</span>
                    <span className="text-cyan-300 font-bold">{thresholds.deadZone.toFixed(3)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.015"
                    max="0.080"
                    step="0.005"
                    value={thresholds.deadZone}
                    onChange={(e) =>
                      setThresholds((prev) => ({ ...prev, deadZone: parseFloat(e.target.value) }))
                    }
                    className="w-full accent-cyan-400 h-1 bg-slate-800 rounded"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-hud text-slate-400 mb-1">
                    <span>Zoom Cooldown:</span>
                    <span className="text-cyan-300 font-bold">{thresholds.zoomCooldownMs}ms</span>
                  </div>
                  <input
                    type="range"
                    min="150"
                    max="700"
                    step="25"
                    value={thresholds.zoomCooldownMs}
                    onChange={(e) =>
                      setThresholds((prev) => ({ ...prev, zoomCooldownMs: parseInt(e.target.value) }))
                    }
                    className="w-full accent-cyan-400 h-1 bg-slate-800 rounded"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
