export type HologramColorTheme = 'cyan' | 'amethyst' | 'solar' | 'emerald' | 'quantum';

export interface HologramThemeConfig {
  id: HologramColorTheme;
  name: string;
  primaryHex: number;
  secondaryHex: number;
  glowHex: number;
  ambientHex: number;
  accentTailwind: string;
  badgeBg: string;
}

export type UniverseScaleLevel =
  | 'street'        // Scale 1: Street level (Anna Salai / Marina Beach Rd, 3D buildings, traffic)
  | 'neighbourhood' // Scale 2: Neighbourhood (Marina Promenade, T. Nagar, central zone)
  | 'city'          // Scale 3: City (Chennai metropolis, urban grid, IT corridor)
  | 'district'      // Scale 4: District (Chennai Metropolitan District)
  | 'state'         // Scale 5: State (Tamil Nadu, Western Ghats & Bay of Bengal)
  | 'country'       // Scale 6: Country (India, glowing national boundary)
  | 'continent'     // Scale 7: Continent (Asia landmass & Indian Ocean)
  | 'earth'         // Scale 8: Earth (Living blue planet, oceans, atmosphere, clouds)
  | 'moon'          // Scale 9: Moon (Earth-Moon orbit & lunar terrain)
  | 'solar'         // Scale 10: Solar System (Sun, Mercury to Neptune, Asteroid belt)
  | 'milkyway'      // Scale 11: Milky Way (Barred spiral galaxy & Orion arm)
  | 'galaxies'      // Scale 12: Galaxy Clusters (Milky Way, Andromeda, Local Group)
  | 'universe';     // Scale 13: Observable Deep Universe (Cosmic web filaments, CMB)

export interface UniverseScaleInfo {
  id: UniverseScaleLevel;
  levelIndex: number; // 1 to 13
  name: string;
  label: string;
  zoomFactor: number; // 0.2 (universe) to 8.0 (street)
  description: string;
  metrics: string;
  sampleLocation: string;
  iconName: string;
}

export type CharacterCategory = 'all' | 'anime' | 'pokemon' | 'cartoons';
export type CharacterPlacementMode = 'in_palm' | 'beside_earth' | 'inside_universe';
export type CharacterFormationType = 'tiered' | 'ring' | 'orbit_earth' | 'grid';

export interface AnimeCharacter {
  id: string;
  name: string;
  category: 'anime' | 'pokemon' | 'cartoons';
  series: string;
  title: string;
  quote: string;
  auraType:
    | 'rasengan'
    | 'curse_queen'
    | 'cursed_energy'
    | 'comedic_joy'
    | 'thunderbolt'
    | 'dragon_fire'
    | 'shadow_ghost'
    | 'kamui_vortex'
    | 'angelic_wings'
    | 'talisman_chi'
    | 'omnitrix_pulse'
    | 'cute_heart'
    | 'super_saiyan'
    | 'infinite_void'
    | 'gear_sun'
    | 'water_breathing'
    | 'demon_blood'
    | 'one_punch'
    | 'bankai'
    | 'alchemy'
    | 'psychic'
    | 'aura_sphere'
    | 'water_shuriken'
    | 'rest'
    | 'gadget_pocket'
    | 'chase_slapstick'
    | 'patty_bubble'
    | 'spinach_power'
    | 'pure_magic';
  auraColor: number;
  primaryColor: number;
  secondaryColor: number;
  accentColor: number;
  pose: 'combat' | 'floating' | 'heroic' | 'mystic' | 'ready' | 'playful';
  energyPower: number; // 1 to 100
  sizeTier: 'small' | 'medium' | 'large'; // For intelligent multi-character depth sorting
  signatureObject:
    | 'rasengan_orb'
    | 'curse_tentacles'
    | 'katana_ring'
    | 'shinchan_action'
    | 'lightning_tail'
    | 'dragon_wings'
    | 'phantom_orb'
    | 'sharingan_mask'
    | 'mechanical_wings'
    | 'kungfu_talisman'
    | 'omnitrix_dial'
    | 'bear_honey'
    | 'panda_bamboo'
    | 'ki_orb'
    | 'blindfold_eyes'
    | 'straw_hat'
    | 'dual_blades'
    | 'nichirin_sword'
    | 'bamboo_muzzle'
    | 'glove_fist'
    | 'zanpakuto'
    | 'automail'
    | 'psychic_spoon'
    | 'fluffy_tail'
    | 'bone_rush'
    | 'water_shell'
    | 'bulb_vines'
    | 'mic'
    | 'water_stars'
    | 'pillow_belly'
    | 'doraemon_bell'
    | 'slingshot'
    | 'mallet'
    | 'cheese_wedge'
    | 'spatula'
    | 'starfish_shorts'
    | 'magnifier'
    | 'spinach_can'
    | 'imported_3d';
  avatarEmoji: string;
  isCustom?: boolean;
  isImported?: boolean;
  modelUrl?: string; // For user uploaded GLTF / GLB models
  legalNotice?: string;
}

export interface HandPalmAnchor {
  detected: boolean;
  confidence: number;
  handCount: number; // 0, 1, or 2 hands detected
  // Primary hand (Palm 0)
  palmCenter: { x: number; y: number; z: number }; // normalized 0..1 in video coordinates
  palmNormal: { x: number; y: number; z: number }; // pitch / yaw / roll normal vector
  palmWidth: number; // relative size of palm
  wrist: { x: number; y: number };
  tiltAngleX: number; // pitch degrees (-90 to +90)
  tiltAngleY: number; // yaw degrees (-90 to +90)
  tiltAngleZ: number; // roll degrees (-180 to +180)
  // Two-hand interactions
  isTwoHanded: boolean;
  handSpan: number; // distance between 2 hands (0..1)
  spanDelta: number; // positive = spreading hands (zoom in), negative = closing (zoom out)
  twoHandCentroid: { x: number; y: number };
  centroidDelta: { x: number; y: number }; // pan vector
  // Pinch & Grab
  isPinching: boolean; // thumb-index pinch
  pinchDistance: number;
  pinchCenter: { x: number; y: number };
  // Movement & stillness detection
  isStationary: boolean; // true if hands are completely still (velocity < deadzone)
  handVelocity: number;
  isSimulated?: boolean;
}

export interface GeographicLocationTarget {
  name: string;
  street: string;
  neighbourhood: string;
  city: string;
  district: string;
  state: string;
  country: string;
  continent: string;
  latitude: number;
  longitude: number;
  source: 'gps' | 'preset' | 'search';
  accuracyMeters?: number;
}
