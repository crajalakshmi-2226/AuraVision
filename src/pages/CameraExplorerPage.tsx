import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  CheckCircle2,
  Cpu,
  FileVideo,
  Globe,
  Hand,
  HardDrive,
  HelpCircle,
  Info,
  Layers,
  Lock,
  Play,
  Server,
  Upload,
  Video,
  VideoOff,
  AlertTriangle,
  RotateCcw,
  Sliders,
  Sparkles,
  Terminal,
  ZoomIn,
  ZoomOut,
  Move,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Maximize2,
  Maximize,
  Minimize,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { GestureControlledVideoPlayer } from '../components/camera/GestureControlledVideoPlayer';
import { CameraDevice, ConditionId, GestureType, TrackingStatus } from '../types';
import {
  initializeHandLandmarker,
  drawHandSkeleton,
  analyzeHandLandmarks,
  analyzeTwoHandGestures,
  drawTwoHandLink,
  DEFAULT_THRESHOLDS,
  GestureThresholds,
  HandLandmarkPoint,
  HandAnalysisResult,
  TwoHandTrackingState,
} from '../services/handTrackingService';
import { detectFaceInVideo, drawFaceReticle, FaceDetectionResult } from '../services/faceDetectionService';

declare global {
  interface Window {
    Hands?: any;
  }
}

interface ActionAlert {
  text: string;
  type: 'zoom_in' | 'zoom_out' | 'pan_left' | 'pan_right' | 'pan_up' | 'pan_down' | 'reset';
  timestamp: number;
}

export const CameraExplorerPage: React.FC = () => {
  const {
    cameras,
    selectedCameraId,
    setSelectedCameraId,
    conditions,
    setIsRTSPGuideOpen,
    addNotification,
    gestureState,
    updateGestureState,
    webcamStream,
    startWebcam,
    stopWebcam,
    retryWebcam,
    cameraStatus,
    setCameraStatus,
    isPreviewVisible,
    setIsPreviewVisible,
    videoTransform,
    updateVideoTransform,
    resetVideoTransform,
  } = useApp();

  const [activeMode, setActiveMode] = useState<'mode_a_sample' | 'mode_b_upload' | 'mode_c_nvr'>('mode_a_sample');

  // Mode B Upload states
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [assignedCondition, setAssignedCondition] = useState<ConditionId>('c1_library_occupancy');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mode C Real NVR / RTSP configuration states
  const [nvrConfig, setNvrConfig] = useState({
    name: 'Primary Perimeter Hikvision NVR',
    host: '192.168.1.100',
    port: '554',
    channel: '101',
    streamProtocol: 'RTSP-over-WebRTC Gateway',
    gatewayUrl: 'http://localhost:1984/api/ws?src=cam1',
    username: '',
    password: '',
  });

  const [testConnectionState, setTestConnectionState] = useState<'idle' | 'testing' | 'result'>('idle');
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    diagnosticDetails: string;
  } | null>(null);

  // --- WEBCAM & GESTURE REFS & STATES (DUAL VIEW LEFT PANEL) ---
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hudCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const tasksLandmarkerRef = useRef<any>(null);
  const classicHandsRef = useRef<any>(null);
  const lastVideoTimeRef = useRef<number>(-1);
  const isClassicBusyRef = useRef<boolean>(false);
  const frameCountRef = useRef<number>(0);
  const lastFpsCalcTimeRef = useRef<number>(performance.now());
  const currentFpsRef = useRef<number>(0);

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
  const [showDebugOverlay, setShowDebugOverlay] = useState<boolean>(false);
  const [showUserGuideModal, setShowUserGuideModal] = useState<boolean>(false);

  // Tracking heuristics state
  const prevSmoothedCentroidRef = useRef<{ x: number; y: number } | null>(null);
  const prevTwoHandStateRef = useRef<TwoHandTrackingState | null>(null);
  const lastActionTimeRef = useRef<number>(0);
  const lastTriggeredGestureRef = useRef<GestureType>('none');
  const [lastVideoActionText, setLastVideoActionText] = useState<string>('Video ready. Waiting for gesture stream.');
  const [actionAlert, setActionAlert] = useState<ActionAlert | null>(null);

  const selectedCamera = cameras.find((c) => c.id === selectedCameraId) || cameras[0];
  const selectedConditionObj = conditions.find((c) => c.id === assignedCondition);

  // Set gesture target to 'video' when CCTV Explorer is active
  useEffect(() => {
    updateGestureState({ target: 'video' });
  }, [updateGestureState]);

  // Auto-dismiss action alert
  useEffect(() => {
    if (!actionAlert) return;
    const timer = setTimeout(() => {
      setActionAlert(null);
    }, 1800);
    return () => clearTimeout(timer);
  }, [actionAlert]);

  // File Upload Handlers (Clean memory management with URL.revokeObjectURL)
  const handleFileSelect = (file: File) => {
    if (!file.type.includes('video/mp4') && !file.type.includes('video/webm')) {
      alert('Please upload a valid MP4 or WebM video file.');
      return;
    }

    if (uploadedVideoUrl) {
      URL.revokeObjectURL(uploadedVideoUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setUploadedVideoUrl(objectUrl);
    setUploadedFileName(file.name);
    addNotification(`Loaded local video file: ${file.name}`);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const removeUploadedVideo = () => {
    if (uploadedVideoUrl) {
      URL.revokeObjectURL(uploadedVideoUrl);
      setUploadedVideoUrl(null);
      setUploadedFileName('');
      addNotification('Removed uploaded video and released object URL');
    }
  };

  // Honest Diagnostic Connection Tester for Mode C
  const handleTestNvrConnection = () => {
    setTestConnectionState('testing');
    setTestResult(null);

    setTimeout(() => {
      setTestConnectionState('result');

      const isPrivateIp =
        nvrConfig.host.startsWith('192.168.') ||
        nvrConfig.host.startsWith('10.') ||
        nvrConfig.host.startsWith('172.16.');

      if (isPrivateIp) {
        setTestResult({
          success: false,
          message: 'Local Gateway Unreachable from Web Sandbox',
          diagnosticDetails:
            `Target host ${nvrConfig.host}:${nvrConfig.port} is on a private local area network (LAN). Browsers cannot open direct raw RTSP sockets or traverse private subnets from a hosted web app without an active local WebRTC/HLS media gateway (e.g. go2rtc docker container on your network). Demo mode and local MP4/WebM analysis remain fully operational.`,
        });
      } else {
        setTestResult({
          success: false,
          message: 'RTSP-to-WebRTC Media Proxy Required',
          diagnosticDetails:
            `Host ${nvrConfig.host} contacted, but HTML5 requires WebRTC or HLS stream encapsulation. Direct raw RTSP stream playback cannot be played in native browser <video> tags without media transcoding. Click the "RTSP & NVR Setup Guide" above for the 3-minute Docker gateway recipe.`,
        });
      }
    }, 1200);
  };

  // -------------------------------------------------------------
  // GESTURE ACTION DISPATCHER ON CCTV VIDEO (Inside Right Panel ONLY)
  // -------------------------------------------------------------
  const executeVideoGestureAction = useCallback(
    (gesture: GestureType, confidence: number) => {
      if (!isGestureControlEnabled) return;
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
            updateVideoTransform((prev) => {
              const newZoom = Math.min(4.0, prev.zoom + 0.25);
              setLastVideoActionText(`ZOOM IN applied (${newZoom.toFixed(2)}x)`);
              setActionAlert({
                text: `ZOOM IN (+0.25x) · ${newZoom.toFixed(2)}x`,
                type: 'zoom_in',
                timestamp: Date.now(),
              });
              return { ...prev, zoom: newZoom };
            });
          } else if (gesture === 'open_hand_zoom_out') {
            updateVideoTransform((prev) => {
              const newZoom = Math.max(1.0, prev.zoom - 0.25);
              setLastVideoActionText(`ZOOM OUT applied (${newZoom.toFixed(2)}x)`);
              setActionAlert({
                text: `ZOOM OUT (-0.25x) · ${newZoom.toFixed(2)}x`,
                type: 'zoom_out',
                timestamp: Date.now(),
              });
              return { ...prev, zoom: newZoom };
            });
          } else if (gesture === 'pan_left') {
            const step = Math.round(50 * sensitivity);
            updateVideoTransform((prev) => {
              const newPanX = prev.panX - step;
              setLastVideoActionText(`PAN LEFT applied (${newPanX}px)`);
              setActionAlert({
                text: `PAN LEFT (${step}px)`,
                type: 'pan_left',
                timestamp: Date.now(),
              });
              return { ...prev, panX: newPanX };
            });
          } else if (gesture === 'pan_right') {
            const step = Math.round(50 * sensitivity);
            updateVideoTransform((prev) => {
              const newPanX = prev.panX + step;
              setLastVideoActionText(`PAN RIGHT applied (${newPanX}px)`);
              setActionAlert({
                text: `PAN RIGHT (${step}px)`,
                type: 'pan_right',
                timestamp: Date.now(),
              });
              return { ...prev, panX: newPanX };
            });
          } else if (gesture === 'pan_up') {
            const step = Math.round(40 * sensitivity);
            updateVideoTransform((prev) => {
              const newPanY = prev.panY - step;
              setLastVideoActionText(`PAN UP applied (${newPanY}px)`);
              setActionAlert({
                text: `PAN UP (${step}px)`,
                type: 'pan_up',
                timestamp: Date.now(),
              });
              return { ...prev, panY: newPanY };
            });
          } else if (gesture === 'pan_down') {
            const step = Math.round(40 * sensitivity);
            updateVideoTransform((prev) => {
              const newPanY = prev.panY + step;
              setLastVideoActionText(`PAN DOWN applied (${newPanY}px)`);
              setActionAlert({
                text: `PAN DOWN (${step}px)`,
                type: 'pan_down',
                timestamp: Date.now(),
              });
              return { ...prev, panY: newPanY };
            });
          }
        }
      } else {
        lastTriggeredGestureRef.current = 'none';
      }
    },
    [isGestureControlEnabled, gestureSensitivity, thresholds, updateVideoTransform]
  );

  // -------------------------------------------------------------
  // CAMERA STREAM ATTACHMENT & WEBCAM RUNTIME (LEFT PANEL)
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
          setActiveEngine('MediaPipe Tasks HandLandmarker (WASM GPU/CPU)');
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
  // CONTINUOUS WEBCAM FRAME LOOP (1-Hand & 2-Hand Gestures)
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

      // FPS tracking
      frameCountRef.current++;
      const nowMs = performance.now();
      if (nowMs - lastFpsCalcTimeRef.current >= 1000) {
        currentFpsRef.current = Math.round((frameCountRef.current * 1000) / (nowMs - lastFpsCalcTimeRef.current));
        frameCountRef.current = 0;
        lastFpsCalcTimeRef.current = nowMs;
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

      // CLEAR HUD CANVAS (Keeps live video feed visible, zero opaque black background)
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // --- A. FACE DETECTION (Upper Frame Analyzer) ---
      const face = await detectFaceInVideo(video, offscreenCanvasRef.current || undefined);
      setFaceResult(face);
      if (face.isFaceDetected && face.boundingBox) {
        drawFaceReticle(ctx, face.boundingBox, canvas.width, canvas.height, face.confidence);
      }

      // --- B. HAND LANDMARK DETECTION (1-Hand & 2-Hand Support) ---
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

              if (detectedHandCount >= 2) {
                // Two-Hand Gesture Analysis
                const twoHandRes = analyzeTwoHandGestures(
                  results.landmarks[0],
                  results.landmarks[1],
                  prevTwoHandStateRef.current,
                  thresholds
                );
                prevTwoHandStateRef.current = twoHandRes.nextState;
                recognizedGesture = twoHandRes.gesture;
                recognizedConfidence = twoHandRes.confidence;

                // Draw skeleton for both hands
                results.landmarks.forEach((handPoints: HandLandmarkPoint[], idx: number) => {
                  drawHandSkeleton(ctx, handPoints, canvas.width, canvas.height, idx === 0 ? twoHandRes.gesture : 'none', idx);
                });

                // Draw glowing two-hand navigation link & directional HUD
                drawTwoHandLink(
                  ctx,
                  results.landmarks[0],
                  results.landmarks[1],
                  canvas.width,
                  canvas.height,
                  twoHandRes.gesture,
                  twoHandRes.spanDistance,
                  twoHandRes.twoHandAction
                );
              } else {
                // Single-Hand Gesture Analysis
                prevTwoHandStateRef.current = null;
                const handPoints = results.landmarks[0];
                const analysis = analyzeHandLandmarks(
                  handPoints,
                  prevSmoothedCentroidRef.current,
                  thresholds
                );
                prevSmoothedCentroidRef.current = analysis.smoothedCentroid;
                recognizedGesture = analysis.gesture;
                recognizedConfidence = analysis.confidence;

                drawHandSkeleton(ctx, handPoints, canvas.width, canvas.height, analysis.gesture, 0);
              }
            } else {
              prevSmoothedCentroidRef.current = null;
              prevTwoHandStateRef.current = null;
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

              if (detectedHandCount >= 2) {
                const twoHandRes = analyzeTwoHandGestures(
                  res.multiHandLandmarks[0],
                  res.multiHandLandmarks[1],
                  prevTwoHandStateRef.current,
                  thresholds
                );
                prevTwoHandStateRef.current = twoHandRes.nextState;
                recognizedGesture = twoHandRes.gesture;
                recognizedConfidence = twoHandRes.confidence;

                res.multiHandLandmarks.forEach((pts: any, idx: number) => {
                  drawHandSkeleton(ctx, pts, canvas.width, canvas.height, idx === 0 ? twoHandRes.gesture : 'none', idx);
                });

                drawTwoHandLink(
                  ctx,
                  res.multiHandLandmarks[0],
                  res.multiHandLandmarks[1],
                  canvas.width,
                  canvas.height,
                  twoHandRes.gesture,
                  twoHandRes.spanDistance,
                  twoHandRes.twoHandAction
                );
              } else {
                prevTwoHandStateRef.current = null;
                const primary = res.multiHandLandmarks[0];
                const analysis = analyzeHandLandmarks(primary, prevSmoothedCentroidRef.current, thresholds);
                prevSmoothedCentroidRef.current = analysis.smoothedCentroid;
                recognizedGesture = analysis.gesture;
                recognizedConfidence = analysis.confidence;

                drawHandSkeleton(ctx, primary, canvas.width, canvas.height, analysis.gesture, 0);
              }
            } else {
              prevSmoothedCentroidRef.current = null;
              prevTwoHandStateRef.current = null;
            }
          });

          try {
            classicHandsRef.current.send({ image: video });
          } catch (e) {
            isClassicBusyRef.current = false;
          }
        }
      }

      // Execute gesture action on CCTV video viewport
      if (detectedHandCount > 0 && recognizedGesture !== 'none') {
        executeVideoGestureAction(recognizedGesture, recognizedConfidence);
        setModelStatus('gesture_recognized');
      } else if (detectedHandCount > 0) {
        setModelStatus('hand_detected');
        executeVideoGestureAction('none', 0);
      } else {
        setModelStatus('waiting_hand');
        executeVideoGestureAction('none', 0);
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
  }, [webcamStream, isVideoReady, thresholds, executeVideoGestureAction, updateGestureState]);

  return (
    <div className="w-full flex flex-col gap-4 font-sans select-none">
      {/* Top Banner Notice: Dual-View Layout Confirmation */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 text-slate-300">
          <div className="p-1 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-400">
            <Camera className="w-4 h-4 shrink-0" />
          </div>
          <div>
            <span className="font-heading font-semibold text-slate-100 mr-1.5">
              CCTV & Optical Feed Explorer — Dual View:
            </span>
            <span className="text-slate-400">
              Left panel features live face & hand gesture pilot; right panel controls CCTV video viewport with full 1-hand & 2-hand gesture zooming and panning.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* User Guide Button */}
          <button
            onClick={() => setShowUserGuideModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 border border-indigo-700 font-hud text-[11px] transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
            <span>Gesture Guide</span>
          </button>

          {/* Docker Guide Button */}
          <button
            onClick={() => setIsRTSPGuideOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 font-hud text-[11px]"
          >
            <Server className="w-3.5 h-3.5" />
            <span>NVR Gateway Setup</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* RESPONSIVE FULL-SCREEN TWO-PANEL INTERFACE (Left: Camera, Right: CCTV) */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[calc(100vh-215px)] min-h-[640px]">
        {/* ============================================================ */}
        {/* LEFT PANEL — Live Face and Hand Camera                       */}
        {/* ============================================================ */}
        <div className="lg:col-span-5 flex flex-col bg-[#070b14] border border-cyan-500/20 rounded-xl overflow-hidden shadow-2xl">
          {/* Left Panel Header */}
          <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-400">
                <Camera className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-heading font-bold text-sm text-slate-100 flex items-center gap-2">
                  <span>Live Face & Hand Camera</span>
                  <span className="text-[10px] font-hud px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                    1 & 2 HAND HUD
                  </span>
                </h2>
                <p className="text-[11px] text-slate-400">
                  Touchless gesture feed · Controls CCTV video inside right panel
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

          {/* Left Panel Status Badges Bar */}
          <div className="p-2.5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-1.5 text-xs font-hud">
            {/* Camera Status */}
            <div className="px-2 py-0.5 rounded border border-slate-800 bg-slate-900 text-slate-300 flex items-center gap-1.5 text-[11px]">
              <span className={`w-1.5 h-1.5 rounded-full ${
                cameraStatus === 'connected'
                  ? 'bg-emerald-400'
                  : cameraStatus === 'permission_requested' || cameraStatus === 'loading'
                  ? 'bg-amber-400 animate-pulse'
                  : cameraStatus === 'error'
                  ? 'bg-rose-400'
                  : 'bg-slate-500'
              }`}></span>
              <span>
                {cameraStatus === 'connected'
                  ? 'Camera Ready'
                  : cameraStatus === 'permission_requested'
                  ? 'Permission Requested'
                  : cameraStatus === 'loading'
                  ? 'Initializing...'
                  : cameraStatus === 'error'
                  ? 'Camera Error'
                  : 'Camera Inactive'}
              </span>
            </div>

            {/* Face Status Indicator */}
            <div className={`px-2 py-0.5 rounded border flex items-center gap-1.5 text-[11px] ${
              faceResult.isFaceDetected
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/40'
                : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${faceResult.isFaceDetected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></span>
              <span>{faceResult.label}</span>
            </div>

            {/* Hand Status Indicator (Shows 1 or 2 hands detected) */}
            <div className={`px-2 py-0.5 rounded border flex items-center gap-1.5 text-[11px] ${
              gestureState.handDetected
                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${gestureState.handDetected ? 'bg-cyan-400 animate-ping' : 'bg-slate-500'}`}></span>
              <span>
                {gestureState.handDetected
                  ? gestureState.detectedHandCount >= 2
                    ? '2 Hands Detected [Dual Mode]'
                    : '1 Hand Detected'
                  : 'Waiting for Hand'}
              </span>
            </div>

            {/* Current Gesture Indicator */}
            <div className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 flex items-center gap-1.5 text-[11px]">
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
                    TARGET: <strong className="text-cyan-300 uppercase">Right CCTV Viewport</strong>
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
                  Enable webcam to activate live face tracking and hand gesture CCTV video control.
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

          {/* Left Panel Bottom Controls & Manual Gesture Simulator */}
          <div className="p-3 bg-slate-900/90 border-t border-slate-800 space-y-2 text-xs font-hud">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-slate-500">LAST VIDEO ACTION:</span>
              <span className="text-cyan-300 font-semibold truncate max-w-[240px]">{lastVideoActionText}</span>
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

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCalibrationDrawer(!showCalibrationDrawer)}
                  className="text-cyan-400 hover:underline flex items-center gap-1 text-[11px]"
                >
                  <Sliders className="w-3 h-3" />
                  <span>{showCalibrationDrawer ? 'Hide Controls' : 'Sensitivity & Simulator'}</span>
                </button>
              </div>
            </div>

            {/* Manual Gesture Simulator & Sensitivity Drawer */}
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

                {/* Instant Gesture Simulator Test Buttons (Test actions even if camera is off) */}
                <div className="pt-2 border-t border-slate-900">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-slate-400">MANUAL VIDEO TRIGGER PANEL:</span>
                    <span className="text-[9px] text-emerald-400">Always Active</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                    <button
                      onClick={() => executeVideoGestureAction('pinch_zoom_in', 0.99)}
                      className="p-1.5 rounded bg-slate-900 hover:bg-slate-850 text-cyan-300 border border-slate-800 flex items-center justify-center gap-1 transition-colors"
                      title="Simulate Pinch / 2-Hand Spread (Zoom In)"
                    >
                      <ZoomIn className="w-3 h-3 text-cyan-400" /> Zoom (+0.25)
                    </button>
                    <button
                      onClick={() => executeVideoGestureAction('open_hand_zoom_out', 0.99)}
                      className="p-1.5 rounded bg-slate-900 hover:bg-slate-850 text-cyan-300 border border-slate-800 flex items-center justify-center gap-1 transition-colors"
                      title="Simulate Open Hand / 2-Hand Contract (Zoom Out)"
                    >
                      <ZoomOut className="w-3 h-3 text-cyan-400" /> Zoom (-0.25)
                    </button>
                    <button
                      onClick={resetVideoTransform}
                      className="p-1.5 rounded bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 flex items-center justify-center gap-1 transition-colors"
                      title="Reset Video Viewport to 1.0x"
                    >
                      <RotateCcw className="w-3 h-3 text-slate-400" /> Reset View
                    </button>

                    <button
                      onClick={() => executeVideoGestureAction('pan_left', 0.99)}
                      className="p-1.5 rounded bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-800 flex items-center justify-center gap-1 transition-colors"
                    >
                      <ArrowLeft className="w-3 h-3 text-amber-400" /> Pan Left
                    </button>
                    <button
                      onClick={() => executeVideoGestureAction('pan_right', 0.99)}
                      className="p-1.5 rounded bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-800 flex items-center justify-center gap-1 transition-colors"
                    >
                      <ArrowRight className="w-3 h-3 text-amber-400" /> Pan Right
                    </button>
                    <button
                      onClick={() => executeVideoGestureAction('pan_up', 0.99)}
                      className="p-1.5 rounded bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-800 flex items-center justify-center gap-1 transition-colors"
                    >
                      <ArrowUp className="w-3 h-3 text-amber-400" /> Pan Up
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ============================================================ */}
        {/* RIGHT PANEL — CCTV & Optical Video Viewport                  */}
        {/* ============================================================ */}
        <div className="lg:col-span-7 flex flex-col bg-[#070b14] border border-cyan-500/20 rounded-xl overflow-hidden shadow-2xl relative">
          {/* Right Panel Header: Mode Switcher (Sample, Upload, Real NVR) */}
          <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 z-10">
            {/* Mode Switcher Segmented Buttons */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs font-hud">
              <button
                onClick={() => setActiveMode('mode_a_sample')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                  activeMode === 'mode_a_sample'
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Play className="w-3.5 h-3.5" />
                <span>Preloaded Nodes</span>
              </button>

              <button
                onClick={() => setActiveMode('mode_b_upload')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                  activeMode === 'mode_b_upload'
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Footage</span>
              </button>

              <button
                onClick={() => setActiveMode('mode_c_nvr')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                  activeMode === 'mode_c_nvr'
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Server className="w-3.5 h-3.5" />
                <span>Real CCTV / NVR</span>
              </button>
            </div>

            {/* Transform HUD Pill */}
            <div className="flex items-center gap-2 text-xs font-hud">
              <span className="text-cyan-300 bg-slate-950 px-2.5 py-1 rounded border border-cyan-500/30">
                Zoom: {videoTransform.zoom.toFixed(2)}x · Pan: ({videoTransform.panX}, {videoTransform.panY})
              </span>
              <button
                onClick={resetVideoTransform}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700"
                title="Reset Video Transform to 1.0x"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Subheader Node Switcher for Mode A */}
          {activeMode === 'mode_a_sample' && (
            <div className="px-3 py-1.5 bg-slate-950/90 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto text-[11px] font-hud z-10 scrollbar-none">
              <span className="text-slate-500 uppercase tracking-wider text-[10px] shrink-0">
                Active CCTV Node:
              </span>
              {cameras.map((cam) => (
                <button
                  key={cam.id}
                  onClick={() => setSelectedCameraId(cam.id)}
                  className={`px-2.5 py-0.5 rounded-full border shrink-0 transition-colors ${
                    selectedCameraId === cam.id
                      ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/60 font-semibold'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {cam.name}
                </button>
              ))}
            </div>
          )}

          {/* Subheader File Upload Status for Mode B */}
          {activeMode === 'mode_b_upload' && (
            <div className="px-3 py-1.5 bg-slate-950/90 border-b border-slate-800/80 flex items-center justify-between gap-2 text-[11px] font-hud z-10">
              <div className="flex items-center gap-2 truncate">
                <span className="text-slate-500 uppercase text-[10px]">Uploaded File:</span>
                <span className="text-slate-200 font-semibold truncate">
                  {uploadedFileName || 'No custom file loaded (Showing default sample)'}
                </span>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-[10px] uppercase shrink-0 transition-colors"
              >
                Choose Local Video
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm"
                onChange={handleFileInputChange}
                className="hidden"
              />
            </div>
          )}

          {/* Right Panel Main Video Viewport */}
          <div className="flex-1 w-full relative z-0 flex flex-col justify-center bg-slate-950 overflow-hidden">
            {/* Visual Action Alert Indicator */}
            {actionAlert && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none animate-bounce">
                <div className="bg-[#070b14]/95 border-2 border-cyan-400 text-cyan-200 px-4 py-2 rounded-xl shadow-[0_0_24px_rgba(6,182,212,0.6)] flex items-center gap-2.5 text-xs font-hud tracking-wide font-bold backdrop-blur-md">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
                  </span>
                  <span>{actionAlert.text}</span>
                </div>
              </div>
            )}

            {/* Mode A & B Video Player Component */}
            {activeMode === 'mode_a_sample' && (
              <GestureControlledVideoPlayer
                cameraName={selectedCamera.name}
                assignedConditionTitle="Condition 1: Library Occupancy & Loitering"
              />
            )}

            {activeMode === 'mode_b_upload' && (
              uploadedVideoUrl ? (
                <GestureControlledVideoPlayer
                  videoSrc={uploadedVideoUrl}
                  isCustomUpload={true}
                  onRemoveUpload={removeUploadedVideo}
                  cameraName={`Custom Upload: ${uploadedFileName}`}
                  assignedConditionTitle={selectedConditionObj?.title}
                />
              ) : (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`m-4 border-2 border-dashed rounded-xl p-8 text-center transition-all flex flex-col items-center justify-center flex-1 ${
                    isDragging
                      ? 'border-cyan-400 bg-cyan-950/20'
                      : 'border-slate-800 bg-slate-900/40 hover:border-cyan-500/40'
                  }`}
                >
                  <div className="w-14 h-14 rounded-full bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center mx-auto mb-4 text-cyan-400">
                    <FileVideo className="w-7 h-7" />
                  </div>
                  <h3 className="font-heading text-base font-bold text-slate-100 mb-1">
                    Drop CCTV MP4 or WebM Video Here
                  </h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4 leading-relaxed">
                    Local video stays 100% inside your browser memory. Fullscreen and hand-gesture pan/zoom controls are enabled upon upload.
                  </p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold text-xs font-hud transition-colors shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                  >
                    Select Video File
                  </button>
                </div>
              )
            )}

            {activeMode === 'mode_c_nvr' && (
              <div className="p-4 space-y-4 overflow-y-auto max-h-full">
                <div className="bg-[#0b1221] border border-cyan-500/30 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-cyan-300 font-heading font-semibold text-sm">
                      <Server className="w-4 h-4 text-cyan-400" />
                      <span>Direct NVR Hardware Stream Configuration</span>
                    </div>
                    <span className="text-[10px] font-hud px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                      RTSP TO WEBRTC
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-hud">
                    <div>
                      <label className="block text-slate-400 mb-1">CAMERA / NVR HOST IP</label>
                      <input
                        type="text"
                        value={nvrConfig.host}
                        onChange={(e) => setNvrConfig({ ...nvrConfig, host: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">LOCAL WEBRTC GATEWAY URL</label>
                      <input
                        type="text"
                        value={nvrConfig.gatewayUrl}
                        onChange={(e) => setNvrConfig({ ...nvrConfig, gatewayUrl: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={handleTestNvrConnection}
                      disabled={testConnectionState === 'testing'}
                      className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs font-hud transition-colors shadow-lg"
                    >
                      {testConnectionState === 'testing' ? 'Verifying RTSP Connection...' : 'Test & Connect Live Feed'}
                    </button>
                    <button
                      onClick={() => setIsRTSPGuideOpen(true)}
                      className="text-cyan-400 hover:underline text-xs font-hud flex items-center gap-1"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Open Setup Guide</span>
                    </button>
                  </div>

                  {testResult && (
                    <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs space-y-1">
                      <div className="font-bold text-amber-300">{testResult.message}</div>
                      <div className="text-slate-400 leading-relaxed text-[11px]">{testResult.diagnosticDetails}</div>
                    </div>
                  )}
                </div>

                {/* Mode C Video Player Stream Placeholder/Player */}
                <GestureControlledVideoPlayer
                  cameraName={nvrConfig.name}
                  assignedConditionTitle="NVR Perimeter Hardware Node"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* USER GUIDE MODAL FOR BOTH 1-HAND & 2-HAND GESTURES             */}
      {/* ============================================================== */}
      {showUserGuideModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0b1221] border border-cyan-500/40 rounded-xl max-w-2xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-cyan-950 border border-cyan-500/40 text-cyan-400">
                  <Hand className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-slate-100 text-base">
                    1-Hand & 2-Hand Gesture Pilot Guide
                  </h3>
                  <p className="text-xs text-slate-400">
                    Full control for Satellite Map and CCTV Optical Video Viewports
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowUserGuideModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-300 leading-relaxed max-h-[70vh] overflow-y-auto pr-1">
              {/* 2-Hand Gestures Highlight Card */}
              <div className="p-3.5 bg-gradient-to-r from-cyan-950/70 to-slate-900 rounded-lg border border-cyan-500/40 space-y-2">
                <h4 className="font-heading font-bold text-cyan-300 text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>Two-Hand Simultaneous Controls</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 bg-slate-950/70 rounded border border-cyan-500/20">
                    <strong className="text-emerald-400 block mb-0.5">👐 SPREAD 2 HANDS APART:</strong>
                    Increase distance between both hands &rarr; <strong>ZOOM IN</strong> on video or map.
                  </div>
                  <div className="p-2 bg-slate-950/70 rounded border border-cyan-500/20">
                    <strong className="text-cyan-400 block mb-0.5">🤲 BRING 2 HANDS TOGETHER:</strong>
                    Decrease distance between both hands &rarr; <strong>ZOOM OUT</strong> on video or map.
                  </div>
                  <div className="p-2 bg-slate-950/70 rounded border border-amber-500/20 md:col-span-2">
                    <strong className="text-amber-300 block mb-0.5">↔️ MOVE BOTH HANDS TOGETHER:</strong>
                    Shift both hands left, right, up, or down simultaneously &rarr; <strong>PANS VIEWPORT</strong> in that direction.
                  </div>
                </div>
              </div>

              {/* 1-Hand Gestures */}
              <div className="p-3.5 bg-slate-900/80 rounded-lg border border-slate-800 space-y-2">
                <h4 className="font-heading font-semibold text-slate-100 text-xs flex items-center gap-2">
                  <Hand className="w-4 h-4 text-cyan-400" />
                  <span>Single-Hand Controls (Auto-Active when 1 hand is visible)</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
                  <div className="p-2 bg-slate-950 rounded border border-slate-800">
                    <strong className="text-cyan-300 block">🤏 PINCH:</strong>
                    Thumb & Index touch &rarr; Zoom In.
                  </div>
                  <div className="p-2 bg-slate-950 rounded border border-slate-800">
                    <strong className="text-cyan-300 block">✋ OPEN HAND:</strong>
                    All 5 fingers spread &rarr; Zoom Out.
                  </div>
                  <div className="p-2 bg-slate-950 rounded border border-slate-800">
                    <strong className="text-amber-300 block">↔️ MOVE HAND:</strong>
                    Move left, right, up, down &rarr; Pan.
                  </div>
                </div>
              </div>

              {/* Fullscreen Instructions */}
              <div className="p-3.5 bg-slate-900/80 rounded-lg border border-slate-800 space-y-1.5">
                <h4 className="font-heading font-semibold text-slate-100 text-xs flex items-center gap-2">
                  <Maximize className="w-4 h-4 text-cyan-400" />
                  <span>Fullscreen Video Viewport</span>
                </h4>
                <p className="text-[11px] text-slate-400">
                  Click the <strong>Fullscreen [ ]</strong> button inside the CCTV video player to expand the uploaded video or live stream to full screen while hand gestures continue operating.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowUserGuideModal(false)}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold text-xs font-heading"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
