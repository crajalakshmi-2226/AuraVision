import { DetectedObject } from '../../types';

declare global {
  interface Window {
    cocoSsd?: {
      load: (config?: any) => Promise<any>;
    };
    tf?: any;
  }
}

let loadedModel: any = null;
let isLoading = false;
let modelLoadError: string | null = null;

export interface DetectionResult {
  status: 'ready' | 'loading' | 'unavailable' | 'error';
  detections: DetectedObject[];
  errorMessage?: string;
  isRealInference: boolean;
  engineInfo: string;
}

/**
 * Initializes client-side TensorFlow.js COCO-SSD model
 */
export async function initObjectDetectionModel(): Promise<{
  success: boolean;
  error?: string;
}> {
  if (loadedModel) {
    return { success: true };
  }
  if (isLoading) {
    return { success: false, error: 'Model loading is already in progress' };
  }

  if (typeof window !== 'undefined' && window.cocoSsd) {
    try {
      isLoading = true;
      modelLoadError = null;
      // Load lightweight MobileNet V2 COCO-SSD for fast in-browser inference
      loadedModel = await window.cocoSsd.load({ base: 'lite_mobilenet_v2' });
      isLoading = false;
      return { success: true };
    } catch (err: any) {
      isLoading = false;
      modelLoadError = err?.message || 'Failed to download COCO-SSD neural network weights';
      console.warn('COCO-SSD initialization error:', err);
      return { success: false, error: modelLoadError ?? undefined };
    }
  }

  return {
    success: false,
    error: 'COCO-SSD script library not found on window object. Verify network connection to CDN assets.',
  };
}

export function isModelReady(): boolean {
  return loadedModel !== null;
}

export function getModelStatus(): 'ready' | 'loading' | 'unavailable' | 'error' {
  if (loadedModel) return 'ready';
  if (isLoading) return 'loading';
  if (modelLoadError) return 'error';
  return 'unavailable';
}

/**
 * Runs genuine object detection on a live video or canvas frame.
 * Strictly filters for 'person' and 'dog' classes.
 * Returns genuine model scores. Never fabricates scores if model is unavailable.
 */
export async function detectPeopleAndDogsInVideo(
  videoElement: HTMLVideoElement | HTMLCanvasElement | null
): Promise<DetectionResult> {
  if (!videoElement) {
    return {
      status: 'loading',
      detections: [],
      isRealInference: false,
      engineInfo: 'Waiting for video element mounting...',
    };
  }

  // Check element readiness
  if (videoElement instanceof HTMLVideoElement) {
    if (videoElement.readyState < 2 || videoElement.videoWidth === 0) {
      return {
        status: 'loading',
        detections: [],
        isRealInference: false,
        engineInfo: 'Video metadata loading...',
      };
    }
  }

  // Automatically attempt initialization if window.cocoSsd exists
  if (window.cocoSsd && !loadedModel && !isLoading && !modelLoadError) {
    await initObjectDetectionModel();
  }

  if (loadedModel) {
    try {
      const rawPredictions = await loadedModel.detect(videoElement);
      // Filter strictly for 'person' and 'dog' classes
      const filtered = rawPredictions.filter(
        (p: any) => p.class === 'person' || p.class === 'dog'
      );

      const detections: DetectedObject[] = filtered.map((p: any, index: number) => ({
        id: `obj-${p.class}-${index}-${Date.now().toString(36)}`,
        class: p.class,
        score: Math.round(p.score * 1000) / 10, // Real model score e.g. 91.8%
        bbox: [
          Math.round(p.bbox[0]),
          Math.round(p.bbox[1]),
          Math.round(p.bbox[2]),
          Math.round(p.bbox[3]),
        ],
        timestamp: new Date().toLocaleTimeString(),
      }));

      return {
        status: 'ready',
        detections,
        isRealInference: true,
        engineInfo: `Active MobileNet v2 COCO-SSD Inference (${detections.length} objects detected)`,
      };
    } catch (err: any) {
      return {
        status: 'error',
        detections: [],
        errorMessage: err?.message || 'Frame optical inference failed',
        isRealInference: false,
        engineInfo: 'Inference runtime error',
      };
    }
  }

  return {
    status: isLoading ? 'loading' : modelLoadError ? 'error' : 'unavailable',
    detections: [],
    errorMessage: modelLoadError || 'COCO-SSD model weights not loaded yet.',
    isRealInference: false,
    engineInfo: isLoading
      ? 'Downloading MobileNet weights (~14MB)...'
      : 'COCO-SSD model not initialized. Click "Initialize COCO-SSD Model" to start real optical inference.',
  };
}
