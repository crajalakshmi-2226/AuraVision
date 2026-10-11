# AuraVision AI

> **Tagline:** See Beyond. Predict Risks. Protect Lives.

AuraVision AI is an advanced, production-grade situational awareness, condition-monitoring, and computer-vision surveillance intelligence platform. It features free Leaflet/OpenStreetMap GIS navigation, touchless hand-gesture controls, CCTV video analysis viewport management, and 10 safety condition monitoring modules.

---

## Key Features

1. **Zero-Paid-API-Key Foundation**:
   - Default GIS maps powered by Leaflet + OpenStreetMap (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`).
   - No Google Maps API keys, Mapbox tokens, or mandatory external billing required.
   - High-contrast tactical dark mode map tile filtering.

2. **Touchless Hand-Gesture Control**:
   - Uses browser MediaDevices API with MediaPipe Hands & fallback optical landmark tracking.
   - **Target-Specific Adapter**: Controls strictly the contents of the currently selected **Map** or **Video**, never the webpage or containers.
   - 6 supported gestures:
     - **Pinch thumb and index**: Zoom IN
     - **Open/spread hand**: Zoom OUT
     - **Hand Left / Right / Up / Down**: Pan selected map or video
   - Integrated smoothing, dead zones, and cooldown thresholds to prevent feedback loops.

3. **Dedicated CCTV & Video Explorer (3 Modes)**:
   - **Mode A (Built-in Sample Demonstration)**: Instant surveillance corridor video playback with full controls, speed adjustment, and simulated bounding box overlays.
   - **Mode B (Upload CCTV Footage)**: Drag-and-drop or select local MP4/WebM files. Footage remains 100% in local memory (safe blob object URL lifecycle with cleanup).
   - **Mode C (Real CCTV / NVR Hardware Setup)**: Configuration interface for RTSP cameras and NVRs (e.g. Hikvision DS-7608NXI-K1). Honest diagnostics explain why raw RTSP cannot be played directly without a local media gateway.

4. **Ten Safety & Hazard Monitoring Modules**:
   - **Condition 1**: Library occupancy & loitering rules
   - **Condition 2**: Server room prolonged presence (never falsely claiming entrapment)
   - **Condition 3**: Laboratory animal containment detection
   - **Condition 4**: Lift entrapment assistance & technician dispatch
   - **Condition 5**: Campus holiday unauthorized perimeter entry
   - **Condition 6**: Home intrusion & arming state management
   - **Condition 7**: Dog / goat compound intrusion detection
   - **Condition 8**: Home combustible gas leakage (Methane / LPG)
   - **Condition 9**: Chemical lab toxic vapor & VOC leakage (OSHA PEL thresholds)
   - **Condition 10**: Electrical overheating, radiometric thermal & ionization smoke

5. **Alerts & Incident Management Centre**:
   - Multi-level severity (Critical, High, Medium, Low).
   - Audit trail, operator acknowledgment notes, and resolution tracking.
   - Distinct labels for simulated events vs verified physical sensors.

---

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm or yarn

### Installation & Run

```bash
# Install dependencies
npm install

# Start local development server on port 3000
npm run dev

# Build for production
npm run build
```

---

## Hardware & RTSP/NVR Integration Architecture

Web browsers cannot directly open raw RTSP TCP sockets (port 554) in native HTML5 `<video>` tags. To stream authorized private NVRs (such as the Hikvision DS-7608NXI-K1), deploy a local media gateway such as **go2rtc**:

```bash
docker run --name go2rtc -d \
  -p 1984:1984 -p 8554:8554 -p 8555:8555/tcp -p 8555:8555/udp \
  -v ./go2rtc.yaml:/config/go2rtc.yaml \
  alexxit/go2rtc
```

In `go2rtc.yaml`:
```yaml
streams:
  cam1: rtsp://admin:password@192.168.1.64:554/Streaming/Channels/101
```

The gateway outputs sub-second latency WebRTC directly to the AuraVision player.

---

## Privacy & Security

- Webcam video frames are evaluated client-side in the browser thread and are **never** transmitted to cloud servers.
- Uploaded video files stay exclusively in local browser memory and are revoked on removal.
- Camera credentials and private RTSP passwords are kept local and never hardcoded or exposed in build artifacts.
