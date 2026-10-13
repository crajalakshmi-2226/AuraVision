import { useCallback, useEffect, useRef, useState } from 'react';
import { HandLandmarker } from '@mediapipe/tasks-vision';
import { initializeHandLandmarker } from '../../services/handTrackingService';
import { HandPalmAnchor } from './types';

export interface UseARPalmTrackerReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isCameraActive: boolean;
  facingMode: 'user' | 'environment';
  palmAnchor: HandPalmAnchor | null;
  cameraError: string | null;
  isModelLoaded: boolean;
  isSimulatedPalm: boolean;
  fps: number;
  startCamera: (mode?: 'user' | 'environment') => Promise<void>;
  stopCamera: () => void;
  toggleFacingMode: () => Promise<void>;
  setIsSimulatedPalm: (val: boolean) => void;
}

export function useARPalmTracker(): UseARPalmTrackerReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  // Default to front camera ('user') so user immediately sees themselves and their hands
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isModelLoaded, setIsModelLoaded] = useState<boolean>(false);
  const [isSimulatedPalm, setIsSimulatedPalm] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(0);
  const [palmAnchor, setPalmAnchor] = useState<HandPalmAnchor | null>(null);

  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);
  const frameCountRef = useRef<number>(0);
  const lastFpsCalcRef = useRef<number>(performance.now());

  // Smoothing & history state for 2 hands and gestures
  const lastSpanRef = useRef<number | null>(null);
  const lastCentroidRef = useRef<{ x: number; y: number } | null>(null);
  const lastPalmPosRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const smoothedAnchorRef = useRef<HandPalmAnchor>({
    detected: false,
    confidence: 0,
    handCount: 0,
    palmCenter: { x: 0.5, y: 0.65, z: 0 },
    palmNormal: { x: 0, y: 0, z: 1 },
    palmWidth: 0.25,
    wrist: { x: 0.5, y: 0.85 },
    tiltAngleX: 0,
    tiltAngleY: 0,
    tiltAngleZ: 0,
    isTwoHanded: false,
    handSpan: 0.35,
    spanDelta: 0,
    twoHandCentroid: { x: 0.5, y: 0.65 },
    centroidDelta: { x: 0, y: 0 },
    isPinching: false,
    pinchDistance: 0.2,
    pinchCenter: { x: 0.5, y: 0.65 },
    isStationary: true,
    handVelocity: 0,
  });

  // 1. Initialize MediaPipe HandLandmarker Model
  useEffect(() => {
    let isMounted = true;
    initializeHandLandmarker()
      .then((landmarker) => {
        if (isMounted) {
          handLandmarkerRef.current = landmarker;
          setIsModelLoaded(true);
        }
      })
      .catch((err) => {
        console.warn('Could not load HandLandmarker for AR tracking:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Stop Camera
  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  // 3. Start Camera (Front camera by default)
  const startCamera = useCallback(
    async (mode: 'user' | 'environment' = facingMode) => {
      stopCamera();
      setCameraError(null);

      try {
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        setFacingMode(mode);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          await videoRef.current.play();
        }

        setIsCameraActive(true);
      } catch (err: unknown) {
        console.warn('Camera access denied or failed:', err);
        setCameraError((err as Error)?.message || 'Camera permission denied or camera device unavailable');
        // Fall back automatically to simulated palm mode so user can test the experience
        setIsSimulatedPalm(true);
      }
    },
    [facingMode, stopCamera]
  );

  // 4. Flip Camera (Front / Back on phone)
  const toggleFacingMode = useCallback(async () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    await startCamera(nextMode);
  }, [facingMode, startCamera]);

  // 5. Main Hand Tracking Loop with Two-Hand & Manual Control support
  useEffect(() => {
    if (!isCameraActive && !isSimulatedPalm) {
      return;
    }

    const processFrame = () => {
      animationFrameRef.current = requestAnimationFrame(processFrame);

      // FPS tracking
      frameCountRef.current++;
      const now = performance.now();
      if (now - lastFpsCalcRef.current >= 1000) {
        setFps(frameCountRef.current);
        frameCountRef.current = 0;
        lastFpsCalcRef.current = now;
      }

      // If user is in Virtual Simulated Palm Mode
      if (isSimulatedPalm) {
        const simAnchor: HandPalmAnchor = {
          detected: true,
          confidence: 0.95,
          handCount: 1,
          palmCenter: { x: 0.5, y: 0.65, z: 0 },
          palmNormal: { x: 0, y: 0, z: 1 },
          palmWidth: 0.28,
          wrist: { x: 0.5, y: 0.88 },
          tiltAngleX: 0,
          tiltAngleY: 0,
          tiltAngleZ: 0,
          isTwoHanded: false,
          handSpan: 0.35,
          spanDelta: 0,
          twoHandCentroid: { x: 0.5, y: 0.65 },
          centroidDelta: { x: 0, y: 0 },
          isPinching: false,
          pinchDistance: 0.2,
          pinchCenter: { x: 0.5, y: 0.65 },
          isStationary: true,
          handVelocity: 0,
          isSimulated: true,
        };
        setPalmAnchor(simAnchor);
        return;
      }

      const video = videoRef.current;
      const landmarker = handLandmarkerRef.current;

      if (!video || !landmarker || video.readyState < 2) {
        return;
      }

      if (video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime;

        try {
          const results = landmarker.detectForVideo(video, performance.now());

          if (results && results.landmarks && results.landmarks.length > 0) {
            const handCount = results.landmarks.length;
            const hand0 = results.landmarks[0]; // Primary Hand

            // Primary Hand Landmarks:
            // 0: Wrist, 4: Thumb Tip, 8: Index Tip, 5: Index MCP, 9: Middle MCP, 12: Middle Tip, 13: Ring MCP, 17: Pinky MCP
            const wrist0 = hand0[0];
            const thumbTip0 = hand0[4];
            const indexTip0 = hand0[8];
            const indexMcp0 = hand0[5];
            const middleMcp0 = hand0[9];
            const middleTip0 = hand0[12];
            const ringMcp0 = hand0[13];
            const pinkyMcp0 = hand0[17];

            // Primary Palm Center (Centroid of wrist & MCP knuckles)
            const rawPalmX = (wrist0.x + indexMcp0.x + middleMcp0.x + ringMcp0.x + pinkyMcp0.x) / 5;
            const rawPalmY = (wrist0.y + indexMcp0.y + middleMcp0.y + ringMcp0.y + pinkyMcp0.y) / 5;
            const rawPalmZ = (wrist0.z + middleMcp0.z) / 2;

            // Velocity & Stillness Calculation (To stop hologram when hands stop moving)
            let currentVelocity = 0;
            if (lastPalmPosRef.current) {
              const dt = Math.max(1, now - lastPalmPosRef.current.time) / 1000;
              const dX = rawPalmX - lastPalmPosRef.current.x;
              const dY = rawPalmY - lastPalmPosRef.current.y;
              currentVelocity = Math.sqrt(dX * dX + dY * dY) / dt;
            }
            lastPalmPosRef.current = { x: rawPalmX, y: rawPalmY, time: now };
            const isStationary = currentVelocity < 0.04; // Below threshold = completely still

            // Up vector (Wrist -> Middle MCP)
            const vUpX = middleMcp0.x - wrist0.x;
            const vUpY = middleMcp0.y - wrist0.y;
            const vUpZ = middleMcp0.z - wrist0.z;

            // Right vector (Index MCP -> Pinky MCP)
            const vRightX = pinkyMcp0.x - indexMcp0.x;
            const vRightY = pinkyMcp0.y - indexMcp0.y;
            const vRightZ = pinkyMcp0.z - indexMcp0.z;

            // Normal Vector (Perpendicular to palm plane)
            const normalX = vUpY * vRightZ - vUpZ * vRightY;
            const normalY = vUpZ * vRightX - vUpX * vRightZ;
            const normalZ = vUpX * vRightY - vUpY * vRightX;
            const normLen = Math.sqrt(normalX * normalX + normalY * normalY + normalZ * normalZ) || 1;

            const palmWidth = Math.sqrt(vRightX * vRightX + vRightY * vRightY + vRightZ * vRightZ);

            // Hand Rotation Angles:
            // Roll: In-plane rotation angle (Wrist -> Middle MCP)
            const rollAngle = Math.atan2(vUpY, vUpX) * (180 / Math.PI) + 90;
            // Pitch & Yaw from palm normal
            const pitchAngle = Math.atan2(normalY, normalZ) * (180 / Math.PI);
            const yawAngle = Math.atan2(normalX, normalZ) * (180 / Math.PI);

            // Pinch Detection (Thumb Tip -> Index Tip distance)
            const pinchDx = thumbTip0.x - indexTip0.x;
            const pinchDy = thumbTip0.y - indexTip0.y;
            const pinchDz = thumbTip0.z - indexTip0.z;
            const rawPinchDist = Math.sqrt(pinchDx * pinchDx + pinchDy * pinchDy + pinchDz * pinchDz);
            const isPinching = rawPinchDist < 0.08; // Normalized distance threshold
            const pinchCenter = {
              x: (thumbTip0.x + indexTip0.x) / 2,
              y: (thumbTip0.y + indexTip0.y) / 2,
            };

            // Two-Hand Tracking (If user presents both hands)
            let isTwoHanded = false;
            let handSpan = 0.4;
            let spanDelta = 0;
            let twoHandCentroid = { x: rawPalmX, y: rawPalmY };
            let centroidDelta = { x: 0, y: 0 };

            if (handCount >= 2) {
              isTwoHanded = true;
              const hand1 = results.landmarks[1];
              const wrist1 = hand1[0];
              const middleMcp1 = hand1[9];
              const palm1X = (wrist1.x + middleMcp1.x) / 2;
              const palm1Y = (wrist1.y + middleMcp1.y) / 2;

              // Distance between hand 0 and hand 1
              const spanX = palm1X - rawPalmX;
              const spanY = palm1Y - rawPalmY;
              handSpan = Math.sqrt(spanX * spanX + spanY * spanY);

              if (lastSpanRef.current !== null) {
                // Positive = spread hands apart (zoom in); Negative = bring closer (zoom out)
                spanDelta = handSpan - lastSpanRef.current;
              }
              lastSpanRef.current = handSpan;

              // Two-hand centroid
              twoHandCentroid = {
                x: (rawPalmX + palm1X) / 2,
                y: (rawPalmY + palm1Y) / 2,
              };

              if (lastCentroidRef.current !== null) {
                centroidDelta = {
                  x: twoHandCentroid.x - lastCentroidRef.current.x,
                  y: twoHandCentroid.y - lastCentroidRef.current.y,
                };
              }
              lastCentroidRef.current = twoHandCentroid;
            } else {
              lastSpanRef.current = null;
              lastCentroidRef.current = null;
            }

            // Smooth using responsive LERP
            const prev = smoothedAnchorRef.current;
            const alpha = 0.4;

            const smoothed: HandPalmAnchor = {
              detected: true,
              confidence: 0.92,
              handCount,
              palmCenter: {
                x: prev.palmCenter.x + (rawPalmX - prev.palmCenter.x) * alpha,
                y: prev.palmCenter.y + (rawPalmY - prev.palmCenter.y) * alpha,
                z: prev.palmCenter.z + (rawPalmZ - prev.palmCenter.z) * alpha,
              },
              palmNormal: {
                x: normalX / normLen,
                y: normalY / normLen,
                z: normalZ / normLen,
              },
              palmWidth: prev.palmWidth + (palmWidth - prev.palmWidth) * alpha,
              wrist: { x: wrist0.x, y: wrist0.y },
              tiltAngleX: prev.tiltAngleX + (pitchAngle - prev.tiltAngleX) * alpha,
              tiltAngleY: prev.tiltAngleY + (yawAngle - prev.tiltAngleY) * alpha,
              tiltAngleZ: prev.tiltAngleZ + (rollAngle - prev.tiltAngleZ) * alpha,
              isTwoHanded,
              handSpan,
              spanDelta,
              twoHandCentroid,
              centroidDelta,
              isPinching,
              pinchDistance: rawPinchDist,
              pinchCenter,
              isStationary,
              handVelocity: currentVelocity,
              isSimulated: false,
            };

            smoothedAnchorRef.current = smoothed;
            setPalmAnchor(smoothed);

            // Draw glowing AR cyber tracking overlay on 2D canvas
            renderHandOverlay(results.landmarks, video.videoWidth, video.videoHeight, smoothed);
          } else {
            // No hand detected
            if (smoothedAnchorRef.current.detected) {
              smoothedAnchorRef.current.detected = false;
              setPalmAnchor({ ...smoothedAnchorRef.current, detected: false, handCount: 0 });
            }
            lastSpanRef.current = null;
            lastCentroidRef.current = null;
            clearHandOverlay();
          }
        } catch {
          // Frame processing error caught cleanly
        }
      }
    };

    animationFrameRef.current = requestAnimationFrame(processFrame);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isCameraActive, isSimulatedPalm]);

  // 6. Draw futuristic holographic palm HUD overlay on 2D canvas
  const renderHandOverlay = (
    allHandLandmarks: { x: number; y: number }[][],
    vWidth: number,
    vHeight: number,
    anchor: HandPalmAnchor
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (canvas.width !== vWidth || canvas.height !== vHeight) {
      canvas.width = vWidth;
      canvas.height = vHeight;
    }

    ctx.clearRect(0, 0, vWidth, vHeight);
    ctx.save();

    // Render skeleton bones for all detected hands
    allHandLandmarks.forEach((landmarks, handIdx) => {
      const isPrimary = handIdx === 0;
      ctx.strokeStyle = isPrimary ? 'rgba(0, 240, 255, 0.45)' : 'rgba(168, 85, 247, 0.45)';
      ctx.lineWidth = 1.5;

      const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
        [0, 5], [5, 6], [6, 7], [7, 8], // Index
        [0, 9], [9, 10], [10, 11], [11, 12], // Middle
        [0, 13], [13, 14], [14, 15], [15, 16], // Ring
        [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
        [5, 9], [9, 13], [13, 17], // Knuckles
      ];

      connections.forEach(([i, j]) => {
        const p1 = landmarks[i];
        const p2 = landmarks[j];
        ctx.beginPath();
        ctx.moveTo(p1.x * vWidth, p1.y * vHeight);
        ctx.lineTo(p2.x * vWidth, p2.y * vHeight);
        ctx.stroke();
      });

      // Joint nodes
      landmarks.forEach((p, idx) => {
        ctx.fillStyle = idx === 4 || idx === 8 ? '#facc15' : '#38bdf8';
        ctx.beginPath();
        ctx.arc(p.x * vWidth, p.y * vHeight, idx === 4 || idx === 8 ? 3.5 : 2, 0, Math.PI * 2);
        ctx.fill();
      });
    });

    // Primary Palm Hologram Anchor Reticle
    const px = anchor.palmCenter.x * vWidth;
    const py = anchor.palmCenter.y * vHeight;

    // Outer Target Rings
    ctx.strokeStyle = anchor.isStationary ? '#00f0ff' : '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 32, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(6, 182, 212, 0.5)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(px, py, 46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Crosshair ticks
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.5;
    [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].forEach((angle) => {
      const cx1 = px + Math.cos(angle) * 26;
      const cy1 = py + Math.sin(angle) * 26;
      const cx2 = px + Math.cos(angle) * 38;
      const cy2 = py + Math.sin(angle) * 38;
      ctx.beginPath();
      ctx.moveTo(cx1, cy1);
      ctx.lineTo(cx2, cy2);
      ctx.stroke();
    });

    // Center Anchor Core
    ctx.fillStyle = anchor.isStationary ? '#22c55e' : '#00f0ff';
    ctx.beginPath();
    ctx.arc(px, py, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Pinch Reticle (if user is pinching thumb & index)
    if (anchor.isPinching) {
      const pinX = anchor.pinchCenter.x * vWidth;
      const pinY = anchor.pinchCenter.y * vHeight;
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(pinX, pinY, 18, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#facc15';
      ctx.font = '10px monospace';
      ctx.fillText('PINCH GRAB', pinX + 22, pinY + 4);
    }

    // Two-Hand Span line & zoom indicator
    if (anchor.isTwoHanded && allHandLandmarks.length >= 2) {
      const p1 = allHandLandmarks[0][0]; // wrist 0
      const p2 = allHandLandmarks[1][0]; // wrist 1
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(p1.x * vWidth, p1.y * vHeight);
      ctx.lineTo(p2.x * vWidth, p2.y * vHeight);
      ctx.stroke();
      ctx.setLineDash([]);

      const midX = anchor.twoHandCentroid.x * vWidth;
      const midY = anchor.twoHandCentroid.y * vHeight;
      ctx.fillStyle = '#c084fc';
      ctx.font = '10px monospace';
      ctx.fillText(
        anchor.spanDelta > 0.005
          ? 'SPREAD: ZOOM IN ▲'
          : anchor.spanDelta < -0.005
          ? 'PINCH: ZOOM OUT ▼'
          : '2-HAND ANCHOR',
        midX - 45,
        midY - 12
      );
    }

    ctx.restore();
  };

  const clearHandOverlay = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  return {
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
  };
}
