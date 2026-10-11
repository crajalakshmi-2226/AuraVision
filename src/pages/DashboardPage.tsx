import React from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Calendar,
  Camera,
  CheckCircle2,
  Cpu,
  Dog,
  Eye,
  Flame,
  Hand,
  Home,
  MapPin,
  Microscope,
  Pause,
  Play,
  Radio,
  Server,
  Shield,
  ShieldAlert,
  Sparkles,
  Upload,
  Wind,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { TacticalMap } from '../components/map/TacticalMap';
import { GestureControlledVideoPlayer } from '../components/camera/GestureControlledVideoPlayer';
import { ConditionId } from '../types';

export const DashboardPage: React.FC = () => {
  const {
    conditions,
    cameras,
    alerts,
    demoMode,
    setDemoMode,
    injectSimulatedIncident,
    setSelectedConditionId,
    setActiveNav,
    gestureState,
  } = useApp();

  const newAlerts = alerts.filter((a) => a.status === 'new');
  const criticalCount = alerts.filter((a) => a.severity === 'critical' && a.status === 'new').length;

  const handleOpenCondition = (id: ConditionId) => {
    setSelectedConditionId(id);
    setActiveNav('condition-detail');
  };

  const getConditionIcon = (id: ConditionId) => {
    switch (id) {
      case 'c1_library_occupancy':
        return BookOpen;
      case 'c2_server_room_presence':
        return Server;
      case 'c3_lab_animal_detection':
        return Microscope;
      case 'c4_lift_entrapment':
        return Radio;
      case 'c5_campus_holiday_entry':
        return Calendar;
      case 'c6_home_intrusion':
        return Home;
      case 'c7_compound_animal_intrusion':
        return Dog;
      case 'c8_home_gas_leak':
        return Wind;
      case 'c9_chemical_lab_gas':
        return Shield;
      case 'c10_device_thermal_fire':
        return Flame;
      default:
        return Activity;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Welcome & Demo Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-gradient-to-r from-[#0b1221] via-slate-900 to-[#070b14] border border-cyan-500/20 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-xl sm:text-2xl font-bold text-slate-100">
              Situational Awareness & Safety Command
            </h1>
            <span className="text-[10px] font-hud px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-semibold">
              SIMULATION ACTIVE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time monitoring across 10 safety conditions, Leaflet tactical mapping, and touchless gesture control
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={injectSimulatedIncident}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 border border-indigo-500/40 transition-colors shadow-[0_0_12px_rgba(99,102,241,0.2)]"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Test Simulation Incident</span>
          </button>

          <button
            onClick={() => setActiveNav('camera')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-cyan-400" />
            <span>Upload Footage</span>
          </button>

          <button
            onClick={() => setActiveNav('map')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-slate-950 transition-colors shadow-[0_0_15px_rgba(6,182,212,0.3)]"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Open Map Explorer</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Metrics (Actual Application State) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Configured Conditions */}
        <div className="p-4 rounded-xl bg-[#0b1221] border border-cyan-500/15 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-hud">
            <span>MONITORING CONDITIONS</span>
            <Shield className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="my-2">
            <span className="font-heading text-3xl font-bold text-slate-100">
              {conditions.length}
            </span>
            <span className="text-xs text-slate-400 ml-1.5 font-hud">Modules</span>
          </div>
          <div className="text-[11px] font-hud text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>100% Configured & Active</span>
          </div>
        </div>

        {/* Metric 2: Connected Cameras */}
        <div className="p-4 rounded-xl bg-[#0b1221] border border-cyan-500/15 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-hud">
            <span>CAMERA NODES</span>
            <Camera className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="my-2">
            <span className="font-heading text-3xl font-bold text-slate-100">
              {cameras.length}
            </span>
            <span className="text-xs text-slate-400 ml-1.5 font-hud">Registered</span>
          </div>
          <div className="text-[11px] font-hud text-cyan-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
            <span>Simulated & Local Streams</span>
          </div>
        </div>

        {/* Metric 3: Active Alerts */}
        <div className="p-4 rounded-xl bg-[#0b1221] border border-cyan-500/15 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-hud">
            <span>UNRESOLVED ALERTS</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="my-2">
            <span className={`font-heading text-3xl font-bold ${newAlerts.length > 0 ? 'text-rose-400' : 'text-slate-100'}`}>
              {newAlerts.length}
            </span>
            {criticalCount > 0 && (
              <span className="text-[11px] font-hud text-rose-300 ml-2 px-1.5 py-0.5 rounded bg-rose-950 border border-rose-800">
                {criticalCount} Critical
              </span>
            )}
          </div>
          <div className="text-[11px] font-hud text-slate-400 flex items-center justify-between">
            <span>{alerts.length} Total in Audit Log</span>
            <button onClick={() => setActiveNav('alerts')} className="text-cyan-400 hover:underline">
              Inspect →
            </button>
          </div>
        </div>

        {/* Metric 4: System Health & Gesture */}
        <div className="p-4 rounded-xl bg-[#0b1221] border border-cyan-500/15 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-hud">
            <span>SYSTEM HEALTH</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="my-2">
            <span className="font-heading text-3xl font-bold text-emerald-400">
              99.8%
            </span>
            <span className="text-xs text-slate-400 ml-1.5 font-hud">Nominal</span>
          </div>
          <div className="text-[11px] font-hud text-slate-400 flex items-center justify-between">
            <span>Gestures: <strong className={gestureState.isActive ? 'text-emerald-400' : 'text-slate-400'}>{gestureState.isActive ? 'Active' : 'Standby'}</strong></span>
            <button onClick={() => setActiveNav('gestures')} className="text-cyan-400 hover:underline">
              Studio →
            </button>
          </div>
        </div>
      </div>

      {/* Main Split View: Left Live CCTV Player + Right Tactical GIS Map Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Live CCTV Viewport Preview */}
        <div className="lg:col-span-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-cyan-400" />
              <h3 className="font-heading font-semibold text-slate-100 text-sm">
                Optical Surveillance Preview (Node 01)
              </h3>
            </div>
            <button
              onClick={() => setActiveNav('camera')}
              className="text-xs font-hud text-cyan-400 hover:underline flex items-center gap-1"
            >
              <span>Full CCTV Explorer</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <GestureControlledVideoPlayer
            cameraName="Corridor Alpha (Building A Entrance)"
            assignedConditionTitle="Condition 1: Occupancy Monitoring"
          />
        </div>

        {/* Right Column: Tactical GIS Map Preview */}
        <div className="lg:col-span-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-cyan-400" />
              <h3 className="font-heading font-semibold text-slate-100 text-sm">
                Tactical GIS Operations Map
              </h3>
            </div>
            <button
              onClick={() => setActiveNav('map')}
              className="text-xs font-hud text-cyan-400 hover:underline flex items-center gap-1"
            >
              <span>Interactive Fullscreen Map</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <TacticalMap heightClass="h-[460px]" showOverlayControls={true} />
        </div>
      </div>

      {/* Ten Monitoring Conditions Quick-Access Grid */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            <h3 className="font-heading font-semibold text-slate-100 text-base">
              Ten Safety Monitoring Conditions
            </h3>
          </div>
          <button
            onClick={() => setActiveNav('conditions')}
            className="text-xs font-hud text-cyan-400 hover:underline"
          >
            Manage All Rules & Thresholds →
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {conditions.map((cond, i) => {
            const Icon = getConditionIcon(cond.id);
            const isAlert = cond.activeAlertCount > 0;

            return (
              <div
                key={cond.id}
                onClick={() => handleOpenCondition(cond.id)}
                className={`p-3.5 rounded-xl border bg-[#0b1221] hover:border-cyan-500/50 cursor-pointer transition-all hover:scale-[1.02] flex flex-col justify-between group ${
                  isAlert ? 'border-amber-500/50' : 'border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-1.5 rounded-md bg-slate-900 border border-slate-800 text-cyan-400 group-hover:text-cyan-300">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-hud text-slate-400">
                      0{i + 1}
                    </span>
                  </div>

                  <h4 className="font-heading font-semibold text-xs text-slate-200 group-hover:text-cyan-300 transition-colors line-clamp-1">
                    {cond.title}
                  </h4>
                  <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 leading-snug">
                    {cond.shortDescription}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-hud">
                  <span className="text-slate-400">Reading:</span>
                  <span className="text-cyan-300 font-medium truncate max-w-[80px]">
                    {cond.currentReading || 'Normal'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
