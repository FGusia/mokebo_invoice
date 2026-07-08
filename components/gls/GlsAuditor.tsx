'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Upload,
  Check,
  AlertTriangle,
  Search,
  Download,
  Filter,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────

type Stammdaten = {
  count: number;
  data: Record<string, string>;
  date: string;
};

type RechnungRow = {
  id: number;
  paketnummer: string;
  pNummer: string | null;
  bezeichnung: string;
  betrag: number;
  type: 'OK' | 'FEHLBUCHUNG' | 'UNBEKANNT' | 'GUTSCHRIFT' | 'STORNO' | 'SAMMELPOSTEN';
  empfaenger: string;
  raw: Record<string, string>;
};

type ModalState = {
  title: string;
  message: string;
  type?: 'info' | 'error' | 'confirm';
  onConfirm?: () => void;
};

// ── Constants ──────────────────────────────────────────────────────

const SPERRGUT_BEZEICHNUNGEN = [
  'nicht sorterfähiges gut',
  'überlänge',
  'sperrgut',
  'nicht bandfähig',
  'gurtmaß',
];

const STATUS_CONFIG: Record<
  RechnungRow['type'],
  { label: string; badgeClass: string; rowClass: string }
> = {
  FEHLBUCHUNG: {
    label: 'FEHLBUCHUNG',
    badgeClass: 'bg-mokebo-rust text-white',
    rowClass: 'bg-mokebo-rust/10',
  },
  UNBEKANNT: {
    label: 'UNBEKANNT',
    badgeClass: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    rowClass: 'bg-amber-500/5',
  },
  GUTSCHRIFT: {
    label: 'GUTSCHRIFT',
    badgeClass: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    rowClass: '',
  },
  STORNO: {
    label: 'STORNO',
    badgeClass: 'bg-mokebo-surface2 text-mokebo-muted border border-mokebo-border',
    rowClass: '',
  },
  SAMMELPOSTEN: {
    label: 'SAMMELPOSTEN',
    badgeClass: 'bg-mokebo-surface2 text-mokebo-muted border border-mokebo-border',
    rowClass: '',
  },
  OK: {
    label: '',
    badgeClass: '',
    rowClass: '',
  },
};

const STORAGE_KEY = 'gls_stammdaten';

// ── Helpers ────────────────────────────────────────────────────────

const parseGermanFloat = (str: any): number => {
  if (!str || str === '-') return 0;
  return parseFloat(String(str).replace(/\./g, '').replace(',', '.')) || 0;
};

const readFileWithEncoding = (file: File, encoding: string = 'utf-8'): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsText(file, encoding);
  });

const parseCSV = (text: string, delimiter: string = ';'): Record<string, string>[] => {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  const headers = lines[0].split(delimiter).map((h) => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const values = line.split(delimiter);
    return Object.fromEntries(
      headers.map((h, i) => [h, values[i]?.trim().replace(/^"|"$/g, '') ?? ''])
    );
  });
};

const extractPNummer = (referenz: string): string | null => {
  if (!referenz || referenz === '-') return null;
  const parts = referenz.trim().split(/\s+/);
  return parts.find((p) => p.startsWith('P-')) ?? null;
};

const istSperrgut = (bezeichnung: string): boolean =>
  SPERRGUT_BEZEICHNUNGEN.some((kw) => bezeichnung.toLowerCase().includes(kw));

// ── Modal ──────────────────────────────────────────────────────────

function Modal({ title, message, type = 'info', onConfirm, onClose }: ModalState & { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-mokebo-surface border border-mokebo-border rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="p-6">
          <h3 className="text-xl font-black text-mokebo-fg mb-2">{title}</h3>
          <p className="text-mokebo-muted font-medium">{message}</p>
        </div>
        <div className="bg-mokebo-surface2/60 p-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-mokebo-muted hover:text-mokebo-fg hover:bg-white/5 rounded-xl transition-colors"
          >
            {type === 'confirm' ? 'Abbrechen' : 'Schließen'}
          </button>
          {type === 'confirm' && (
            <button
              onClick={onConfirm}
              className="px-4 py-2 text-sm font-bold text-white bg-mokebo-rust hover:bg-mokebo-dark rounded-xl transition-colors shadow-sm"
            >
              Bestätigen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────

export default function GlsAuditor() {
  const [stammdaten, setStammdaten] = useState<Stammdaten | null>(null);
  const [rechnung, setRechnung] = useState<RechnungRow[] | null>(null);
  const [filter, setFilter] = useState('Alle');
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const [modal, setModal] = useState<ModalState | null>(null);

  // Load stammdaten from localStorage on mount
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setStammdaten(JSON.parse(saved));
      } catch (e) {
        console.error('Fehler beim Laden der Stammdaten', e);
      }
    }
  }, []);

  const processStammdatenFile = useCallback(async (file: File) => {
    try {
      const text = await readFileWithEncoding(file);
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length === 0) return;

      const firstLine = lines[0];
      const delimiter = firstLine.includes(';') ? ';' : ',';
      const dataMap: Record<string, string> = {};

      lines.forEach((line, index) => {
        if (index === 0 && (line.toLowerCase().includes('p-nr') || line.toLowerCase().includes('varianten'))) return;
        const cols = line.split(delimiter);
        const pNummer = cols[1]?.trim();
        const filteredCols = cols.map((c) => c.trim()).filter((c) => c !== '');
        const kategorie = filteredCols[filteredCols.length - 1];
        if (pNummer && pNummer.startsWith('P-')) {
          dataMap[pNummer] = kategorie;
        }
      });

      const payload: Stammdaten = {
        count: Object.keys(dataMap).length,
        data: dataMap,
        date: new Date().toLocaleDateString('de-DE'),
      };

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      setStammdaten(payload);
      setModal({ title: 'Stammdaten geladen', message: `${payload.count} Artikel erfolgreich importiert.` });
    } catch (err) {
      console.error(err);
      setModal({ title: 'Fehler', message: 'Die Stammdaten-Datei konnte nicht verarbeitet werden.', type: 'error' });
    }
  }, []);

  const handleStammdatenUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (stammdaten) {
      setModal({
        title: 'Stammdaten ersetzen?',
        message: `${stammdaten.count} bestehende Artikel werden überschrieben.`,
        type: 'confirm',
        onConfirm: () => {
          setModal(null);
          processStammdatenFile(file);
        },
      });
    } else {
      processStammdatenFile(file);
    }
  };

  const handleRechnungUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const text = await readFileWithEncoding(file, 'iso-8859-1');
      const rawRows = parseCSV(text);

      const processed: RechnungRow[] = rawRows.map((row, index) => {
        const paketnummer = row['Paketnummer'] || '';
        const referenz = row['Referenz (en) pro Paket'] || '';
        const bezeichnung = row['Bezeichnung'] || '';
        const betrag = parseGermanFloat(row['Nettobetrag']);
        const empfaenger = row['Empfängername'] || '';
        const pNummer = extractPNummer(referenz);

        let type: RechnungRow['type'] = 'OK';

        if (!paketnummer || paketnummer === '-') {
          type = 'SAMMELPOSTEN';
        } else if (bezeichnung.toLowerCase().includes('storno')) {
          type = 'STORNO';
        } else if (betrag < 0) {
          type = 'GUTSCHRIFT';
        } else if (istSperrgut(bezeichnung)) {
          const kat = pNummer ? stammdaten?.data[pNummer] : undefined;
          if (kat === 'Kein Zuschlag') {
            type = 'FEHLBUCHUNG';
          } else if (!kat) {
            type = 'UNBEKANNT';
          }
        }

        return { id: index, paketnummer, pNummer, bezeichnung, betrag, type, empfaenger, raw: row };
      });

      setRechnung(processed);
      setSelection(new Set());
    } catch (err) {
      console.error(err);
      setModal({ title: 'Fehler', message: 'Die GLS-Rechnung konnte nicht verarbeitet werden. Bitte prüfen Sie das Format.', type: 'error' });
    }
  };

  const filteredData = useMemo(() => {
    if (!rechnung) return [];
    return rechnung.filter((item) => {
      const matchesFilter = filter === 'Alle' || item.type === filter.toUpperCase();
      const searchLower = search.toLowerCase();
      const matchesSearch =
        !search ||
        item.paketnummer.toLowerCase().includes(searchLower) ||
        (item.pNummer && item.pNummer.toLowerCase().includes(searchLower)) ||
        item.empfaenger.toLowerCase().includes(searchLower);
      return matchesFilter && matchesSearch;
    });
  }, [rechnung, filter, search]);

  const stats = useMemo(() => {
    if (!rechnung) return { fehl: 0, gut: 0, sammel: 0, selected: 0 };
    return {
      fehl: rechnung.filter((r) => r.type === 'FEHLBUCHUNG').reduce((sum, r) => sum + r.betrag, 0),
      gut: rechnung.filter((r) => r.type === 'GUTSCHRIFT').reduce((sum, r) => sum + r.betrag, 0),
      sammel: rechnung.filter((r) => r.type === 'SAMMELPOSTEN').reduce((sum, r) => sum + r.betrag, 0),
      selected: rechnung.filter((r) => selection.has(r.id)).reduce((sum, r) => sum + r.betrag, 0),
    };
  }, [rechnung, selection]);

  const toggleSelectAll = () => {
    if (!rechnung) return;
    if (selection.size === filteredData.length) {
      setSelection(new Set());
    } else {
      setSelection(new Set(filteredData.map((d) => d.id)));
    }
  };

  const selectAllFehlbuchungen = () => {
    if (!rechnung) return;
    const fehlIds = rechnung.filter((r) => r.type === 'FEHLBUCHUNG').map((r) => r.id);
    setSelection(new Set(fehlIds));
  };

  const handleExport = () => {
    if (!rechnung || selection.size === 0) return;
    const selectedRows = rechnung.filter((r) => selection.has(r.id));
    const headers = 'Paketnummer;P-Nummer;Bezeichnung;Nettobetrag;Status;Empfängername';
    const csvContent = selectedRows
      .map(
        (r) =>
          `${r.paketnummer};${r.pNummer || ''};${r.bezeichnung};${r.betrag.toLocaleString('de-DE')};${r.type};${r.empfaenger}`
      )
      .join('\n');

    const bom = '﻿';
    const blob = new Blob([bom + headers + '\n' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `gls-audit-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filterOptions = ['Alle', 'Fehlbuchung', 'Unbekannt', 'Gutschrift', 'Storno', 'Sammelposten'];

  return (
    <div className="flex h-screen overflow-hidden bg-mokebo-dark text-mokebo-fg font-sans">
      {/* Sidebar */}
      <aside className="w-[280px] bg-mokebo-surface2 border-r border-mokebo-border flex-shrink-0 flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <Link
            href="/"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-mokebo-muted hover:text-mokebo-fg hover:bg-white/5 transition-all shrink-0"
            aria-label="Zur Übersicht"
          >
            <ArrowLeft size={18} strokeWidth={2.5} />
          </Link>
          <div className="w-9 h-9 rounded-xl bg-mokebo-green flex items-center justify-center text-white font-black text-sm shrink-0">
            GLS
          </div>
          <h1 className="text-sm font-black tracking-tight leading-tight">
            GLS
            <br />
            Sperrgut-Check
          </h1>
        </div>

        <div className="px-6 mb-6">
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-black text-mokebo-muted uppercase tracking-widest">Stammdaten</span>
            {stammdaten ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 bg-emerald-500/15 text-emerald-400 px-3 py-2 rounded-xl text-sm border border-emerald-500/30">
                  <Check size={14} />
                  <span className="font-bold">{stammdaten.count} Artikel</span>
                </div>
                <div className="text-[10px] text-mokebo-muted ml-1">Stand: {stammdaten.date}</div>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-mokebo-rust/15 text-mokebo-rustlight px-3 py-2 rounded-xl text-sm border border-mokebo-rust/30">
                <AlertTriangle size={14} />
                <span className="font-bold">Keine Stammdaten</span>
              </div>
            )}
            <label className="mt-2 cursor-pointer bg-mokebo-surface hover:bg-white/5 text-mokebo-muted hover:text-mokebo-fg px-4 py-2 rounded-xl text-xs font-bold transition-colors text-center border border-mokebo-border">
              Stammdaten aktualisieren
              <input type="file" accept=".csv,.txt" className="hidden" onChange={handleStammdatenUpload} />
            </label>
          </div>
        </div>

        {rechnung && (
          <div className="px-6 flex-grow overflow-y-auto">
            <div className="space-y-6">
              <div>
                <span className="text-[10px] font-black text-mokebo-muted uppercase tracking-widest block mb-3">
                  Finanz-Übersicht
                </span>
                <div className="space-y-3">
                  <div className="bg-mokebo-surface p-3 rounded-2xl border border-mokebo-border">
                    <div className="text-[10px] text-mokebo-muted uppercase mb-1 font-bold">Fehlbuchungen</div>
                    <div className="text-lg font-black text-mokebo-rustlight">
                      {stats.fehl.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </div>
                  </div>
                  <div className="bg-mokebo-surface p-3 rounded-2xl border border-mokebo-border">
                    <div className="text-[10px] text-mokebo-muted uppercase mb-1 font-bold">Gutschriften</div>
                    <div className="text-lg font-black text-emerald-400">
                      {stats.gut.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </div>
                  </div>
                  <div className="bg-mokebo-surface p-3 rounded-2xl border border-mokebo-border">
                    <div className="text-[10px] text-mokebo-muted uppercase mb-1 font-bold">Sammelposten</div>
                    <div className="text-lg font-black text-mokebo-muted">
                      {stats.sammel.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-mokebo-border">
                <div className="bg-mokebo-blue/20 p-4 rounded-2xl border border-mokebo-blue/40">
                  <div className="text-[10px] text-mokebo-lightblue uppercase mb-1 font-black">Ausgewählt für Export</div>
                  <div className="text-xl font-black text-mokebo-lightblue">
                    {stats.selected.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </div>
                  <div className="text-[10px] text-mokebo-lightblue/70 mt-1">{selection.size} Positionen</div>
                </div>
                <button
                  disabled={selection.size === 0}
                  onClick={handleExport}
                  className="w-full mt-4 bg-mokebo-green hover:bg-mokebo-dark disabled:bg-mokebo-surface2 disabled:text-mokebo-muted text-white font-bold py-3 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-black/30"
                >
                  <Download size={16} />
                  Export (.csv)
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="p-6 mt-auto text-[10px] text-mokebo-muted border-t border-mokebo-border">
          Sperrgut-Check &middot; GLS
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-grow flex flex-col overflow-hidden">
        {!rechnung ? (
          <div className="flex-grow flex items-center justify-center p-8">
            <div
              className={`max-w-xl w-full bg-mokebo-surface rounded-3xl p-12 shadow-xl border-2 border-dashed ${
                stammdaten ? 'border-mokebo-mint/30' : 'border-mokebo-border'
              } transition-all`}
            >
              <div className="text-center">
                <div
                  className={`w-20 h-20 mx-auto rounded-2xl flex items-center justify-center mb-6 ${
                    stammdaten ? 'bg-mokebo-mint/15 text-mokebo-mint' : 'bg-mokebo-surface2 text-mokebo-muted'
                  }`}
                >
                  <Upload size={36} />
                </div>
                <h2 className="text-2xl font-black text-mokebo-fg mb-2">GLS-Rechnung prüfen</h2>
                <p className="text-mokebo-muted font-medium mb-8">
                  {stammdaten
                    ? 'Laden Sie Ihre GLS-Rechnung (.csv) hoch, um den Audit zu starten.'
                    : 'Bitte laden Sie zuerst Ihre Stammdaten in der Sidebar hoch.'}
                </p>

                <label
                  className={`inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-white transition-all shadow-lg ${
                    stammdaten
                      ? 'bg-mokebo-green hover:bg-mokebo-dark cursor-pointer shadow-mokebo-mint/10'
                      : 'bg-mokebo-surface2 text-mokebo-muted cursor-not-allowed'
                  }`}
                >
                  Rechnung auswählen
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    disabled={!stammdaten}
                    onChange={handleRechnungUpload}
                  />
                </label>

                {!stammdaten && (
                  <div className="mt-6 flex items-center justify-center gap-2 text-mokebo-rustlight text-sm font-bold">
                    <AlertTriangle size={14} />
                    Stammdaten erforderlich
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Filter Bar */}
            <div className="bg-mokebo-surface border-b border-mokebo-border p-4 flex flex-col gap-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-1 bg-mokebo-surface2 p-1 rounded-xl flex-wrap">
                  {filterOptions.map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        filter === f ? 'bg-mokebo-surface text-mokebo-fg shadow-sm' : 'text-mokebo-muted hover:text-mokebo-fg'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <div className="text-sm font-bold text-mokebo-muted">
                  {filteredData.length} von {rechnung.length} Positionen
                </div>
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                <div className="relative flex-grow min-w-[240px]">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-mokebo-muted">
                    <Search size={14} />
                  </div>
                  <input
                    type="text"
                    placeholder="Suche nach Paketnummer, P-Nummer oder Empfänger..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 bg-white/5 border border-mokebo-border rounded-xl text-sm text-mokebo-fg placeholder:text-mokebo-muted focus:ring-4 focus:ring-mokebo-mint/15 outline-none transition-all"
                  />
                </div>
                <button
                  onClick={selectAllFehlbuchungen}
                  className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-mokebo-rust/15 text-mokebo-rustlight hover:bg-mokebo-rust/25 rounded-xl text-sm font-bold transition-all border border-mokebo-rust/30"
                >
                  <Filter size={14} />
                  Alle Fehlbuchungen auswählen
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="flex-grow overflow-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-mokebo-surface z-10 shadow-sm">
                  <tr className="text-[11px] font-black text-mokebo-muted uppercase tracking-wider border-b border-mokebo-border">
                    <th className="px-6 py-4 w-12">
                      <input
                        type="checkbox"
                        className="accent-mokebo-mint w-4 h-4"
                        checked={filteredData.length > 0 && selection.size === filteredData.length}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th className="px-4 py-4">Paketnummer</th>
                    <th className="px-4 py-4">P-Nummer</th>
                    <th className="px-4 py-4">Bezeichnung</th>
                    <th className="px-4 py-4 text-right">Betrag</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4">Empfänger</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mokebo-border/50">
                  {filteredData.map((item) => {
                    const config = STATUS_CONFIG[item.type];
                    const isSelected = selection.has(item.id);
                    return (
                      <tr
                        key={item.id}
                        className={`group hover:bg-white/5 transition-colors ${
                          isSelected ? 'bg-mokebo-blue/10' : config.rowClass
                        }`}
                      >
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            className="accent-mokebo-mint w-4 h-4"
                            checked={isSelected}
                            onChange={() => {
                              const next = new Set(selection);
                              if (next.has(item.id)) next.delete(item.id);
                              else next.add(item.id);
                              setSelection(next);
                            }}
                          />
                        </td>
                        <td className="px-4 py-4 text-sm font-mono text-mokebo-muted">{item.paketnummer}</td>
                        <td className="px-4 py-4 text-sm font-bold text-mokebo-fg">{item.pNummer || '-'}</td>
                        <td className="px-4 py-4 text-sm text-mokebo-muted">{item.bezeichnung}</td>
                        <td
                          className={`px-4 py-4 text-sm font-bold text-right ${
                            item.betrag < 0 ? 'text-emerald-400' : 'text-mokebo-fg'
                          }`}
                        >
                          {item.betrag.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                        </td>
                        <td className="px-4 py-4">
                          {config.label && (
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${config.badgeClass}`}
                            >
                              {config.label}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm text-mokebo-muted truncate max-w-[200px]">{item.empfaenger}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredData.length === 0 && (
                <div className="p-12 text-center text-mokebo-muted font-medium">Keine Daten gefunden.</div>
              )}
            </div>
          </>
        )}
      </main>

      {modal && <Modal {...modal} onClose={() => setModal(null)} />}
    </div>
  );
}
