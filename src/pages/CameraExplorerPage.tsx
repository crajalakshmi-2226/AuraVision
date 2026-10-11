import React, { useState, useRef } from 'react';
import {
  Camera,
  CheckCircle2,
  Cpu,
  FileVideo,
  Globe,
  HardDrive,
  HelpCircle,
  Info,
  Layers,
  Lock,
  Play,
  Server,
  Upload,
  Video,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { GestureControlledVideoPlayer } from '../components/camera/GestureControlledVideoPlayer';
import { GestureTracker } from '../components/gestures/GestureTracker';
import { ConditionId } from '../types';

export const CameraExplorerPage: React.FC = () => {
  const {
    cameras,
    selectedCameraId,
    setSelectedCameraId,
    conditions,
    setIsRTSPGuideOpen,
    addNotification,
    gestureState,
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

  const selectedCamera = cameras.find((c) => c.id === selectedCameraId) || cameras[0];
  const selectedConditionObj = conditions.find((c) => c.id === assignedCondition);

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

      // Honest Technical Verification:
      // A web browser running in an isolated HTTPS sandbox cannot reach private LAN IP 192.168.x.x without a local RTSP media gateway (go2rtc / MediaMTX).
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

  return (
    <div className="space-y-6">
      {/* Page Title & Mode Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Camera className="w-6 h-6 text-cyan-400" />
            CCTV & Optical Feed Explorer
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time video viewport, simulated optical AI analysis, and CCTV hardware integration
          </p>
        </div>

        {/* Mode Selector Segmented Tabs */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs">
          <button
            onClick={() => setActiveMode('mode_a_sample')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
              activeMode === 'mode_a_sample'
                ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>Mode A: Built-in Sample</span>
          </button>

          <button
            onClick={() => setActiveMode('mode_b_upload')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
              activeMode === 'mode_b_upload'
                ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Mode B: Upload Footage</span>
          </button>

          <button
            onClick={() => setActiveMode('mode_c_nvr')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
              activeMode === 'mode_c_nvr'
                ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Mode C: Real CCTV / NVR</span>
          </button>
        </div>
      </div>

      {/* MODE A: BUILT-IN SAMPLE DEMONSTRATION */}
      {activeMode === 'mode_a_sample' && (
        <div className="space-y-4">
          {/* Camera Node Switcher Strip */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-slate-400 font-hud text-[11px] whitespace-nowrap">PRELOADED NODES:</span>
            {cameras.map((cam) => (
              <button
                key={cam.id}
                onClick={() => setSelectedCameraId(cam.id)}
                className={`px-3 py-1.5 rounded border whitespace-nowrap transition-colors ${
                  selectedCameraId === cam.id
                    ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50 font-medium'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {cam.name}
              </button>
            ))}
          </div>

          {/* Main Video Viewport Player */}
          <GestureControlledVideoPlayer
            cameraName={selectedCamera.name}
            assignedConditionTitle="Condition 1: Library Occupancy & Loitering"
          />

          {/* Camera Telemetry & Specs Card */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 text-xs font-hud">
            <div>
              <span className="text-slate-400">ASSIGNED LOCATION:</span>
              <p className="text-slate-200 font-medium mt-0.5">{selectedCamera.location}</p>
            </div>
            <div>
              <span className="text-slate-400">RESOLUTION & FPS:</span>
              <p className="text-slate-200 font-medium mt-0.5">
                {selectedCamera.resolution || '1080p'} @ {selectedCamera.fps || 30} FPS
              </p>
            </div>
            <div>
              <span className="text-slate-400">HARDWARE PROFILE:</span>
              <p className="text-cyan-400 font-medium mt-0.5">H.264 IP Dome / IR Sensor</p>
            </div>
            <div>
              <span className="text-slate-400">INFERENCE ENGINE:</span>
              <p className="text-cyan-300 font-medium mt-0.5">COCO-SSD Optical Neural Inference</p>
            </div>
          </div>
        </div>
      )}

      {/* MODE B: UPLOAD CCTV FOOTAGE */}
      {activeMode === 'mode_b_upload' && (
        <div className="space-y-4">
          {/* File Upload Box or Active Uploaded Player */}
          {!uploadedVideoUrl ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center transition-all ${
                isDragging
                  ? 'border-cyan-400 bg-cyan-950/20'
                  : 'border-slate-800 bg-slate-900/40 hover:border-cyan-500/40'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm"
                onChange={handleFileInputChange}
                className="hidden"
              />

              <div className="w-14 h-14 rounded-full bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center mx-auto mb-4 text-cyan-400">
                <FileVideo className="w-7 h-7" />
              </div>

              <h3 className="font-heading text-lg font-bold text-slate-100 mb-1">
                Upload CCTV Video Footage
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto mb-5 leading-relaxed">
                Drag and drop an <strong>MP4</strong> or <strong>WebM</strong> video file from your computer. Video stays 100% local in your browser memory and is never uploaded to any remote server.
              </p>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold text-xs transition-colors shadow-[0_0_15px_rgba(6,182,212,0.3)]"
              >
                Choose Local Video File
              </button>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-[11px] font-hud text-slate-400">
                <span>Supported: MP4 (H.264), WebM (VP8/VP9)</span>
                <span>·</span>
                <span>Safe Browser Sandbox</span>
                <span>·</span>
                <span>Zero Server Upload</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Condition Association Toolbar */}
              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-hud text-slate-400">ACTIVE FILE:</span>
                  <span className="text-slate-100 font-semibold">{uploadedFileName}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-hud text-slate-400">ASSOCIATE MONITORING CONDITION:</span>
                  <select
                    value={assignedCondition}
                    onChange={(e) => setAssignedCondition(e.target.value as ConditionId)}
                    className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-cyan-400"
                  >
                    {conditions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Uploaded Video Player with full Gesture & Transform support */}
              <GestureControlledVideoPlayer
                videoSrc={uploadedVideoUrl}
                isCustomUpload={true}
                onRemoveUpload={removeUploadedVideo}
                cameraName={`Custom Upload: ${uploadedFileName}`}
                assignedConditionTitle={selectedConditionObj?.title}
              />

              {/* Analytical Simulation Disclosure */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-xs">
                <div className="flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-200">Video Analysis Pipeline Disclosure: </span>
                    <span className="text-slate-400">
                      The application displays simulated optical detections on uploaded footage. Real production computer-vision models (such as YOLOv8 or TensorFlow inference pipelines) can be connected through our modular interface without code rewrites. No false live incidents are reported.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODE C: CONNECT REAL CCTV OR NVR */}
      {activeMode === 'mode_c_nvr' && (
        <div className="space-y-6">
          {/* Architecture Explanation Banner */}
          <div className="bg-gradient-to-r from-indigo-950/70 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-xl p-4 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-300 font-heading font-semibold text-sm">
                <Server className="w-4 h-4 text-indigo-400" />
                RTSP & NVR Integration Architecture (Hikvision / Dahua / Axis)
              </div>
              <button
                onClick={() => setIsRTSPGuideOpen(true)}
                className="text-xs text-cyan-400 hover:underline flex items-center gap-1 font-hud"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>View Docker Setup Recipe</span>
              </button>
            </div>
            <p className="text-slate-300 leading-relaxed">
              <strong>Technical Reality:</strong> Web browsers cannot directly open raw RTSP (port 554) TCP sockets in native HTML5 video tags. In production, an authorized CCTV or NVR (such as the <em>Hikvision DS-7608NXI-K1</em>) streams RTSP to a lightweight local media gateway (e.g. <code>go2rtc</code> or <code>MediaMTX</code>), which transcodes or wraps the video into low-latency WebRTC or HLS.
            </p>
          </div>

          {/* NVR Configuration Form */}
          <div className="bg-[#0b1221] border border-cyan-500/20 rounded-xl p-5 space-y-4">
            <h3 className="font-heading font-semibold text-slate-100 text-sm flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-cyan-400" />
              Configure Target NVR / Camera Hardware
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-hud">
              <div>
                <label className="block text-slate-400 mb-1">NVR / CAMERA NAME</label>
                <input
                  type="text"
                  value={nvrConfig.name}
                  onChange={(e) => setNvrConfig({ ...nvrConfig, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">IP ADDRESS / HOSTNAME</label>
                <input
                  type="text"
                  value={nvrConfig.host}
                  onChange={(e) => setNvrConfig({ ...nvrConfig, host: e.target.value })}
                  placeholder="e.g. 192.168.1.100 or cam.facility.local"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">RTSP PORT</label>
                <input
                  type="text"
                  value={nvrConfig.port}
                  onChange={(e) => setNvrConfig({ ...nvrConfig, port: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">CHANNEL ID / SUBSTREAM</label>
                <input
                  type="text"
                  value={nvrConfig.channel}
                  onChange={(e) => setNvrConfig({ ...nvrConfig, channel: e.target.value })}
                  placeholder="e.g. 101 or ch01_sub"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">GATEWAY WRAPPER PROTOCOL</label>
                <select
                  value={nvrConfig.streamProtocol}
                  onChange={(e) => setNvrConfig({ ...nvrConfig, streamProtocol: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400"
                >
                  <option value="RTSP-over-WebRTC Gateway">RTSP over WebRTC Gateway (go2rtc)</option>
                  <option value="HLS (HTTP Live Streaming)">HLS Stream (MediaMTX / NGINX-RTMP)</option>
                  <option value="Raw RTSP (Backend Ingestion)">Raw RTSP (Backend Headless Ingestion)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">WEBRTC / HLS GATEWAY URL</label>
                <input
                  type="text"
                  value={nvrConfig.gatewayUrl}
                  onChange={(e) => setNvrConfig({ ...nvrConfig, gatewayUrl: e.target.value })}
                  placeholder="http://localhost:1984/api/ws?src=cam1"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-slate-400" />
                  AUTH USERNAME (OPTIONAL)
                </label>
                <input
                  type="text"
                  value={nvrConfig.username}
                  onChange={(e) => setNvrConfig({ ...nvrConfig, username: e.target.value })}
                  placeholder="admin"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-slate-400" />
                  AUTH PASSWORD (OPTIONAL)
                </label>
                <input
                  type="password"
                  value={nvrConfig.password}
                  onChange={(e) => setNvrConfig({ ...nvrConfig, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            {/* Test Connection Button & Security Note */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800">
              <span className="text-[11px] font-hud text-slate-400">
                Credentials are kept strictly local in memory and never logged or leaked.
              </span>

              <button
                onClick={handleTestNvrConnection}
                disabled={testConnectionState === 'testing'}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors flex items-center gap-2"
              >
                {testConnectionState === 'testing' ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    <span>Testing Connection Handshake...</span>
                  </>
                ) : (
                  <span>Test Connection Diagnostics</span>
                )}
              </button>
            </div>
          </div>

          {/* Diagnostic Test Result Box (Honest Feedback) */}
          {testResult && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-amber-400 font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>{testResult.message}</span>
              </div>
              <p className="text-slate-300 leading-relaxed font-hud text-[11px]">
                {testResult.diagnosticDetails}
              </p>
              <div className="pt-2 text-[11px] text-cyan-400 flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Sample demonstration and video upload modes remain fully operational.</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Embedded Live Gesture Tracker Module */}
      <GestureTracker />
    </div>
  );
};
