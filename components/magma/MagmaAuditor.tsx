'use client';

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import Link from 'next/link';
import { 
  Upload, 
  Trash2, 
  TrendingUp, 
  CheckCircle2, 
  RefreshCw, 
  AlertTriangle, 
  Plus, 
  X, 
  Filter, 
  Printer, 
  Calendar, 
  Tag, 
  Save, 
  Info, 
  ChevronRight, 
  Undo2, 
  FileUp,
  FileText,
  Database,
  Search,
  Download,
  ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MagmaMark } from './MagmaLogo';

// ─── UTILS ────────────────────────────────────────────────────────────────────
const fmtEur = (n: number) => (n ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('de-DE') : '–';

const toIsoDate = (val: any) => {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().split('T')[0];
  const s = val.toString().trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.split('T')[0];
  
  let parts: string[] = [];
  if (s.includes('.')) {
    parts = s.split('.');
  } else if (s.includes('/')) {
    parts = s.split('/');
  }

  if (parts.length === 3) {
    const [d, m, y] = parts.map(p => p.trim());
    if (d && m && y) {
      const year = y.length === 2 ? '20' + y : y;
      return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }
  return null;
};

const parseNum = (val: any) => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  
  let s = val.toString().trim();
  
  // Clean up currency symbols or other non-numeric chars except , . -
  s = s.replace(/[^\d,.\-]/g, '');

  if (!s) return 0;

  // Handle German format: 1.559,00 or 15,59
  // If there's a comma, it's likely a decimal separator in this context
  if (s.includes(',') && !s.includes('.')) {
    s = s.replace(',', '.');
  } else if (s.includes(',') && s.includes('.')) {
    // Mixed: 1.559,00
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // US format: 1,559.00
      s = s.replace(/,/g, '');
    }
  }
  
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

const cleanSku = (s: string) => (s || '').toString().trim().toLowerCase().replace(/\s*\(do not edit\)\s*/gi, '');
const alphaNum = (s: string) => cleanSku(s).replace(/[^a-z0-9]/g, '');

const HARDCODED_ALIASES: Record<string, string[]> = {
  'lp4trb_usbc_taupe': ['lp4trb_usbc_tau'],
  'lp4trb_usbc_stone-blue': ['lp4trb_usbc_blau'],
  'lp4trb_usbc_fuzzy-peach': ['lp4trb_usbc_peach']
};

const isSkuMatch = (skuA: string, skuB: string, aliases: string[] = []) => {
  const a = cleanSku(skuA);
  const b = cleanSku(skuB);
  if (a === b) return true;
  
  const aAlpha = alphaNum(skuA);
  const bAlpha = alphaNum(skuB);
  if (aAlpha === bAlpha && aAlpha.length > 2) return true;

  // Combine manual aliases with hardcoded ones
  const allAliases = [...aliases];
  if (HARDCODED_ALIASES[a]) allAliases.push(...HARDCODED_ALIASES[a]);
  if (HARDCODED_ALIASES[b]) allAliases.push(...HARDCODED_ALIASES[b]);

  // Check aliases
  return allAliases.some(alias => {
    const cleanAlias = cleanSku(alias);
    const alphaAlias = alphaNum(alias);
    return a === cleanAlias || b === cleanAlias || aAlpha === alphaAlias || bAlpha === alphaAlias;
  });
};

const findMasterEntry = (sku: string, masterPrices: MasterPrice[]) => {
  if (!sku || !masterPrices?.length) return null;
  return masterPrices.find(m => isSkuMatch(sku, m.sku, m.aliases));
};

const dateInRange = (dateStr: string, fromStr: string, toStr: string) => {
  if (!dateStr || !fromStr || !toStr) return false;
  return dateStr >= fromStr && dateStr <= toStr;
};

const findDiscount = (sku: string, dateStr: string, discountRules: any[]) => {
  if (!sku || !dateStr || !discountRules?.length) return 0;
  const skuClean = cleanSku(sku);
  const skuAlpha = alphaNum(sku);
  for (const rule of discountRules) {
    if (!dateInRange(dateStr, rule.from, rule.to)) continue;
    if (rule.skuFilter && rule.skuFilter.trim() !== '') {
      const filters = rule.skuFilter.split(',').map((f: string) => f.trim().toLowerCase());
      const matches = filters.some((f: string) =>
        isSkuMatch(sku, f) || skuClean.includes(f) || f.includes(skuClean) ||
        alphaNum(f) === skuAlpha
      );
      if (!matches) continue;
    }
    return parseNum(rule.percent);
  }
  return 0;
};

const calcSoll = (einzelpreis: number, menge: number, rabattPct: number) => {
  const discountedSingle = Math.round(einzelpreis * (1 - rabattPct / 100) * 100) / 100;
  return Math.round(discountedSingle * menge * 100) / 100;
};

const detectHeaderRowIndex = (rows: any[][]): number => {
  for (let idx = 0; idx < Math.min(rows.length, 15); idx++) {
    const row = rows[idx] || [];
    const hasSKUIndicator = row.some(c => {
      if (c === null || c === undefined) return false;
      const s = c.toString().toLowerCase().trim();
      return s === 'sku' || s === 'artikel_id' || s === 'artikelnummer' || s === 'kd_artikel_id';
    });
    const hasInvoiceIndicator = row.some(c => {
      if (c === null || c === undefined) return false;
      const s = c.toString().toLowerCase().trim();
      return s === 'auftrag_nr_id' || s === 'kontrakt_nr_kunde' || s === 'rechnungs_nr_id' || s === 'datum_rechnung';
    });
    if (hasSKUIndicator || hasInvoiceIndicator) {
      return idx;
    }
  }
  return 0;
};

const guessMasterMapping = (row: any[]): MasterMappingConfig => {
  let skuIdx = 0;
  let priceIdx = 1;
  let discountIdx = -1;
  
  if (!row) return { skuIdx, priceIdx, discountIdx };
  
  // 1. Detect SKU
  row.forEach((cell, idx) => {
    if (cell === null || cell === undefined) return;
    const s = cell.toString().toLowerCase().trim();
    if (s === 'sku' || s === 'artikelnummer' || s === 'artikel_id' || s === 'kd_artikel_id') {
      skuIdx = idx;
    }
  });

  // 2. Detect Price: Prioritize exact match for "purchase price" or "einkaufspreis"
  let priceMatched = false;
  row.forEach((cell, idx) => {
    if (cell === null || cell === undefined || priceMatched) return;
    const s = cell.toString().toLowerCase().trim();
    if (s === 'purchase price' || s === 'purchase_price' || s === 'purchaseprice' || s === 'einkaufspreis' || s === 'ek' || s === 'ek-preis' || s === 'ek preis') {
      priceIdx = idx;
      priceMatched = true;
    }
  });

  // If no exact match, try strong partial matches (e.g., includes "purchase price" but not "net", "shipping", etc.)
  if (!priceMatched) {
    row.forEach((cell, idx) => {
      if (cell === null || cell === undefined || priceMatched) return;
      const s = cell.toString().toLowerCase().trim();
      if (s.includes('purchase price') && !s.includes('net purchase price') && !s.includes('shipping') && !s.includes('variable') && !s.includes('cogs')) {
        priceIdx = idx;
        priceMatched = true;
      }
    });
  }

  // If still no match, fallback to any column containing "purchase price"
  if (!priceMatched) {
    row.forEach((cell, idx) => {
      if (cell === null || cell === undefined || priceMatched) return;
      const s = cell.toString().toLowerCase().trim();
      if (s.includes('purchase price')) {
        priceIdx = idx;
        priceMatched = true;
      }
    });
  }

  // If still no match, try generic "einkauf" or "ek"
  if (!priceMatched) {
    row.forEach((cell, idx) => {
      if (cell === null || cell === undefined || priceMatched) return;
      const s = cell.toString().toLowerCase().trim();
      if (s.includes('einkauf') || s === 'ek') {
        priceIdx = idx;
        priceMatched = true;
      }
    });
  }

  // If still no match, default to a column that does NOT look like "selling price" or "otto"
  if (!priceMatched) {
    row.forEach((cell, idx) => {
      if (cell === null || cell === undefined || priceMatched) return;
      const s = cell.toString().toLowerCase().trim();
      if (s.includes('preis') || s.includes('price')) {
        if (!s.includes('selling') && !s.includes('verkauf') && !s.includes('otto') && !s.includes('amazon') && !s.includes('shopify') && !s.includes('uvp')) {
          priceIdx = idx;
          priceMatched = true;
        }
      }
    });
  }

  // 3. Detect Discount
  row.forEach((cell, idx) => {
    if (cell === null || cell === undefined) return;
    const s = cell.toString().toLowerCase().trim();
    if (s.includes('skonto') || s.includes('rabatt') || s.includes('discount')) {
      if (!s.includes('purchase price')) {
        discountIdx = idx;
      }
    }
  });
  
  return { skuIdx, priceIdx, discountIdx };
};

const guessInvoiceMapping = (row: any[]): InvoiceMappingConfig => {
  let auftragIdIdx = 2;
  let dateIdx = 6;
  let skuIdx = 4;
  let mengeIdx = 8;
  let priceIdx = 5;
  let istWertIdx = 9;
  let bagRgIdx = 7;
  
  if (!row) return { auftragIdIdx, dateIdx, skuIdx, mengeIdx, priceIdx, istWertIdx, bagRgIdx };
  
  row.forEach((cell, idx) => {
    if (cell === null || cell === undefined) return;
    const s = cell.toString().toLowerCase().trim();
    if (s === 'kontrakt_nr_kunde' || s === 'auftragsnummer' || s === 'auftrag_nr_id' || s.includes('auftrag-id') || s.includes('auftrag_id')) {
      auftragIdIdx = idx;
    }
    if (s === 'datum_rechnung' || s === 'rechnungsdatum' || s === 'datum' || s === 'date') {
      dateIdx = idx;
    }
    if (s === 'kd_artikel_id' || s === 'sku' || s === 'artikelnummer' || s === 'artikel_id') {
      skuIdx = idx;
    }
    if (s === 'menge_rechnung' || s === 'menge' || s === 'anzahl' || s === 'quantity' || s === 'menge_rechn') {
      mengeIdx = idx;
    }
    if (s === 'preis' || s === 'price' || s === 'einzelpreis') {
      priceIdx = idx;
    }
    if (s === 'wert_netto_rw' || s === 'netto' || s === 'gesamtwert' || s === 'betrag' || s === 'wert_netto' || s === 'netto_wert') {
      istWertIdx = idx;
    }
    if (s === 'rechnungs_nr_id' || s === 'rechnungsnummer' || s === 'rechnungs_nr' || s === 'rg_nr' || s === 'invoice_no' || s === 'rechnungs_nr_id') {
      bagRgIdx = idx;
    }
  });
  
  return { auftragIdIdx, dateIdx, skuIdx, mengeIdx, priceIdx, istWertIdx, bagRgIdx };
};

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface MasterPrice {
  id: number;
  sku: string;
  ek: number;
  discount?: number;
  aliases?: string[];
}

interface MasterMappingConfig {
  skuIdx: number;
  priceIdx: number;
  discountIdx: number;
}

interface InvoiceMappingConfig {
  auftragIdIdx: number;
  dateIdx: number;
  skuIdx: number;
  mengeIdx: number;
  priceIdx: number;
  istWertIdx: number;
  bagRgIdx: number;
}

interface DiscountRule {
  id: number;
  label: string;
  from: string;
  to: string;
  percent: string | number;
  skuFilter: string;
}

interface InvoiceItem {
  id: number;
  bagRg: string;
  auftragId: string;
  date: string;
  sku: string;
  menge: number;
  einzelpreis: number;
  istWert: number;
  rabatt?: number;
  sollWert?: number;
  diff?: number;
  hasError?: boolean;
  isMatch?: boolean;
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState<'audit' | 'rabatte' | 'stamm'>('audit');
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [masterPrices, setMasterPrices] = useState<MasterPrice[]>([]);
  const [discountRules, setDiscountRules] = useState<DiscountRule[]>([]);
  const [filterErrors, setFilterErrors] = useState(false);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [fileName, setFileName] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Mapping Modal State
  const [isMappingOpen, setIsMappingOpen] = useState(false);
  const [mappingType, setMappingType] = useState<'master' | 'invoice'>('master');
  const [rawRows, setRawRows] = useState<any[][]>([]);
  const [headerRowIdx, setHeaderRowIdx] = useState<number>(0);
  const [masterMapping, setMasterMapping] = useState<MasterMappingConfig>({ skuIdx: 0, priceIdx: 1, discountIdx: -1 });
  const [invoiceMapping, setInvoiceMapping] = useState<InvoiceMappingConfig>({ 
    auftragIdIdx: 2, // kontrakt_nr_kunde
    dateIdx: 6,      // datum_rechnung
    skuIdx: 4,       // kd_artikel_id
    mengeIdx: 8,     // menge_rechnung
    priceIdx: 5,     // Preis
    istWertIdx: 9,   // wert_netto_rw
    bagRgIdx: 7      // rechnungs_nr_id
  });
  const [masterSearch, setMasterSearch] = useState('');
  const [auditSearch, setAuditSearch] = useState('');
  const [editingMaster, setEditingMaster] = useState<MasterPrice | null>(null);
  const [newMaster, setNewMaster] = useState<Partial<MasterPrice>>({ sku: '', ek: 0, aliases: [] });

  const emptyRule = (): DiscountRule => ({ id: Date.now(), label: '', from: '', to: '', percent: '', skuFilter: '' });
  const [newRule, setNewRule] = useState<DiscountRule>(emptyRule());
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [showClearMasterConfirm, setShowClearMasterConfirm] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const masterRef = useRef<HTMLInputElement>(null);

  // Load from LocalStorage on init
  useEffect(() => {
    const savedMaster = localStorage.getItem('brilliant_master');
    const savedRules = localStorage.getItem('brilliant_rules');
    if (savedMaster) setMasterPrices(JSON.parse(savedMaster));
    if (savedRules) setDiscountRules(JSON.parse(savedRules));
  }, []);

  const syncToLocal = useCallback((master: MasterPrice[] | null, rules: DiscountRule[] | null) => {
    setIsSyncing(true);
    if (master) localStorage.setItem('brilliant_master', JSON.stringify(master));
    if (rules) localStorage.setItem('brilliant_rules', JSON.stringify(rules));
    setTimeout(() => setIsSyncing(false), 500);
  }, []);

  // ── XLSX Import (Rechnung) ────────────────────────────────────────────────
  const handleInvoiceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result;
        const wb = XLSX.read(data as ArrayBuffer, { 
          type: 'array', 
          cellDates: true,
          raw: true // Keep raw values to avoid library-side auto-formatting errors
        });
        const ws = wb.Sheets[wb.SheetNames[0]];
        // Force strings to ensure our parseNum handles decimals correctly
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { 
          header: 1, 
          defval: '',
          raw: false // Gives us the formatted strings which are safer for German CSVs
        });
        if (rows.length > 0) {
          setRawRows(rows);
          const idx = detectHeaderRowIndex(rows);
          setHeaderRowIdx(idx);
          const guessed = guessInvoiceMapping(rows[idx]);
          setInvoiceMapping(guessed);
          setMappingType('invoice');
          setIsMappingOpen(true);
        }
      } catch (err: any) {
        alert('Fehler beim Lesen der Datei: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // ── Stammdaten CSV/XLSX Import ────────────────────────────────────────────
  const handleMasterUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result as ArrayBuffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (rows.length > 0) {
          setRawRows(rows);
          const idx = detectHeaderRowIndex(rows);
          setHeaderRowIdx(idx);
          const guessed = guessMasterMapping(rows[idx]);
          setMasterMapping(guessed);
          setMappingType('master');
          setIsMappingOpen(true);
        }
      } catch (err: any) { alert('Fehler: ' + err.message); }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const confirmMapping = () => {
    if (mappingType === 'master') {
      const data = rawRows.slice(headerRowIdx + 1)
        .map(r => ({ 
          id: Date.now() + Math.random(), 
          sku: (r[masterMapping.skuIdx] || '').toString().trim(), 
          ek: parseNum(r[masterMapping.priceIdx]),
          discount: masterMapping.discountIdx !== -1 ? parseNum(r[masterMapping.discountIdx]) : undefined
        }))
        .filter(r => r.sku && r.ek > 0);
      
      setMasterPrices(data);
      syncToLocal(data, null);
    } else {
      const parsed = rawRows.slice(headerRowIdx + 1).map((row, i) => {
        // Find by column index or guess if SKU column has data
        const rawSku = (row[invoiceMapping.skuIdx] || '').toString().trim();
        const sku = rawSku;
        const menge = parseNum(row[invoiceMapping.mengeIdx]);
        const istWert = parseNum(row[invoiceMapping.istWertIdx]);
        const dateStr = toIsoDate(row[invoiceMapping.dateIdx]) || '';
        const bagRg = (row[invoiceMapping.bagRgIdx] || '').toString().trim();

        const masterEntry = findMasterEntry(sku, masterPrices);
        const ekPreis = masterEntry ? masterEntry.ek : parseNum(row[invoiceMapping.priceIdx]);

        return {
          id: Date.now() + i,
          bagRg,
          auftragId: (row[invoiceMapping.auftragIdIdx] || '').toString().trim(),
          date: dateStr,
          sku: sku || '(Keine SKU)',
          menge,
          einzelpreis: ekPreis,
          istWert,
          isMatch: !!masterEntry,
        };
      }).filter(r => (r.sku !== '(Keine SKU)' || r.istWert !== 0) && r.menge !== 0);

      setItems(parsed);
    }
    setIsMappingOpen(false);
    setRawRows([]);
  };

  // ── Rabatt-Regel hinzufügen ───────────────────────────────────────────────
  const addRule = () => {
    if (!newRule.from || !newRule.to || !newRule.percent) {
      alert('Bitte Zeitraum und Rabatt % ausfüllen.');
      return;
    }
    
    let updated: DiscountRule[];
    if (editingRuleId) {
      updated = discountRules.map(r => r.id === editingRuleId ? { ...newRule, id: editingRuleId } : r);
      setEditingRuleId(null);
    } else {
      updated = [...discountRules, { ...newRule, id: Date.now() }];
    }
    
    setDiscountRules(updated);
    syncToLocal(null, updated);
    setNewRule(emptyRule());
  };

  const removeRule = (id: number) => {
    const updated = discountRules.filter(r => r.id !== id);
    setDiscountRules(updated);
    syncToLocal(null, updated);
  };

  // ── Stammdaten Manuell ────────────────────────────────────────────────────
  const saveMasterEntry = (entry: Partial<MasterPrice>) => {
    if (!entry.sku || entry.ek === undefined) return;
    
    let updated: MasterPrice[];
    if (entry.id) {
      updated = masterPrices.map(m => m.id === entry.id ? { ...m, ...entry } as MasterPrice : m);
    } else {
      updated = [...masterPrices, { ...entry, id: Date.now() } as MasterPrice];
    }
    
    setMasterPrices(updated);
    syncToLocal(updated, null);
    setEditingMaster(null);
    setNewMaster({ sku: '', ek: 0, aliases: [] });
  };

  const deleteMasterEntry = (id: number) => {
    const updated = masterPrices.filter(m => m.id !== id);
    setMasterPrices(updated);
    syncToLocal(updated, null);
  };

  const exportToCSV = () => {
    if (visibleItems.length === 0) return;
    
    const headers = ['Auftrag-ID', 'Datum', 'SKU', 'Menge', 'Einzelpreis', 'Rabatt %', 'Soll-Wert', 'Ist-Wert', 'Differenz', 'Fehler'];
    const rows = visibleItems.map(it => [
      it.auftragId || '',
      it.date || '',
      it.sku,
      it.menge,
      it.einzelpreis.toString().replace('.', ','),
      (it.rabatt || 0).toString().replace('.', ','),
      (it.sollWert || 0).toString().replace('.', ','),
      it.istWert.toString().replace('.', ','),
      (it.diff || 0).toString().replace('.', ','),
      it.hasError ? 'JA' : 'NEIN'
    ]);
    
    const csvContent = "\uFEFF" + [
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Audit_Export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── Analyse ───────────────────────────────────────────────────────────────
  const enrichedItems = useMemo(() => items.map(item => {
    const rabatt = findDiscount(item.sku, item.date, discountRules);
    const sollWert = calcSoll(item.einzelpreis, item.menge, rabatt);
    
    const isSpecialItem = item.istWert <= 0;
    const finalSoll = isSpecialItem ? item.istWert : sollWert;
    const finalDiff = Math.round((item.istWert - finalSoll) * 100) / 100;
    const hasError = !isSpecialItem && item.isMatch && Math.abs(finalDiff) > 0.01;

    return { ...item, rabatt, sollWert: finalSoll, diff: finalDiff, hasError, isSpecialItem, notAuditable: !item.isMatch };
  }), [items, discountRules]);

  const visibleItems = useMemo(() => {
    return enrichedItems.filter(item => {
      const matchesError = filterErrors ? item.hasError : true;
      const matchesSpecial = filterErrors ? !item.isSpecialItem : true;
      
      let matchesDate = true;
      if (startDate && item.date) {
        matchesDate = matchesDate && item.date >= startDate;
      }
      if (endDate && item.date) {
        matchesDate = matchesDate && item.date <= endDate;
      }
      
      const searchLower = auditSearch.toLowerCase();
      const matchesSearch = !auditSearch || 
        item.sku.toLowerCase().includes(searchLower) || 
        (item.auftragId && item.auftragId.toLowerCase().includes(searchLower));
      
      return matchesError && matchesSpecial && matchesDate && matchesSearch;
    });
  }, [enrichedItems, filterErrors, startDate, endDate, auditSearch]);

   const analysis = useMemo(() => {
    const monthly: Record<string, { count: number, sum: number, retouren: number }> = {};
    const invoiceSums: Record<string, { sum: number, count: number }> = {};
    let totalSoll = 0, totalIst = 0, errors = 0, retouren = 0, missingSkus = 0;
    
    for (const it of enrichedItems) {
      if (it.notAuditable) {
        missingSkus++;
      } else {
        totalSoll += it.sollWert || 0;
        if (it.hasError) errors++;
      }
      
      totalIst += it.istWert;
      if (it.menge < 0) retouren++;
      
      let mk = 'Unbekannt';
      if (it.date) {
        const [y, m, d] = it.date.split('-').map(Number);
        const dt = new Date(y, m - 1, d, 12);
        if (!isNaN(dt.getTime())) mk = dt.toLocaleString('de-DE', { month: 'long', year: 'numeric' });
      }
      if (!monthly[mk]) monthly[mk] = { count: 0, sum: 0, retouren: 0 };
      monthly[mk].count++;
      monthly[mk].sum += it.istWert;
      if (it.menge < 0) monthly[mk].retouren++;

      if (it.bagRg) {
        if (!invoiceSums[it.bagRg]) {
          invoiceSums[it.bagRg] = { sum: 0, count: 0 };
        }
        invoiceSums[it.bagRg].sum += it.istWert;
        invoiceSums[it.bagRg].count++;
      }
    }

    // Round values
    for (const k in invoiceSums) {
      invoiceSums[k].sum = Math.round(invoiceSums[k].sum * 100) / 100;
    }
    
    return { 
      totalSoll: Math.round(totalSoll * 100) / 100, 
      totalIst: Math.round(totalIst * 100) / 100, 
      diff: Math.round((totalIst - totalSoll) * 100) / 100, 
      errors, 
      retouren, 
      missingSkus,
      monthly,
      invoiceSums
    };
  }, [enrichedItems]);

  const MO = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  const sortedMonths = Object.keys(analysis.monthly).sort((a, b) => {
    if (a === 'Unbekannt') return 1; if (b === 'Unbekannt') return -1;
    const [mA, yA] = a.split(' '); const [mB, yB] = b.split(' ');
    return yA !== yB ? +yA - +yB : MO.indexOf(mA) - MO.indexOf(mB);
  });

  const downloadInvoiceSumsCsv = () => {
    if (!analysis.invoiceSums || Object.keys(analysis.invoiceSums).length === 0) return;
    let csvContent = "\uFEFF"; // UTF-8 BOM so Excel detects German commas and decimals correctly
    csvContent += "Rechnungsnummer;Anzahl Positionen;Gesamtsumme (EUR)\r\n";
    Object.entries(analysis.invoiceSums).forEach(([rgNum, info]: [string, any]) => {
      const safeRgNum = rgNum ? `"${rgNum.replace(/"/g, '""')}"` : '"Ohne Nr."';
      const formattedSum = info.sum.toFixed(2).replace('.', ',');
      csvContent += `${safeRgNum};${info.count};${formattedSum}\r\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Magma_Rechnungssummen_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-mokebo-dark text-mokebo-fg font-sans selection:bg-mokebo-mint/30 selection:text-mokebo-dark">
      <div className="max-w-screen-xl mx-auto px-4 py-8 md:px-8">
        
        {/* ── HEADER ── */}
        <header className="no-print mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-mokebo-surface border border-mokebo-border rounded-3xl px-8 py-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-sm">
          <div className="flex items-center gap-5">
            <Link
              href="/"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-mokebo-muted hover:text-mokebo-fg hover:bg-white/5 transition-all shrink-0"
              aria-label="Zur Übersicht"
            >
              <ArrowLeft size={20} strokeWidth={2.5} />
            </Link>
            <MagmaMark size={56} className="shadow-lg shadow-black/30" />
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-black text-2xl tracking-tight">Magma Auditor</h1>
                {isSyncing ? (
                  <motion.span 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-[10px] font-black text-amber-600 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-full flex items-center gap-1.5"
                  >
                    <RefreshCw size={10} className="animate-spin" /> SYNCING
                  </motion.span>
                ) : (
                  <span className="text-[10px] font-black text-emerald-600 bg-emerald-500/15 border border-emerald-100 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                    <CheckCircle2 size={10} /> READY
                  </span>
                )}
              </div>
              <p className="text-sm text-mokebo-muted font-medium mt-0.5">Rechnungsprüfung & Aktions-Management</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <nav className="flex bg-mokebo-surface2/80 p-1.5 rounded-2xl">
              {[
                { id: 'audit', label: 'AUDIT', icon: FileText },
                { id: 'rabatte', label: 'RABATTE', icon: Tag },
                { id: 'stamm', label: 'STAMM', icon: Database }
              ].map((v) => (
                <button 
                  key={v.id} 
                  onClick={() => {
                    setView(v.id as any);
                    setShowClearMasterConfirm(false);
                  }}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 ${view === v.id ? 'bg-mokebo-surface text-mokebo-fg shadow-md shadow-black/30/50' : 'text-mokebo-muted hover:text-mokebo-muted'}`}
                >
                  <v.icon size={14} />
                  {v.label}
                </button>
              ))}
            </nav>
            {view === 'audit' && (
              <button 
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 bg-mokebo-green text-white text-xs font-bold px-6 py-3 rounded-2xl hover:bg-mokebo-dark active:scale-95 transition-all shadow-xl shadow-black/30"
              >
                <Upload size={16} strokeWidth={2.5} />
                XLSX LADEN
                <input type="file" ref={fileRef} accept=".xlsx,.xls,.csv" className="hidden" onChange={handleInvoiceUpload} />
              </button>
            )}
          </div>
        </header>

        <AnimatePresence mode="wait">
          {/* ══ RABATTE VIEW ══════════════════════════════════════════════════ */}
          {view === 'rabatte' && (
            <motion.div 
              key="rabatte"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="bg-mokebo-surface border border-mokebo-border rounded-3xl shadow-sm p-8">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2 bg-mokebo-mint/15 text-mokebo-mint rounded-xl">
                    {editingRuleId ? <RefreshCw size={20} strokeWidth={3} /> : <Plus size={20} strokeWidth={3} />}
                  </div>
                  <h2 className="font-black text-lg tracking-tight">
                    {editingRuleId ? 'Rabattregel bearbeiten' : 'Neuen Aktionsrabatt anlegen'}
                  </h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-mokebo-muted ml-1">Bezeichnung</label>
                    <input 
                      type="text" 
                      placeholder="z.B. Winter-Aktion 2025"
                      value={newRule.label} 
                      onChange={e => setNewRule(r => ({...r, label: e.target.value}))}
                      className="w-full px-4 py-3.5 border border-mokebo-border rounded-2xl text-sm outline-none focus:ring-4 focus:ring-mokebo-mint/15 bg-white/5 transition-all font-medium text-mokebo-fg placeholder:text-mokebo-muted" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-mokebo-muted ml-1">Von</label>
                    <input 
                      type="date" 
                      value={newRule.from} 
                      onChange={e => setNewRule(r => ({...r, from: e.target.value}))}
                      className="w-full px-4 py-3.5 border border-mokebo-border rounded-2xl text-sm outline-none focus:ring-4 focus:ring-mokebo-mint/15 bg-white/5 transition-all font-medium text-mokebo-fg placeholder:text-mokebo-muted" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-mokebo-muted ml-1">Bis</label>
                    <input 
                      type="date" 
                      value={newRule.to} 
                      onChange={e => setNewRule(r => ({...r, to: e.target.value}))}
                      className="w-full px-4 py-3.5 border border-mokebo-border rounded-2xl text-sm outline-none focus:ring-4 focus:ring-mokebo-mint/15 bg-white/5 transition-all font-medium text-mokebo-fg placeholder:text-mokebo-muted" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-mokebo-muted ml-1">Rabatt %</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        step="0.1" 
                        placeholder="25"
                        value={newRule.percent} 
                        onChange={e => setNewRule(r => ({...r, percent: e.target.value}))}
                        className="w-full px-4 py-3.5 border border-mokebo-border rounded-2xl text-sm outline-none focus:ring-4 focus:ring-mokebo-mint/15 bg-white/5 transition-all font-bold font-mono text-mokebo-fg placeholder:text-mokebo-muted" 
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-mokebo-muted">%</span>
                    </div>
                  </div>
                  <div className="md:col-span-2 space-y-3">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-mokebo-muted ml-1">
                      SKU-Auswahl <span className="font-normal normal-case opacity-60">(Wähle betroffene SKUs aus oder gib sie manuell ein)</span>
                    </label>
                    
                    {masterPrices.length > 0 ? (
                      <div className="border border-mokebo-border rounded-2xl bg-white/5 overflow-hidden">
                        <div className="p-3 border-b border-mokebo-border bg-mokebo-surface flex items-center gap-3">
                          <div className="relative flex-1">
                            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-mokebo-muted" />
                            <input 
                              type="text" 
                              placeholder="SKUs filtern..." 
                              className="w-full pl-8 pr-3 py-1.5 text-xs border-none outline-none bg-white/5 rounded-lg text-mokebo-fg placeholder:text-mokebo-muted"
                              onChange={(e) => {
                                const term = e.target.value.toLowerCase();
                                const items = document.querySelectorAll('.sku-select-item');
                                items.forEach((item: any) => {
                                  const sku = item.getAttribute('data-sku').toLowerCase();
                                  item.style.display = sku.includes(term) ? 'flex' : 'none';
                                });
                              }}
                            />
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => {
                                const allSkus = masterPrices.map(p => p.sku).join(', ');
                                setNewRule(r => ({...r, skuFilter: allSkus}));
                              }}
                              className="text-[9px] font-black text-mokebo-mint hover:text-mokebo-mint uppercase tracking-widest"
                            >
                              Alle
                            </button>
                            <button 
                              onClick={() => setNewRule(r => ({...r, skuFilter: ''}))}
                              className="text-[9px] font-black text-mokebo-muted hover:text-mokebo-rustlight uppercase tracking-widest"
                            >
                              Leeren
                            </button>
                          </div>
                        </div>
                        <div className="max-h-40 overflow-y-auto p-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1">
                          {masterPrices.map(p => {
                            const isSelected = newRule.skuFilter.split(',').map(s => s.trim().toLowerCase()).includes(p.sku.toLowerCase());
                            return (
                              <div 
                                key={p.id} 
                                data-sku={p.sku}
                                className="sku-select-item flex items-center gap-2 p-2 rounded-xl hover:bg-mokebo-surface transition-colors cursor-pointer group"
                                onClick={() => {
                                  const current = newRule.skuFilter.split(',').map(s => s.trim()).filter(s => s !== '');
                                  const idx = current.findIndex(s => s.toLowerCase() === p.sku.toLowerCase());
                                  if (idx > -1) {
                                    current.splice(idx, 1);
                                  } else {
                                    current.push(p.sku);
                                  }
                                  setNewRule(r => ({...r, skuFilter: current.join(', ')}));
                                }}
                              >
                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-mokebo-green border-mokebo-mint' : 'bg-mokebo-surface border-mokebo-border group-hover:border-mokebo-mint/60'}`}>
                                  {isSelected && <CheckCircle2 size={10} className="text-white" />}
                                </div>
                                <span className={`font-mono text-[11px] truncate ${isSelected ? 'font-black text-mokebo-mint' : 'text-mokebo-muted'}`}>{p.sku}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 border border-dashed border-mokebo-border rounded-2xl text-center">
                        <p className="text-[10px] font-bold text-mokebo-muted">Lade erst Stammdaten hoch, um SKUs bequem auswählen zu können.</p>
                      </div>
                    )}

                    <input 
                      type="text" 
                      placeholder="Manuelle Eingabe (z.B. SKU1, SKU2)"
                      value={newRule.skuFilter} 
                      onChange={e => setNewRule(r => ({...r, skuFilter: e.target.value}))}
                      className="w-full px-4 py-3.5 border border-mokebo-border rounded-2xl text-sm outline-none focus:ring-4 focus:ring-mokebo-mint/15 bg-white/5 transition-all font-mono text-mokebo-fg placeholder:text-mokebo-muted" 
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    onClick={addRule}
                    className="flex items-center gap-2 bg-mokebo-green text-white text-xs font-bold px-8 py-4 rounded-2xl hover:bg-mokebo-dark active:scale-95 transition-all shadow-lg shadow-mokebo-mint/10"
                  >
                    <Save size={16} />
                    {editingRuleId ? 'ÄNDERUNGEN SPEICHERN' : 'REGEL SPEICHERN'}
                  </button>
                  {editingRuleId && (
                    <button 
                      onClick={() => {
                        setEditingRuleId(null);
                        setNewRule(emptyRule());
                      }}
                      className="px-6 py-4 text-xs font-bold text-mokebo-muted hover:text-mokebo-muted transition-colors"
                    >
                      ABBRECHEN
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-mokebo-surface border border-mokebo-border rounded-3xl shadow-sm overflow-hidden">
                <div className="px-8 py-6 border-b border-mokebo-border/50 bg-white/5 flex items-center justify-between">
                  <h2 className="font-black text-sm uppercase tracking-widest text-mokebo-muted">Aktive Regeln ({discountRules.length})</h2>
                  <div className="flex items-center gap-3">
                    {discountRules.length > 0 && (
                      <button 
                        onClick={() => {
                          setDiscountRules([]);
                          syncToLocal(null, []);
                        }}
                        className="flex items-center gap-2 text-[10px] font-black text-mokebo-muted hover:text-mokebo-rustlight transition-all px-3 py-1.5 rounded-lg hover:bg-mokebo-rust/15"
                      >
                        <Trash2 size={12} />
                        ALLE LÖSCHEN
                      </button>
                    )}
                    <Info size={16} className="text-mokebo-muted" />
                  </div>
                </div>
                {discountRules.length === 0 ? (
                  <div className="py-24 text-center">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Calendar size={32} className="text-mokebo-muted" />
                    </div>
                    <p className="font-bold text-mokebo-muted">Noch keine Rabattregeln definiert.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {discountRules.map(rule => (
                      <motion.div 
                        layout
                        key={rule.id} 
                        className="flex items-center justify-between px-8 py-6 hover:bg-white/5 group transition-colors"
                      >
                        <div className="flex items-center gap-6 flex-wrap">
                          <div className="space-y-1">
                            <span className="font-bold text-sm text-mokebo-fg block">{rule.label || 'Aktionsrabatt'}</span>
                            <span className="font-mono text-[10px] text-mokebo-muted flex items-center gap-1">
                              <Calendar size={10} />
                              {fmtDate(rule.from)} – {fmtDate(rule.to)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-black text-sm text-mokebo-mint bg-mokebo-mint/15 px-3 py-1.5 rounded-xl border border-mokebo-mint/30">
                              -{rule.percent}%
                            </span>
                            {rule.skuFilter ? (
                              <span className="font-mono text-[10px] bg-amber-500/15 text-amber-600 border border-amber-500/30 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                                <Filter size={10} />
                                {rule.skuFilter}
                              </span>
                            ) : (
                              <span className="text-[10px] text-mokebo-muted bg-white/5 border border-mokebo-border px-3 py-1.5 rounded-xl">Global</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 transition-all">
                          <button 
                            onClick={() => {
                              setEditingRuleId(rule.id);
                              setNewRule({ ...rule });
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-mokebo-mint hover:text-mokebo-mint bg-mokebo-mint/15 hover:bg-mokebo-mint/15 border border-mokebo-mint/30 transition-all"
                            title="Bearbeiten"
                          >
                            <RefreshCw size={18} />
                          </button>
                          <button 
                            onClick={() => removeRule(rule.id)}
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-mokebo-rustlight hover:text-mokebo-rustlight bg-mokebo-rust/15 hover:bg-mokebo-rust/15 border border-mokebo-rust/30 transition-all"
                            title="Löschen"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ══ STAMMDATEN VIEW ═══════════════════════════════════════════════ */}
          {view === 'stamm' && (
            <motion.div 
              key="stamm"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="bg-mokebo-surface border border-mokebo-border rounded-3xl shadow-sm p-8">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2 bg-mokebo-green text-white rounded-xl">
                    <Plus size={20} strokeWidth={3} />
                  </div>
                  <h2 className="font-black text-lg tracking-tight">Manueller Stammdaten-Eintrag</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-mokebo-muted ml-1">SKU / Artikelnummer</label>
                    <input 
                      type="text" 
                      placeholder="z.B. LP4trB_USBC_schw"
                      value={newMaster.sku} 
                      onChange={e => setNewMaster(m => ({...m, sku: e.target.value}))}
                      className="w-full px-4 py-3.5 border border-mokebo-border rounded-2xl text-sm outline-none focus:ring-4 focus:ring-mokebo-mint/15 bg-white/5 transition-all font-mono font-bold text-mokebo-fg placeholder:text-mokebo-muted" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-mokebo-muted ml-1">EK-Preis (Netto)</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        step="0.01" 
                        placeholder="0.00"
                        value={newMaster.ek || ''} 
                        onChange={e => setNewMaster(m => ({...m, ek: parseNum(e.target.value)}))}
                        className="w-full px-4 py-3.5 border border-mokebo-border rounded-2xl text-sm outline-none focus:ring-4 focus:ring-mokebo-mint/15 bg-white/5 transition-all font-bold font-mono text-mokebo-fg placeholder:text-mokebo-muted" 
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-mokebo-muted">€</span>
                    </div>
                  </div>
                  <div className="flex items-end">
                    <button 
                      onClick={() => saveMasterEntry(newMaster)}
                      disabled={!newMaster.sku || !newMaster.ek}
                      className="w-full flex items-center justify-center gap-2 bg-mokebo-green text-white text-xs font-bold px-8 py-4 rounded-2xl hover:bg-mokebo-dark disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all shadow-lg shadow-black/20"
                    >
                      <Save size={16} />
                      EINTRAG SPEICHERN
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-mokebo-surface border border-mokebo-border rounded-3xl shadow-sm overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-8 py-6 border-b border-mokebo-border/50 bg-white/5 gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-mokebo-green text-white rounded-xl">
                      <Database size={20} />
                    </div>
                    <div>
                      <h2 className="font-black text-sm uppercase tracking-widest text-mokebo-muted">STAMMDATEN LISTE</h2>
                      <p className="text-[10px] text-mokebo-muted font-bold mt-0.5">{masterPrices.length} Preise gespeichert</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mokebo-muted" />
                      <input 
                        type="text" 
                        placeholder="SKU oder Alias suchen..." 
                        value={masterSearch}
                        onChange={e => setMasterSearch(e.target.value)}
                        className="pl-9 pr-4 py-2 border border-mokebo-border rounded-xl text-xs outline-none focus:ring-2 focus:ring-mokebo-mint/20 w-full sm:w-48 bg-mokebo-surface2 text-mokebo-fg placeholder:text-mokebo-muted"
                      />
                    </div>
                    {masterPrices.length > 0 && (
                      showClearMasterConfirm ? (
                        <div className="flex items-center gap-2 bg-mokebo-rust/15 border border-mokebo-rust/30 px-3 py-1.5 rounded-xl text-[10px] font-black text-mokebo-rustlight">
                          <span>Wirklich alle löschen?</span>
                          <button 
                            onClick={() => {
                              setMasterPrices([]);
                              syncToLocal([], null);
                              setShowClearMasterConfirm(false);
                            }}
                            className="bg-mokebo-rust text-white px-2.5 py-1 rounded-lg hover:bg-mokebo-dark transition-all font-black"
                          >
                            JA
                          </button>
                          <button 
                            onClick={() => setShowClearMasterConfirm(false)}
                            className="bg-mokebo-surface border border-mokebo-border text-mokebo-muted px-2 py-1 rounded-lg hover:bg-white/5 transition-all font-black"
                          >
                            NEIN
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setShowClearMasterConfirm(true)}
                          className="flex items-center gap-2 text-[10px] font-black text-mokebo-muted hover:text-mokebo-rustlight transition-all px-3 py-2 rounded-xl hover:bg-mokebo-rust/15 border border-transparent hover:border-mokebo-rust/30"
                        >
                          <Trash2 size={14} />
                          ALLE LÖSCHEN
                        </button>
                      )
                    )}
                    <button 
                      onClick={() => masterRef.current?.click()}
                      className="flex items-center gap-2 bg-mokebo-green text-white text-xs font-bold px-5 py-2.5 rounded-xl hover:bg-mokebo-dark transition-all shadow-lg shadow-black/30"
                    >
                      <FileUp size={14} />
                      IMPORTIEREN
                      <input type="file" ref={masterRef} accept=".xlsx,.xls,.csv" className="hidden" onChange={handleMasterUpload} />
                    </button>
                  </div>
                </div>
                
                {masterPrices.length === 0 ? (
                  <div className="py-32 text-center">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Database size={40} className="text-mokebo-muted" />
                    </div>
                    <p className="font-bold text-mokebo-muted max-w-xs mx-auto">Importiere eine Liste mit SKUs und EK-Preisen oder füge Einträge manuell hinzu.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="text-[10px] uppercase font-black text-mokebo-muted border-b border-mokebo-border/50 bg-white/5 tracking-widest">
                          <th className="py-5 px-8">INTERNE SKU</th>
                          <th className="py-5 px-4">ALIASES (RECHNUNGS-NAMEN)</th>
                          <th className="py-5 px-4 text-right">EK-PREIS</th>
                          <th className="py-5 px-8 text-right">AKTIONEN</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {masterPrices
                          .filter(p => 
                            p.sku.toLowerCase().includes(masterSearch.toLowerCase()) ||
                            p.aliases?.some(a => a.toLowerCase().includes(masterSearch.toLowerCase()))
                          )
                          .map(p => (
                            <tr key={p.id} className="group hover:bg-white/5 transition-colors">
                              <td className="py-5 px-8">
                                <div className="font-mono font-black text-xs text-mokebo-mint bg-mokebo-mint/15 px-2 py-1 rounded-md inline-block">
                                  {p.sku}
                                </div>
                              </td>
                              <td className="py-5 px-4">
                                <div className="flex flex-wrap gap-1.5">
                                  {p.aliases && p.aliases.length > 0 ? (
                                    p.aliases.map((alias, idx) => (
                                      <span key={idx} className="text-[9px] font-bold text-mokebo-muted bg-mokebo-surface2 px-2 py-0.5 rounded-full">
                                        {alias}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-[10px] text-mokebo-muted italic">Keine Aliases</span>
                                  )}
                                  <button 
                                    onClick={() => setEditingMaster(p)}
                                    className="text-[9px] font-black text-mokebo-mint hover:text-mokebo-mint uppercase tracking-widest ml-1"
                                  >
                                    + Alias
                                  </button>
                                </div>
                              </td>
                              <td className="py-5 px-4 text-right">
                                <div className="font-mono font-black text-sm text-mokebo-fg">{fmtEur(p.ek)} €</div>
                                {p.discount !== undefined && p.discount > 0 && (
                                  <div className="text-[9px] font-bold text-emerald-600">-{p.discount}% Rabatt</div>
                                )}
                              </td>
                              <td className="py-5 px-8 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button 
                                    onClick={() => setEditingMaster(p)}
                                    className="p-2 text-mokebo-muted hover:text-mokebo-mint hover:bg-mokebo-mint/15 rounded-lg transition-all"
                                    title="Bearbeiten"
                                  >
                                    <RefreshCw size={14} />
                                  </button>
                                  <button 
                                    onClick={() => deleteMasterEntry(p.id)}
                                    className="p-2 text-mokebo-muted hover:text-mokebo-rustlight hover:bg-mokebo-rust/15 rounded-lg transition-all"
                                    title="Löschen"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ══ AUDIT VIEW ════════════════════════════════════════════════════ */}
          {view === 'audit' && (
            <motion.div 
              key="audit"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
            >
              {/* Linke Seite: Tabelle */}
              <div className="lg:col-span-8 space-y-6">
                <div className="bg-mokebo-surface border border-mokebo-border rounded-3xl shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between gap-4 px-8 py-6 border-b border-mokebo-border/50 bg-white/5">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mokebo-muted" />
                        <input 
                          type="text" 
                          placeholder="SKU oder Auftrag..." 
                          value={auditSearch}
                          onChange={e => setAuditSearch(e.target.value)}
                          className="pl-9 pr-4 py-2 border border-mokebo-border rounded-xl text-[10px] font-black outline-none focus:ring-2 focus:ring-mokebo-mint/20 w-40 bg-mokebo-surface2 text-mokebo-fg placeholder:text-mokebo-muted"
                        />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-mokebo-muted">
                        {visibleItems.length} / {items.length} POSITIONEN {fileName && <span className="opacity-40 ml-2">· {fileName}</span>}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-mokebo-border">
                        <div className="flex items-center gap-2 px-3">
                          <Calendar size={12} className="text-mokebo-muted" />
                          <input 
                            type="date" 
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="text-[10px] font-black bg-transparent outline-none text-mokebo-muted cursor-pointer text-mokebo-fg placeholder:text-mokebo-muted"
                          />
                          <span className="text-mokebo-muted text-[10px] font-black">—</span>
                          <input 
                            type="date" 
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="text-[10px] font-black bg-transparent outline-none text-mokebo-muted cursor-pointer text-mokebo-fg placeholder:text-mokebo-muted"
                          />
                        </div>
                        {(startDate || endDate) && (
                          <button 
                            onClick={() => { setStartDate(''); setEndDate(''); }}
                            className="px-2 py-1 text-[10px] font-black text-mokebo-rustlight hover:bg-mokebo-rust/15 rounded-lg transition-colors mr-1"
                          >
                            RESET
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setFilterErrors(!filterErrors)}
                          className={`flex items-center gap-2 text-[10px] font-black px-4 py-2 rounded-xl border transition-all ${filterErrors ? 'bg-mokebo-rust text-white border-mokebo-rust shadow-lg shadow-mokebo-rust/20' : 'bg-mokebo-surface text-mokebo-muted border-mokebo-border hover:border-mokebo-border'}`}
                        >
                          <Filter size={12} strokeWidth={3} />
                          NUR FEHLER
                          {analysis.errors > 0 && (
                            <span className={`ml-1 px-1.5 py-0.5 rounded-md ${filterErrors ? 'bg-mokebo-rust' : 'bg-mokebo-rust/20 text-mokebo-rustlight'}`}>
                              {analysis.errors}
                            </span>
                          )}
                        </button>
                        {items.length > 0 && (
                          <button 
                            onClick={() => setItems([])}
                            className="flex items-center gap-2 text-[10px] font-black px-4 py-2 rounded-xl border border-mokebo-border text-mokebo-muted hover:text-mokebo-rustlight hover:border-mokebo-rust/30 transition-all"
                            title="Liste leeren"
                          >
                            <Trash2 size={12} />
                            LEEREN
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    {items.length === 0 ? (
                      <div className="py-32 flex flex-col items-center gap-6 text-center">
                        <div className="w-24 h-24 bg-white/5 rounded-3xl flex items-center justify-center text-white/80">
                          <FileUp size={48} />
                        </div>
                        <div className="space-y-2">
                          <p className="font-black text-xl tracking-tight">Audit starten</p>
                          <p className="text-sm text-mokebo-muted max-w-xs mx-auto">Lade eine Hersteller-Rechnung hoch, um Preise und Rabatte automatisch zu prüfen.</p>
                        </div>
                        <button 
                          onClick={() => fileRef.current?.click()}
                          className="bg-mokebo-green text-white text-xs font-bold px-8 py-4 rounded-2xl hover:bg-mokebo-dark transition-all shadow-xl shadow-black/30"
                        >
                          DATEI AUSWÄHLEN
                        </button>
                      </div>
                    ) : (
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="text-[10px] uppercase font-black text-mokebo-muted border-b border-mokebo-border/50 bg-white/5 tracking-widest">
                            <th className="py-5 px-8">AUFTRAG / DATUM</th>
                            <th className="py-5 px-4">SKU</th>
                            <th className="py-5 px-4 text-center">MENGE</th>
                            <th className="py-5 px-4 text-right">EK/STK</th>
                            <th className="py-5 px-4 text-center">RABATT</th>
                            <th className="py-5 px-4 text-right bg-mokebo-mint/15 text-mokebo-mint">SOLL (€)</th>
                            <th className="py-5 px-4 text-right bg-white/5">IST (€)</th>
                            <th className="py-5 px-8 text-right">DIFF.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {visibleItems.map(item => (
                            <tr key={item.id} className={`group transition-colors ${item.hasError ? 'bg-mokebo-rust/15' : 'hover:bg-white/5'} ${item.isSpecialItem ? 'opacity-40 grayscale-[0.5]' : ''} ${(item as any).notAuditable ? 'bg-white/5' : ''}`}>
                              <td className="py-5 px-8">
                                <div className="font-mono text-xs font-bold text-mokebo-fg">
                                  {item.auftragId || '–'}
                                  {item.bagRg && <span className="text-[9px] text-mokebo-muted font-normal ml-2 opacity-70">RG: {item.bagRg}</span>}
                                </div>
                                <div className="text-[10px] text-mokebo-muted font-medium mt-1 flex items-center gap-1">
                                  <Calendar size={10} />
                                  {fmtDate(item.date)}
                                </div>
                              </td>
                              <td className="py-5 px-4">
                                <div className="font-mono font-black text-xs text-mokebo-fg">{item.sku}</div>
                                {(item as any).notAuditable && (
                                  <div className="text-[8px] font-black text-amber-500 uppercase tracking-tighter mt-1 bg-amber-500/15 px-1.5 py-0.5 rounded inline-block border border-amber-500/30">
                                    Keine Stammpreis-Zuordnung
                                  </div>
                                )}
                                {item.isSpecialItem && (
                                  <div className="text-[8px] font-black text-mokebo-muted uppercase tracking-tighter mt-1 bg-mokebo-surface2 px-1.5 py-0.5 rounded inline-block">
                                    Gutschrift / GWL
                                  </div>
                                )}
                              </td>
                              <td className="py-5 px-4 text-center">
                                <span className={`font-mono font-black text-sm ${item.menge < 0 ? 'text-mokebo-rustlight' : 'text-mokebo-fg'}`}>
                                  {item.menge}
                                </span>
                              </td>
                              <td className="py-5 px-4 text-right font-mono text-xs text-mokebo-fg">{fmtEur(item.einzelpreis)}</td>
                              <td className="py-5 px-4 text-center">
                                {item.rabatt && item.rabatt > 0 ? (
                                  <span className="text-[10px] font-black text-mokebo-mint bg-mokebo-mint/15 border border-mokebo-mint/30 px-2.5 py-1 rounded-lg">
                                    -{item.rabatt}%
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-mokebo-muted">—</span>
                                )}
                              </td>
                              <td className="py-5 px-4 text-right bg-mokebo-mint/15">
                                <span className="font-mono font-black text-mokebo-mint text-sm">{fmtEur(item.sollWert || 0)}</span>
                              </td>
                              <td className="py-5 px-4 text-right bg-white/5">
                                <span className={`font-mono font-black text-sm ${item.hasError ? 'text-mokebo-rustlight' : 'text-mokebo-fg'}`}>
                                  {fmtEur(item.istWert)}
                                </span>
                              </td>
                              <td className="py-5 px-8 text-right">
                                <span className={`font-mono text-[11px] font-black px-3 py-1.5 rounded-xl ${Math.abs(item.diff || 0) <= 0.01 ? 'bg-mokebo-surface2 text-mokebo-fg' : (item.diff || 0) > 0 ? 'bg-mokebo-rust/20 text-mokebo-rustlight' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                  {(item.diff || 0) > 0 ? '+' : ''}{fmtEur(item.diff || 0)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>

              {/* Rechte Seite: Sidebar */}
              <div className="lg:col-span-4 space-y-6">
                {/* Bilanz-Card */}
                <div className="bg-mokebo-surface border border-mokebo-border rounded-3xl shadow-sm p-8">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-mokebo-muted mb-6 flex items-center gap-2">
                    <TrendingUp size={14} className="text-mokebo-mint" /> BILANZ ÜBERSICHT
                  </h3>
                  
                  <div className="space-y-5">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-mokebo-muted">Soll (Erwartet)</span>
                      <span className="font-mono font-black text-mokebo-mint">{fmtEur(analysis.totalSoll)} €</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-mokebo-muted">Ist (Rechnung)</span>
                      <span className="font-mono font-black text-mokebo-fg">{fmtEur(analysis.totalIst)} €</span>
                    </div>
                    
                    <div className="pt-6 mt-2 border-t border-mokebo-border/50">
                      <div className="text-[10px] font-black uppercase text-mokebo-muted tracking-widest mb-2">Differenz</div>
                      <div className={`font-mono text-4xl font-black tracking-tighter ${Math.abs(analysis.diff) <= 0.01 ? 'text-emerald-600' : analysis.diff > 0 ? 'text-mokebo-rustlight' : 'text-emerald-600'}`}>
                        {analysis.diff > 0 ? '+' : ''}{fmtEur(analysis.diff)} €
                      </div>
                    </div>
                  </div>

                  {(analysis.errors > 0 || analysis.retouren > 0 || analysis.missingSkus > 0) && (
                    <div className="mt-8 space-y-3">
                      {analysis.missingSkus > 0 && (
                        <div className="flex items-center gap-3 text-xs font-black text-amber-600 bg-amber-500/15 rounded-2xl px-4 py-3 border border-amber-500/30">
                          <Search size={16} /> {analysis.missingSkus} ohne SKU (nicht prüfbar)
                        </div>
                      )}
                      {analysis.errors > 0 && (
                        <div className="flex items-center gap-3 text-xs font-black text-mokebo-rustlight bg-mokebo-rust/15 rounded-2xl px-4 py-3 border border-mokebo-rust/30">
                          <AlertTriangle size={16} /> {analysis.errors} Preisabweichung{analysis.errors > 1 ? 'en' : ''}
                        </div>
                      )}
                      {analysis.retouren > 0 && (
                        <div className="flex items-center gap-3 text-xs font-black text-mokebo-muted bg-white/5 rounded-2xl px-4 py-3 border border-mokebo-border">
                          <Undo2 size={16} /> {analysis.retouren} Retoure{analysis.retouren > 1 ? 'n' : ''}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Rechnungs-Salden Card */}
                {Object.keys(analysis.invoiceSums || {}).length > 0 && (
                  <div className="bg-mokebo-surface border border-mokebo-border rounded-3xl shadow-sm p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border-mokebo-mint/20">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-mokebo-mint flex items-center gap-2">
                        <FileText size={14} className="text-mokebo-mint" /> RECHNUNGSSUMMEN (AVISEN)
                      </h3>
                      <button 
                        onClick={downloadInvoiceSumsCsv}
                        className="px-3 py-1.5 text-[10px] font-black text-mokebo-mint hover:text-white hover:bg-mokebo-green bg-mokebo-mint/15 border border-mokebo-mint/30 rounded-xl transition-all flex items-center gap-1.5"
                        title="Rechnungssummen als CSV herunterladen"
                      >
                        <Download size={12} /> HERUNTERLADEN
                      </button>
                    </div>
                    <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
                      {Object.entries(analysis.invoiceSums as Record<string, { sum: number, count: number }>).map(([rgNum, info]) => (
                        <div key={rgNum} className="flex justify-between items-center py-2.5 border-b border-mokebo-border/50 last:border-0 hover:bg-white/5 rounded-lg px-2 -mx-2 transition-colors">
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-mokebo-fg">RG {rgNum || 'Ohne Nr.'}</span>
                            <span className="text-[9px] text-mokebo-muted font-bold uppercase tracking-wider">{info.count} Position{info.count > 1 ? 'en' : ''}</span>
                          </div>
                          <span className="font-mono text-sm font-black text-mokebo-fg bg-white/5 border border-mokebo-border px-3 py-1 rounded-xl">
                            {fmtEur(info.sum)} €
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Monats-Stats */}
                {sortedMonths.length > 0 && (
                  <div className="bg-mokebo-surface border border-mokebo-border rounded-3xl shadow-sm p-8">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-mokebo-muted mb-6 flex items-center gap-2">
                      <Calendar size={14} className="text-mokebo-muted" /> MONATS-VERTEILUNG
                    </h3>
                    <div className="space-y-4">
                      {sortedMonths.map(month => (
                        <div key={month} className="group">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-black text-mokebo-muted">{month}</span>
                            <span className="font-mono text-xs font-black text-mokebo-fg">{fmtEur(analysis.monthly[month].sum)} €</span>
                          </div>
                          <div className="relative h-2 bg-white/5 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${(analysis.monthly[month].sum / (analysis.totalIst || 1)) * 100}%` }}
                              className="absolute h-full bg-mokebo-green rounded-full"
                            />
                          </div>
                          <div className="flex justify-between mt-1.5">
                            <span className="text-[9px] font-black text-mokebo-muted uppercase tracking-widest">{analysis.monthly[month].count} POS.</span>
                            {analysis.monthly[month].retouren > 0 && (
                              <span className="text-[9px] font-black text-mokebo-rustlight uppercase tracking-widest">{analysis.monthly[month].retouren} RET.</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick Actions */}
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => window.print()}
                    className="flex flex-col items-center justify-center gap-3 bg-mokebo-surface border border-mokebo-border text-mokebo-muted py-6 rounded-3xl text-xs font-black hover:bg-white/5 active:scale-95 transition-all shadow-sm"
                  >
                    <Printer size={20} />
                    DRUCKEN
                  </button>
                  <button 
                    onClick={exportToCSV}
                    disabled={visibleItems.length === 0}
                    className="flex flex-col items-center justify-center gap-3 bg-mokebo-green text-white py-6 rounded-3xl text-xs font-black hover:bg-mokebo-dark active:scale-95 transition-all shadow-xl shadow-black/30 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Download size={20} />
                    EXPORT
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ══ EDIT MASTER MODAL ══════════════════════════════════════════════ */}
        <AnimatePresence>
          {editingMaster && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setEditingMaster(null)}
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-mokebo-surface w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
              >
                <div className="px-8 py-6 border-b border-mokebo-border/50 flex items-center justify-between bg-white/5">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-mokebo-green text-white rounded-xl">
                      <Database size={20} />
                    </div>
                    <div>
                      <h2 className="font-black text-lg tracking-tight">Eintrag bearbeiten</h2>
                      <p className="text-[10px] text-mokebo-muted font-bold uppercase tracking-widest">Stammdaten & Aliases</p>
                    </div>
                  </div>
                  <button onClick={() => setEditingMaster(null)} className="text-mokebo-muted hover:text-mokebo-muted transition-colors">
                    <X size={24} />
                  </button>
                </div>

                <div className="p-8 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-mokebo-muted">Interne SKU</label>
                      <input 
                        type="text" 
                        value={editingMaster.sku}
                        onChange={e => setEditingMaster({...editingMaster, sku: e.target.value})}
                        className="w-full px-4 py-3 border border-mokebo-border rounded-2xl text-sm font-bold bg-white/5 outline-none focus:ring-4 focus:ring-mokebo-mint/15 transition-all font-mono text-mokebo-fg placeholder:text-mokebo-muted"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-mokebo-muted">EK-Preis (€)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={editingMaster.ek}
                        onChange={e => setEditingMaster({...editingMaster, ek: parseNum(e.target.value)})}
                        className="w-full px-4 py-3 border border-mokebo-border rounded-2xl text-sm font-bold bg-white/5 outline-none focus:ring-4 focus:ring-mokebo-mint/15 transition-all font-mono text-mokebo-fg placeholder:text-mokebo-muted"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-mokebo-muted">Aliases (Alternative Namen in Rechnungen)</label>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                      {(editingMaster.aliases || []).map((alias, idx) => (
                        <div key={idx} className="flex items-center gap-2 group">
                          <input 
                            type="text" 
                            value={alias}
                            onChange={e => {
                              const newAliases = [...(editingMaster.aliases || [])];
                              newAliases[idx] = e.target.value;
                              setEditingMaster({...editingMaster, aliases: newAliases});
                            }}
                            className="flex-1 px-4 py-2 border border-mokebo-border rounded-xl text-xs font-bold bg-white/5 outline-none focus:ring-2 focus:ring-mokebo-mint/20 transition-all font-mono text-mokebo-fg placeholder:text-mokebo-muted"
                          />
                          <button 
                            onClick={() => {
                              const newAliases = (editingMaster.aliases || []).filter((_, i) => i !== idx);
                              setEditingMaster({...editingMaster, aliases: newAliases});
                            }}
                            className="p-2 text-mokebo-muted hover:text-mokebo-rustlight transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button 
                      onClick={() => setEditingMaster({...editingMaster, aliases: [...(editingMaster.aliases || []), '']})}
                      className="w-full py-3 border border-dashed border-mokebo-border rounded-2xl text-[10px] font-black text-mokebo-muted hover:text-mokebo-mint hover:border-mokebo-mint/40 transition-all uppercase tracking-widest"
                    >
                      + Alias hinzufügen
                    </button>
                  </div>
                </div>

                <div className="px-8 py-6 bg-white/5 border-t border-mokebo-border/50 flex justify-end gap-3">
                  <button 
                    onClick={() => setEditingMaster(null)}
                    className="px-6 py-3 text-xs font-bold text-mokebo-muted hover:text-mokebo-muted transition-colors"
                  >
                    Abbrechen
                  </button>
                  <button 
                    onClick={() => saveMasterEntry(editingMaster)}
                    className="px-8 py-3 bg-mokebo-green text-white text-xs font-bold rounded-2xl hover:bg-mokebo-dark transition-all shadow-xl shadow-black/30"
                  >
                    Änderungen speichern
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ══ MAPPING MODAL ══════════════════════════════════════════════════ */}
        <AnimatePresence>
          {isMappingOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMappingOpen(false)}
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-mokebo-surface w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
              >
                <div className="px-8 py-6 border-b border-mokebo-border/50 flex items-center justify-between bg-white/5 flex-shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-mokebo-green text-white rounded-xl">
                      <FileText size={20} />
                    </div>
                    <div>
                      <h2 className="font-black text-lg tracking-tight">Spalten-Mapping</h2>
                      <p className="text-[10px] text-mokebo-muted font-bold uppercase tracking-widest">Mapping für {mappingType === 'master' ? 'Stammdaten' : 'Rechnung'}</p>
                    </div>
                  </div>
                  <button onClick={() => setIsMappingOpen(false)} className="text-mokebo-muted hover:text-mokebo-muted transition-colors">
                    <X size={24} />
                  </button>
                </div>

                <div className="p-8 space-y-8 overflow-y-auto flex-1">
                  {/* Select Row containing titles */}
                  <div className="p-5 border border-mokebo-mint/30 rounded-2xl bg-mokebo-mint/15 space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-mokebo-mint flex items-center gap-1.5">
                      <Info size={12} /> Zeile mit Spaltenbezeichnungen wählen
                    </label>
                    <select
                      value={headerRowIdx}
                      onChange={e => {
                        const newIdx = Number(e.target.value);
                        setHeaderRowIdx(newIdx);
                        const row = rawRows[newIdx] || [];
                        if (mappingType === 'master') {
                          setMasterMapping(guessMasterMapping(row));
                        } else {
                          setInvoiceMapping(guessInvoiceMapping(row));
                        }
                      }}
                      className="w-full px-4 py-3 border border-mokebo-mint/30 rounded-xl text-sm font-bold bg-mokebo-surface outline-none focus:ring-4 focus:ring-mokebo-mint/20 transition-all text-mokebo-muted"
                    >
                      {rawRows.slice(0, 10).map((row, idx) => (
                        <option key={idx} value={idx}>
                          Zeile {idx + 1}: {row.slice(0, 5).map(c => c || '(Leer)').join(' | ')}...
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-mokebo-muted font-medium">Zeilen vor dieser Zeile werden beim Daten-Import ignoriert. Zeilen danach enthalten die eigentlichen Produkte.</p>
                  </div>

                  {/* Preview */}
                  <div className="space-y-3">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-mokebo-muted">Daten-Vorschau (Spaltenbezeichnungen)</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {rawRows[headerRowIdx]?.map((header, idx) => (
                        <div key={idx} className="p-3 border border-mokebo-border rounded-xl bg-white/5">
                          <div className="text-[9px] font-black text-mokebo-mint uppercase mb-1">Spalte {String.fromCharCode(65 + idx)}</div>
                          <div className="text-[11px] font-bold text-mokebo-muted truncate">{header || `(Leer)`}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Selectors */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {mappingType === 'master' ? (
                      <>
                        <div className="space-y-2">
                          <label className="block text-[10px] font-black uppercase tracking-widest text-mokebo-muted">Spalte: SKU / Artikelnummer</label>
                          <select 
                            value={masterMapping.skuIdx}
                            onChange={e => setMasterMapping(m => ({...m, skuIdx: Number(e.target.value)}))}
                            className="w-full px-4 py-3 border border-mokebo-border rounded-2xl text-sm font-bold bg-white/5 outline-none focus:ring-4 focus:ring-mokebo-mint/15 transition-all"
                          >
                            {rawRows[headerRowIdx]?.map((h, i) => <option key={i} value={i}>Spalte {String.fromCharCode(65 + i)}: {h || `(Leer)`}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-[10px] font-black uppercase tracking-widest text-mokebo-muted">Spalte: Rabatt (%)</label>
                          <select 
                            value={masterMapping.discountIdx}
                            onChange={e => setMasterMapping(m => ({...m, discountIdx: Number(e.target.value)}))}
                            className="w-full px-4 py-3 border border-mokebo-border rounded-2xl text-sm font-bold bg-white/5 outline-none focus:ring-4 focus:ring-mokebo-mint/15 transition-all"
                          >
                            <option value={-1}>Nicht vorhanden</option>
                            {rawRows[headerRowIdx]?.map((h, i) => <option key={i} value={i}>Spalte {String.fromCharCode(65 + i)}: {h || `(Leer)`}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-[10px] font-black uppercase tracking-widest text-mokebo-muted">Spalte: Preis (Netto)</label>
                          <select 
                            value={masterMapping.priceIdx}
                            onChange={e => setMasterMapping(m => ({...m, priceIdx: Number(e.target.value)}))}
                            className="w-full px-4 py-3 border border-mokebo-border rounded-2xl text-sm font-bold bg-white/5 outline-none focus:ring-4 focus:ring-mokebo-mint/15 transition-all"
                          >
                            {rawRows[headerRowIdx]?.map((h, i) => <option key={i} value={i}>Spalte {String.fromCharCode(65 + i)}: {h || `(Leer)`}</option>)}
                          </select>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <label className="block text-[10px] font-black uppercase tracking-widest text-mokebo-muted">Spalte: Rechnungs-Nr.</label>
                          <select 
                            value={invoiceMapping.bagRgIdx}
                            onChange={e => setInvoiceMapping(m => ({...m, bagRgIdx: Number(e.target.value)}))}
                            className="w-full px-4 py-3 border border-mokebo-border rounded-2xl text-sm font-bold bg-white/5 outline-none focus:ring-4 focus:ring-mokebo-mint/15 transition-all"
                          >
                            {rawRows[headerRowIdx]?.map((h, i) => <option key={i} value={i}>Spalte {String.fromCharCode(65 + i)}: {h || `(Leer)`}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-[10px] font-black uppercase tracking-widest text-mokebo-muted">Spalte: Auftrag-ID</label>
                          <select 
                            value={invoiceMapping.auftragIdIdx}
                            onChange={e => setInvoiceMapping(m => ({...m, auftragIdIdx: Number(e.target.value)}))}
                            className="w-full px-4 py-3 border border-mokebo-border rounded-2xl text-sm font-bold bg-white/5 outline-none focus:ring-4 focus:ring-mokebo-mint/15 transition-all"
                          >
                            {rawRows[headerRowIdx]?.map((h, i) => <option key={i} value={i}>Spalte {String.fromCharCode(65 + i)}: {h || `(Leer)`}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-[10px] font-black uppercase tracking-widest text-mokebo-muted">Spalte: Datum</label>
                          <select 
                            value={invoiceMapping.dateIdx}
                            onChange={e => setInvoiceMapping(m => ({...m, dateIdx: Number(e.target.value)}))}
                            className="w-full px-4 py-3 border border-mokebo-border rounded-2xl text-sm font-bold bg-white/5 outline-none focus:ring-4 focus:ring-mokebo-mint/15 transition-all"
                          >
                            {rawRows[headerRowIdx]?.map((h, i) => <option key={i} value={i}>Spalte {String.fromCharCode(65 + i)}: {h || `(Leer)`}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-[10px] font-black uppercase tracking-widest text-mokebo-muted">Spalte: SKU</label>
                          <select 
                            value={invoiceMapping.skuIdx}
                            onChange={e => setInvoiceMapping(m => ({...m, skuIdx: Number(e.target.value)}))}
                            className="w-full px-4 py-3 border border-mokebo-border rounded-2xl text-sm font-bold bg-white/5 outline-none focus:ring-4 focus:ring-mokebo-mint/15 transition-all"
                          >
                            {rawRows[headerRowIdx]?.map((h, i) => <option key={i} value={i}>Spalte {String.fromCharCode(65 + i)}: {h || `(Leer)`}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-[10px] font-black uppercase tracking-widest text-mokebo-muted">Spalte: Menge</label>
                          <select 
                            value={invoiceMapping.mengeIdx}
                            onChange={e => setInvoiceMapping(m => ({...m, mengeIdx: Number(e.target.value)}))}
                            className="w-full px-4 py-3 border border-mokebo-border rounded-2xl text-sm font-bold bg-white/5 outline-none focus:ring-4 focus:ring-mokebo-mint/15 transition-all"
                          >
                            {rawRows[headerRowIdx]?.map((h, i) => <option key={i} value={i}>Spalte {String.fromCharCode(65 + i)}: {h || `(Leer)`}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-[10px] font-black uppercase tracking-widest text-mokebo-muted">Spalte: EK/Stk (Netto)</label>
                          <select 
                            value={invoiceMapping.priceIdx}
                            onChange={e => setInvoiceMapping(m => ({...m, priceIdx: Number(e.target.value)}))}
                            className="w-full px-4 py-3 border border-mokebo-border rounded-2xl text-sm font-bold bg-white/5 outline-none focus:ring-4 focus:ring-mokebo-mint/15 transition-all"
                          >
                            {rawRows[headerRowIdx]?.map((h, i) => <option key={i} value={i}>Spalte {String.fromCharCode(65 + i)}: {h || `(Leer)`}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-[10px] font-black uppercase tracking-widest text-mokebo-muted">Spalte: Gesamt (Ist)</label>
                          <select 
                            value={invoiceMapping.istWertIdx}
                            onChange={e => setInvoiceMapping(m => ({...m, istWertIdx: Number(e.target.value)}))}
                            className="w-full px-4 py-3 border border-mokebo-border rounded-2xl text-sm font-bold bg-white/5 outline-none focus:ring-4 focus:ring-mokebo-mint/15 transition-all"
                          >
                            {rawRows[headerRowIdx]?.map((h, i) => <option key={i} value={i}>Spalte {String.fromCharCode(65 + i)}: {h || `(Leer)`}</option>)}
                          </select>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="px-8 py-6 border-t border-mokebo-border/50 bg-white/5 flex justify-end gap-3 flex-shrink-0">
                  <button 
                    onClick={() => setIsMappingOpen(false)}
                    className="px-6 py-3 text-xs font-bold text-mokebo-muted hover:text-mokebo-muted transition-colors"
                  >
                    Abbrechen
                  </button>
                  <button 
                    onClick={confirmMapping}
                    className="flex items-center gap-2 bg-mokebo-green text-white text-xs font-bold px-8 py-3 rounded-2xl hover:bg-mokebo-dark transition-all shadow-xl shadow-black/30"
                  >
                    Import bestätigen
                    <ChevronRight size={16} />
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ── EXPORT FOOTER FOR LLMs / CLAUDE ── */}
        <footer className="no-print mt-12 mb-6 flex flex-col md:flex-row items-center justify-between gap-4 border-t border-mokebo-border pt-6 text-xs text-mokebo-muted">
          <p>© {new Date().getFullYear()} Magma Auditor. Alle Rechte vorbehalten.</p>
          <div className="flex flex-wrap items-center gap-4">
            <span className="font-semibold text-mokebo-muted">Codebase exportieren:</span>
            <a 
              href="/magma_auditor_all_code.md" 
              download="magma_auditor_all_code.md"
              className="flex items-center gap-1.5 bg-mokebo-mint/15 border border-mokebo-mint/30 hover:bg-mokebo-mint/25 text-mokebo-mint px-3 py-1.5 rounded-xl font-bold transition-all shadow-sm"
            >
              <FileText size={14} />
              Als .md (Für Claude / LLMs)
            </a>
            <a 
              href="/magma_auditor_project.tar.gz" 
              download="magma_auditor_project.tar.gz"
              className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-xl font-bold transition-all shadow-sm"
            >
              <Download size={14} />
              Als .tar.gz (Komplettes Projekt)
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
