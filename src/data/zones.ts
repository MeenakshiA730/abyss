/**
 * ABYSS — Ocean Zone Data
 * Defines the four ocean zones for the descent experience
 */

export interface OceanZone {
  id: string;
  name: string;
  shortName: string;
  depthRange: { min: number; max: number };
  narrative: string;
  description: string;
  // Visual properties
  bgColor: string;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  lightIntensity: number;
  lightColor: string;
  particleColor: string;
  particleDensity: number;
  particleSize: number;
  // Creature IDs present in this zone
  creatureIds: string[];
  // Ambient sound (if implemented)
  ambientSound?: string;
}

export const oceanZones: OceanZone[] = [
  {
    id: 'sunlight',
    name: 'Sunlight Zone (Epipelagic)',
    shortName: 'SUNLIGHT',
    depthRange: { min: 0, max: 200 },
    narrative: 'The ocean still remembers the light.',
    description:
      'Faint natural sunlight filters from above. Muted turquoise and blue tones dominate. Floating plankton and soft rays create a sense of beauty and apparent safety. This is the only zone where photosynthesis occurs, supporting 90% of ocean life.',
    bgColor: '#081830',
    fogColor: '#0e2d50',
    fogNear: 15,
    fogFar: 400,
    lightIntensity: 0.5,
    lightColor: '#4aa8e8',
    particleColor: '#4aa8e8',
    particleDensity: 0.8,
    particleSize: 0.15,
    creatureIds: [],
  },
  {
    id: 'twilight',
    name: 'Twilight Zone (Mesopelagic)',
    shortName: 'TWILIGHT',
    depthRange: { min: 200, max: 1000 },
    narrative: 'The surface is still above you. It already feels impossibly far away.',
    description:
      'Natural light rapidly fades. Colder, darker blue tones take over. Increasing darkness and isolation. Sparse marine life and drifting particles. This is the realm of diel vertical migration — the largest animal migration on Earth, happening daily.',
    bgColor: '#05101e',
    fogColor: '#08182e',
    fogNear: 12,
    fogFar: 250,
    lightIntensity: 0.2,
    lightColor: '#2a6b9e',
    particleColor: '#2a6b9e',
    particleDensity: 0.6,
    particleSize: 0.12,
    creatureIds: ['giant-squid'],
  },
  {
    id: 'midnight',
    name: 'Midnight Zone (Bathypelagic)',
    shortName: 'MIDNIGHT',
    depthRange: { min: 1000, max: 4000 },
    narrative: 'Your instruments can measure the darkness. They cannot explain it.',
    description:
      'Near-total darkness. Sparse, restrained bioluminescence. The searchlight becomes the primary source of illumination. Occasional indistinct shapes at the edge of visibility. Pressure exceeds 100 atmospheres. Temperature hovers near freezing.',
    bgColor: '#02050a',
    fogColor: '#010204',
    fogNear: 8,
    fogFar: 150,
    lightIntensity: 0.06,
    lightColor: '#0088cc',
    particleColor: '#00ffbf',
    particleDensity: 0.35,
    particleSize: 0.08,
    creatureIds: ['anglerfish', 'deep-sea-jellyfish'],
  },
  {
    id: 'abyss',
    name: 'The Abyss (Abyssopelagic)',
    shortName: 'ABYSS',
    depthRange: { min: 4000, max: 6000 },
    narrative: 'Something exists beyond the reach of your instruments.',
    description:
      'Vast negative space. Almost complete darkness. Tiny blue signals and faint suspended particles. An immense shape revealed only in fragments. Pressure exceeds 400 atmospheres. This is the final frontier of our expedition — where the unknown becomes tangible.',
    bgColor: '#010102',
    fogColor: '#000102',
    fogNear: 5,
    fogFar: 100,
    lightIntensity: 0.02,
    lightColor: '#006699',
    particleColor: '#00aa88',
    particleDensity: 0.15,
    particleSize: 0.05,
    creatureIds: ['dumbo-octopus'],
  },
];

export const getZoneByDepth = (depth: number): OceanZone => {
  for (const zone of oceanZones) {
    if (depth >= zone.depthRange.min && depth <= zone.depthRange.max) {
      return zone;
    }
  }
  // Return abyss zone for depths beyond defined ranges
  return oceanZones[oceanZones.length - 1];
};

export const getZoneById = (id: string): OceanZone | undefined => {
  return oceanZones.find((z) => z.id === id);
};

export const getDepthProgress = (depth: number): number => {
  const maxDepth = oceanZones[oceanZones.length - 1].depthRange.max;
  return Math.min(Math.max(depth / maxDepth, 0), 1);
};

export const getZoneProgress = (depth: number, zoneId: string): number => {
  const zone = getZoneById(zoneId);
  if (!zone) return 0;
  const { min, max } = zone.depthRange;
  return Math.min(Math.max((depth - min) / (max - min), 0), 1);
};