import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { DashboardPage } from './pages/DashboardPage';
import { TacticalMap } from './components/map/TacticalMap';
import { CameraExplorerPage } from './pages/CameraExplorerPage';
import { ConditionsExplorerPage } from './pages/ConditionsExplorerPage';
import { ConditionDetailPage } from './pages/ConditionDetailPage';
import { AlertsCenterPage } from './pages/AlertsCenterPage';
import { HardwareManagerPage } from './pages/HardwareManagerPage';
import { GestureStudioPage } from './pages/GestureStudioPage';
import { ActivityHistoryPage } from './pages/ActivityHistoryPage';
import { SatelliteGesturePilotPage } from './pages/SatelliteGesturePilotPage';
import { ARPalmUniverseHologramPage } from './pages/ARPalmUniverseHologramPage';
import { RtspGuideModal } from './pages/RtspGuideModal';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Menu, MapPin, Compass, Shield, Globe, Sparkles } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { activeNav, setActiveNav, setIsRTSPGuideOpen } = useApp();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Header */}
      <Header />

      {/* Main Shell Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Navigation */}
        <Sidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} />

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {/* Mobile subheader bar with hamburger trigger */}
          <div className="lg:hidden flex items-center justify-between p-3 bg-slate-950/80 border-b border-slate-800">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold"
            >
              <Menu className="w-4 h-4 text-cyan-400" />
              <span>Navigation Menu</span>
            </button>
            <span className="text-[11px] font-hud text-slate-400 uppercase">
              {activeNav.replace('-', ' ')}
            </span>
          </div>

          {/* Dynamic Page Viewport */}
          <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
            {activeNav === 'dashboard' && <DashboardPage />}

            {activeNav === 'pilot' && <SatelliteGesturePilotPage />}

            {activeNav === 'map' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div>
                    <h1 className="font-heading text-2xl font-bold text-slate-100 flex items-center gap-2">
                      <Compass className="w-6 h-6 text-cyan-400" />
                      Tactical GIS & Zone Explorer
                    </h1>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Full-scale spatial awareness powered by Leaflet & OpenStreetMap (No mandatory API key)
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-hud">
                    <button
                      onClick={() => setActiveNav('pilot')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold transition-all shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>Open Dual-Panel Satellite & Gesture Pilot</span>
                    </button>
                    <button
                      onClick={() => setActiveNav('gestures')}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white"
                    >
                      Configure Gestures
                    </button>
                  </div>
                </div>
                <TacticalMap heightClass="h-[calc(100vh-230px)] min-h-[550px]" showOverlayControls={true} />
              </div>
            )}

            {activeNav === 'camera' && (
              <ErrorBoundary fallbackTitle="CCTV & Optical Feed Explorer Recovery">
                <CameraExplorerPage />
              </ErrorBoundary>
            )}

            {activeNav === 'ar-hologram' && (
              <ErrorBoundary fallbackTitle="AR Palm Universe Hologram Recovery">
                <ARPalmUniverseHologramPage />
              </ErrorBoundary>
            )}

            {activeNav === 'conditions' && <ConditionsExplorerPage />}

            {activeNav === 'condition-detail' && <ConditionDetailPage />}

            {activeNav === 'alerts' && <AlertsCenterPage />}

            {activeNav === 'gestures' && <GestureStudioPage />}

            {activeNav === 'hardware' && <HardwareManagerPage />}

            {activeNav === 'history' && <ActivityHistoryPage />}

            {activeNav === 'guide' && (
              <div className="space-y-6">
                <div className="pb-3 border-b border-slate-800">
                  <h1 className="font-heading text-2xl font-bold text-slate-100">
                    CCTV & RTSP Architecture Documentation
                  </h1>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Production deployment guide for private NVRs (Hikvision DS-7608NXI-K1, Dahua, Axis)
                  </p>
                </div>
                <div className="bg-[#0b1221] border border-cyan-500/20 rounded-xl p-6 text-xs text-slate-300 leading-relaxed space-y-4">
                  <h3 className="font-heading font-semibold text-slate-100 text-sm">
                    Why Direct RTSP In Browser Fails Without A Media Gateway
                  </h3>
                  <p>
                    Browsers operate within strict sandboxed network stacks. Native HTML5 <code>&lt;video&gt;</code> elements only understand streaming media over standard protocols such as WebRTC (low-latency UDP/TCP), HLS (HTTP Live Streaming), and DASH. A direct RTSP stream (port 554) requires transport protocol translation.
                  </p>
                  <p>
                    By running <strong>go2rtc</strong> or <strong>MediaMTX</strong> on your local network (e.g. Docker on a Raspberry Pi, NAS, or workstation), your RTSP streams are instantly converted into sub-second latency WebRTC streams consumable by any web app.
                  </p>
                  <button
                    onClick={() => setIsRTSPGuideOpen(true)}
                    className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold text-xs"
                  >
                    Open Step-by-Step Gateway Setup Modal
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Global RTSP Setup Blueprint Modal */}
      <RtspGuideModal />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
