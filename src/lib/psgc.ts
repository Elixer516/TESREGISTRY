/**
 * Philippine geography for the address fields.
 *
 * Scope is deliberate rather than exhaustive. Every region and every province
 * is here, because those lists are short and stable. Cities and municipalities
 * are complete for Davao Region — the centre's actual catchment, where nearly
 * every applicant comes from — and left as free text elsewhere, because
 * bundling all ~1,600 nationwide (let alone ~42,000 barangays) would cost more
 * than it buys for a Davao training centre.
 *
 * `citiesFor` returning an empty array is the signal to render a text input
 * instead of a dropdown. Callers must handle that, not treat it as an error.
 */

export interface Region {
  /** PSGC-style short code, used as the stored value. */
  code: string;
  name: string;
}

export const REGIONS: readonly Region[] = [
  { code: 'NCR', name: 'National Capital Region (NCR)' },
  { code: 'CAR', name: 'Cordillera Administrative Region (CAR)' },
  { code: 'R1', name: 'Region I — Ilocos Region' },
  { code: 'R2', name: 'Region II — Cagayan Valley' },
  { code: 'R3', name: 'Region III — Central Luzon' },
  { code: 'R4A', name: 'Region IV-A — CALABARZON' },
  { code: 'R4B', name: 'Region IV-B — MIMAROPA' },
  { code: 'R5', name: 'Region V — Bicol Region' },
  { code: 'R6', name: 'Region VI — Western Visayas' },
  { code: 'R7', name: 'Region VII — Central Visayas' },
  { code: 'R8', name: 'Region VIII — Eastern Visayas' },
  { code: 'R9', name: 'Region IX — Zamboanga Peninsula' },
  { code: 'R10', name: 'Region X — Northern Mindanao' },
  { code: 'R11', name: 'Region XI — Davao Region' },
  { code: 'R12', name: 'Region XII — SOCCSKSARGEN' },
  { code: 'R13', name: 'Region XIII — Caraga' },
  { code: 'BARMM', name: 'Bangsamoro (BARMM)' },
];

/** Provinces by region code. NCR has none — its cities sit directly under it. */
const PROVINCES: Record<string, string[]> = {
  NCR: [],
  CAR: ['Abra', 'Apayao', 'Benguet', 'Ifugao', 'Kalinga', 'Mountain Province'],
  R1: ['Ilocos Norte', 'Ilocos Sur', 'La Union', 'Pangasinan'],
  R2: ['Batanes', 'Cagayan', 'Isabela', 'Nueva Vizcaya', 'Quirino'],
  R3: [
    'Aurora',
    'Bataan',
    'Bulacan',
    'Nueva Ecija',
    'Pampanga',
    'Tarlac',
    'Zambales',
  ],
  R4A: ['Batangas', 'Cavite', 'Laguna', 'Quezon', 'Rizal'],
  R4B: ['Marinduque', 'Occidental Mindoro', 'Oriental Mindoro', 'Palawan', 'Romblon'],
  R5: [
    'Albay',
    'Camarines Norte',
    'Camarines Sur',
    'Catanduanes',
    'Masbate',
    'Sorsogon',
  ],
  R6: ['Aklan', 'Antique', 'Capiz', 'Guimaras', 'Iloilo', 'Negros Occidental'],
  R7: ['Bohol', 'Cebu', 'Negros Oriental', 'Siquijor'],
  R8: [
    'Biliran',
    'Eastern Samar',
    'Leyte',
    'Northern Samar',
    'Samar',
    'Southern Leyte',
  ],
  R9: ['Zamboanga del Norte', 'Zamboanga del Sur', 'Zamboanga Sibugay'],
  R10: [
    'Bukidnon',
    'Camiguin',
    'Lanao del Norte',
    'Misamis Occidental',
    'Misamis Oriental',
  ],
  R11: [
    'Davao de Oro',
    'Davao del Norte',
    'Davao del Sur',
    'Davao Occidental',
    'Davao Oriental',
  ],
  R12: ['Cotabato', 'Sarangani', 'South Cotabato', 'Sultan Kudarat'],
  R13: [
    'Agusan del Norte',
    'Agusan del Sur',
    'Dinagat Islands',
    'Surigao del Norte',
    'Surigao del Sur',
  ],
  BARMM: [
    'Basilan',
    'Lanao del Sur',
    'Maguindanao del Norte',
    'Maguindanao del Sur',
    'Sulu',
    'Tawi-Tawi',
  ],
};

/**
 * Cities and municipalities, complete for Davao Region only.
 * NCR is included because it is a common birthplace and has no province tier.
 */
const CITIES: Record<string, string[]> = {
  'Davao del Sur': [
    'Bansalan',
    'Davao City',
    'Digos City',
    'Hagonoy',
    'Kiblawan',
    'Magsaysay',
    'Malalag',
    'Matanao',
    'Padada',
    'Santa Cruz',
    'Sulop',
  ],
  'Davao del Norte': [
    'Asuncion',
    'Braulio E. Dujali',
    'Carmen',
    'Island Garden City of Samal',
    'Kapalong',
    'New Corella',
    'Panabo City',
    'San Isidro',
    'Santo Tomas',
    'Tagum City',
    'Talaingod',
  ],
  'Davao de Oro': [
    'Compostela',
    'Laak',
    'Mabini',
    'Maco',
    'Maragusan',
    'Mawab',
    'Monkayo',
    'Montevista',
    'Nabunturan',
    'New Bataan',
    'Pantukan',
  ],
  'Davao Oriental': [
    'Baganga',
    'Banaybanay',
    'Boston',
    'Caraga',
    'Cateel',
    'Governor Generoso',
    'Lupon',
    'Manay',
    'Mati City',
    'San Isidro',
    'Tarragona',
  ],
  'Davao Occidental': [
    'Don Marcelino',
    'Jose Abad Santos',
    'Malita',
    'Santa Maria',
    'Sarangani',
  ],
  // NCR's cities hang off the region directly, so they are keyed by region code.
  NCR: [
    'Caloocan',
    'Las Piñas',
    'Makati',
    'Malabon',
    'Mandaluyong',
    'Manila',
    'Marikina',
    'Muntinlupa',
    'Navotas',
    'Parañaque',
    'Pasay',
    'Pasig',
    'Pateros',
    'Quezon City',
    'San Juan',
    'Taguig',
    'Valenzuela',
  ],
};

/** Davao City's three legislative districts — the only district list we need. */
export const DAVAO_CITY_DISTRICTS: readonly string[] = [
  'District I (Poblacion)',
  'District II (Talomo)',
  'District III (Buhangin, Bunawan, Paquibato, Baguio, Calinan, Marilog, Toril)',
];

export function regionName(code: string): string {
  return REGIONS.find((r) => r.code === code)?.name ?? code;
}

export function provincesFor(regionCode: string): readonly string[] {
  return PROVINCES[regionCode] ?? [];
}

/**
 * Cities for a province, or for NCR when no province applies.
 * An empty array means "we do not have this list" — render a text input.
 */
export function citiesFor(regionCode: string, province: string): readonly string[] {
  if (regionCode === 'NCR') return CITIES.NCR;
  return CITIES[province] ?? [];
}

export function districtsFor(city: string): readonly string[] {
  return city === 'Davao City' ? DAVAO_CITY_DISTRICTS : [];
}

/**
 * Joins the address parts into the single line documents print.
 * Blank parts drop out rather than leaving stray commas.
 */
export function composeAddress(parts: {
  street: string;
  barangay: string;
  cityMunicipality: string;
  province: string;
  regionCode: string;
}): string {
  const pieces = [
    parts.street.trim(),
    parts.barangay.trim() ? `Brgy. ${parts.barangay.trim()}` : '',
    parts.cityMunicipality.trim(),
    parts.province.trim(),
  ].filter(Boolean);
  return pieces.join(', ');
}

/** Same idea for the birthplace triple, which has no street or barangay. */
export function composeBirthPlace(parts: {
  cityMunicipality: string;
  province: string;
  regionCode: string;
}): string {
  const pieces = [parts.cityMunicipality.trim(), parts.province.trim()].filter(Boolean);
  if (pieces.length === 0 && parts.regionCode) return regionName(parts.regionCode);
  return pieces.join(', ');
}

export const BLOOD_TYPES: readonly string[] = [
  'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-',
];

export const EMPLOYMENT_STATUSES: readonly string[] = [
  'Unemployed',
  'Employed — Full time',
  'Employed — Part time',
  'Self-employed',
  'Student',
  'OFW / Returning OFW',
];

export const DISABILITY_OPTIONS: readonly string[] = [
  'None',
  'Visual',
  'Hearing',
  'Speech',
  'Physical / Orthopedic',
  'Intellectual / Learning',
  'Psychosocial',
  'Multiple',
  'Other',
];

export const SOCIAL_MEDIA_OPTIONS: readonly string[] = [
  'Facebook',
  'Messenger',
  'Instagram',
  'X (Twitter)',
  'TikTok',
  'LinkedIn',
  'Viber',
  'WhatsApp',
];

export const RELATIONSHIP_OPTIONS: readonly string[] = [
  'Mother',
  'Father',
  'Guardian',
  'Spouse',
  'Sibling',
  'Grandparent',
  'Aunt / Uncle',
  'Cousin',
  'Friend',
  'Other',
];

export const EDUCATIONAL_ATTAINMENTS: readonly string[] = [
  'Elementary Graduate',
  'Junior High School Graduate',
  'Senior High School Graduate',
  'Senior High School Undergraduate',
  'College Undergraduate',
  'College Graduate',
  'Vocational / Technical Graduate',
  'Post-Graduate',
];
