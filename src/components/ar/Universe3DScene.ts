import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  AnimeCharacter,
  CharacterFormationType,
  CharacterPlacementMode,
  GeographicLocationTarget,
  HandPalmAnchor,
  HologramColorTheme,
} from './types';
import { DEFAULT_GEOGRAPHIC_TARGET, HOLOGRAM_THEMES } from './animeCharacters';

export class Universe3DScene {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private animationFrameId: number | null = null;

  // Root Hologram Groups
  private hologramRoot: THREE.Group;
  private universeHierarchyGroup: THREE.Group;

  // 13 Nested Hierarchy Groups
  private deepUniverseGroup: THREE.Group;
  private galaxyClusterGroup: THREE.Group;
  private milkyWayGroup: THREE.Group;
  private solarSystemGroup: THREE.Group;
  private moonGroup: THREE.Group;
  private earthGroup: THREE.Group;
  private continentGroup: THREE.Group;
  private countryGroup: THREE.Group;
  private stateGroup: THREE.Group;
  private districtGroup: THREE.Group;
  private cityGroup: THREE.Group;
  private neighbourhoodGroup: THREE.Group;
  private streetGroup: THREE.Group;

  // Character Formation & Pedestal Groups
  private characterClusterGroup: THREE.Group;
  private emitterRingGroup: THREE.Group;
  private locationMarkerGroup: THREE.Group;

  // Particle systems & animatables
  private cosmicWebParticles!: THREE.Points;
  private galaxyParticles!: THREE.Points;
  private earthMesh!: THREE.Mesh;
  private earthCloudMesh!: THREE.Mesh;
  private earthAtmosphereMesh!: THREE.Mesh;
  private moonMesh!: THREE.Mesh;
  private sunCoronaMesh!: THREE.Mesh;
  private streetTrafficParticles!: THREE.Points;
  private planets: { mesh: THREE.Mesh; orbitRadius: number; speed: number; angle: number }[] = [];

  // Lighting
  private primaryLight: THREE.PointLight;
  private ambientLight: THREE.AmbientLight;
  private rimLight: THREE.DirectionalLight;

  // State & Total Manual Control
  private targetZoom: number = 2.1; // Default: Earth Scale
  private currentZoom: number = 2.1;
  private manualRotX: number = 0.2;
  private manualRotY: number = 0;
  private panOffsetX: number = 0;
  private panOffsetY: number = 0;

  // CRITICAL RULE: Universe must NOT rotate automatically! Default = false.
  private isAutoRotate: boolean = false;
  private isPaused: boolean = false;

  private currentTheme: HologramColorTheme = 'cyan';

  // Multi-Character State
  private currentCharacters: AnimeCharacter[] = [];
  private characterPlacement: CharacterPlacementMode = 'in_palm';
  private characterFormation: CharacterFormationType = 'tiered';
  private characterScaleFactor: number = 1.0;
  private characterRotationY: number = 0;
  private characterOffset: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };

  private geographicTarget: GeographicLocationTarget = DEFAULT_GEOGRAPHIC_TARGET;
  private palmAnchor: HandPalmAnchor | null = null;
  private clock: THREE.Clock = new THREE.Clock();

  constructor(container: HTMLElement) {
    this.container = container;

    // 1. Scene
    this.scene = new THREE.Scene();

    // 2. Camera
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(0, 1.2, 5.2);

    // 3. Renderer with transparent background to overlay on camera feed
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // 4. Master Groups
    this.hologramRoot = new THREE.Group();
    this.scene.add(this.hologramRoot);

    this.emitterRingGroup = new THREE.Group();
    this.hologramRoot.add(this.emitterRingGroup);

    this.universeHierarchyGroup = new THREE.Group();
    this.hologramRoot.add(this.universeHierarchyGroup);

    // Create 13 hierarchy groups
    this.deepUniverseGroup = new THREE.Group();
    this.galaxyClusterGroup = new THREE.Group();
    this.milkyWayGroup = new THREE.Group();
    this.solarSystemGroup = new THREE.Group();
    this.moonGroup = new THREE.Group();
    this.earthGroup = new THREE.Group();
    this.continentGroup = new THREE.Group();
    this.countryGroup = new THREE.Group();
    this.stateGroup = new THREE.Group();
    this.districtGroup = new THREE.Group();
    this.cityGroup = new THREE.Group();
    this.neighbourhoodGroup = new THREE.Group();
    this.streetGroup = new THREE.Group();

    this.universeHierarchyGroup.add(this.deepUniverseGroup);
    this.universeHierarchyGroup.add(this.galaxyClusterGroup);
    this.universeHierarchyGroup.add(this.milkyWayGroup);
    this.universeHierarchyGroup.add(this.solarSystemGroup);
    this.universeHierarchyGroup.add(this.moonGroup);
    this.universeHierarchyGroup.add(this.earthGroup);
    this.universeHierarchyGroup.add(this.continentGroup);
    this.universeHierarchyGroup.add(this.countryGroup);
    this.universeHierarchyGroup.add(this.stateGroup);
    this.universeHierarchyGroup.add(this.districtGroup);
    this.universeHierarchyGroup.add(this.cityGroup);
    this.universeHierarchyGroup.add(this.neighbourhoodGroup);
    this.universeHierarchyGroup.add(this.streetGroup);

    this.characterClusterGroup = new THREE.Group();
    this.hologramRoot.add(this.characterClusterGroup);

    this.locationMarkerGroup = new THREE.Group();
    this.hologramRoot.add(this.locationMarkerGroup);

    // 5. Lighting
    this.ambientLight = new THREE.AmbientLight(0x03182b, 1.8);
    this.scene.add(this.ambientLight);

    this.primaryLight = new THREE.PointLight(0x00f0ff, 3.8, 18);
    this.primaryLight.position.set(0, 3.5, 2.5);
    this.scene.add(this.primaryLight);

    this.rimLight = new THREE.DirectionalLight(0x38bdf8, 2.2);
    this.rimLight.position.set(-2, 4, -3);
    this.scene.add(this.rimLight);

    // 6. Build 3D Universe Layers
    this.buildPalmEmitterReticle();
    this.buildDeepUniverseLayer();
    this.buildGalaxyClustersLayer();
    this.buildMilkyWayLayer();
    this.buildSolarSystemLayer();
    this.buildMoonLayer();
    this.buildEarthLayer();
    this.buildContinentLayer();
    this.buildCountryIndiaLayer();
    this.buildStateTamilNaduLayer();
    this.buildDistrictLayer();
    this.buildCityMetropolisLayer();
    this.buildNeighbourhoodLayer();
    this.buildStreetLayer();
    this.buildGeographicLocationMarker();

    // 7. Event Listeners & Animation Loop
    window.addEventListener('resize', this.handleResize);
    this.startRenderLoop();
  }

  // --- PALM EMITTER BASE ---
  private buildPalmEmitterReticle() {
    const ringGeo = new THREE.RingGeometry(0.85, 0.95, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -1.1;
    this.emitterRingGroup.add(ring);

    const innerRingGeo = new THREE.RingGeometry(0.45, 0.5, 32);
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
    });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.y = -1.1;
    this.emitterRingGroup.add(innerRing);

    const beamGeo = new THREE.CylinderGeometry(0.9, 0.2, 1.2, 24, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = -0.55;
    this.emitterRingGroup.add(beam);
  }

  // --- LAYER 13: DEEP UNIVERSE ---
  private buildDeepUniverseLayer() {
    const particleCount = 1400;
    const pos = new Float32Array(particleCount * 3);
    const cols = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 2.2 + Math.random() * 2.5;

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);

      cols[i * 3] = 0.2 + Math.random() * 0.4;
      cols[i * 3 + 1] = 0.5 + Math.random() * 0.5;
      cols[i * 3 + 2] = 0.9 + Math.random() * 0.1;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.045,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });

    this.cosmicWebParticles = new THREE.Points(geo, mat);
    this.deepUniverseGroup.add(this.cosmicWebParticles);
  }

  // --- LAYER 12: GALAXY CLUSTERS ---
  private buildGalaxyClustersLayer() {
    const andromedaGeo = new THREE.TorusGeometry(1.4, 0.12, 16, 64);
    const andromedaMat = new THREE.MeshBasicMaterial({
      color: 0x818cf8,
      transparent: true,
      opacity: 0.4,
      wireframe: true,
    });
    const andromeda = new THREE.Mesh(andromedaGeo, andromedaMat);
    andromeda.rotation.x = Math.PI / 3;
    andromeda.position.set(1.1, 0.8, -0.6);
    this.galaxyClusterGroup.add(andromeda);
  }

  // --- LAYER 11: MILKY WAY ---
  private buildMilkyWayLayer() {
    const starCount = 1800;
    const pos = new Float32Array(starCount * 3);
    const cols = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const arms = 2;
      const armIndex = i % arms;
      const dist = Math.random() * 1.8;
      const angle = dist * 2.8 + (armIndex * 2 * Math.PI) / arms;
      const spread = (Math.random() - 0.5) * 0.25;

      pos[i * 3] = Math.cos(angle) * dist + spread;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 0.2;
      pos[i * 3 + 2] = Math.sin(angle) * dist + spread;

      cols[i * 3] = 0.1;
      cols[i * 3 + 1] = 0.85;
      cols[i * 3 + 2] = 1.0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.035,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });

    this.galaxyParticles = new THREE.Points(geo, mat);
    this.milkyWayGroup.add(this.galaxyParticles);

    const coreGeo = new THREE.SphereGeometry(0.18, 24, 24);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.9,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    this.milkyWayGroup.add(core);
  }

  // --- LAYER 10: SOLAR SYSTEM ---
  private buildSolarSystemLayer() {
    const sunGeo = new THREE.SphereGeometry(0.32, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.95,
    });
    const sun = new THREE.Mesh(sunGeo, sunMat);
    this.solarSystemGroup.add(sun);

    const coronaGeo = new THREE.SphereGeometry(0.42, 32, 32);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
    });
    this.sunCoronaMesh = new THREE.Mesh(coronaGeo, coronaMat);
    this.solarSystemGroup.add(this.sunCoronaMesh);

    const planetData = [
      { radius: 0.05, orbit: 0.65, color: 0x94a3b8, speed: 1.6 },
      { radius: 0.08, orbit: 0.95, color: 0xfde047, speed: 1.2 },
      { radius: 0.07, orbit: 1.35, color: 0xf87171, speed: 0.9 },
      { radius: 0.18, orbit: 1.9, color: 0xfb923c, speed: 0.5 },
      { radius: 0.15, orbit: 2.45, color: 0xfacc15, speed: 0.35, hasRing: true },
    ];

    planetData.forEach((p) => {
      const orbitGeo = new THREE.RingGeometry(p.orbit - 0.008, p.orbit + 0.008, 64);
      const orbitMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
      });
      const orbit = new THREE.Mesh(orbitGeo, orbitMat);
      orbit.rotation.x = Math.PI / 2;
      this.solarSystemGroup.add(orbit);

      const pGeo = new THREE.SphereGeometry(p.radius, 16, 16);
      const pMat = new THREE.MeshStandardMaterial({
        color: p.color,
        roughness: 0.4,
        metalness: 0.3,
        emissive: p.color,
        emissiveIntensity: 0.25,
      });
      const pMesh = new THREE.Mesh(pGeo, pMat);
      pMesh.position.x = p.orbit;
      this.solarSystemGroup.add(pMesh);

      if (p.hasRing) {
        const ringGeo = new THREE.RingGeometry(p.radius * 1.4, p.radius * 2.3, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xfde047,
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.rotation.x = Math.PI / 3;
        pMesh.add(ringMesh);
      }

      this.planets.push({
        mesh: pMesh,
        orbitRadius: p.orbit,
        speed: p.speed,
        angle: Math.random() * Math.PI * 2,
      });
    });
  }

  // --- LAYER 9: MOON & ORBIT ---
  private buildMoonLayer() {
    const moonOrbitGeo = new THREE.RingGeometry(1.28, 1.3, 64);
    const moonOrbitMat = new THREE.MeshBasicMaterial({
      color: 0x94a3b8,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    const moonOrbit = new THREE.Mesh(moonOrbitGeo, moonOrbitMat);
    moonOrbit.rotation.x = Math.PI / 2.3;
    this.moonGroup.add(moonOrbit);

    const moonGeo = new THREE.SphereGeometry(0.12, 24, 24);
    const moonMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.85,
      metalness: 0.1,
    });
    this.moonMesh = new THREE.Mesh(moonGeo, moonMat);
    this.moonMesh.position.set(1.15, 0.25, 0.4);
    this.moonGroup.add(this.moonMesh);
  }

  // --- LAYER 8: EARTH (LIVING BLUE GLOBE) ---
  private buildEarthLayer() {
    const earthGeo = new THREE.SphereGeometry(0.82, 48, 48);
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const oceanGrad = ctx.createLinearGradient(0, 0, 0, 512);
      oceanGrad.addColorStop(0, '#0f3a60');
      oceanGrad.addColorStop(0.5, '#0a2540');
      oceanGrad.addColorStop(1, '#0f3a60');
      ctx.fillStyle = oceanGrad;
      ctx.fillRect(0, 0, 1024, 512);

      ctx.fillStyle = '#065f46';
      ctx.beginPath();
      ctx.ellipse(650, 190, 180, 80, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#047857';
      ctx.beginPath();
      ctx.moveTo(680, 210);
      ctx.lineTo(720, 210);
      ctx.lineTo(700, 270);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(520, 260, 80, 110, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(260, 180, 75, 90, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(320, 320, 60, 95, 0.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(820, 340, 55, 45, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
      ctx.lineWidth = 1;
      for (let y = 64; y < 512; y += 64) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(1024, y);
        ctx.stroke();
      }
      for (let x = 64; x < 1024; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 512);
        ctx.stroke();
      }
    }

    const earthTexture = new THREE.CanvasTexture(canvas);
    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTexture,
      roughness: 0.65,
      metalness: 0.25,
      emissive: 0x0284c7,
      emissiveIntensity: 0.2,
    });
    this.earthMesh = new THREE.Mesh(earthGeo, earthMat);
    this.earthGroup.add(this.earthMesh);

    const cloudGeo = new THREE.SphereGeometry(0.835, 36, 36);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
    });
    this.earthCloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    this.earthGroup.add(this.earthCloudMesh);

    const atmosGeo = new THREE.SphereGeometry(0.88, 36, 36);
    const atmosMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.2,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    this.earthAtmosphereMesh = new THREE.Mesh(atmosGeo, atmosMat);
    this.earthGroup.add(this.earthAtmosphereMesh);
  }

  // --- LAYER 7: CONTINENT (ASIA) ---
  private buildContinentLayer() {
    const contGeo = new THREE.CylinderGeometry(0.9, 0.85, 0.05, 32);
    const contMat = new THREE.MeshStandardMaterial({
      color: 0x0f766e,
      roughness: 0.7,
      metalness: 0.2,
      emissive: 0x047857,
      emissiveIntensity: 0.3,
    });
    const contMesh = new THREE.Mesh(contGeo, contMat);
    contMesh.position.y = -0.15;
    this.continentGroup.add(contMesh);

    const borderGeo = new THREE.RingGeometry(0.85, 0.9, 32);
    const borderMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    });
    const border = new THREE.Mesh(borderGeo, borderMat);
    border.rotation.x = Math.PI / 2;
    border.position.y = -0.12;
    this.continentGroup.add(border);
  }

  // --- LAYER 6: COUNTRY (INDIA) ---
  private buildCountryIndiaLayer() {
    const indiaShape = new THREE.Shape();
    indiaShape.moveTo(0, 0.75);
    indiaShape.lineTo(0.55, 0.25);
    indiaShape.lineTo(0.35, -0.45);
    indiaShape.lineTo(0.05, -0.75);
    indiaShape.lineTo(-0.25, -0.4);
    indiaShape.lineTo(-0.45, 0.2);
    indiaShape.closePath();

    const extrudeSettings = { depth: 0.08, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.02, bevelThickness: 0.02 };
    const indiaGeo = new THREE.ExtrudeGeometry(indiaShape, extrudeSettings);
    const indiaMat = new THREE.MeshStandardMaterial({
      color: 0x0369a1,
      roughness: 0.4,
      metalness: 0.5,
      emissive: 0x0284c7,
      emissiveIntensity: 0.4,
    });
    const indiaMesh = new THREE.Mesh(indiaGeo, indiaMat);
    indiaMesh.scale.set(0.9, 0.9, 0.9);
    indiaMesh.position.set(0, 0, -0.04);
    this.countryGroup.add(indiaMesh);

    const edges = new THREE.EdgesGeometry(indiaGeo);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 });
    const wireframe = new THREE.LineSegments(edges, lineMat);
    wireframe.scale.set(0.9, 0.9, 0.9);
    wireframe.position.set(0, 0, -0.04);
    this.countryGroup.add(wireframe);
  }

  // --- LAYER 5: STATE (TAMIL NADU) ---
  private buildStateTamilNaduLayer() {
    const tnShape = new THREE.Shape();
    tnShape.moveTo(-0.4, 0.45);
    tnShape.lineTo(0.45, 0.4);
    tnShape.lineTo(0.5, -0.2);
    tnShape.lineTo(0.1, -0.6);
    tnShape.lineTo(-0.15, -0.7);
    tnShape.lineTo(-0.5, -0.3);
    tnShape.closePath();

    const tnGeo = new THREE.ExtrudeGeometry(tnShape, { depth: 0.1, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.02, bevelThickness: 0.02 });
    const tnMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.35,
      metalness: 0.6,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.5,
    });
    const tnMesh = new THREE.Mesh(tnGeo, tnMat);
    this.stateGroup.add(tnMesh);

    for (let i = 0; i < 6; i++) {
      const coneGeo = new THREE.ConeGeometry(0.06, 0.14, 8);
      const coneMat = new THREE.MeshStandardMaterial({ color: 0x10b981 });
      const peak = new THREE.Mesh(coneGeo, coneMat);
      peak.position.set(-0.42 + i * 0.05, -0.3 + i * 0.12, 0.15);
      peak.rotation.x = Math.PI / 2;
      this.stateGroup.add(peak);
    }
  }

  // --- LAYER 4: DISTRICT ---
  private buildDistrictLayer() {
    const distGeo = new THREE.BoxGeometry(1.2, 1.0, 0.08);
    const distMat = new THREE.MeshStandardMaterial({
      color: 0x0369a1,
      roughness: 0.5,
      metalness: 0.4,
      emissive: 0x0284c7,
      emissiveIntensity: 0.35,
    });
    const distMesh = new THREE.Mesh(distGeo, distMat);
    this.districtGroup.add(distMesh);

    for (let r = 0; r < 2; r++) {
      const riverGeo = new THREE.PlaneGeometry(0.9, 0.04);
      const riverMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
      const river = new THREE.Mesh(riverGeo, riverMat);
      river.position.set(0, 0.15 - r * 0.35, 0.05);
      this.districtGroup.add(river);
    }
  }

  // --- LAYER 3: CITY ---
  private buildCityMetropolisLayer() {
    const buildingCount = 28;
    for (let i = 0; i < buildingCount; i++) {
      const bx = (Math.random() - 0.5) * 1.3;
      const by = (Math.random() - 0.5) * 1.3;
      const bHeight = 0.2 + Math.random() * 0.45;
      const bWidth = 0.08 + Math.random() * 0.06;

      const bGeo = new THREE.BoxGeometry(bWidth, bWidth, bHeight);
      const bMat = new THREE.MeshStandardMaterial({
        color: 0x0c4a6e,
        roughness: 0.3,
        metalness: 0.8,
        emissive: 0x00f0ff,
        emissiveIntensity: 0.3,
      });
      const bMesh = new THREE.Mesh(bGeo, bMat);
      bMesh.position.set(bx, by, bHeight / 2);
      this.cityGroup.add(bMesh);
    }

    const coastGeo = new THREE.PlaneGeometry(0.3, 1.4);
    const coastMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.2 });
    const coast = new THREE.Mesh(coastGeo, coastMat);
    coast.position.set(0.65, 0, 0.01);
    this.cityGroup.add(coast);
  }

  // --- LAYER 2: NEIGHBOURHOOD ---
  private buildNeighbourhoodLayer() {
    const groundGeo = new THREE.PlaneGeometry(1.6, 1.6);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    this.neighbourhoodGroup.add(ground);

    const blockCount = 12;
    for (let i = 0; i < blockCount; i++) {
      const blockGeo = new THREE.BoxGeometry(0.24, 0.24, 0.15);
      const blockMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
      const block = new THREE.Mesh(blockGeo, blockMat);
      const col = i % 4;
      const row = Math.floor(i / 4);
      block.position.set(-0.5 + col * 0.35, -0.4 + row * 0.4, 0.08);
      this.neighbourhoodGroup.add(block);
    }
  }

  // --- LAYER 1: STREET LEVEL ---
  private buildStreetLayer() {
    const roadGeo = new THREE.PlaneGeometry(0.38, 1.8);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.9 });
    const road = new THREE.Mesh(roadGeo, roadMat);
    this.streetGroup.add(road);

    for (let y = -0.8; y <= 0.8; y += 0.2) {
      const dashGeo = new THREE.PlaneGeometry(0.015, 0.1);
      const dashMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide });
      const dash = new THREE.Mesh(dashGeo, dashMat);
      dash.position.set(0, y, 0.005);
      this.streetGroup.add(dash);
    }

    for (let side = -1; side <= 1; side += 2) {
      for (let j = 0; j < 5; j++) {
        const height = 0.25 + (j % 3) * 0.15;
        const bGeo = new THREE.BoxGeometry(0.22, 0.25, height);
        const bMat = new THREE.MeshStandardMaterial({
          color: 0x0f172a,
          roughness: 0.25,
          metalness: 0.7,
          emissive: 0x00f0ff,
          emissiveIntensity: 0.25,
        });
        const building = new THREE.Mesh(bGeo, bMat);
        building.position.set(side * 0.32, -0.6 + j * 0.32, height / 2);
        this.streetGroup.add(building);
      }
    }

    const trafficCount = 30;
    const trafficPos = new Float32Array(trafficCount * 3);
    const trafficCols = new Float32Array(trafficCount * 3);

    for (let i = 0; i < trafficCount; i++) {
      const lane = i % 2 === 0 ? -0.09 : 0.09;
      trafficPos[i * 3] = lane;
      trafficPos[i * 3 + 1] = (Math.random() - 0.5) * 1.6;
      trafficPos[i * 3 + 2] = 0.02;

      const isHeadingNorth = lane > 0;
      trafficCols[i * 3] = isHeadingNorth ? 0.0 : 1.0;
      trafficCols[i * 3 + 1] = isHeadingNorth ? 0.9 : 0.2;
      trafficCols[i * 3 + 2] = isHeadingNorth ? 1.0 : 0.2;
    }

    const trafficGeo = new THREE.BufferGeometry();
    trafficGeo.setAttribute('position', new THREE.BufferAttribute(trafficPos, 3));
    trafficGeo.setAttribute('color', new THREE.BufferAttribute(trafficCols, 3));

    const trafficMat = new THREE.PointsMaterial({
      size: 0.035,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
    });
    this.streetTrafficParticles = new THREE.Points(trafficGeo, trafficMat);
    this.streetGroup.add(this.streetTrafficParticles);
  }

  // --- GEOGRAPHIC DESTINATION MARKER PIN ---
  private buildGeographicLocationMarker() {
    const pinGeo = new THREE.ConeGeometry(0.08, 0.22, 16);
    const pinMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.9,
    });
    const pin = new THREE.Mesh(pinGeo, pinMat);
    pin.rotation.x = Math.PI;
    pin.position.set(0, 0, 0.2);
    this.locationMarkerGroup.add(pin);

    const rippleGeo = new THREE.RingGeometry(0.08, 0.12, 24);
    const rippleMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    });
    const ripple = new THREE.Mesh(rippleGeo, rippleMat);
    ripple.position.set(0, 0, 0.05);
    this.locationMarkerGroup.add(ripple);
  }

  // --- MULTI-CHARACTER AR FORMATION GENERATOR ---
  public setAnimeCharacters(characters: AnimeCharacter[]) {
    this.currentCharacters = [...characters];

    // Clear existing character cluster meshes
    while (this.characterClusterGroup.children.length > 0) {
      const obj = this.characterClusterGroup.children[0];
      this.characterClusterGroup.remove(obj);
    }

    if (characters.length === 0) {
      return;
    }

    // Dynamic auto-scale factor so all characters fit in palm
    const count = characters.length;
    const baseScale =
      count === 1 ? 1.0 : count <= 4 ? 0.75 : count <= 12 ? 0.52 : count <= 24 ? 0.38 : 0.28;

    // Intelligent Depth Sorting: Place small characters in upper/back tier or front, large spaced out
    const sorted = [...characters].sort((a, b) => {
      const order = { large: 1, medium: 2, small: 3 };
      return (order[a.sizeTier] || 2) - (order[b.sizeTier] || 2);
    });

    sorted.forEach((char, index) => {
      const charGroup = this.buildProceduralCharacterMesh(char);
      charGroup.scale.set(baseScale, baseScale, baseScale);

      // Formation Layout Calculation
      const pos = this.calculateFormationPosition(index, count, this.characterFormation, char.sizeTier);
      charGroup.position.set(pos.x, pos.y, pos.z);
      charGroup.rotation.y = pos.rotY;

      this.characterClusterGroup.add(charGroup);
    });

    this.applyClusterTransforms();
  }

  // Backwards compatibility for single character setter
  public setAnimeCharacter(character: AnimeCharacter | null) {
    this.setAnimeCharacters(character ? [character] : []);
  }

  public setCharacterFormation(formation: CharacterFormationType) {
    this.characterFormation = formation;
    this.setAnimeCharacters(this.currentCharacters);
  }

  private calculateFormationPosition(
    index: number,
    total: number,
    formation: CharacterFormationType,
    sizeTier: 'small' | 'medium' | 'large'
  ): { x: number; y: number; z: number; rotY: number } {
    if (total === 1) {
      return { x: 0, y: 0.1, z: 0.15, rotY: 0 };
    }

    if (formation === 'ring') {
      // Concentric or single circular orbit ring
      const radius = total <= 8 ? 0.95 : total <= 20 ? 1.4 : 1.85;
      const angle = (index / total) * Math.PI * 2;
      const staggerY = (index % 2 === 0 ? 0.08 : -0.08);
      return {
        x: Math.cos(angle) * radius,
        y: staggerY + 0.15,
        z: Math.sin(angle) * radius * 0.7,
        rotY: -angle + Math.PI / 2,
      };
    }

    if (formation === 'orbit_earth') {
      // Swarm orbiting celestial globe
      const radius = 1.35 + (index % 3) * 0.25;
      const angle = (index / total) * Math.PI * 2;
      const elev = Math.sin(index * 1.5) * 0.45;
      return {
        x: Math.cos(angle) * radius,
        y: elev + 0.2,
        z: Math.sin(angle) * radius,
        rotY: -angle + Math.PI / 2,
      };
    }

    // Default: 'tiered' Amphitheater Curved Rows (smaller toward back/top, larger in front)
    const tiers = total <= 6 ? 2 : total <= 18 ? 3 : 4;
    const tierIndex = index % tiers;
    const itemsInTier = Math.ceil(total / tiers);
    const posInTier = Math.floor(index / tiers);

    const span = Math.min(2.8, itemsInTier * 0.42);
    const xStep = itemsInTier > 1 ? span / (itemsInTier - 1) : 0;
    const x = -span / 2 + posInTier * xStep;

    // Curved amphitheater arc
    const depthCurve = (x * x) * 0.18;
    const z = -tierIndex * 0.42 + depthCurve;
    const y = tierIndex * 0.22 - (sizeTier === 'large' ? 0.08 : 0);

    // Turn characters slightly toward center
    const rotY = -Math.atan2(x, 2.5);

    return { x, y, z, rotY };
  }

  // --- PROCEDURAL 3D CHARACTER MODEL BUILDER ---
  private buildProceduralCharacterMesh(c: AnimeCharacter): THREE.Group {
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({
      color: c.primaryColor,
      roughness: 0.35,
      metalness: 0.2,
      emissive: c.primaryColor,
      emissiveIntensity: 0.18,
    });
    const secondaryMat = new THREE.MeshStandardMaterial({
      color: c.secondaryColor,
      roughness: 0.4,
      metalness: 0.2,
    });
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xffdfd0,
      roughness: 0.6,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: c.accentColor,
      roughness: 0.3,
      emissive: c.accentColor,
      emissiveIntensity: 0.4,
    });

    if (c.id === 'rika') {
      // Monstrous Queen of Curses (Spooky spectral spirit)
      const headGeo = new THREE.SphereGeometry(0.35, 20, 20);
      const head = new THREE.Mesh(headGeo, secondaryMat);
      head.position.y = 0.4;
      group.add(head);

      const eyeGeo = new THREE.SphereGeometry(0.12, 16, 16);
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(0, 0.45, 0.3);
      group.add(eye);

      for (let h = -1; h <= 1; h += 2) {
        const hornGeo = new THREE.ConeGeometry(0.08, 0.38, 12);
        const horn = new THREE.Mesh(hornGeo, bodyMat);
        horn.position.set(h * 0.28, 0.75, 0);
        horn.rotation.z = -h * 0.5;
        group.add(horn);
      }
    } else if (c.id === 'pokemon_pikachu') {
      const bodyGeo = new THREE.SphereGeometry(0.24, 20, 20);
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.1;
      group.add(body);

      const headGeo = new THREE.SphereGeometry(0.2, 20, 20);
      const head = new THREE.Mesh(headGeo, bodyMat);
      head.position.y = 0.36;
      group.add(head);

      for (let ch = -1; ch <= 1; ch += 2) {
        const cheekGeo = new THREE.SphereGeometry(0.05, 12, 12);
        const cheek = new THREE.Mesh(cheekGeo, secondaryMat);
        cheek.position.set(ch * 0.14, 0.34, 0.15);
        group.add(cheek);
      }

      for (let e = -1; e <= 1; e += 2) {
        const earGeo = new THREE.ConeGeometry(0.045, 0.28, 12);
        const ear = new THREE.Mesh(earGeo, bodyMat);
        ear.position.set(e * 0.12, 0.58, 0);
        ear.rotation.z = -e * 0.35;
        group.add(ear);
      }

      const tailGeo = new THREE.BoxGeometry(0.06, 0.3, 0.02);
      const tail = new THREE.Mesh(tailGeo, bodyMat);
      tail.position.set(0, 0.2, -0.22);
      tail.rotation.x = -0.4;
      group.add(tail);
    } else if (c.id === 'pokemon_charizard') {
      const torsoGeo = new THREE.CylinderGeometry(0.14, 0.18, 0.45, 16);
      const torso = new THREE.Mesh(torsoGeo, bodyMat);
      torso.position.y = 0.15;
      group.add(torso);

      const headGeo = new THREE.ConeGeometry(0.12, 0.25, 16);
      const head = new THREE.Mesh(headGeo, bodyMat);
      head.position.set(0, 0.45, 0.1);
      head.rotation.x = Math.PI / 4;
      group.add(head);

      for (let w = -1; w <= 1; w += 2) {
        const wingGeo = new THREE.PlaneGeometry(0.45, 0.35);
        const wingMat = new THREE.MeshStandardMaterial({
          color: c.secondaryColor,
          side: THREE.DoubleSide,
        });
        const wing = new THREE.Mesh(wingGeo, wingMat);
        wing.position.set(w * 0.35, 0.3, -0.1);
        wing.rotation.y = -w * 0.6;
        group.add(wing);
      }
    } else if (c.id === 'dudu' || c.id === 'budu') {
      const headGeo = new THREE.SphereGeometry(0.24, 20, 20);
      const head = new THREE.Mesh(headGeo, bodyMat);
      head.position.y = 0.32;
      group.add(head);

      const bodyGeo = new THREE.SphereGeometry(0.22, 20, 20);
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.05;
      group.add(body);

      const bellyGeo = new THREE.SphereGeometry(0.14, 16, 16);
      const belly = new THREE.Mesh(bellyGeo, secondaryMat);
      belly.position.set(0, 0.05, 0.12);
      group.add(belly);

      for (let er = -1; er <= 1; er += 2) {
        const earGeo = new THREE.SphereGeometry(0.07, 16, 16);
        const ear = new THREE.Mesh(earGeo, bodyMat);
        ear.position.set(er * 0.18, 0.5, 0);
        group.add(ear);
      }
    } else {
      // Standard stylized anime/cartoon humanoid geometry
      const torsoGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.38, 16);
      const torso = new THREE.Mesh(torsoGeo, bodyMat);
      torso.position.y = 0.15;
      group.add(torso);

      const headGeo = new THREE.SphereGeometry(0.16, 20, 20);
      const head = new THREE.Mesh(headGeo, skinMat);
      head.position.y = 0.44;
      group.add(head);

      const hairGeo = new THREE.ConeGeometry(0.19, 0.22, 16);
      const hair = new THREE.Mesh(hairGeo, secondaryMat);
      hair.position.y = 0.54;
      group.add(hair);

      if (c.id === 'naruto') {
        const rasGeo = new THREE.SphereGeometry(0.1, 16, 16);
        const rasMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.9 });
        const ras = new THREE.Mesh(rasGeo, rasMat);
        ras.position.set(0.26, 0.15, 0.2);
        group.add(ras);
      } else if (c.id === 'yuta') {
        const bladeGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.65, 8);
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9 });
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        blade.position.set(0.12, 0.25, -0.15);
        blade.rotation.z = 0.4;
        group.add(blade);
      } else if (c.id === 'ben10') {
        const dialGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.03, 12);
        const dialMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
        const dial = new THREE.Mesh(dialGeo, dialMat);
        dial.position.set(-0.2, 0.12, 0.15);
        dial.rotation.x = Math.PI / 2;
        group.add(dial);
      }
    }

    // Swirling Holographic Energy Aura
    const auraCount = 45;
    const auraPos = new Float32Array(auraCount * 3);
    for (let p = 0; p < auraCount; p++) {
      const theta = Math.random() * Math.PI * 2;
      const radius = 0.24 + Math.random() * 0.28;
      const y = (Math.random() - 0.2) * 0.75;
      auraPos[p * 3] = Math.cos(theta) * radius;
      auraPos[p * 3 + 1] = y;
      auraPos[p * 3 + 2] = Math.sin(theta) * radius;
    }
    const auraGeo = new THREE.BufferGeometry();
    auraGeo.setAttribute('position', new THREE.BufferAttribute(auraPos, 3));
    const auraMat = new THREE.PointsMaterial({
      color: c.auraColor,
      size: 0.04,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });
    const auraPoints = new THREE.Points(auraGeo, auraMat);
    group.add(auraPoints);

    return group;
  }

  // --- CHARACTER PLACEMENT & TRANSFORMS ---
  public setCharacterPlacement(mode: CharacterPlacementMode) {
    this.characterPlacement = mode;
    this.applyClusterTransforms();
  }

  public setCharacterScale(scale: number) {
    this.characterScaleFactor = scale;
    this.applyClusterTransforms();
  }

  public setCharacterRotation(degrees: number) {
    this.characterRotationY = (degrees * Math.PI) / 180;
    this.applyClusterTransforms();
  }

  public setCharacterOffset(offset: { x: number; y: number; z: number }) {
    this.characterOffset = offset;
    this.applyClusterTransforms();
  }

  private applyClusterTransforms() {
    if (!this.characterClusterGroup) return;

    const s = this.characterScaleFactor;
    this.characterClusterGroup.scale.set(s, s, s);
    this.characterClusterGroup.rotation.y = this.characterRotationY;

    if (this.characterPlacement === 'in_palm') {
      this.characterClusterGroup.position.set(
        this.characterOffset.x,
        this.characterOffset.y - 0.15,
        this.characterOffset.z + 0.25
      );
    } else if (this.characterPlacement === 'beside_earth') {
      this.characterClusterGroup.position.set(
        this.characterOffset.x + 1.25,
        this.characterOffset.y + 0.1,
        this.characterOffset.z
      );
    } else {
      this.characterClusterGroup.position.set(
        this.characterOffset.x,
        this.characterOffset.y,
        this.characterOffset.z
      );
    }
  }

  // --- GEOGRAPHIC DESTINATION TARGET ---
  public setGeographicTarget(target: GeographicLocationTarget) {
    this.geographicTarget = target;
    this.locationMarkerGroup.position.set(0.1, -0.15, 0.75);
  }

  // --- SCALE ZOOM MANAGEMENT ---
  public setTargetZoom(zoom: number) {
    this.targetZoom = Math.min(8.5, Math.max(0.2, zoom));
  }

  public getTargetZoom(): number {
    return this.targetZoom;
  }

  // --- TOTAL MANUAL CONTROL METHODS ---
  public setAutoRotate(auto: boolean) {
    this.isAutoRotate = auto;
  }

  public setPaused(paused: boolean) {
    this.isPaused = paused;
  }

  public isScenePaused(): boolean {
    return this.isPaused;
  }

  public addRotation(deltaX: number, deltaY: number) {
    this.manualRotX += deltaX;
    this.manualRotY += deltaY;
    this.characterRotationY += deltaY;
    this.applyClusterTransforms();
  }

  public applyPan(deltaX: number, deltaY: number) {
    this.panOffsetX += deltaX * 1.5;
    this.panOffsetY -= deltaY * 1.5;
  }

  public resetView() {
    this.targetZoom = 2.1;
    this.manualRotX = 0.2;
    this.manualRotY = 0;
    this.panOffsetX = 0;
    this.panOffsetY = 0;
    this.characterRotationY = 0;
    this.characterScaleFactor = 1.0;
    this.characterOffset = { x: 0, y: 0, z: 0 };
    this.applyClusterTransforms();
  }

  public setHologramTheme(themeId: HologramColorTheme) {
    this.currentTheme = themeId;
    const cfg = HOLOGRAM_THEMES.find((t) => t.id === themeId) || HOLOGRAM_THEMES[0];
    this.primaryLight.color.setHex(cfg.primaryHex);
    this.rimLight.color.setHex(cfg.glowHex);
    this.ambientLight.color.setHex(cfg.ambientHex);
  }

  // --- REAL HAND TRACKING COORDINATE INPUT ---
  public updatePalmAnchor(anchor: HandPalmAnchor | null) {
    this.palmAnchor = anchor;

    if (!anchor || !anchor.detected) {
      return;
    }

    if (anchor.isTwoHanded && Math.abs(anchor.spanDelta) > 0.003) {
      this.targetZoom = Math.min(8.5, Math.max(0.2, this.targetZoom + anchor.spanDelta * 8.0));
    }

    if (anchor.isTwoHanded && (Math.abs(anchor.centroidDelta.x) > 0.003 || Math.abs(anchor.centroidDelta.y) > 0.003)) {
      this.panOffsetX += anchor.centroidDelta.x * 2.5;
      this.panOffsetY -= anchor.centroidDelta.y * 2.5;
    }

    if (!anchor.isStationary && anchor.confidence > 0.7) {
      const targetRotY = (anchor.palmCenter.x - 0.5) * 2.2 + (anchor.tiltAngleY * Math.PI) / 180;
      const targetRotX = (anchor.palmCenter.y - 0.5) * 1.8 + (anchor.tiltAngleX * Math.PI) / 180;
      this.manualRotY += (targetRotY - this.manualRotY) * 0.08;
      this.manualRotX += (targetRotX - this.manualRotX) * 0.08;

      if (this.currentCharacters.length > 0) {
        this.characterRotationY = (anchor.tiltAngleZ * Math.PI) / 180;
        this.applyClusterTransforms();
      }
    }

    if (anchor.isPinching && this.currentCharacters.length > 0) {
      const px = (anchor.pinchCenter.x - 0.5) * 2.0;
      const py = -(anchor.pinchCenter.y - 0.5) * 2.0;
      this.characterOffset = { x: px, y: py, z: this.characterOffset.z };
      this.applyClusterTransforms();
    }
  }

  // --- RENDER LOOP ---
  private startRenderLoop = () => {
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);

      if (this.isPaused) {
        this.renderer.render(this.scene, this.camera);
        return;
      }

      const delta = this.clock.getDelta();
      this.currentZoom += (this.targetZoom - this.currentZoom) * 0.12;

      this.universeHierarchyGroup.scale.set(this.currentZoom, this.currentZoom, this.currentZoom);
      this.universeHierarchyGroup.position.set(this.panOffsetX, this.panOffsetY, 0);

      if (this.isAutoRotate) {
        this.manualRotY += delta * 0.25;
        this.characterRotationY += delta * 0.25;
        this.applyClusterTransforms();
      }

      this.universeHierarchyGroup.rotation.x = this.manualRotX;
      this.universeHierarchyGroup.rotation.y = this.manualRotY;

      if (this.palmAnchor && this.palmAnchor.detected) {
        const targetAnchorX = (this.palmAnchor.palmCenter.x - 0.5) * 3.0;
        const targetAnchorY = -(this.palmAnchor.palmCenter.y - 0.6) * 2.5;
        this.hologramRoot.position.x += (targetAnchorX - this.hologramRoot.position.x) * 0.15;
        this.hologramRoot.position.y += (targetAnchorY - this.hologramRoot.position.y) * 0.15;
      } else {
        this.hologramRoot.position.x += (0 - this.hologramRoot.position.x) * 0.1;
        this.hologramRoot.position.y += (0 - this.hologramRoot.position.y) * 0.1;
      }

      // Smooth Scale Visibility Blending
      const z = this.currentZoom;
      this.deepUniverseGroup.visible = z <= 1.2;
      this.galaxyClusterGroup.visible = z >= 0.3 && z <= 1.6;
      this.milkyWayGroup.visible = z >= 0.5 && z <= 2.4;
      this.solarSystemGroup.visible = z >= 0.8 && z <= 3.2;
      this.moonGroup.visible = z >= 1.2 && z <= 4.0;
      this.earthGroup.visible = z >= 1.5 && z <= 5.5;
      this.continentGroup.visible = z >= 2.2 && z <= 6.2;
      this.countryGroup.visible = z >= 2.8 && z <= 7.2;
      this.stateGroup.visible = z >= 3.6 && z <= 8.0;
      this.districtGroup.visible = z >= 4.4 && z <= 8.3;
      this.cityGroup.visible = z >= 5.2 && z <= 8.5;
      this.neighbourhoodGroup.visible = z >= 6.0;
      this.streetGroup.visible = z >= 6.8;

      this.locationMarkerGroup.visible = z >= 1.8 && z <= 7.0;

      if (this.earthCloudMesh) {
        this.earthCloudMesh.rotation.y += delta * 0.05;
      }
      if (this.sunCoronaMesh) {
        this.sunCoronaMesh.rotation.z += delta * 0.1;
      }

      this.planets.forEach((p) => {
        p.angle += delta * p.speed * 0.4;
        p.mesh.position.x = Math.cos(p.angle) * p.orbitRadius;
        p.mesh.position.z = Math.sin(p.angle) * p.orbitRadius;
      });

      if (this.streetTrafficParticles && this.streetGroup.visible) {
        const posAttr = this.streetTrafficParticles.geometry.attributes.position as THREE.BufferAttribute;
        const array = posAttr.array as Float32Array;
        for (let i = 0; i < array.length / 3; i++) {
          const lane = array[i * 3];
          const speed = lane > 0 ? 0.3 : -0.3;
          array[i * 3 + 1] += delta * speed;
          if (array[i * 3 + 1] > 0.8) array[i * 3 + 1] = -0.8;
          if (array[i * 3 + 1] < -0.8) array[i * 3 + 1] = 0.8;
        }
        posAttr.needsUpdate = true;
      }

      this.renderer.render(this.scene, this.camera);
    };

    animate();
  };

  private handleResize = () => {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  public getCanvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  public dispose() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this.handleResize);
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
