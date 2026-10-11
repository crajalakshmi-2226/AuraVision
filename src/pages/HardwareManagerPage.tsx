import React, { useState } from 'react';
import {
  Activity,
  AlertCircle,
  Camera,
  CheckCircle2,
  Cpu,
  Flame,
  HardDrive,
  Plus,
  Radio,
  Server,
  Shield,
  Trash2,
  Wind,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CameraDevice, ConditionId, SensorDevice } from '../types';

export const HardwareManagerPage: React.FC = () => {
  const {
    cameras,
    addCamera,
    removeCamera,
    sensors,
    addSensor,
    removeSensor,
    conditions,
    addNotification,
  } = useApp();

  // Add camera modal state
  const [showAddCameraModal, setShowAddCameraModal] = useState(false);
  const [newCamName, setNewCamName] = useState('');
  const [newCamLocation, setNewCamLocation] = useState('');
  const [newCamCondition, setNewCamCondition] = useState<ConditionId>('c1_library_occupancy');
  const [newCamResolution, setNewCamResolution] = useState('1920x1080');

  // Add sensor modal state
  const [showAddSensorModal, setShowAddSensorModal] = useState(false);
  const [newSensorName, setNewSensorName] = useState('');
  const [newSensorType, setNewSensorType] = useState<SensorDevice['type']>('gas');
  const [newSensorLocation, setNewSensorLocation] = useState('');
  const [newSensorThreshold, setNewSensorThreshold] = useState('500 PPM');

  const handleCreateCamera = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCamName.trim()) return;

    // Default demo coordinate offset
    const lat = 37.7749 + (Math.random() - 0.5) * 0.01;
    const lng = -122.4194 + (Math.random() - 0.5) * 0.01;

    addCamera({
      name: newCamName.trim(),
      location: newCamLocation.trim() || 'Facility Sector North',
      assignedCondition: newCamCondition,
      type: 'sample',
      status: 'simulated',
      resolution: newCamResolution,
      fps: 30,
      coordinates: [lat, lng],
    });

    setShowAddCameraModal(false);
    setNewCamName('');
    setNewCamLocation('');
  };

  const handleCreateSensor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSensorName.trim()) return;

    addSensor({
      name: newSensorName.trim(),
      type: newSensorType,
      location: newSensorLocation.trim() || 'Zone Monitoring Post',
      reading: '0',
      unit: newSensorType === 'gas' ? 'PPM' : newSensorType === 'temperature' ? '°C' : 'Status',
      status: 'simulated',
      lastHeartbeat: 'Just now',
      threshold: newSensorThreshold,
    });

    setShowAddSensorModal(false);
    setNewSensorName('');
    setNewSensorLocation('');
  };

  // Computer Vision & Sensor Inference Capability Matrix
  const modelCapabilities = [
    {
      name: 'Real-Time Pedestrian & Head Counting',
      target: 'Condition 1: Library & Hall Occupancy',
      status: 'Modular Interface Ready (Simulated in Demo)',
      engine: 'YOLOv8-Nano / OpenCV Edge Worker',
    },
    {
      name: 'Restricted-Zone Prolonged Dwell Tracker',
      target: 'Condition 2: Server Room Presence',
      status: 'Modular Interface Ready (Simulated in Demo)',
      engine: 'Optical Centroid + Dwell Stopwatch',
    },
    {
      name: 'Lab Animal Specimen Classifier',
      target: 'Condition 3: Lab Animal Escape',
      status: 'Model Slot Configurable (No Fake Live Infer)',
      engine: 'MobileNetV3 Species Weight Model',
    },
    {
      name: 'Elevator Cabin Optical Positioner',
      target: 'Condition 4: Lift Entrapment',
      status: 'Hardware Telemetry Protocol Ready',
      engine: 'Modbus / Serial Lift Controller Gateway',
    },
    {
      name: 'Compound Animal Tripwire Classifier',
      target: 'Condition 7: Compound Intrusion',
      status: 'Modular Interface Ready (Simulated in Demo)',
      engine: 'Edge TensorRT Quadruped Classifier',
    },
    {
      name: 'Combustible & Toxic Gas Ingestion Engine',
      target: 'Condition 8 & 9: Chemical & Home Gas',
      status: 'MQTT / Modbus Sensor Ingestion Ingest Ready',
      engine: 'Electrochemical ADC Serial Telemetry',
    },
    {
      name: 'Radiometric Thermal Spot-Meter & Smoke',
      target: 'Condition 10: Thermal Fire Overheating',
      status: 'FLIR / Optris Radiometric Matrix Interface',
      engine: 'Thermal Spot Temperature Extraction',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Cpu className="w-6 h-6 text-cyan-400" />
            Hardware, Sensors & Vision Model Manager
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage camera nodes, environmental sensor profiles, and AI inference capability readiness
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddCameraModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-slate-950 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Camera Profile</span>
          </button>

          <button
            onClick={() => setShowAddSensorModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 border border-indigo-500/40 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Sensor Profile</span>
          </button>
        </div>
      </div>

      {/* Camera Devices Table */}
      <div className="bg-[#0b1221] border border-cyan-500/20 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-cyan-400" />
            <h3 className="font-heading font-semibold text-slate-100 text-sm">
              Configured Camera Nodes ({cameras.length})
            </h3>
          </div>
          <span className="text-[11px] font-hud text-slate-400">
            Coordinates calibrated for Leaflet GIS tactical map
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-hud">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-2 font-medium">CAMERA NAME</th>
                <th className="pb-2 font-medium">LOCATION</th>
                <th className="pb-2 font-medium">ASSIGNED CONDITION</th>
                <th className="pb-2 font-medium">RESOLUTION</th>
                <th className="pb-2 font-medium">STATE</th>
                <th className="pb-2 font-medium text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {cameras.map((cam) => {
                const assignedCond = conditions.find((c) => c.id === cam.assignedCondition);
                return (
                  <tr key={cam.id} className="hover:bg-slate-900/40">
                    <td className="py-2.5 font-semibold text-slate-200">{cam.name}</td>
                    <td className="py-2.5 text-slate-400">{cam.location}</td>
                    <td className="py-2.5 text-cyan-300">{assignedCond?.title || cam.assignedCondition}</td>
                    <td className="py-2.5 text-slate-400">{cam.resolution || '1080p'}</td>
                    <td className="py-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-900 border border-slate-700 text-cyan-300">
                        {cam.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => removeCamera(cam.id)}
                        className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors"
                        title="Remove camera"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Environmental Sensors Table */}
      <div className="bg-[#0b1221] border border-cyan-500/20 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h3 className="font-heading font-semibold text-slate-100 text-sm">
              Physical & Environmental Sensors ({sensors.length})
            </h3>
          </div>
          <span className="text-[11px] font-hud text-slate-400">
            Gas Sniffers, Thermal Radiometry, Lift Telemetry
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-hud">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-2 font-medium">SENSOR NAME</th>
                <th className="pb-2 font-medium">TYPE</th>
                <th className="pb-2 font-medium">LOCATION</th>
                <th className="pb-2 font-medium">LIVE TELEMETRY</th>
                <th className="pb-2 font-medium">THRESHOLD</th>
                <th className="pb-2 font-medium">HEARTBEAT</th>
                <th className="pb-2 font-medium text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {sensors.map((sens) => (
                <tr key={sens.id} className="hover:bg-slate-900/40">
                  <td className="py-2.5 font-semibold text-slate-200">{sens.name}</td>
                  <td className="py-2.5 uppercase text-indigo-300">{sens.type}</td>
                  <td className="py-2.5 text-slate-400">{sens.location}</td>
                  <td className="py-2.5 text-cyan-300 font-bold">
                    {sens.reading} {sens.unit}
                  </td>
                  <td className="py-2.5 text-slate-300">{sens.threshold}</td>
                  <td className="py-2.5 text-slate-400">{sens.lastHeartbeat}</td>
                  <td className="py-2.5 text-right">
                    <button
                      onClick={() => removeSensor(sens.id)}
                      className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors"
                      title="Remove sensor"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Model Capability & Architectural Readiness Matrix */}
      <div className="bg-[#0b1221] border border-slate-800 rounded-xl p-5 space-y-4">
        <div>
          <h3 className="font-heading font-semibold text-slate-100 text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            AI Computer Vision Model Architecture Matrix
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Honest capability disclosure: Demonstrating model pipeline readiness without misleading claims of live cloud inference on unmetered accounts.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {modelCapabilities.map((model, i) => (
            <div
              key={i}
              className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-hud space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">{model.name}</span>
                <span className="text-[10px] text-cyan-400">{model.engine}</span>
              </div>
              <p className="text-slate-400 text-[11px]">{model.target}</p>
              <div className="pt-1 text-[11px] text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{model.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Camera Modal */}
      {showAddCameraModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateCamera}
            className="bg-[#0b1221] border border-cyan-500/30 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-heading font-bold text-slate-100 text-base">Add Camera Node</h3>
              <button
                type="button"
                onClick={() => setShowAddCameraModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs font-hud">
              <div>
                <label className="block text-slate-400 mb-1">CAMERA NAME</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. West Campus Gate Entrance"
                  value={newCamName}
                  onChange={(e) => setNewCamName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">LOCATION / ZONE</label>
                <input
                  type="text"
                  placeholder="e.g. Science Complex Annex"
                  value={newCamLocation}
                  onChange={(e) => setNewCamLocation(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">ASSIGN MONITORING CONDITION</label>
                <select
                  value={newCamCondition}
                  onChange={(e) => setNewCamCondition(e.target.value as ConditionId)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400"
                >
                  {conditions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">OPTICAL RESOLUTION</label>
                <select
                  value={newCamResolution}
                  onChange={(e) => setNewCamResolution(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400"
                >
                  <option value="1920x1080">1080p FHD (1920x1080)</option>
                  <option value="2560x1440">2K QHD (2560x1440)</option>
                  <option value="3840x2160">4K Ultra HD (3840x2160)</option>
                  <option value="640x512 Radiometric">Radiometric Thermal (640x512)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddCameraModal(false)}
                className="px-4 py-2 rounded bg-slate-900 text-slate-300 text-xs hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold text-xs transition-colors"
              >
                Register Camera
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Sensor Modal */}
      {showAddSensorModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateSensor}
            className="bg-[#0b1221] border border-cyan-500/30 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-heading font-bold text-slate-100 text-base">Add Sensor Profile</h3>
              <button
                type="button"
                onClick={() => setShowAddSensorModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs font-hud">
              <div>
                <label className="block text-slate-400 mb-1">SENSOR NAME</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Utility Gas Sniffer #2"
                  value={newSensorName}
                  onChange={(e) => setNewSensorName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">SENSOR TELEMETRY TYPE</label>
                <select
                  value={newSensorType}
                  onChange={(e) => setNewSensorType(e.target.value as SensorDevice['type'])}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400"
                >
                  <option value="gas">Combustible / Toxic Gas (PPM)</option>
                  <option value="temperature">Thermal Spot Temperature (°C)</option>
                  <option value="smoke">Ionization Smoke Detector</option>
                  <option value="lift_telemetry">Elevator Shaft Telemetry</option>
                  <option value="door_contact">Magnetic Vault Contact</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">INSTALLATION LOCATION</label>
                <input
                  type="text"
                  placeholder="e.g. Kitchen Line Sector 3"
                  value={newSensorLocation}
                  onChange={(e) => setNewSensorLocation(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">SAFETY THRESHOLD VALUE</label>
                <input
                  type="text"
                  placeholder="e.g. 1000 PPM or 65.0 °C"
                  value={newSensorThreshold}
                  onChange={(e) => setNewSensorThreshold(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddSensorModal(false)}
                className="px-4 py-2 rounded bg-slate-900 text-slate-300 text-xs hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors"
              >
                Register Sensor
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
