import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichFritzBoxen } from '@/lib/enrich';
import type { EnrichedFritzBoxen } from '@/types/enriched';
import type { Wohnungen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { StatCard } from '@/components/StatCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  IconAlertCircle, IconTool, IconRefresh, IconCheck,
  IconPlus, IconPencil, IconTrash, IconWifi, IconHome,
  IconSearch, IconRouter, IconMapPin, IconUser, IconCalendar,
  IconChevronDown, IconChevronRight,
} from '@tabler/icons-react';
import { WohnungenDialog } from '@/components/dialogs/WohnungenDialog';
import { FritzBoxenDialog } from '@/components/dialogs/FritzBoxenDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';

const APPGROUP_ID = '6a677201aabac22df8e8dc70';
const REPAIR_ENDPOINT = '/claude/build/repair';

const STATUS_COLORS: Record<string, string> = {
  aktiv: 'bg-green-500/15 text-green-700 border-green-200',
  inaktiv: 'bg-muted text-muted-foreground border-border',
  defekt: 'bg-red-500/15 text-red-700 border-red-200',
  in_wartung: 'bg-amber-500/15 text-amber-700 border-amber-200',
};

export default function DashboardOverview() {
  const {
    wohnungen, fritzBoxen,
    wohnungenMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const enrichedFritzBoxen = enrichFritzBoxen(fritzBoxen, { wohnungenMap });

  // ---- State (ALL hooks before any early return!) ----
  const [search, setSearch] = useState('');
  const [expandedWohnungen, setExpandedWohnungen] = useState<Set<string>>(new Set());
  const [wohnungDialog, setWohnungDialog] = useState<{ open: boolean; record?: Wohnungen }>({ open: false });
  const [fritzDialog, setFritzDialog] = useState<{ open: boolean; record?: EnrichedFritzBoxen; wohnungId?: string }>({ open: false });
  const [deleteWohnungTarget, setDeleteWohnungTarget] = useState<Wohnungen | null>(null);
  const [deleteFritzTarget, setDeleteFritzTarget] = useState<EnrichedFritzBoxen | null>(null);

  const filteredWohnungen = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return wohnungen;
    return wohnungen.filter(w =>
      (w.fields.bezeichnung ?? '').toLowerCase().includes(q) ||
      (w.fields.strasse ?? '').toLowerCase().includes(q) ||
      (w.fields.ort ?? '').toLowerCase().includes(q) ||
      (w.fields.mieter_nachname ?? '').toLowerCase().includes(q) ||
      (w.fields.mieter_vorname ?? '').toLowerCase().includes(q)
    );
  }, [wohnungen, search]);

  const boxenByWohnung = useMemo(() => {
    const map = new Map<string, EnrichedFritzBoxen[]>();
    for (const box of enrichedFritzBoxen) {
      const wohnungId = extractRecordId(box.fields.wohnung);
      if (wohnungId) {
        if (!map.has(wohnungId)) map.set(wohnungId, []);
        map.get(wohnungId)!.push(box);
      }
    }
    return map;
  }, [enrichedFritzBoxen]);

  const unassignedBoxen = useMemo(() =>
    enrichedFritzBoxen.filter(b => !extractRecordId(b.fields.wohnung)),
    [enrichedFritzBoxen]
  );

  const activeCount = useMemo(() =>
    enrichedFritzBoxen.filter(b => b.fields.status?.key === 'aktiv').length,
    [enrichedFritzBoxen]
  );

  const defektCount = useMemo(() =>
    enrichedFritzBoxen.filter(b => b.fields.status?.key === 'defekt' || b.fields.status?.key === 'in_wartung').length,
    [enrichedFritzBoxen]
  );

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  const toggleWohnung = (id: string) => {
    setExpandedWohnungen(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleDeleteWohnung = async () => {
    if (!deleteWohnungTarget) return;
    await LivingAppsService.deleteWohnungenEntry(deleteWohnungTarget.record_id);
    setDeleteWohnungTarget(null);
    fetchAll();
  };

  const handleDeleteFritz = async () => {
    if (!deleteFritzTarget) return;
    await LivingAppsService.deleteFritzBoxenEntry(deleteFritzTarget.record_id);
    setDeleteFritzTarget(null);
    fetchAll();
  };

  return (
    <div className="space-y-6 pb-8">
      {/* KPI-Zeile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Wohnungen"
          value={String(wohnungen.length)}
          description="Gesamt"
          icon={<IconHome size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Fritz!Boxen"
          value={String(fritzBoxen.length)}
          description="Gesamt"
          icon={<IconRouter size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Aktiv"
          value={String(activeCount)}
          description="Betriebsbereit"
          icon={<IconWifi size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Störungen"
          value={String(defektCount)}
          description="Defekt / Wartung"
          icon={<IconAlertCircle size={18} className="text-muted-foreground" />}
        />
      </div>

      {/* Hauptbereich: Wohnungen + Fritz!Boxen */}
      <div className="space-y-3">
        {/* Aktionszeile */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground shrink-0" />
            <Input
              placeholder="Wohnungen suchen…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          <Button size="sm" onClick={() => setWohnungDialog({ open: true })}>
            <IconPlus size={15} className="mr-1.5 shrink-0" />
            <span className="hidden sm:inline">Wohnung</span>
            <span className="sm:hidden">+</span>
          </Button>
        </div>

        {/* Wohnungsliste */}
        {filteredWohnungen.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <IconHome size={40} className="text-muted-foreground" stroke={1.5} />
            <div>
              <p className="font-medium text-foreground">Keine Wohnungen</p>
              <p className="text-sm text-muted-foreground mt-1">Leg deine erste Wohnung an, um zu starten.</p>
            </div>
            <Button size="sm" onClick={() => setWohnungDialog({ open: true })}>
              <IconPlus size={15} className="mr-1.5" />Wohnung anlegen
            </Button>
          </div>
        )}

        {filteredWohnungen.map(wohnung => {
          const boxen = boxenByWohnung.get(wohnung.record_id) ?? [];
          const isExpanded = expandedWohnungen.has(wohnung.record_id);
          const mieterName = [wohnung.fields.mieter_vorname, wohnung.fields.mieter_nachname].filter(Boolean).join(' ');
          const adresse = [wohnung.fields.strasse, wohnung.fields.hausnummer].filter(Boolean).join(' ');
          const ort = [wohnung.fields.plz, wohnung.fields.ort].filter(Boolean).join(' ');

          const statusCounts = {
            aktiv: boxen.filter(b => b.fields.status?.key === 'aktiv').length,
            defekt: boxen.filter(b => b.fields.status?.key === 'defekt').length,
            in_wartung: boxen.filter(b => b.fields.status?.key === 'in_wartung').length,
          };

          return (
            <div key={wohnung.record_id} className="border border-border rounded-xl overflow-hidden bg-card">
              {/* Wohnungs-Header */}
              <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-accent/40 transition-colors"
                onClick={() => toggleWohnung(wohnung.record_id)}
              >
                <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <IconHome size={17} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm truncate">
                      {wohnung.fields.bezeichnung ?? 'Unbenannte Wohnung'}
                    </span>
                    {wohnung.fields.etage && (
                      <span className="text-xs text-muted-foreground shrink-0">{wohnung.fields.etage}. Etage</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {adresse && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <IconMapPin size={11} className="shrink-0" />{adresse}{ort ? `, ${ort}` : ''}
                      </span>
                    )}
                    {mieterName && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <IconUser size={11} className="shrink-0" />{mieterName}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  {statusCounts.defekt > 0 && (
                    <Badge variant="outline" className={`text-xs ${STATUS_COLORS['defekt']}`}>
                      {statusCounts.defekt} Defekt
                    </Badge>
                  )}
                  {statusCounts.in_wartung > 0 && (
                    <Badge variant="outline" className={`text-xs ${STATUS_COLORS['in_wartung']}`}>
                      {statusCounts.in_wartung} Wartung
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    <IconRouter size={11} className="mr-1" />{boxen.length}
                  </Badge>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7"
                      onClick={e => { e.stopPropagation(); setWohnungDialog({ open: true, record: wohnung }); }}
                      title="Wohnung bearbeiten"
                    >
                      <IconPencil size={14} />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={e => { e.stopPropagation(); setDeleteWohnungTarget(wohnung); }}
                      title="Wohnung löschen"
                    >
                      <IconTrash size={14} />
                    </Button>
                  </div>
                  {isExpanded
                    ? <IconChevronDown size={16} className="text-muted-foreground shrink-0" />
                    : <IconChevronRight size={16} className="text-muted-foreground shrink-0" />}
                </div>
              </div>

              {/* Fritz!Boxen dieser Wohnung */}
              {isExpanded && (
                <div className="border-t border-border bg-muted/30">
                  {boxen.length === 0 ? (
                    <div className="flex items-center justify-between px-4 py-3 text-sm text-muted-foreground">
                      <span>Keine Fritz!Box zugewiesen</span>
                      <Button
                        variant="outline" size="sm"
                        className="h-7 text-xs"
                        onClick={() => setFritzDialog({ open: true, wohnungId: wohnung.record_id })}
                      >
                        <IconPlus size={13} className="mr-1" />Fritz!Box hinzufügen
                      </Button>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {boxen.map(box => (
                        <div key={box.record_id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors">
                          <div className={`shrink-0 w-2 h-2 rounded-full ${
                            box.fields.status?.key === 'aktiv' ? 'bg-green-500' :
                            box.fields.status?.key === 'defekt' ? 'bg-red-500' :
                            box.fields.status?.key === 'in_wartung' ? 'bg-amber-500' : 'bg-muted-foreground'
                          }`} />
                          <IconRouter size={15} className="shrink-0 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium truncate">{box.fields.modell ?? 'Unbekanntes Modell'}</span>
                              {box.fields.status && (
                                <Badge variant="outline" className={`text-xs ${STATUS_COLORS[box.fields.status.key] ?? ''}`}>
                                  {box.fields.status.label}
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                              {box.fields.ip_adresse && (
                                <span className="text-xs text-muted-foreground font-mono">{box.fields.ip_adresse}</span>
                              )}
                              {box.fields.firmware && (
                                <span className="text-xs text-muted-foreground">FW {box.fields.firmware}</span>
                              )}
                              {box.fields.installationsdatum && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <IconCalendar size={11} className="shrink-0" />
                                  {formatDate(box.fields.installationsdatum)}
                                </span>
                              )}
                              {box.fields.admin_url && (
                                <a
                                  href={box.fields.admin_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary underline underline-offset-2 hover:no-underline"
                                  onClick={e => e.stopPropagation()}
                                >
                                  Admin-UI
                                </a>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button
                              variant="ghost" size="icon"
                              className="h-7 w-7"
                              onClick={() => setFritzDialog({ open: true, record: box })}
                              title="Fritz!Box bearbeiten"
                            >
                              <IconPencil size={13} />
                            </Button>
                            <Button
                              variant="ghost" size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setDeleteFritzTarget(box)}
                              title="Fritz!Box löschen"
                            >
                              <IconTrash size={13} />
                            </Button>
                          </div>
                        </div>
                      ))}
                      <div className="px-4 py-2.5">
                        <Button
                          variant="ghost" size="sm"
                          className="h-7 text-xs text-muted-foreground"
                          onClick={() => setFritzDialog({ open: true, wohnungId: wohnung.record_id })}
                        >
                          <IconPlus size={13} className="mr-1" />Fritz!Box hinzufügen
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Nicht zugewiesene Fritz!Boxen */}
        {unassignedBoxen.length > 0 && (
          <div className="border border-dashed border-border rounded-xl overflow-hidden bg-card">
            <div
              className="flex items-center gap-3 p-4 cursor-pointer hover:bg-accent/40 transition-colors"
              onClick={() => toggleWohnung('__unassigned__')}
            >
              <div className="shrink-0 w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                <IconRouter size={17} className="text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-medium text-sm text-muted-foreground">Nicht zugewiesen</span>
                <p className="text-xs text-muted-foreground mt-0.5">{unassignedBoxen.length} Fritz!Box ohne Wohnungszuordnung</p>
              </div>
              {expandedWohnungen.has('__unassigned__')
                ? <IconChevronDown size={16} className="text-muted-foreground shrink-0" />
                : <IconChevronRight size={16} className="text-muted-foreground shrink-0" />}
            </div>
            {expandedWohnungen.has('__unassigned__') && (
              <div className="border-t border-border bg-muted/30 divide-y divide-border">
                {unassignedBoxen.map(box => (
                  <div key={box.record_id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors">
                    <div className={`shrink-0 w-2 h-2 rounded-full ${
                      box.fields.status?.key === 'aktiv' ? 'bg-green-500' :
                      box.fields.status?.key === 'defekt' ? 'bg-red-500' :
                      box.fields.status?.key === 'in_wartung' ? 'bg-amber-500' : 'bg-muted-foreground'
                    }`} />
                    <IconRouter size={15} className="shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{box.fields.modell ?? 'Unbekanntes Modell'}</span>
                        {box.fields.status && (
                          <Badge variant="outline" className={`text-xs ${STATUS_COLORS[box.fields.status.key] ?? ''}`}>
                            {box.fields.status.label}
                          </Badge>
                        )}
                      </div>
                      {box.fields.ip_adresse && (
                        <span className="text-xs text-muted-foreground font-mono">{box.fields.ip_adresse}</span>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7"
                        onClick={() => setFritzDialog({ open: true, record: box })}
                      >
                        <IconPencil size={13} />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteFritzTarget(box)}
                      >
                        <IconTrash size={13} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Fritz!Box hinzufügen (global) */}
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setFritzDialog({ open: true })}>
            <IconPlus size={15} className="mr-1.5 shrink-0" />Fritz!Box anlegen
          </Button>
        </div>
      </div>

      {/* Dialoge */}
      <WohnungenDialog
        open={wohnungDialog.open}
        onClose={() => setWohnungDialog({ open: false })}
        onSubmit={async (fields) => {
          if (wohnungDialog.record) {
            await LivingAppsService.updateWohnungenEntry(wohnungDialog.record.record_id, fields);
          } else {
            await LivingAppsService.createWohnungenEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={wohnungDialog.record?.fields}
        enablePhotoScan={AI_PHOTO_SCAN['Wohnungen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Wohnungen']}
      />

      <FritzBoxenDialog
        open={fritzDialog.open}
        onClose={() => setFritzDialog({ open: false })}
        onSubmit={async (fields) => {
          const submitFields = { ...fields };
          if (!submitFields.wohnung && fritzDialog.wohnungId) {
            submitFields.wohnung = createRecordUrl(APP_IDS.WOHNUNGEN, fritzDialog.wohnungId);
          }
          if (fritzDialog.record) {
            await LivingAppsService.updateFritzBoxenEntry(fritzDialog.record.record_id, submitFields);
          } else {
            await LivingAppsService.createFritzBoxenEntry(submitFields);
          }
          fetchAll();
        }}
        defaultValues={fritzDialog.record
          ? fritzDialog.record.fields
          : fritzDialog.wohnungId
            ? { wohnung: createRecordUrl(APP_IDS.WOHNUNGEN, fritzDialog.wohnungId) }
            : undefined
        }
        wohnungenList={wohnungen}
        enablePhotoScan={AI_PHOTO_SCAN['FritzBoxen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['FritzBoxen']}
      />

      <ConfirmDialog
        open={!!deleteWohnungTarget}
        title="Wohnung löschen"
        description={`"${deleteWohnungTarget?.fields.bezeichnung ?? 'Wohnung'}" wirklich löschen? Alle zugehörigen Fritz!Boxen bleiben erhalten.`}
        onConfirm={handleDeleteWohnung}
        onClose={() => setDeleteWohnungTarget(null)}
      />

      <ConfirmDialog
        open={!!deleteFritzTarget}
        title="Fritz!Box löschen"
        description={`"${deleteFritzTarget?.fields.modell ?? 'Fritz!Box'}" wirklich löschen?`}
        onConfirm={handleDeleteFritz}
        onClose={() => setDeleteFritzTarget(null)}
      />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [repairing, setRepairing] = useState(false);
  const [repairStatus, setRepairStatus] = useState('');
  const [repairDone, setRepairDone] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);

  const handleRepair = async () => {
    setRepairing(true);
    setRepairStatus('Reparatur wird gestartet...');
    setRepairFailed(false);

    const errorContext = JSON.stringify({
      type: 'data_loading',
      message: error.message,
      stack: (error.stack ?? '').split('\n').slice(0, 10).join('\n'),
      url: window.location.href,
    });

    try {
      const resp = await fetch(REPAIR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ appgroup_id: APPGROUP_ID, error_context: errorContext }),
      });

      if (!resp.ok || !resp.body) {
        setRepairing(false);
        setRepairFailed(true);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data: ')) continue;
          const content = line.slice(6);
          if (content.startsWith('[STATUS]')) {
            setRepairStatus(content.replace(/^\[STATUS]\s*/, ''));
          }
          if (content.startsWith('[DONE]')) {
            setRepairDone(true);
            setRepairing(false);
          }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) {
            setRepairFailed(true);
          }
        }
      }
    } catch {
      setRepairing(false);
      setRepairFailed(true);
    }
  };

  if (repairDone) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <IconCheck size={22} className="text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">Dashboard repariert</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Das Problem wurde behoben. Bitte lade die Seite neu.</p>
        </div>
        <Button size="sm" onClick={() => window.location.reload()}>
          <IconRefresh size={14} className="mr-1" />Neu laden
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {repairing ? repairStatus : error.message}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry} disabled={repairing}>Erneut versuchen</Button>
        <Button size="sm" onClick={handleRepair} disabled={repairing}>
          {repairing
            ? <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1" />
            : <IconTool size={14} className="mr-1" />}
          {repairing ? 'Reparatur läuft...' : 'Dashboard reparieren'}
        </Button>
      </div>
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen. Bitte kontaktiere den Support.</p>}
    </div>
  );
}
