import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  Camera,
  CheckCircle2,
  Cpu,
  Hand,
  HelpCircle,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Logo } from '../common/Logo';
import { PWAInstallButton } from '../common/PWAInstallButton';

export const Header: React.FC = () => {
  const {
    demoMode,
    setDemoMode,
    injectSimulatedIncident,
    gestureState,
    updateGestureState,
    alerts,
    notifications,
    setIsRTSPGuideOpen,
    activeNav,
    setActiveNav,
    stopWebcam,
  } = useApp();

  const [showNotifications, setShowNotifications] = useState(false);

  const activeAlertsCount = alerts.filter((a) => a.status === 'new').length;

  return (
    <header className="sticky top-0 z-40 w-full bg-[#070b14]/90 backdrop-blur-md border-b border-cyan-500/15 px-4 lg:px-6 py-2.5">
      <div className="flex items-center justify-between gap-4">
        {/* Brand & Tagline */}
        <div className="flex items-center gap-6">
          <Logo size="md" showTagline={true} />
        </div>

        {/* System Status Telemetry Strip (Honest Labeling) */}
        <div className="hidden xl:flex items-center gap-4 text-xs font-hud bg-slate-900/80 px-3.5 py-1.5 rounded border border-slate-800">
          {/* Mode Indicator */}
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${demoMode === 'running' ? 'bg-cyan-400' : 'bg-amber-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${demoMode === 'running' ? 'bg-cyan-500' : 'bg-amber-500'}`}></span>
            </span>
            <span className="text-slate-400">STATE:</span>
            <span className="text-cyan-300 font-medium uppercase">
              {demoMode === 'running' ? 'Demo Simulation' : demoMode === 'paused' ? 'Demo Paused' : 'Simulation Idle'}
            </span>
          </div>

          <span className="text-slate-700">|</span>

          {/* Camera Status */}
          <div className="flex items-center gap-1.5 text-slate-400">
            <Camera className="w-3.5 h-3.5 text-slate-400" />
            <span>CAMERAS:</span>
            <span className="text-emerald-400 font-medium">5 Simulated</span>
          </div>

          <span className="text-slate-700">|</span>

          {/* Sensor Status */}
          <div className="flex items-center gap-1.5 text-slate-400">
            <Activity className="w-3.5 h-3.5 text-slate-400" />
            <span>SENSORS:</span>
            <span className="text-cyan-400 font-medium">5 Connected (Demo Telemetry)</span>
          </div>

          <span className="text-slate-700">|</span>

          {/* Gesture Tracking Status */}
          <div className="flex items-center gap-1.5 text-slate-400">
            <Hand className="w-3.5 h-3.5 text-slate-400" />
            <span>GESTURE:</span>
            <span className={gestureState.isActive ? 'text-emerald-400 font-medium' : 'text-slate-500'}>
              {gestureState.isActive ? `Active (${gestureState.target.toUpperCase()})` : 'Standby'}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Demo Mode Toggle Buttons */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded p-0.5 text-xs">
            <button
              onClick={() => setDemoMode('running')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded transition-colors ${
                demoMode === 'running'
                  ? 'bg-cyan-500/20 text-cyan-300 font-medium border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Resume background simulated telemetry"
            >
              <Play className="w-3 h-3" />
              <span className="hidden sm:inline">Run Demo</span>
            </button>
            <button
              onClick={() => setDemoMode('paused')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded transition-colors ${
                demoMode === 'paused'
                  ? 'bg-amber-500/20 text-amber-300 font-medium border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Pause telemetry stream"
            >
              <Pause className="w-3 h-3" />
              <span className="hidden sm:inline">Pause</span>
            </button>
          </div>

          {/* Inject Incident Simulation */}
          <button
            onClick={injectSimulatedIncident}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-indigo-950/70 hover:bg-indigo-900/90 text-indigo-200 border border-indigo-500/30 transition-all hover:shadow-[0_0_12px_rgba(99,102,241,0.25)]"
            title="Inject an artificial emergency incident into demo queue"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden md:inline">Test Incident</span>
          </button>

          {/* Satellite & Gesture Pilot Quick Navigation */}
          <button
            onClick={() => setActiveNav('pilot')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition-all ${
              activeNav === 'pilot'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 font-bold shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                : 'bg-slate-900 text-cyan-300 border-cyan-500/40 hover:bg-slate-850'
            }`}
            title="Open Full-Screen Live Face/Hand Camera + Interactive Satellite Map Split View"
          >
            <Hand className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Satellite Pilot</span>
          </button>

          {/* AURAVERSE-UNI Quick Launch Button */}
          <button
            onClick={() => setActiveNav('ar-hologram')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition-all ${
              activeNav === 'ar-hologram'
                ? 'bg-cyan-500/30 text-cyan-200 border-cyan-400 font-bold shadow-[0_0_14px_rgba(6,182,212,0.4)]'
                : 'bg-slate-900 text-cyan-300 border-cyan-500/40 hover:bg-slate-850'
            }`}
            title="Open Interactive 3D AR Palm Universe Hologram with Anime Characters"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="hidden sm:inline">AURAVERSE-UNI</span>
          </button>

          {/* PWA Install Button */}
          <PWAInstallButton />

          {/* Real NVR / RTSP Guide Button */}
          <button
            onClick={() => setIsRTSPGuideOpen(true)}
            className="flex items-center gap-1 p-2 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-colors"
            title="Real CCTV & NVR Connection Guide"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Notification / Alert Drawer Trigger */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-colors"
              title="System Alerts & Activity"
            >
              <Bell className="w-4 h-4" />
              {activeAlertsCount > 0 && (
                <span className="absolute top-1 right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
              )}
            </button>

            {/* Notification Dropdown Panel */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#0b1221] border border-cyan-500/25 rounded-lg shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span className="font-heading text-sm font-semibold text-slate-200">
                      Active Alerts ({activeAlertsCount})
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setShowNotifications(false);
                      setActiveNav('alerts');
                    }}
                    className="text-xs text-cyan-400 hover:underline"
                  >
                    Open Alert Centre
                  </button>
                </div>

                <div className="mt-3 space-y-2 max-h-72 overflow-y-auto pr-1">
                  {alerts.slice(0, 4).map((alert) => (
                    <div
                      key={alert.id}
                      onClick={() => {
                        setShowNotifications(false);
                        setActiveNav('alerts');
                      }}
                      className="p-2.5 rounded bg-slate-900/80 border border-slate-800 hover:border-cyan-500/30 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className={`font-medium uppercase text-[10px] px-1.5 py-0.5 rounded ${
                          alert.severity === 'critical'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : alert.severity === 'high'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-blue-950 text-blue-300 border border-blue-800'
                        }`}>
                          {alert.severity}
                        </span>
                        <span className="text-[11px] font-hud text-slate-500">
                          {alert.timestamp.split(' ')[1]}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-slate-200 line-clamp-1">{alert.conditionTitle}</p>
                      <p className="text-[11px] text-slate-400 line-clamp-1">{alert.location}</p>
                    </div>
                  ))}
                  {alerts.length === 0 && (
                    <div className="text-center py-6 text-xs text-slate-500">
                      No active alerts. All monitoring zones clear.
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] font-hud text-slate-400 flex items-center justify-between">
                  <span>Demo Mode Engine:</span>
                  <span className="text-cyan-400">No paid keys required</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
