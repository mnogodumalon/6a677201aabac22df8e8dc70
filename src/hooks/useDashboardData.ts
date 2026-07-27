import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Wohnungen, FritzBoxen } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';

export function useDashboardData() {
  const [wohnungen, setWohnungen] = useState<Wohnungen[]>([]);
  const [fritzBoxen, setFritzBoxen] = useState<FritzBoxen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [wohnungenData, fritzBoxenData] = await Promise.all([
        LivingAppsService.getWohnungen(),
        LivingAppsService.getFritzBoxen(),
      ]);
      setWohnungen(wohnungenData);
      setFritzBoxen(fritzBoxenData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fehler beim Laden der Daten'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Silent background refresh (no loading state change → no flicker)
  useEffect(() => {
    async function silentRefresh() {
      try {
        const [wohnungenData, fritzBoxenData] = await Promise.all([
          LivingAppsService.getWohnungen(),
          LivingAppsService.getFritzBoxen(),
        ]);
        setWohnungen(wohnungenData);
        setFritzBoxen(fritzBoxenData);
      } catch {
        // silently ignore — stale data is better than no data
      }
    }
    function handleRefresh() { void silentRefresh(); }
    window.addEventListener('dashboard-refresh', handleRefresh);
    return () => window.removeEventListener('dashboard-refresh', handleRefresh);
  }, []);

  const wohnungenMap = useMemo(() => {
    const m = new Map<string, Wohnungen>();
    wohnungen.forEach(r => m.set(r.record_id, r));
    return m;
  }, [wohnungen]);

  return { wohnungen, setWohnungen, fritzBoxen, setFritzBoxen, loading, error, fetchAll, wohnungenMap };
}