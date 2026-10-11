import React from 'react';
import {
  Check,
  CheckCircle2,
  Code,
  Copy,
  FileText,
  HardDrive,
  Lock,
  Server,
  Shield,
  X,
  AlertTriangle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const RtspGuideModal: React.FC = () => {
  const { isRTSPGuideOpen, setIsRTSPGuideOpen } = useApp();

  if (!isRTSPGuideOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#0b1221] border border-cyan-500/30 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-800">
          <div>
            <div className="text-[10px] font-hud text-cyan-400 uppercase tracking-wider">
              HARDWARE INTEGRATION ARCHITECTURE
            </div>
            <h2 className="font-heading font-bold text-lg text-slate-100 flex items-center gap-2 mt-0.5">
              <Server className="w-5 h-5 text-indigo-400" />
              CCTV & NVR RTSP Integration Blueprint
            </h2>
          </div>
          <button
            onClick={() => setIsRTSPGuideOpen(false)}
            className="p-1 rounded text-slate-400 hover:text-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Technical Reality Warning */}
        <div className="p-4 rounded-lg bg-amber-950/50 border border-amber-600/40 text-xs text-amber-200 space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            Why Direct Browser-to-RTSP Connections Fail
          </div>
          <p className="leading-relaxed">
            Standard web browsers (Chrome, Edge, Safari, Firefox) speak HTTP, WebRTC, and WebSockets. They <strong>cannot open raw TCP sockets on port 554</strong> or decode raw RTSP transport packets natively inside an HTML <code>&lt;video&gt;</code> element. Additionally, private network cameras (e.g. <code>192.168.1.x</code>) are unreachable from cloud-hosted websites.
          </p>
        </div>

        {/* 3-Minute Gateway Recipe with go2rtc / MediaMTX */}
        <div className="space-y-3">
          <h3 className="font-heading font-semibold text-slate-100 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Recommended Production Architecture: Local Media Gateway
          </h3>

          <p className="text-xs text-slate-300 leading-relaxed">
            Deploy an open-source, ultra-low latency gateway such as <strong>go2rtc</strong> or <strong>MediaMTX</strong> on the same local network as your NVR. The gateway connects to the RTSP streams and serves them as standard <strong>WebRTC</strong> or <strong>HLS</strong> to the browser.
          </p>

          {/* Docker Run Code Snippet */}
          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 text-xs font-hud space-y-2">
            <div className="text-slate-400 text-[11px] flex items-center justify-between">
              <span>Step 1: Run go2rtc with Docker (on your local server or mini-PC)</span>
            </div>
            <pre className="text-cyan-300 overflow-x-auto p-2 bg-slate-900 rounded text-[11px] leading-relaxed">
{`docker run --name go2rtc -d \\
  -p 1984:1984 -p 8554:8554 -p 8555:8555/tcp -p 8555:8555/udp \\
  -v ./go2rtc.yaml:/config/go2rtc.yaml \\
  alexxit/go2rtc`}
            </pre>
          </div>

          {/* YAML Config Snippet */}
          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 text-xs font-hud space-y-2">
            <div className="text-slate-400 text-[11px]">
              Step 2: Map Hikvision DS-7608NXI-K1 NVR Stream in <code>go2rtc.yaml</code>
            </div>
            <pre className="text-slate-200 overflow-x-auto p-2 bg-slate-900 rounded text-[11px] leading-relaxed">
{`streams:
  # Hikvision NVR DS-7608NXI-K1 (Channel 1, Main Stream 101 or Substream 102)
  cam_perimeter: rtsp://admin:YOUR_PASS@192.168.1.64:554/Streaming/Channels/101
  cam_server_room: rtsp://admin:YOUR_PASS@192.168.1.64:554/Streaming/Channels/201`}
            </pre>
          </div>
        </div>

        {/* Hikvision NVR DS-7608NXI-K1 Specific Guide */}
        <div className="bg-[#070b14] p-4 rounded-lg border border-slate-800 space-y-2 text-xs">
          <h4 className="font-heading font-semibold text-cyan-300">
            Hikvision DS-7608NXI-K1 Configuration Checklist
          </h4>
          <ul className="space-y-1.5 text-slate-300 list-disc list-inside">
            <li>Open NVR Web Admin: <code>Configuration &gt; Network &gt; Advanced &gt; Integration Protocol</code>.</li>
            <li>Enable <strong>Hikvision-CGI</strong> or <strong>ONVIF</strong> authentication.</li>
            <li>Verify RTSP Port (Default: <code>554</code>) is not blocked by local subnets.</li>
            <li>Use the substream (e.g. channel <code>102</code>) for multi-channel grid monitoring to conserve bandwidth.</li>
          </ul>
        </div>

        {/* Security & Credentials Protocol */}
        <div className="flex items-center gap-2 text-xs font-hud text-slate-400 pt-2 border-t border-slate-800">
          <Lock className="w-4 h-4 text-cyan-400" />
          <span>Security Protocol: Never commit private RTSP passwords to Git or client-side bundles.</span>
        </div>

        {/* Close Button */}
        <div className="flex justify-end pt-2">
          <button
            onClick={() => setIsRTSPGuideOpen(false)}
            className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold text-xs transition-colors"
          >
            Understood & Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
