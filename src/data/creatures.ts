/**
 * ABYSS — Creature Data
 * Deep-sea species for the interactive field guide
 */

export interface Creature {
  id: string;
  name: string;
  scientificName: string;
  depthRange: { min: number; max: number; unit: string };
  habitat: string;
  fieldNotes: string;
  classification: string;
  discoveryStatus: 'verified' | 'hypothetical' | 'expedition-observed';
  bioluminescent: boolean;
  size: string;
  thumbnailColor: string;
  accentColor: string;
}

export const creatures: Creature[] = [
  {
    id: 'anglerfish',
    name: 'Anglerfish',
    scientificName: 'Melanocetus johnsonii',
    depthRange: { min: 200, max: 2000, unit: 'm' },
    habitat: 'Midnight Zone to Abyssal Zone. Worldwide in temperate and tropical oceans.',
    fieldNotes:
      'The bioluminescent lure (esca) houses symbiotic bacteria that produce cold light. Only females possess the iconic lure; males are tiny parasites that fuse permanently to females. The jaw can extend to swallow prey twice the anglerfish\'s size. Observed specimens exhibit extreme sexual dimorphism — one of the most dramatic in the animal kingdom.',
    classification: 'Order: Lophiiformes | Family: Melanocetidae',
    discoveryStatus: 'verified',
    bioluminescent: true,
    size: '8–18 cm (female); <3 cm (male)',
    thumbnailColor: '#1a0a2e',
    accentColor: '#cc4400',
  },
  {
    id: 'giant-squid',
    name: 'Giant Squid',
    scientificName: 'Architeuthis dux',
    depthRange: { min: 300, max: 1000, unit: 'm' },
    habitat: 'Twilight Zone to Midnight Zone. Global deep-ocean distribution; rarely observed alive.',
    fieldNotes:
      'Largest known invertebrate. Eyes up to 27 cm diameter — the largest in the animal kingdom — adapted for detecting faint bioluminescence in near-total darkness. Eight arms and two longer feeding tentacles lined with serrated suckers. Primary predator: sperm whales. First live footage captured in 2012 (Japan, 900m). Carcasses occasionally wash ashore, confirming global presence.',
    classification: 'Order: Oegopsida | Family: Architeuthidae',
    discoveryStatus: 'verified',
    bioluminescent: false,
    size: 'Up to 12–13 m total length (mantle ~2 m)',
    thumbnailColor: '#0d1b2a',
    accentColor: '#0066aa',
  },
  {
    id: 'deep-sea-jellyfish',
    name: 'Deep-Sea Jellyfish',
    scientificName: 'Atolla wyvillei',
    depthRange: { min: 1000, max: 4000, unit: 'm' },
    habitat: 'Midnight Zone to Abyssal Zone. Cosmopolitan in deep oceans.',
    fieldNotes:
      'Known as the "alarm jellyfish" — when threatened, produces a spectacular bioluminescent display: concentric waves of blue light propagating outward from the bell. This "burglar alarm" may attract larger predators to attack whatever is threatening the jellyfish. Lacks tentacles in adult form; uses hypertrophied trailing tentacle for prey capture. Bell diameter typically 20–35 mm.',
    classification: 'Order: Coronatae | Family: Atollidae',
    discoveryStatus: 'verified',
    bioluminescent: true,
    size: '2–3.5 cm bell diameter',
    thumbnailColor: '#0a1a2e',
    accentColor: '#0088ff',
  },
  {
    id: 'dumbo-octopus',
    name: 'Dumbo Octopus',
    scientificName: 'Grimpoteuthis spp.',
    depthRange: { min: 3000, max: 7000, unit: 'm' },
    habitat: 'Abyssal Zone to Hadal Zone. Deepest-living octopus genus known.',
    fieldNotes:
      'Named for ear-like fins protruding from the mantle, used for propulsion. Unlike shallow-water octopuses, lacks an ink sac — no need for defensive ink in perpetual darkness. Swallows prey whole (copepods, isopods, amphipods). Neutral buoyancy allows hovering above seafloor. At least 17 described species; more likely undiscovered. Observed at 6,957 m in Java Trench — deepest confirmed cephalopod sighting.',
    classification: 'Order: Cirrata | Family: Grimpoteuthidae',
    discoveryStatus: 'verified',
    bioluminescent: false,
    size: '20–30 cm typical; up to 1.8 m (G. megaptera)',
    thumbnailColor: '#151a2e',
    accentColor: '#8866cc',
  },
];

export const getCreatureById = (id: string): Creature | undefined => {
  return creatures.find((c) => c.id === id);
};

export const getCreatureByZone = (depth: number): Creature[] => {
  return creatures.filter(
    (c) => depth >= c.depthRange.min && depth <= c.depthRange.max
  );
};