import { FilesetResolver, HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { GestureType, TrackingStatus } from '../types';

export interface HandLandmarkPoint {
  x: number;
  y: number;
  z: number;
}

export interface HandDetectionMetrics {
  detectedHandCount: number;
  landmarks: HandLandmarkPoint[][];
  rawPinchDistance: number;
  rawPinchRatio: number;
  rawExtensionScore: number;
  centroid: { x: number; y: number };
  gesture: GestureType;
  confidence: number;
  trackingStatus: TrackingStatus;
  engineName: 'MediaPipe Tasks HandLandmarker' | 'MediaPipe Classic Hands' | 'Optical Reticle Engine';
  statusDescription: string;
}

export interface GestureThresholds {
  pinchThreshold: number; // default 0.35
  openHandThreshold: number; // default 0.65
  deadZone: number; // default 0.035
  zoomCooldownMs: number; // default 350ms
  panCooldownMs: number; // default 160ms
  smoothingFactor: number; // default 0.35
}

export const DEFAULT_THRESHOLDS: GestureThresholds = {
  pinchThreshold: 0.35,
  openHandThreshold: 0.65,
  deadZone: 0.035,
  zoomCooldownMs: 350,
  panCooldownMs: 160,
  smoothingFactor: 0.35,
};

// Singleton instance holder
let handLandmarkerInstance: HandLandmarker | null = null;
let isInitializingModel = false;
let modelInitPromise: Promise<HandLandmarker | null> | null = null;

/**
 * Initializes Google MediaPipe HandLandmarker from @mediapipe/tasks-vision
 */
export async function initializeHandLandmarker(): Promise<HandLandmarker | null> {
  if (handLandmarkerInstance) {
    return handLandmarkerInstance;
  }
  if (isInitializingModel && modelInitPromise) {
    return modelInitPromise;
  }

  isInitializingModel = true;
  modelInitPromise = (async () => {
    try {
      // 1. Resolve WASM assets from jsdelivr CDN
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      // 2. Load official Google Hand Landmarker model
      try {
        handLandmarkerInstance = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        isInitializingModel = false;
        return handLandmarkerInstance;
      } catch (gpuError) {
        console.warn('MediaPipe GPU delegate unavailable, falling back to CPU delegate:', gpuError);
        // Fallback to CPU delegate if WebGL is unavailable
        handLandmarkerInstance = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        isInitializingModel = false;
        return handLandmarkerInstance;
      }
    } catch (err) {
      console.warn('Failed to initialize MediaPipe Tasks HandLandmarker:', err);
      isInitializingModel = false;
      return null;
    }
  })();

  return modelInitPromise;
}

export function disposeHandLandmarker() {
  if (handLandmarkerInstance) {
    try {
      handLandmarkerInstance.close();
    } catch (e) {}
    handLandmarkerInstance = null;
  }
  modelInitPromise = null;
  isInitializingModel = false;
}

/**
 * 21 Hand Landmark Finger Joint Bones Connection Map
 */
export const HAND_CONNECTIONS = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle
  [0, 9], [9, 10], [10, 11], [11, 12],
  // Ring
  [0, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm Knuckle Cross-Links
  [5, 9], [9, 13], [13, 17],
];

/**
 * Renders the tactical high-tech HUD hand landmark skeleton onto canvas
 */
export function drawHandSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: HandLandmarkPoint[],
  canvasWidth: number,
  canvasHeight: number,
  currentGesture: GestureType,
  handIndex: number = 0
) {
  if (!landmarks || landmarks.length < 21) return;

  // Mirror x coordinate so it mirrors user's physical motion naturally
  const toScreenX = (x: number) => (1 - x) * canvasWidth;
  const toScreenY = (y: number) => y * canvasHeight;

  // 1. Draw glowing bones
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  HAND_CONNECTIONS.forEach(([i, j]) => {
    const p1 = landmarks[i];
    const p2 = landmarks[j];
    const x1 = toScreenX(p1.x);
    const y1 = toScreenY(p1.y);
    const x2 = toScreenX(p2.x);
    const y2 = toScreenY(p2.y);

    // Outer cyber-glow
    ctx.strokeStyle = currentGesture !== 'none' ? 'rgba(34, 211, 238, 0.4)' : 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Inner bone line
    ctx.strokeStyle = currentGesture !== 'none' ? '#22d3ee' : '#38bdf8';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  });

  // 2. Draw joints
  landmarks.forEach((pt, idx) => {
    const x = toScreenX(pt.x);
    const y = toScreenY(pt.y);
    const isTip = idx === 4 || idx === 8 || idx === 12 || idx === 16 || idx === 20;
    const isPinchFinger = idx === 4 || idx === 8;

    // Joint glow
    ctx.fillStyle = isTip
      ? currentGesture === 'pinch_zoom_in' && isPinchFinger
        ? '#4ade80' // Green for pinch tips
        : currentGesture === 'open_hand_zoom_out'
        ? '#38bdf8' // Cyan for open hand tips
        : '#f43f5e' // Rose for fingertip tips
      : '#a855f7'; // Purple for knuckle joints

    ctx.beginPath();
    ctx.arc(x, y, isTip ? 4.5 : 3, 0, Math.PI * 2);
    ctx.fill();

    // White center pip
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, isTip ? 1.8 : 1.2, 0, Math.PI * 2);
    ctx.fill();
  });

  // 3. Highlight specific gesture cues
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const tx = toScreenX(thumbTip.x);
  const ty = toScreenY(thumbTip.y);
  const ix = toScreenX(indexTip.x);
  const iy = toScreenY(indexTip.y);

  if (currentGesture === 'pinch_zoom_in') {
    // Glowing beam between thumb and index
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(ix, iy);
    ctx.stroke();

    // Pinch center reticle
    const midX = (tx + ix) / 2;
    const midY = (ty + iy) / 2;
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('PINCH [ZOOM IN]', midX - 45, midY - 14);

    ctx.strokeStyle = '#4ade80';
    ctx.beginPath();
    ctx.arc(midX, midY, 14, 0, Math.PI * 2);
    ctx.stroke();
  } else if (currentGesture === 'open_hand_zoom_out') {
    // Open hand radial arc above fingers
    const wrist = landmarks[0];
    const wx = toScreenX(wrist.x);
    const wy = toScreenY(wrist.y);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('OPEN HAND [ZOOM OUT]', wx - 60, wy - 140);
  } else if (
    currentGesture === 'pan_left' ||
    currentGesture === 'pan_right' ||
    currentGesture === 'pan_up' ||
    currentGesture === 'pan_down'
  ) {
    const palmX = toScreenX((landmarks[0].x + landmarks[5].x + landmarks[17].x) / 3);
    const palmY = toScreenY((landmarks[0].y + landmarks[5].y + landmarks[17].y) / 3);

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`MOTION: ${currentGesture.replace('_', ' ').toUpperCase()}`, palmX - 50, palmY - 24);

    // Direction arrow
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(palmX, palmY);
    let targetX = palmX;
    let targetY = palmY;
    if (currentGesture === 'pan_left') targetX -= 40;
    if (currentGesture === 'pan_right') targetX += 40;
    if (currentGesture === 'pan_up') targetY -= 40;
    if (currentGesture === 'pan_down') targetY += 40;
    ctx.lineTo(targetX, targetY);
    ctx.stroke();
  }

  // Draw hand identifier badge
  const wrist = landmarks[0];
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(toScreenX(wrist.x) - 30, toScreenY(wrist.y) + 12, 60, 16);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
  ctx.strokeRect(toScreenX(wrist.x) - 30, toScreenY(wrist.y) + 12, 60, 16);
  ctx.fillStyle = '#38bdf8';
  ctx.font = '9px monospace';
  ctx.fillText(`HAND #${handIndex + 1}`, toScreenX(wrist.x) - 22, toScreenY(wrist.y) + 24);

  ctx.restore();
}

/**
 * Calculates scale-invariant hand gesture metrics from 21 landmarks
 */
export function analyzeHandLandmarks(
  landmarks: HandLandmarkPoint[],
  prevSmoothedCentroid: { x: number; y: number } | null,
  thresholds: GestureThresholds = DEFAULT_THRESHOLDS
): {
  gesture: GestureType;
  confidence: number;
  rawPinchDistance: number;
  rawPinchRatio: number;
  rawExtensionScore: number;
  currentCentroid: { x: number; y: number };
  smoothedCentroid: { x: number; y: number };
} {
  const wrist = landmarks[0];
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const middleTip = landmarks[12];
  const ringTip = landmarks[16];
  const pinkyTip = landmarks[20];
  const middleMCP = landmarks[9];
  const indexMCP = landmarks[5];
  const pinkyMCP = landmarks[17];

  // 1. Palm Scale Reference (wrist to middle knuckle)
  const palmScale = Math.max(0.06, Math.hypot(wrist.x - middleMCP.x, wrist.y - middleMCP.y));

  // 2. Pinch calculation (Thumb tip 4 to Index tip 8)
  const rawPinchDistance = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
  const rawPinchRatio = rawPinchDistance / palmScale;

  // 3. Fingertip Extension & Spread Score (average distance of 5 tips from wrist relative to palm size)
  const extThumb = Math.hypot(thumbTip.x - wrist.x, thumbTip.y - wrist.y);
  const extIndex = Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y);
  const extMiddle = Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y);
  const extRing = Math.hypot(ringTip.x - wrist.x, ringTip.y - wrist.y);
  const extPinky = Math.hypot(pinkyTip.x - wrist.x, pinkyTip.y - wrist.y);
  const rawExtensionScore = (extThumb + extIndex + extMiddle + extRing + extPinky) / (5 * palmScale);

  // 4. Palm Centroid in Mirrored Screen Space
  const rawCentroidX = (wrist.x + indexMCP.x + pinkyMCP.x) / 3;
  const rawCentroidY = (wrist.y + indexMCP.y + pinkyMCP.y) / 3;
  // In mirrored coordinates: user moving left is lower x on mirrored screen
  const currentCentroid = {
    x: 1 - rawCentroidX,
    y: rawCentroidY,
  };

  // Exponential moving average smoothing
  const alpha = thresholds.smoothingFactor;
  const smoothedCentroid = prevSmoothedCentroid
    ? {
        x: alpha * currentCentroid.x + (1 - alpha) * prevSmoothedCentroid.x,
        y: alpha * currentCentroid.y + (1 - alpha) * prevSmoothedCentroid.y,
      }
    : currentCentroid;

  let gesture: GestureType = 'none';
  let confidence = 0.85;

  // Gesture Rule 1: PINCH (Thumb tip and Index tip touching or very close)
  if (rawPinchRatio < thresholds.pinchThreshold) {
    gesture = 'pinch_zoom_in';
    confidence = Math.min(0.99, Math.max(0.72, 1.0 - rawPinchRatio * 1.5));
  }
  // Gesture Rule 2: OPEN HAND (All 5 fingers extended and spread outward)
  else if (rawExtensionScore > 1.32 && rawPinchRatio > thresholds.openHandThreshold) {
    gesture = 'open_hand_zoom_out';
    confidence = Math.min(0.99, Math.max(0.75, rawExtensionScore * 0.65));
  }
  // Gesture Rule 3: MOTION PANNING (Hand displacement exceeding dead zone)
  else if (prevSmoothedCentroid) {
    const dx = currentCentroid.x - prevSmoothedCentroid.x;
    const dy = currentCentroid.y - prevSmoothedCentroid.y;
    const deadZone = thresholds.deadZone;

    if (Math.abs(dx) > deadZone || Math.abs(dy) > deadZone) {
      if (Math.abs(dx) >= Math.abs(dy)) {
        // Horizontal motion
        gesture = dx > 0 ? 'pan_right' : 'pan_left';
      } else {
        // Vertical motion
        gesture = dy > 0 ? 'pan_down' : 'pan_up';
      }
      confidence = Math.min(0.96, Math.max(0.70, Math.max(Math.abs(dx), Math.abs(dy)) * 8));
    }
  }

  return {
    gesture,
    confidence,
    rawPinchDistance,
    rawPinchRatio,
    rawExtensionScore,
    currentCentroid,
    smoothedCentroid,
  };
}
