'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { GlsMark } from './GlsLogo';
import {
  ArrowLeft,
  Upload,
  Check,
  AlertTriangle,
  Search,
  Download,
  Filter,
  Database,
  Pencil,
  Trash2,
  Plus,
  X,
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
  type: 'OK' | 'FEHLBUCHUNG' | 'ABWEICHUNG' | 'UNBEKANNT' | 'GUTSCHRIFT' | 'STORNO' | 'SAMMELPOSTEN';
  billKategorie: string | null;
  erwarteterPreis: number | null;
  differenz: number | null;
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

// Ordnet den Formulierungen auf der GLS-Rechnung eine unserer Zuschlags-Kategorien zu,
// damit wir erkennen können, ALS WAS GLS tatsächlich abgerechnet hat (nicht nur DASS).
const BEZEICHNUNG_KATEGORIE_MAP: { keyword: string; kategorie: string }[] = [
  { keyword: 'nicht sorterfähig', kategorie: 'Nicht Sortierfähig' },
  { keyword: 'nicht sortierfähig', kategorie: 'Nicht Sortierfähig' },
  { keyword: 'nicht bandfähig', kategorie: 'Nicht Sortierfähig' },
  { keyword: 'überlänge', kategorie: 'Überlänge' },
  { keyword: 'übermaß', kategorie: 'Übermaße' },
  { keyword: 'gurtmaß', kategorie: 'Übermaße' },
];

const erkenneBillKategorie = (bezeichnung: string): string | null => {
  const lower = bezeichnung.toLowerCase();
  const match = BEZEICHNUNG_KATEGORIE_MAP.find((m) => lower.includes(m.keyword));
  return match ? match.kategorie : null;
};

const STATUS_CONFIG: Record<
  RechnungRow['type'],
  { label: string; badgeClass: string; rowClass: string }
> = {
  FEHLBUCHUNG: {
    label: 'FEHLBUCHUNG',
    badgeClass: 'bg-mokebo-rust text-white',
    rowClass: 'bg-mokebo-rust/10',
  },
  ABWEICHUNG: {
    label: 'ABWEICHUNG',
    badgeClass: 'bg-sky-500/20 text-sky-400 border border-sky-500/30',
    rowClass: 'bg-sky-500/5',
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
const TARIFE_STORAGE_KEY = 'gls_tarife';

const DEFAULT_TARIFE: Record<string, number> = {
  'Nicht Sortierfähig': 0,
  'Überlänge': 0,
  'Übermaße': 0,
};

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
  const [mainView, setMainView] = useState<'rechnung' | 'stammdaten' | 'report'>('rechnung');
  const [stammdatenSearch, setStammdatenSearch] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ pNummer: '', kategorie: '' });
  const [newEntry, setNewEntry] = useState({ pNummer: '', kategorie: '' });
  const [deleteConfirmKey, setDeleteConfirmKey] = useState<string | null>(null);
  const [tarife, setTarife] = useState<Record<string, number>>(DEFAULT_TARIFE);
  const [editingTarifKey, setEditingTarifKey] = useState<string | null>(null);
  const [tarifEditDraft, setTarifEditDraft] = useState({ bezeichnung: '', preis: '' });
  const [newTarif, setNewTarif] = useState({ bezeichnung: '', preis: '' });
  const [deleteTarifConfirmKey, setDeleteTarifConfirmKey] = useState<string | null>(null);

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

    const savedTarife = window.localStorage.getItem(TARIFE_STORAGE_KEY);
    if (savedTarife) {
      try {
        setTarife(JSON.parse(savedTarife));
      } catch (e) {
        console.error('Fehler beim Laden der Tarife', e);
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

  const persistStammdaten = useCallback((data: Record<string, string>) => {
    const payload: Stammdaten = {
      count: Object.keys(data).length,
      data,
      date: new Date().toLocaleDateString('de-DE'),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setStammdaten(payload);
  }, []);

  const startEditEntry = (pNummer: string, kategorie: string) => {
    setEditingKey(pNummer);
    setEditDraft({ pNummer, kategorie });
  };

  const cancelEditEntry = () => {
    setEditingKey(null);
    setEditDraft({ pNummer: '', kategorie: '' });
  };

  const saveEditEntry = (originalKey: string) => {
    const nextPNummer = editDraft.pNummer.trim();
    const nextKategorie = editDraft.kategorie.trim();
    if (!nextPNummer || !nextKategorie) return;

    const nextData = { ...(stammdaten?.data ?? {}) };
    if (nextPNummer !== originalKey) {
      delete nextData[originalKey];
    }
    nextData[nextPNummer] = nextKategorie;
    persistStammdaten(nextData);
    cancelEditEntry();
  };

  const deleteEntry = (pNummer: string) => {
    const nextData = { ...(stammdaten?.data ?? {}) };
    delete nextData[pNummer];
    persistStammdaten(nextData);
    setDeleteConfirmKey(null);
  };

  const addEntry = () => {
    const pNummer = newEntry.pNummer.trim();
    const kategorie = newEntry.kategorie.trim();
    if (!pNummer || !kategorie) return;
    if (!pNummer.startsWith('P-')) {
      setModal({ title: 'Ungültige P-Nummer', message: 'Die P-Nummer muss mit "P-" beginnen.', type: 'error' });
      return;
    }
    const nextData = { ...(stammdaten?.data ?? {}), [pNummer]: kategorie };
    persistStammdaten(nextData);
    setNewEntry({ pNummer: '', kategorie: '' });
  };

  const persistTarife = useCallback((next: Record<string, number>) => {
    window.localStorage.setItem(TARIFE_STORAGE_KEY, JSON.stringify(next));
    setTarife(next);
  }, []);

  const startEditTarif = (bezeichnung: string, preis: number) => {
    setEditingTarifKey(bezeichnung);
    setTarifEditDraft({ bezeichnung, preis: preis.toLocaleString('de-DE') });
  };

  const cancelEditTarif = () => {
    setEditingTarifKey(null);
    setTarifEditDraft({ bezeichnung: '', preis: '' });
  };

  const saveEditTarif = (originalKey: string) => {
    const nextBezeichnung = tarifEditDraft.bezeichnung.trim();
    const nextPreis = parseGermanFloat(tarifEditDraft.preis);
    if (!nextBezeichnung) return;

    const nextTarife = { ...tarife };
    if (nextBezeichnung !== originalKey) {
      delete nextTarife[originalKey];
    }
    nextTarife[nextBezeichnung] = nextPreis;
    persistTarife(nextTarife);
    cancelEditTarif();
  };

  const deleteTarif = (bezeichnung: string) => {
    const nextTarife = { ...tarife };
    delete nextTarife[bezeichnung];
    persistTarife(nextTarife);
    setDeleteTarifConfirmKey(null);
  };

  const addTarif = () => {
    const bezeichnung = newTarif.bezeichnung.trim();
    const preis = parseGermanFloat(newTarif.preis);
    if (!bezeichnung) return;
    const nextTarife = { ...tarife, [bezeichnung]: preis };
    persistTarife(nextTarife);
    setNewTarif({ bezeichnung: '', preis: '' });
  };

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
        let billKategorie: string | null = null;
        let erwarteterPreis: number | null = null;
        let differenz: number | null = null;

        if (!paketnummer || paketnummer === '-') {
          type = 'SAMMELPOSTEN';
        } else if (bezeichnung.toLowerCase().includes('storno')) {
          type = 'STORNO';
        } else if (betrag < 0) {
          type = 'GUTSCHRIFT';
        } else if (istSperrgut(bezeichnung)) {
          const kat = pNummer ? stammdaten?.data[pNummer] : undefined;
          billKategorie = erkenneBillKategorie(bezeichnung);

          if (kat === 'Kein Zuschlag') {
            // Es hätte laut Stammdaten gar kein Zuschlag anfallen dürfen.
            type = 'FEHLBUCHUNG';
          } else if (!kat) {
            type = 'UNBEKANNT';
          } else {
            // Beide Seiten über dieselbe Kanonisierung vergleichen, damit Schreibweisen
            // wie "sorterfähig"/"sortierfähig", Groß-/Kleinschreibung oder Zusätze wie
            // "Retoure"/"(E)" nicht fälschlich als Abweichung gewertet werden.
            const sollKanonisch = erkenneBillKategorie(kat) ?? kat;
            const stimmtUeberein =
              !billKategorie ||
              billKategorie.trim().toLowerCase() === sollKanonisch.trim().toLowerCase();

            if (!stimmtUeberein) {
              // Es sollte laut Stammdaten eine andere (evtl. teurere) Zuschlagsart sein,
              // als GLS tatsächlich abgerechnet hat – z.B. "Nicht Sortierfähig" statt "Übermaße".
              type = 'ABWEICHUNG';
              const tarifKey = sollKanonisch in tarife ? sollKanonisch : kat in tarife ? kat : null;
              if (tarifKey) {
                erwarteterPreis = tarife[tarifKey];
                differenz = erwarteterPreis - Math.abs(betrag);
              }
            }
          }
        }

        return {
          id: index,
          paketnummer,
          pNummer,
          bezeichnung,
          betrag,
          type,
          billKategorie,
          erwarteterPreis,
          differenz,
          empfaenger,
          raw: row,
        };
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
        (item.pNummer && item.pNummer.toLowerCase().includes(searchLower));
      return matchesFilter && matchesSearch;
    });
  }, [rechnung, filter, search]);

  const stats = useMemo(() => {
    if (!rechnung)
      return {
        fehl: 0,
        gut: 0,
        sammel: 0,
        abweichung: 0,
        abweichungDiff: 0,
        abweichungPositivSumme: 0,
        abweichungPositivAnzahl: 0,
        abweichungNegativSumme: 0,
        abweichungNegativAnzahl: 0,
        abweichungOhneTarifAnzahl: 0,
        selected: 0,
      };
    const abweichungRows = rechnung.filter((r) => r.type === 'ABWEICHUNG');
    const abweichungPositiv = abweichungRows.filter((r) => (r.differenz ?? 0) > 0);
    const abweichungNegativ = abweichungRows.filter((r) => (r.differenz ?? 0) < 0);
    const abweichungOhneTarif = abweichungRows.filter((r) => r.differenz == null);
    return {
      fehl: rechnung.filter((r) => r.type === 'FEHLBUCHUNG').reduce((sum, r) => sum + r.betrag, 0),
      gut: rechnung.filter((r) => r.type === 'GUTSCHRIFT').reduce((sum, r) => sum + r.betrag, 0),
      sammel: rechnung.filter((r) => r.type === 'SAMMELPOSTEN').reduce((sum, r) => sum + r.betrag, 0),
      abweichung: abweichungRows.reduce((sum, r) => sum + r.betrag, 0),
      abweichungDiff: abweichungRows.reduce((sum, r) => sum + (r.differenz ?? 0), 0),
      abweichungPositivSumme: abweichungPositiv.reduce((sum, r) => sum + (r.differenz ?? 0), 0),
      abweichungPositivAnzahl: abweichungPositiv.length,
      abweichungNegativSumme: abweichungNegativ.reduce((sum, r) => sum + (r.differenz ?? 0), 0),
      abweichungNegativAnzahl: abweichungNegativ.length,
      abweichungOhneTarifAnzahl: abweichungOhneTarif.length,
      selected: rechnung.filter((r) => selection.has(r.id)).reduce((sum, r) => sum + r.betrag, 0),
    };
  }, [rechnung, selection]);

  type ReportGruppe = {
    key: string;
    soll: string;
    ist: string;
    anzahl: number;
    summe: number;
    diffSumme: number;
    diffBekannt: boolean;
  };

  const report = useMemo<ReportGruppe[]>(() => {
    if (!rechnung) return [];
    const gruppen: Record<string, ReportGruppe> = {};

    rechnung
      .filter((r) => r.type === 'FEHLBUCHUNG' || r.type === 'ABWEICHUNG')
      .forEach((r) => {
        const soll = (r.pNummer && stammdaten?.data[r.pNummer]) || 'Kein Zuschlag';
        const ist = r.billKategorie ?? r.bezeichnung;
        const key = `${soll}|||${ist}`;

        if (!gruppen[key]) {
          gruppen[key] = { key, soll, ist, anzahl: 0, summe: 0, diffSumme: 0, diffBekannt: false };
        }
        gruppen[key].anzahl += 1;
        gruppen[key].summe += r.betrag;
        if (r.differenz != null) {
          gruppen[key].diffSumme += r.differenz;
          gruppen[key].diffBekannt = true;
        }
      });

    return Object.values(gruppen).sort((a, b) => b.summe - a.summe);
  }, [rechnung, stammdaten]);

  const reportSumme = useMemo(() => report.reduce((sum, g) => sum + g.summe, 0), [report]);

  const handleReportExport = () => {
    if (report.length === 0) return;
    const headers = 'Korrekt;Berechnet;Anzahl;Summe';
    const rows = report
      .map((g) => `${g.soll};${g.ist};${g.anzahl};${g.summe.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`)
      .join('\n');
    const bom = '﻿';
    const blob = new Blob([bom + headers + '\n' + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `gls-report-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
    const headers = 'Paketnummer;P-Nummer;Bezeichnung;Nettobetrag;Status;Laut Stammdaten';
    const csvContent = selectedRows
      .map(
        (r) =>
          `${r.paketnummer};${r.pNummer || ''};${r.bezeichnung};${r.betrag.toLocaleString('de-DE')};${r.type};${
            (r.pNummer && stammdaten?.data[r.pNummer]) || ''
          }`
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

  const filterOptions = ['Alle', 'Fehlbuchung', 'Abweichung', 'Unbekannt', 'Gutschrift', 'Storno', 'Sammelposten'];

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
          <GlsMark height={32} className="shadow-lg shadow-black/30" />
          <h1 className="text-sm font-black tracking-tight leading-tight">
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

        <div className="px-6 mb-6">
          <div className="flex bg-mokebo-surface p-1 rounded-xl border border-mokebo-border">
            <button
              onClick={() => setMainView('rechnung')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold transition-all ${
                mainView === 'rechnung' ? 'bg-mokebo-surface2 text-mokebo-fg shadow-sm' : 'text-mokebo-muted hover:text-mokebo-fg'
              }`}
            >
              <Upload size={12} />
              Rechnung
            </button>
            <button
              onClick={() => setMainView('stammdaten')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold transition-all ${
                mainView === 'stammdaten' ? 'bg-mokebo-surface2 text-mokebo-fg shadow-sm' : 'text-mokebo-muted hover:text-mokebo-fg'
              }`}
            >
              <Database size={12} />
              Stammdaten
            </button>
            <button
              onClick={() => setMainView('report')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold transition-all ${
                mainView === 'report' ? 'bg-mokebo-surface2 text-mokebo-fg shadow-sm' : 'text-mokebo-muted hover:text-mokebo-fg'
              }`}
            >
              <Filter size={12} />
              Report
            </button>
          </div>
        </div>

        {mainView === 'rechnung' && rechnung && (
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
                    <div className="text-[10px] text-mokebo-muted uppercase mb-1 font-bold">
                      Abweichungen ({stats.abweichungPositivAnzahl + stats.abweichungNegativAnzahl + stats.abweichungOhneTarifAnzahl})
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-emerald-400">Zu unseren Gunsten</span>
                      <span className="text-sm font-black text-emerald-400 whitespace-nowrap">
                        +{stats.abweichungPositivSumme.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                        <span className="text-[9px] text-mokebo-muted font-bold ml-1">({stats.abweichungPositivAnzahl})</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1.5">
                      <span className="text-[10px] font-bold text-mokebo-rustlight">Zu unseren Ungunsten</span>
                      <span className="text-sm font-black text-mokebo-rustlight whitespace-nowrap">
                        {stats.abweichungNegativSumme.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                        <span className="text-[9px] text-mokebo-muted font-bold ml-1">({stats.abweichungNegativAnzahl})</span>
                      </span>
                    </div>
                    {stats.abweichungOhneTarifAnzahl > 0 && (
                      <div className="text-[9px] font-bold text-mokebo-muted mt-1.5">
                        {stats.abweichungOhneTarifAnzahl} ohne Tarif – Preis unbekannt
                      </div>
                    )}
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
        {mainView === 'stammdaten' ? (
          <div className="flex-grow overflow-y-auto p-8">
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-xl font-black text-mokebo-fg">Stammdaten</h2>
                  <p className="text-sm text-mokebo-muted font-medium mt-0.5">
                    {stammdaten ? `${stammdaten.count} Artikel · Stand: ${stammdaten.date}` : 'Noch keine Stammdaten importiert.'}
                  </p>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-mokebo-muted">
                    <Search size={14} />
                  </div>
                  <input
                    type="text"
                    placeholder="P-Nummer oder Kategorie suchen..."
                    value={stammdatenSearch}
                    onChange={(e) => setStammdatenSearch(e.target.value)}
                    className="pl-9 pr-4 py-2.5 bg-white/5 border border-mokebo-border rounded-xl text-sm text-mokebo-fg placeholder:text-mokebo-muted focus:ring-4 focus:ring-mokebo-mint/15 outline-none transition-all w-72"
                  />
                </div>
              </div>

              {/* Zuschlag-Tarife */}
              <div className="bg-mokebo-surface border border-mokebo-border rounded-3xl overflow-hidden">
                <div className="px-6 py-5 border-b border-mokebo-border bg-white/5">
                  <h3 className="font-black text-sm uppercase tracking-widest text-mokebo-muted">Zuschlag-Tarife</h3>
                  <p className="text-[11px] text-mokebo-muted font-medium mt-1">
                    Aktuelle Kosten je Zuschlagsart – bei Preisänderungen hier anpassen.
                  </p>
                </div>

                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10px] uppercase font-black text-mokebo-muted border-b border-mokebo-border bg-white/5 tracking-widest">
                      <th className="py-3.5 px-6">Bezeichnung</th>
                      <th className="py-3.5 px-4 text-right">Preis</th>
                      <th className="py-3.5 px-6 text-right">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {Object.entries(tarife)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([bezeichnung, preis]) => (
                        <tr key={bezeichnung} className="group hover:bg-white/5 transition-colors">
                          {editingTarifKey === bezeichnung ? (
                            <>
                              <td className="py-3 px-6">
                                <input
                                  type="text"
                                  value={tarifEditDraft.bezeichnung}
                                  onChange={(e) => setTarifEditDraft((prev) => ({ ...prev, bezeichnung: e.target.value }))}
                                  className="w-full px-2 py-1.5 bg-white/5 border border-mokebo-border rounded-lg text-xs text-mokebo-fg outline-none focus:ring-2 focus:ring-mokebo-mint/20"
                                />
                              </td>
                              <td className="py-3 px-4">
                                <input
                                  type="text"
                                  value={tarifEditDraft.preis}
                                  onChange={(e) => setTarifEditDraft((prev) => ({ ...prev, preis: e.target.value }))}
                                  className="w-full px-2 py-1.5 bg-white/5 border border-mokebo-border rounded-lg text-xs font-mono text-right text-mokebo-fg outline-none focus:ring-2 focus:ring-mokebo-mint/20"
                                />
                              </td>
                              <td className="py-3 px-6 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => saveEditTarif(bezeichnung)}
                                    className="p-2 text-mokebo-mint hover:bg-mokebo-mint/15 rounded-lg transition-all"
                                    title="Speichern"
                                  >
                                    <Check size={14} />
                                  </button>
                                  <button
                                    onClick={cancelEditTarif}
                                    className="p-2 text-mokebo-muted hover:bg-white/5 rounded-lg transition-all"
                                    title="Abbrechen"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-3.5 px-6 text-sm font-bold text-mokebo-fg">{bezeichnung}</td>
                              <td className="py-3.5 px-4 text-right font-mono font-black text-sm text-mokebo-mint">
                                {preis.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                              </td>
                              <td className="py-3.5 px-6 text-right">
                                {deleteTarifConfirmKey === bezeichnung ? (
                                  <div className="flex items-center justify-end gap-2 text-[10px] font-black text-mokebo-rustlight">
                                    <span>Löschen?</span>
                                    <button
                                      onClick={() => deleteTarif(bezeichnung)}
                                      className="bg-mokebo-rust text-white px-2.5 py-1 rounded-lg hover:bg-mokebo-dark transition-all"
                                    >
                                      JA
                                    </button>
                                    <button
                                      onClick={() => setDeleteTarifConfirmKey(null)}
                                      className="bg-mokebo-surface2 border border-mokebo-border text-mokebo-muted px-2 py-1 rounded-lg hover:bg-white/5 transition-all"
                                    >
                                      NEIN
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => startEditTarif(bezeichnung, preis)}
                                      className="p-2 text-mokebo-muted hover:text-mokebo-mint hover:bg-mokebo-mint/15 rounded-lg transition-all"
                                      title="Bearbeiten"
                                    >
                                      <Pencil size={14} />
                                    </button>
                                    <button
                                      onClick={() => setDeleteTarifConfirmKey(bezeichnung)}
                                      className="p-2 text-mokebo-muted hover:text-mokebo-rustlight hover:bg-mokebo-rust/15 rounded-lg transition-all"
                                      title="Löschen"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                  </tbody>
                </table>

                <div className="px-6 py-4 border-t border-mokebo-border bg-white/5 flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[160px]">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-mokebo-muted mb-1.5">Neue Zuschlagsart</label>
                    <input
                      type="text"
                      placeholder="z. B. Gurtmaß"
                      value={newTarif.bezeichnung}
                      onChange={(e) => setNewTarif((prev) => ({ ...prev, bezeichnung: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/5 border border-mokebo-border rounded-xl text-sm text-mokebo-fg placeholder:text-mokebo-muted focus:ring-4 focus:ring-mokebo-mint/15 outline-none transition-all"
                    />
                  </div>
                  <div className="w-40">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-mokebo-muted mb-1.5">Preis (€)</label>
                    <input
                      type="text"
                      placeholder="0,00"
                      value={newTarif.preis}
                      onChange={(e) => setNewTarif((prev) => ({ ...prev, preis: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/5 border border-mokebo-border rounded-xl text-sm font-mono text-right text-mokebo-fg placeholder:text-mokebo-muted focus:ring-4 focus:ring-mokebo-mint/15 outline-none transition-all"
                    />
                  </div>
                  <button
                    onClick={addTarif}
                    disabled={!newTarif.bezeichnung.trim()}
                    className="flex items-center gap-2 bg-mokebo-green hover:bg-mokebo-dark disabled:bg-mokebo-surface2 disabled:text-mokebo-muted text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-black/30"
                  >
                    <Plus size={14} />
                    Hinzufügen
                  </button>
                </div>
              </div>

              {/* Neuer Eintrag */}
              <div className="bg-mokebo-surface border border-mokebo-border rounded-2xl p-4 flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[160px]">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-mokebo-muted mb-1.5">P-Nummer</label>
                  <input
                    type="text"
                    placeholder="P-12345"
                    value={newEntry.pNummer}
                    onChange={(e) => setNewEntry((prev) => ({ ...prev, pNummer: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/5 border border-mokebo-border rounded-xl text-sm font-mono text-mokebo-fg placeholder:text-mokebo-muted focus:ring-4 focus:ring-mokebo-mint/15 outline-none transition-all"
                  />
                </div>
                <div className="flex-1 min-w-[160px]">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-mokebo-muted mb-1.5">Kategorie</label>
                  <input
                    type="text"
                    placeholder="z. B. Kein Zuschlag"
                    value={newEntry.kategorie}
                    onChange={(e) => setNewEntry((prev) => ({ ...prev, kategorie: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/5 border border-mokebo-border rounded-xl text-sm text-mokebo-fg placeholder:text-mokebo-muted focus:ring-4 focus:ring-mokebo-mint/15 outline-none transition-all"
                  />
                </div>
                <button
                  onClick={addEntry}
                  disabled={!newEntry.pNummer.trim() || !newEntry.kategorie.trim()}
                  className="flex items-center gap-2 bg-mokebo-green hover:bg-mokebo-dark disabled:bg-mokebo-surface2 disabled:text-mokebo-muted text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-black/30"
                >
                  <Plus size={14} />
                  Hinzufügen
                </button>
              </div>

              {/* Tabelle */}
              <div className="bg-mokebo-surface border border-mokebo-border rounded-3xl overflow-hidden">
                {!stammdaten || stammdaten.count === 0 ? (
                  <div className="py-24 text-center">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Database size={36} className="text-mokebo-muted" />
                    </div>
                    <p className="font-bold text-mokebo-muted max-w-xs mx-auto">
                      Importiere eine Stammdaten-Datei oder füge oben manuell einen Eintrag hinzu.
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-[10px] uppercase font-black text-mokebo-muted border-b border-mokebo-border bg-white/5 tracking-widest">
                        <th className="py-4 px-6">P-Nummer</th>
                        <th className="py-4 px-4">Kategorie</th>
                        <th className="py-4 px-6 text-right">Aktionen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {Object.entries(stammdaten.data)
                        .filter(
                          ([p, kat]) =>
                            p.toLowerCase().includes(stammdatenSearch.toLowerCase()) ||
                            kat.toLowerCase().includes(stammdatenSearch.toLowerCase())
                        )
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([pNummer, kategorie]) => (
                          <tr key={pNummer} className="group hover:bg-white/5 transition-colors">
                            {editingKey === pNummer ? (
                              <>
                                <td className="py-3 px-6">
                                  <input
                                    type="text"
                                    value={editDraft.pNummer}
                                    onChange={(e) => setEditDraft((prev) => ({ ...prev, pNummer: e.target.value }))}
                                    className="w-full px-2 py-1.5 bg-white/5 border border-mokebo-border rounded-lg text-xs font-mono text-mokebo-fg outline-none focus:ring-2 focus:ring-mokebo-mint/20"
                                  />
                                </td>
                                <td className="py-3 px-4">
                                  <input
                                    type="text"
                                    value={editDraft.kategorie}
                                    onChange={(e) => setEditDraft((prev) => ({ ...prev, kategorie: e.target.value }))}
                                    className="w-full px-2 py-1.5 bg-white/5 border border-mokebo-border rounded-lg text-xs text-mokebo-fg outline-none focus:ring-2 focus:ring-mokebo-mint/20"
                                  />
                                </td>
                                <td className="py-3 px-6 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => saveEditEntry(pNummer)}
                                      className="p-2 text-mokebo-mint hover:bg-mokebo-mint/15 rounded-lg transition-all"
                                      title="Speichern"
                                    >
                                      <Check size={14} />
                                    </button>
                                    <button
                                      onClick={cancelEditEntry}
                                      className="p-2 text-mokebo-muted hover:bg-white/5 rounded-lg transition-all"
                                      title="Abbrechen"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="py-3.5 px-6">
                                  <span className="font-mono font-black text-xs text-mokebo-mint bg-mokebo-mint/15 px-2 py-1 rounded-md inline-block">
                                    {pNummer}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-sm text-mokebo-fg">{kategorie}</td>
                                <td className="py-3.5 px-6 text-right">
                                  {deleteConfirmKey === pNummer ? (
                                    <div className="flex items-center justify-end gap-2 text-[10px] font-black text-mokebo-rustlight">
                                      <span>Löschen?</span>
                                      <button
                                        onClick={() => deleteEntry(pNummer)}
                                        className="bg-mokebo-rust text-white px-2.5 py-1 rounded-lg hover:bg-mokebo-dark transition-all"
                                      >
                                        JA
                                      </button>
                                      <button
                                        onClick={() => setDeleteConfirmKey(null)}
                                        className="bg-mokebo-surface2 border border-mokebo-border text-mokebo-muted px-2 py-1 rounded-lg hover:bg-white/5 transition-all"
                                      >
                                        NEIN
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        onClick={() => startEditEntry(pNummer, kategorie)}
                                        className="p-2 text-mokebo-muted hover:text-mokebo-mint hover:bg-mokebo-mint/15 rounded-lg transition-all"
                                        title="Bearbeiten"
                                      >
                                        <Pencil size={14} />
                                      </button>
                                      <button
                                        onClick={() => setDeleteConfirmKey(pNummer)}
                                        className="p-2 text-mokebo-muted hover:text-mokebo-rustlight hover:bg-mokebo-rust/15 rounded-lg transition-all"
                                        title="Löschen"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        ) : mainView === 'report' ? (
          <div className="flex-grow overflow-y-auto p-8">
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-xl font-black text-mokebo-fg">Report</h2>
                  <p className="text-sm text-mokebo-muted font-medium mt-0.5">
                    Fehlbuchungen &amp; Abweichungen, gruppiert nach Korrekt/Berechnet.
                  </p>
                </div>
                <button
                  onClick={handleReportExport}
                  disabled={report.length === 0}
                  className="flex items-center gap-2 bg-mokebo-green hover:bg-mokebo-dark disabled:bg-mokebo-surface2 disabled:text-mokebo-muted text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-black/30"
                >
                  <Download size={14} />
                  Export (.csv)
                </button>
              </div>

              <div className="bg-mokebo-surface border border-mokebo-border rounded-3xl overflow-hidden">
                {!rechnung ? (
                  <div className="py-24 text-center">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Filter size={36} className="text-mokebo-muted" />
                    </div>
                    <p className="font-bold text-mokebo-muted max-w-xs mx-auto">
                      Lade zuerst eine GLS-Rechnung hoch, um einen Report zu sehen.
                    </p>
                  </div>
                ) : report.length === 0 ? (
                  <div className="py-24 text-center">
                    <div className="w-20 h-20 bg-emerald-500/15 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Check size={36} className="text-emerald-400" />
                    </div>
                    <p className="font-bold text-mokebo-muted max-w-xs mx-auto">
                      Keine Fehlbuchungen oder Abweichungen in dieser Rechnung gefunden.
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-[10px] uppercase font-black text-mokebo-muted border-b border-mokebo-border bg-white/5 tracking-widest">
                        <th className="py-4 px-6">Korrekt / Berechnet</th>
                        <th className="py-4 px-4 text-right">Anzahl</th>
                        <th className="py-4 px-6 text-right">Summe</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {report.map((g) => {
                        const istFehlbuchung = g.soll === 'Kein Zuschlag';
                        const guenstig = !istFehlbuchung && g.diffBekannt && g.diffSumme > 0;
                        const unguenstig = istFehlbuchung || (g.diffBekannt && g.diffSumme < 0);
                        const rowClass = unguenstig ? 'bg-mokebo-rust/10' : guenstig ? 'bg-emerald-500/10' : '';
                        const textClass = unguenstig
                          ? 'text-mokebo-rustlight'
                          : guenstig
                          ? 'text-emerald-400'
                          : 'text-mokebo-fg';
                        return (
                          <tr key={g.key} className={`${rowClass} transition-colors`}>
                            <td className="py-3.5 px-6 text-sm">
                              <span className="font-bold text-mokebo-fg">Korrekt: {g.soll}</span>
                              <span className="text-mokebo-muted"> / Berechnet: </span>
                              <span className="font-bold text-mokebo-fg">{g.ist}</span>
                            </td>
                            <td className="py-3.5 px-4 text-right text-sm font-mono text-mokebo-muted">{g.anzahl}</td>
                            <td className={`py-3.5 px-6 text-right text-sm font-black font-mono ${textClass}`}>
                              {g.summe.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-mokebo-border bg-white/5">
                        <td className="py-4 px-6 text-xs font-black uppercase tracking-widest text-mokebo-muted">
                          Summe
                        </td>
                        <td className="py-4 px-4 text-right text-sm font-mono text-mokebo-muted">
                          {report.reduce((sum, g) => sum + g.anzahl, 0)}
                        </td>
                        <td className="py-4 px-6 text-right text-sm font-black font-mono text-mokebo-fg">
                          {reportSumme.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </div>
          </div>
        ) : !rechnung ? (
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
                    placeholder="Suche nach Paketnummer oder P-Nummer..."
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
                    <th className="px-4 py-4">Laut Stammdaten</th>
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
                        <td className="px-4 py-4 text-sm text-mokebo-muted">
                          {item.bezeichnung}
                          {item.type === 'ABWEICHUNG' && item.billKategorie && (
                            <div className="text-[10px] font-bold text-sky-400 mt-0.5">
                              Abgerechnet als „{item.billKategorie}"
                            </div>
                          )}
                        </td>
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
                        <td className="px-4 py-4 text-sm">
                          {item.pNummer && stammdaten?.data[item.pNummer] ? (
                            <>
                              <span className="font-bold text-mokebo-fg">{stammdaten.data[item.pNummer]}</span>
                              {item.type === 'ABWEICHUNG' && item.differenz != null && (
                                <div
                                  className={`text-[10px] font-bold mt-0.5 ${
                                    item.differenz > 0 ? 'text-emerald-400' : 'text-mokebo-rustlight'
                                  }`}
                                >
                                  {item.differenz > 0 ? '+' : ''}
                                  {item.differenz.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} ggü. berechnet
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-mokebo-muted">–</span>
                          )}
                        </td>
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
