// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export interface Wohnungen {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    bezeichnung?: string;
    strasse?: string;
    hausnummer?: string;
    plz?: string;
    ort?: string;
    etage?: string;
    mieter_vorname?: string;
    mieter_nachname?: string;
    telefon?: string;
    email?: string;
    notizen?: string;
  };
}

export interface FritzBoxen {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    modell?: string;
    seriennummer?: string;
    mac_adresse?: string;
    ip_adresse?: string;
    firmware?: string;
    status?: LookupValue;
    installationsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    benutzername?: string;
    admin_url?: string;
    wohnung?: string; // applookup -> URL zu 'Wohnungen' Record
    notizen?: string;
  };
}

export const APP_IDS = {
  WOHNUNGEN: '6a67718396a742023e0f652d',
  'FRITZ!BOXEN': '6a677186efbcbdef0709827e',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'fritz!boxen': {
    status: [{ key: "inaktiv", label: "Inaktiv" }, { key: "defekt", label: "Defekt" }, { key: "in_wartung", label: "In Wartung" }, { key: "aktiv", label: "Aktiv" }],
  },
};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'wohnungen': {
    'bezeichnung': 'string/text',
    'strasse': 'string/text',
    'hausnummer': 'string/text',
    'plz': 'string/text',
    'ort': 'string/text',
    'etage': 'string/text',
    'mieter_vorname': 'string/text',
    'mieter_nachname': 'string/text',
    'telefon': 'string/tel',
    'email': 'string/email',
    'notizen': 'string/textarea',
  },
  'fritz!boxen': {
    'modell': 'string/text',
    'seriennummer': 'string/text',
    'mac_adresse': 'string/text',
    'ip_adresse': 'string/text',
    'firmware': 'string/text',
    'status': 'lookup/radio',
    'installationsdatum': 'date/date',
    'benutzername': 'string/text',
    'admin_url': 'string/url',
    'wohnung': 'applookup/select',
    'notizen': 'string/textarea',
  },
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateWohnungen = StripLookup<Wohnungen['fields']>;
export type CreateFritzBoxen = StripLookup<FritzBoxen['fields']>;