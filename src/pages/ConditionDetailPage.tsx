import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Cpu,
  Dog,
  Flame,
  Home,
  Info,
  Microscope,
  PhoneCall,
  Radio,
  RotateCcw,
  Save,
  Server,
  Shield,
  ShieldAlert,
  Sparkles,
  Wind,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ConditionId } from '../types';

export const ConditionDetailPage: React.FC = () => {
  const {
    conditions,
    selectedConditionId,
    updateCondition,
    setActiveNav,
    alerts,
    createAlert,
    addNotification,
  } = useApp();

  const condition = conditions.find((c) => c.id === selectedConditionId) || conditions[0];

  // Editable threshold state
  const [thresholdVal, setThresholdVal] = useState<string | number>(condition.thresholdValue);
  const [operatingStart, setOperatingStart] = useState<string>(condition.rulesConfig.operatingHoursStart || '08:00');
  const [operatingEnd, setOperatingEnd] = useState<string>(condition.rulesConfig.operatingHoursEnd || '22:00');
  const [armMode, setArmMode] = useState<string>(condition.rulesConfig.armMode || 'away');
  const [isSaved, setIsSaved] = useState<boolean>(false);

  const conditionAlerts = alerts.filter((a) => a.conditionId === condition.id);

  const handleSaveThreshold = () => {
    updateCondition(condition.id, {
      thresholdValue: typeof condition.thresholdValue === 'number' ? Number(thresholdVal) : thresholdVal,
      rulesConfig: {
        ...condition.rulesConfig,
        operatingHoursStart: operatingStart,
        operatingHoursEnd: operatingEnd,
        armMode: armMode,
      },
    });
    setIsSaved(true);
    addNotification(`Updated threshold rules for ${condition.title}`);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleInjectConditionAlert = () => {
    createAlert({
      conditionId: condition.id,
      conditionTitle: condition.title,
      severity: condition.id === 'c10_device_thermal_fire' || condition.id === 'c8_home_gas_leak' ? 'critical' : 'high',
      source: condition.recommendedHardware.split('(')[0],
      sourceType: condition.sourceType,
      location: 'Primary Monitored Zone Alpha',
      description: `Manual test incident triggered: Current condition breached threshold of ${thresholdVal} ${condition.thresholdUnit || ''}.`,
      isSimulated: true,
      metricValue: `${thresholdVal} ${condition.thresholdUnit || ''} limit breached`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Top back navigation and header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveNav('conditions')}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-slate-400 hover:text-slate-100 transition-colors"
            title="Back to all conditions"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="text-[10px] font-hud text-cyan-400 uppercase tracking-wider">
              {condition.category} · CONDITION CONFIGURATION
            </div>
            <h1 className="font-heading text-xl font-bold text-slate-100">
              {condition.title}
            </h1>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleInjectConditionAlert}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 border border-indigo-500/40 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Test Simulation Incident</span>
          </button>

          <button
            onClick={handleSaveThreshold}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-slate-950 transition-colors shadow-[0_0_15px_rgba(6,182,212,0.3)]"
          >
            {isSaved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            <span>{isSaved ? 'Rules Saved' : 'Save Configuration'}</span>
          </button>
        </div>
      </div>

      {/* Overview & Hardware Telemetry Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Full Description & Hardware details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card: Mission Scope & Principles */}
          <div className="bg-[#0b1221] border border-cyan-500/20 rounded-xl p-5 space-y-4">
            <h3 className="font-heading font-semibold text-slate-100 text-sm flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              Operational Scope & Integrity Principles
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed">
              {condition.fullDescription}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-800 text-xs font-hud">
              <div>
                <span className="text-slate-400">RECOMMENDED SENSOR/CAMERA:</span>
                <p className="text-slate-200 font-medium mt-0.5">{condition.recommendedHardware}</p>
              </div>
              <div>
                <span className="text-slate-400">INGESTION SOURCE TYPE:</span>
                <p className="text-cyan-400 font-medium uppercase mt-0.5">{condition.sourceType.replace('_', ' ')}</p>
              </div>
            </div>
          </div>

          {/* Card: Rules & Threshold Tuning Editor */}
          <div className="bg-[#0b1221] border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="font-heading font-semibold text-slate-100 text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              Configurable Detection Thresholds & Parameters
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-hud">
              {/* Primary Threshold Value */}
              <div>
                <label className="block text-slate-400 mb-1">
                  {condition.thresholdLabel.toUpperCase()} {condition.thresholdUnit ? `(${condition.thresholdUnit})` : ''}
                </label>
                <input
                  type={typeof condition.thresholdValue === 'number' ? 'number' : 'text'}
                  value={thresholdVal}
                  onChange={(e) => setThresholdVal(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400 font-semibold"
                />
              </div>

              {/* Special condition parameters */}
              {condition.id === 'c1_library_occupancy' && (
                <>
                  <div>
                    <label className="block text-slate-400 mb-1">OPERATING HOURS (START - END)</label>
                    <div className="flex gap-2">
                      <input
                        type="time"
                        value={operatingStart}
                        onChange={(e) => setOperatingStart(e.target.value)}
                        className="w-1/2 bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200 text-xs"
                      />
                      <input
                        type="time"
                        value={operatingEnd}
                        onChange={(e) => setOperatingEnd(e.target.value)}
                        className="w-1/2 bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200 text-xs"
                      />
                    </div>
                  </div>
                </>
              )}

              {condition.id === 'c6_home_intrusion' && (
                <div>
                  <label className="block text-slate-400 mb-1">SYSTEM ARMING MODE</label>
                  <select
                    value={armMode}
                    onChange={(e) => setArmMode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-cyan-400"
                  >
                    <option value="away">Armed: Away (Full Perimeter & Interior)</option>
                    <option value="home">Armed: Home (Perimeter Only)</option>
                    <option value="disarmed">Disarmed (Sensors in Standby)</option>
                  </select>
                </div>
              )}

              {condition.id === 'c4_lift_entrapment' && (
                <div>
                  <label className="block text-slate-400 mb-1">ELEVATOR STALL ALARM (SECONDS)</label>
                  <input
                    type="number"
                    value={thresholdVal}
                    onChange={(e) => setThresholdVal(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
              )}
            </div>

            <div className="text-[11px] text-slate-400 font-hud">
              Changes update immediately in local demo storage and will trigger simulated alarms when exceeded.
            </div>
          </div>

          {/* Safety Guidance Box (If Applicable) */}
          {condition.safetyGuidance && (
            <div className="bg-amber-950/60 border border-amber-600/40 rounded-xl p-4 text-xs text-amber-200 space-y-1.5">
              <div className="flex items-center gap-2 text-amber-300 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Emergency Safety Guidance & Standard Operating Procedure
              </div>
              <p className="leading-relaxed font-sans text-slate-200">
                {condition.safetyGuidance}
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Live Status & Incident History */}
        <div className="space-y-6">
          {/* Status & Live Telemetry Card */}
          <div className="bg-[#0b1221] border border-cyan-500/20 rounded-xl p-5 space-y-4">
            <h3 className="font-heading font-semibold text-slate-100 text-sm">
              Live Sensor Telemetry
            </h3>

            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-center space-y-1">
              <span className="text-[10px] font-hud text-slate-400 uppercase">CURRENT TELEMETRY READING</span>
              <div className="font-heading text-2xl font-bold text-cyan-300">
                {condition.currentReading || 'Normal Telemetry'}
              </div>
              <span className="text-[10px] font-hud text-emerald-400 flex items-center justify-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                Simulated Heartbeat Active
              </span>
            </div>

            <div className="text-xs font-hud space-y-2 text-slate-400">
              <div className="flex justify-between">
                <span>ACTIVE ALERTS:</span>
                <span className={conditionAlerts.length > 0 ? 'text-rose-400 font-bold' : 'text-slate-200'}>
                  {conditionAlerts.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span>INFERENCE VERIFICATION:</span>
                <span className="text-cyan-400">Demo Simulation</span>
              </div>
            </div>
          </div>

          {/* Event History for this specific condition */}
          <div className="bg-[#0b1221] border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="font-heading font-semibold text-slate-100 text-sm flex items-center justify-between">
              <span>Incident History</span>
              <span className="text-xs font-hud text-slate-400">({conditionAlerts.length})</span>
            </h3>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {conditionAlerts.map((alt) => (
                <div key={alt.id} className="p-2.5 rounded bg-slate-950 border border-slate-800 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-hud font-bold text-rose-400 uppercase">
                      [{alt.severity}]
                    </span>
                    <span className="text-[10px] font-hud text-slate-500">
                      {alt.timestamp}
                    </span>
                  </div>
                  <p className="text-slate-300 line-clamp-2">{alt.description}</p>
                </div>
              ))}

              {conditionAlerts.length === 0 && (
                <div className="py-6 text-center text-xs text-slate-500">
                  No incident events recorded for this condition.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
