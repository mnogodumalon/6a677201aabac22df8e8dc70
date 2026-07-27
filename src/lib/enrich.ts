import type { EnrichedFritzBoxen } from '@/types/enriched';
import type { FritzBoxen, Wohnungen } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface FritzBoxenMaps {
  wohnungenMap: Map<string, Wohnungen>;
}

export function enrichFritzBoxen(
  fritzBoxen: FritzBoxen[],
  maps: FritzBoxenMaps
): EnrichedFritzBoxen[] {
  return fritzBoxen.map(r => ({
    ...r,
    wohnungName: resolveDisplay(r.fields.wohnung, maps.wohnungenMap, 'bezeichnung'),
  }));
}
