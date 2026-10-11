export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type AlertStatus = 'new' | 'acknowledged' | 'resolved';

export type SourceType = 'camera' | 'gas_sensor' | 'temp_sensor' | 'lift_controller' | 'access_control';

export type ConditionId =
  | 'c1_library_occupancy'
  | 'c2_server_room_presence'
  | 'c3_lab_animal_detection'
  | 'c4_lift_entrapment'
  | 'c5_campus_holiday_entry'
  | 'c6_home_intrusion'
  | 'c7_compound_animal_intrusion'
  | 'c8_home_gas_leak'
  | 'c9_chemical_lab_gas'
  | 'c10_device_thermal_fire';

export interface Alert {
  id: string;
  conditionId: ConditionId;
  conditionTitle: string;
  severity: Severity;
  timestamp: string;
  source: string;
  sourceType: SourceType;
  location: string;
  description: string;
  status: AlertStatus;
  isSimulated: boolean;
  operatorNotes?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  metricValue?: string;
}

export interface MonitoringCondition {
  id: ConditionId;
  title: string;
  category: 'Commercial & Campus' | 'Restricted Facilities' | 'Residential & Perimeter' | 'Hazard & Safety';
  shortDescription: string;
  fullDescription: string;
  sourceType: SourceType;
  recommendedHardware: string;
  status: 'active' | 'standby' | 'alert' | 'offline';
  isSimulated: boolean;
  thresholdLabel: string;
  thresholdValue: number | string;
  thresholdUnit?: string;
  currentReading?: number | string;
  safetyGuidance?: string;
  rulesConfig: Record<string, any>;
  cameraAssigned?: string;
  activeAlertCount: number;
}

export interface CameraDevice {
  id: string;
  name: string;
  location: string;
  coordinates: [number, number]; // [lat, lng]
  assignedCondition: ConditionId;
  type: 'sample' | 'rtsp' | 'webrtc' | 'uploaded';
  status: 'online' | 'simulated' | 'offline';
  streamUrl?: string;
  lastPing?: string;
  resolution?: string;
  fps?: number;
}

export interface SensorDevice {
  id: string;
  name: string;
  type: 'gas' | 'temperature' | 'smoke' | 'lift_telemetry' | 'door_contact';
  location: string;
  reading: string;
  unit: string;
  status: 'connected' | 'simulated' | 'offline';
  lastHeartbeat: string;
  threshold: string;
}

export type GestureType =
  | 'none'
  | 'pinch_zoom_in'
  | 'open_hand_zoom_out'
  | 'pan_left'
  | 'pan_right'
  | 'pan_up'
  | 'pan_down';

export type GestureTarget = 'map' | 'video';

export type CameraStatus =
  | 'idle'
  | 'permission_requested'
  | 'loading'
  | 'connected'
  | 'hand_detected'
  | 'searching'
  | 'error';

export interface GestureState {
  isActive: boolean;
  isCameraActive: boolean;
  target: GestureTarget;
  currentGesture: GestureType;
  confidence: number;
  handDetected: boolean;
  lastAction: string;
  lastActionTime: number;
  sensitivity: number;
  debugLogs: string[];
}

export interface VideoViewportTransform {
  zoom: number; // 1.0 to 4.0
  panX: number; // clamped px
  panY: number; // clamped px
}

export type ActiveNav =
  | 'dashboard'
  | 'map'
  | 'camera'
  | 'conditions'
  | 'condition-detail'
  | 'alerts'
  | 'hardware'
  | 'gestures'
  | 'history'
  | 'guide';
