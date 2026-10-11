import React from 'react';
import {
  Compass,
  Hand,
  Layers,
  Move,
  RotateCcw,
  Sparkles,
  Video,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { GestureTracker } from '../components/gestures/GestureTracker';
import { TacticalMap } from '../components/map/TacticalMap';
import { GestureControlledVideoPlayer } from '../components/camera/GestureControlledVideoPlayer';

export const GestureStudioPage: React.FC = () => {
  const {
    gestureState,
    updateGestureState,
    videoTransform,
    resetVideoTransform,
    triggerMapAction,
  } = useApp();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Hand className="w-6 h-6 text-cyan-400" />
            Hand Gesture Control Studio
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Touchless computer-vision situational control for maps and tactical video feeds
          </p>
        </div>

        {/* Target Switcher */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs font-hud">
          <span className="text-slate-400 px-2">CURRENT TARGET:</span>
          <button
            onClick={() => updateGestureState({ target: 'video' })}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
              gestureState.target === 'video'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Video Feed
          </button>
          <button
            onClick={() => updateGestureState({ target: 'map' })}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
              gestureState.target === 'map'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Tactical Map
          </button>
        </div>
      </div>

      {/* Main Gesture Tracker Engine Panel */}
      <GestureTracker />

      {/* Interactive Testing Sandbox — Shows both Targets side-by-side! */}
      <div className="bg-[#0b1221] border border-cyan-500/20 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <h3 className="font-heading font-semibold text-slate-100 text-sm">
              Live Target Verification Sandbox
            </h3>
          </div>
          <span className="text-xs font-hud text-slate-400">
            Observe how hand landmarks control strictly the selected target
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Target 1: Video Viewport Sandbox */}
          <div className={`p-3 rounded-xl border transition-all ${
            gestureState.target === 'video'
              ? 'border-cyan-400/60 bg-cyan-950/10 shadow-[0_0_20px_rgba(6,182,212,0.15)]'
              : 'border-slate-800 bg-slate-900/40 opacity-70'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-cyan-400" />
                <span className="font-heading font-semibold text-xs text-slate-200">
                  Target: CCTV Video Viewport
                </span>
                {gestureState.target === 'video' && (
                  <span className="text-[10px] font-hud bg-cyan-950 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-500/40">
                    ACTIVE TARGET
                  </span>
                )}
              </div>
              <button
                onClick={resetVideoTransform}
                className="text-[11px] font-hud text-slate-400 hover:text-cyan-300 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset (1.0x)</span>
              </button>
            </div>

            <GestureControlledVideoPlayer
              cameraName="Sandbox Test Video (Corridor Feed)"
              assignedConditionTitle="Testing Sandbox"
            />
          </div>

          {/* Target 2: Tactical Map Sandbox */}
          <div className={`p-3 rounded-xl border transition-all flex flex-col justify-between ${
            gestureState.target === 'map'
              ? 'border-cyan-400/60 bg-cyan-950/10 shadow-[0_0_20px_rgba(6,182,212,0.15)]'
              : 'border-slate-800 bg-slate-900/40 opacity-70'
          }`}>
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-cyan-400" />
                  <span className="font-heading font-semibold text-xs text-slate-200">
                    Target: Tactical GIS Map
                  </span>
                  {gestureState.target === 'map' && (
                    <span className="text-[10px] font-hud bg-cyan-950 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-500/40">
                      ACTIVE TARGET
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-hud text-slate-400">
                  Pinch = Zoom | Hand = Pan
                </div>
              </div>

              <TacticalMap heightClass="h-[380px]" showOverlayControls={true} />
            </div>

            <div className="mt-3 p-2 bg-slate-950/80 rounded border border-slate-800 text-[11px] font-hud text-slate-400 flex items-center justify-between">
              <span>Map gestures affect leaflet zoom level and center coordinates</span>
              <button
                onClick={() => triggerMapAction(1, 0, 0)}
                className="text-cyan-400 hover:underline"
              >
                Test +1 Zoom
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Debug & Diagnostic Telemetry Panel */}
      <div className="bg-[#0b1221] border border-slate-800 rounded-xl p-5 space-y-3">
        <h3 className="font-heading font-semibold text-slate-100 text-sm flex items-center gap-2">
          <span>Engine Debug & Landmark Audit Stream</span>
          <span className="text-xs font-hud text-slate-400">({gestureState.debugLogs.length} events logged)</span>
        </h3>

        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-hud text-xs text-slate-300 space-y-1.5 max-h-48 overflow-y-auto">
          {gestureState.debugLogs.map((log, index) => (
            <div key={index} className="flex items-start gap-2 text-[11px]">
              <span className="text-cyan-500 shrink-0">›</span>
              <span className="text-slate-300">{log}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
