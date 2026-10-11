import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  ActiveNav,
  Alert,
  CameraDevice,
  ConditionId,
  GestureState,
  MonitoringCondition,
  SensorDevice,
  VideoViewportTransform,
} from '../types';
import { INITIAL_ALERTS, INITIAL_CAMERAS, INITIAL_CONDITIONS, INITIAL_SENSORS } from '../data/initialData';

interface MapActionPayload {
  zoomDelta: number;
  panDeltaX: number;
  panDeltaY: number;
  timestamp: number;
}

interface AppContextType {
  activeNav: ActiveNav;
  setActiveNav: (nav: ActiveNav) => void;
  selectedConditionId: ConditionId;
  setSelectedConditionId: (id: ConditionId) => void;
  conditions: MonitoringCondition[];
  updateCondition: (id: ConditionId, updates: Partial<MonitoringCondition>) => void;
  cameras: CameraDevice[];
  addCamera: (cam: Omit<CameraDevice, 'id'>) => void;
  removeCamera: (id: string) => void;
  updateCamera: (id: string, updates: Partial<CameraDevice>) => void;
  sensors: SensorDevice[];
  addSensor: (sensor: Omit<SensorDevice, 'id'>) => void;
  removeSensor: (id: string) => void;
  alerts: Alert[];
  acknowledgeAlert: (id: string, notes?: string) => void;
  resolveAlert: (id: string) => void;
  createAlert: (alert: Omit<Alert, 'id' | 'timestamp' | 'status'>) => void;
  clearResolvedAlerts: () => void;
  demoMode: 'running' | 'paused' | 'stopped';
  setDemoMode: (mode: 'running' | 'paused' | 'stopped') => void;
  injectSimulatedIncident: () => void;
  selectedCameraId: string;
  setSelectedCameraId: (id: string) => void;
  gestureState: GestureState;
  updateGestureState: (updates: Partial<GestureState>) => void;
  videoTransform: VideoViewportTransform;
  updateVideoTransform: (updater: (prev: VideoViewportTransform) => VideoViewportTransform) => void;
  resetVideoTransform: () => void;
  mapAction: MapActionPayload | null;
  triggerMapAction: (zoomDelta: number, panDeltaX: number, panDeltaY: number) => void;
  notifications: string[];
  addNotification: (msg: string) => void;
  isRTSPGuideOpen: boolean;
  setIsRTSPGuideOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeNav, setActiveNav] = useState<ActiveNav>('dashboard');
  const [selectedConditionId, setSelectedConditionId] = useState<ConditionId>('c1_library_occupancy');
  const [conditions, setConditions] = useState<MonitoringCondition[]>(() => {
    const saved = localStorage.getItem('auravision_conditions');
    return saved ? JSON.parse(saved) : INITIAL_CONDITIONS;
  });
  const [cameras, setCameras] = useState<CameraDevice[]>(() => {
    const saved = localStorage.getItem('auravision_cameras');
    return saved ? JSON.parse(saved) : INITIAL_CAMERAS;
  });
  const [sensors, setSensors] = useState<SensorDevice[]>(() => {
    const saved = localStorage.getItem('auravision_sensors');
    return saved ? JSON.parse(saved) : INITIAL_SENSORS;
  });
  const [alerts, setAlerts] = useState<Alert[]>(() => {
    const saved = localStorage.getItem('auravision_alerts');
    return saved ? JSON.parse(saved) : INITIAL_ALERTS;
  });
  const [demoMode, setDemoMode] = useState<'running' | 'paused' | 'stopped'>('running');
  const [selectedCameraId, setSelectedCameraId] = useState<string>('cam-01');
  const [notifications, setNotifications] = useState<string[]>([
    'AuraVision core initialized in verified simulation mode',
  ]);
  const [isRTSPGuideOpen, setIsRTSPGuideOpen] = useState<boolean>(false);

  // Gesture State
  const [gestureState, setGestureState] = useState<GestureState>({
    isActive: false,
    isCameraActive: false,
    target: 'video', // 'video' or 'map'
    currentGesture: 'none',
    confidence: 0,
    handDetected: false,
    lastAction: 'Waiting for gesture stream',
    lastActionTime: 0,
    sensitivity: 1.0,
    debugLogs: ['Gesture engine standby. Click "Enable Gesture Control" to activate webcam.'],
  });

  // Video inner viewport transform (isolated strictly to video contents)
  const [videoTransform, setVideoTransform] = useState<VideoViewportTransform>({
    zoom: 1.0,
    panX: 0,
    panY: 0,
  });

  // Map gesture trigger
  const [mapAction, setMapAction] = useState<MapActionPayload | null>(null);

  // Persistence
  useEffect(() => {
    try {
      localStorage.setItem('auravision_conditions', JSON.stringify(conditions));
    } catch (e) {
      console.warn('LocalStorage save failed', e);
    }
  }, [conditions]);

  useEffect(() => {
    try {
      localStorage.setItem('auravision_cameras', JSON.stringify(cameras));
    } catch (e) {
      console.warn('LocalStorage save failed', e);
    }
  }, [cameras]);

  useEffect(() => {
    try {
      localStorage.setItem('auravision_sensors', JSON.stringify(sensors));
    } catch (e) {
      console.warn('LocalStorage save failed', e);
    }
  }, [sensors]);

  useEffect(() => {
    try {
      localStorage.setItem('auravision_alerts', JSON.stringify(alerts));
    } catch (e) {
      console.warn('LocalStorage save failed', e);
    }
  }, [alerts]);

  const addNotification = useCallback((msg: string) => {
    setNotifications((prev) => [msg, ...prev.slice(0, 19)]);
  }, []);

  const updateCondition = useCallback((id: ConditionId, updates: Partial<MonitoringCondition>) => {
    setConditions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  }, []);

  const addCamera = useCallback((cam: Omit<CameraDevice, 'id'>) => {
    const newCam: CameraDevice = {
      ...cam,
      id: `cam-${Date.now().toString(36)}`,
      lastPing: 'Just now',
    };
    setCameras((prev) => [...prev, newCam]);
    addNotification(`Added camera: ${newCam.name}`);
  }, [addNotification]);

  const removeCamera = useCallback((id: string) => {
    setCameras((prev) => prev.filter((c) => c.id !== id));
    addNotification(`Camera removed (ID: ${id})`);
  }, [addNotification]);

  const updateCamera = useCallback((id: string, updates: Partial<CameraDevice>) => {
    setCameras((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  }, []);

  const addSensor = useCallback((sensor: Omit<SensorDevice, 'id'>) => {
    const newSensor: SensorDevice = {
      ...sensor,
      id: `sens-${Date.now().toString(36)}`,
      lastHeartbeat: 'Just now',
    };
    setSensors((prev) => [...prev, newSensor]);
    addNotification(`Configured sensor: ${newSensor.name}`);
  }, [addNotification]);

  const removeSensor = useCallback((id: string) => {
    setSensors((prev) => prev.filter((s) => s.id !== id));
    addNotification(`Sensor removed (ID: ${id})`);
  }, [addNotification]);

  const acknowledgeAlert = useCallback((id: string, notes?: string) => {
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              status: 'acknowledged',
              acknowledgedAt: new Date().toISOString(),
              operatorNotes: notes || a.operatorNotes || 'Acknowledged by operator',
            }
          : a
      )
    );
    addNotification(`Alert ${id} acknowledged`);
  }, [addNotification]);

  const resolveAlert = useCallback((id: string) => {
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              status: 'resolved',
              resolvedAt: new Date().toISOString(),
            }
          : a
      )
    );
    addNotification(`Alert ${id} resolved`);
  }, [addNotification]);

  const createAlert = useCallback(
    (alert: Omit<Alert, 'id' | 'timestamp' | 'status'>) => {
      const now = new Date();
      const timeStr = now.toISOString().replace('T', ' ').substring(0, 19);
      const newAlert: Alert = {
        ...alert,
        id: `alt-${Date.now().toString(36)}`,
        timestamp: timeStr,
        status: 'new',
      };
      setAlerts((prev) => [newAlert, ...prev]);
      addNotification(`[${newAlert.severity.toUpperCase()}] ${newAlert.conditionTitle}: ${newAlert.location}`);
    },
    [addNotification]
  );

  const clearResolvedAlerts = useCallback(() => {
    setAlerts((prev) => prev.filter((a) => a.status !== 'resolved'));
    addNotification('Cleared resolved alerts from incident list');
  }, [addNotification]);

  const updateGestureState = useCallback((updates: Partial<GestureState>) => {
    setGestureState((prev) => ({ ...prev, ...updates }));
  }, []);

  const updateVideoTransform = useCallback(
    (updater: (prev: VideoViewportTransform) => VideoViewportTransform) => {
      setVideoTransform((prev) => {
        const next = updater(prev);
        // Clamp zoom between 1.0 and 4.0
        const clampedZoom = Math.min(4.0, Math.max(1.0, next.zoom));
        // Clamp pan based on current zoom so content doesn't permanently fly off screen
        const maxPanX = (clampedZoom - 1) * 320;
        const maxPanY = (clampedZoom - 1) * 200;
        const clampedPanX = Math.min(maxPanX, Math.max(-maxPanX, next.panX));
        const clampedPanY = Math.min(maxPanY, Math.max(-maxPanY, next.panY));
        return {
          zoom: Number(clampedZoom.toFixed(2)),
          panX: Number(clampedPanX.toFixed(1)),
          panY: Number(clampedPanY.toFixed(1)),
        };
      });
    },
    []
  );

  const resetVideoTransform = useCallback(() => {
    setVideoTransform({ zoom: 1.0, panX: 0, panY: 0 });
    addNotification('Video viewport transform reset to 1.0x centered');
  }, [addNotification]);

  const triggerMapAction = useCallback((zoomDelta: number, panDeltaX: number, panDeltaY: number) => {
    setMapAction({
      zoomDelta,
      panDeltaX,
      panDeltaY,
      timestamp: Date.now(),
    });
  }, []);

  const injectSimulatedIncident = useCallback(() => {
    const candidateConditions: Array<{
      condId: ConditionId;
      title: string;
      severity: Alert['severity'];
      source: string;
      sourceType: Alert['sourceType'];
      loc: string;
      desc: string;
      metric: string;
    }> = [
      {
        condId: 'c1_library_occupancy',
        title: 'Library Occupancy & Activity',
        severity: 'medium',
        source: 'Main Public Corridor & Hall',
        sourceType: 'camera',
        loc: 'Building A - North Wing Entrance',
        desc: 'Occupancy exceeded configured threshold (128 / 120 persons). Crowd density warning.',
        metric: '128 persons (106% capacity)',
      },
      {
        condId: 'c8_home_gas_leak',
        title: 'Home Gas Leakage Detection',
        severity: 'critical',
        source: 'Utility Kitchen Gas Sniffer S1',
        sourceType: 'gas_sensor',
        loc: 'Staff Cafeteria Utility Line',
        desc: 'Simulated gas spike: 1,150 PPM detected (Threshold 1,000 PPM). Automated solenoid shutoff alert.',
        metric: '1,150 PPM',
      },
      {
        condId: 'c5_campus_holiday_entry',
        title: 'Campus Holiday Unauthorized Entry',
        severity: 'high',
        source: 'Perimeter North Gate 04',
        sourceType: 'camera',
        loc: 'Outer Compound Boundary Road',
        desc: 'Unscheduled pedestrian ingress detected during Academic Holiday lockdown schedule.',
        metric: 'Tripwire Sector B breach',
      },
      {
        condId: 'c9_chemical_lab_gas',
        title: 'Chemical Lab Toxic Gas Leakage',
        severity: 'high',
        source: 'Fume Hood PID Sensor F4',
        sourceType: 'gas_sensor',
        loc: 'Chemistry Lab B - Hood 04',
        desc: 'Volatile organic compound vapor detected at 28.5 PPM (PEL limit: 25.0 PPM). Exhaust scrubber ramped to 100%.',
        metric: '28.5 PPM VOC',
      },
    ];

    const pick = candidateConditions[Math.floor(Math.random() * candidateConditions.length)];
    createAlert({
      conditionId: pick.condId,
      conditionTitle: pick.title,
      severity: pick.severity,
      source: pick.source,
      sourceType: pick.sourceType,
      location: pick.loc,
      description: pick.desc,
      isSimulated: true,
      metricValue: pick.metric,
    });
  }, [createAlert]);

  // Periodic simulated heartbeat in running mode
  useEffect(() => {
    if (demoMode !== 'running') return;
    const interval = setInterval(() => {
      // Lightly vary sensor telemetry values to demonstrate live monitoring without fake emergency
      setSensors((prev) =>
        prev.map((s) => {
          if (s.type === 'gas' && s.id === 'sens-gas-01') {
            const val = 35 + Math.floor(Math.random() * 8);
            return { ...s, reading: `${val}`, lastHeartbeat: 'Just now' };
          }
          if (s.type === 'gas' && s.id === 'sens-gas-02') {
            const val = (4.0 + Math.random() * 0.5).toFixed(1);
            return { ...s, reading: `${val}`, lastHeartbeat: 'Just now' };
          }
          if (s.type === 'temperature') {
            const val = (71.5 + Math.random() * 1.5).toFixed(1);
            return { ...s, reading: `${val}`, lastHeartbeat: 'Just now' };
          }
          return { ...s, lastHeartbeat: 'Just now' };
        })
      );
    }, 4000);
    return () => clearInterval(interval);
  }, [demoMode]);

  return (
    <AppContext.Provider
      value={{
        activeNav,
        setActiveNav,
        selectedConditionId,
        setSelectedConditionId,
        conditions,
        updateCondition,
        cameras,
        addCamera,
        removeCamera,
        updateCamera,
        sensors,
        addSensor,
        removeSensor,
        alerts,
        acknowledgeAlert,
        resolveAlert,
        createAlert,
        clearResolvedAlerts,
        demoMode,
        setDemoMode,
        injectSimulatedIncident,
        selectedCameraId,
        setSelectedCameraId,
        gestureState,
        updateGestureState,
        videoTransform,
        updateVideoTransform,
        resetVideoTransform,
        mapAction,
        triggerMapAction,
        notifications,
        addNotification,
        isRTSPGuideOpen,
        setIsRTSPGuideOpen,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
