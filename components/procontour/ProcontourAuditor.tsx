'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ProcontourMark } from './ProcontourLogo';

// ─── ICONS (inline SVG subset) ──────────────────────────────────────────────
const Icon = ({ d, size = 16, className = '', strokeWidth = 2 }: { d: string | string[], size?: number, className?: string, strokeWidth?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
    {Array.isArray(d) ? d.map((path, i) => <path key={i} d={path} />) : <path d={d} />}
  </svg>
);

const icons: Record<string, string | string[]> = {
  ArrowRightLeft: ["M21 16H3m18 0-4 4m4-4-4-4M3 8h18M3 8l4 4M3 8l4-4"],
  ArrowLeft: ["M19 12H5", "m12 19-7-7 7-7"],
  Upload: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "m17 8-5-5-5 5", "M12 3v12"],
  Trash2: ["M3 6h18", "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6", "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2", "m10 11 0 6", "m14 11 0 6"],
  TrendingUp: ["m22 7-8.5 8.5-5-5L2 17"],
  FileSpreadsheet: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6", "M8 13h2", "M8 17h2", "M14 13h2", "M14 17h2"],
  X: ["M18 6 6 18", "m6 6 12 12"],
  Plus: ["M12 5v14", "M5 12h14"],
  Search: ["M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0"],
  Filter: ["M22 3H2l8 9.46V19l4 2v-8.54L22 3"],
  Save: ["M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z", "M17 21v-8H7v8", "M7 3v5h8"],
  RefreshCw: ["M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8", "M21 3v5h-5", "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16", "M8 16H3v5"],
  CheckCircle: ["M22 11.08V12a10 10 0 1 1-5.93-9.14", "m9 11 3 3L22 4"],
  Cloud: ["M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"],
  Database: ["M12 2a9 3 0 0 1 9 3 9 3 0 0 1-9 3 9 3 0 0 1-9-3 9 3 0 0 1 9-3z", "M3 5v4a9 3 0 0 0 18 0V5", "M3 9v4a9 3 0 0 0 18 0V9", "M3 13v4a9 3 0 0 0 18 0v-4"],
  Settings: ["M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z", "M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"],
  AlertTriangle: ["M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z", "M12 9v4", "M12 17h.01"],
  Tag: ["M12 2H2v10l9.29 9.29a1 1 0 0 0 1.41 0l7.29-7.29a1 1 0 0 0 0-1.41L12 2z", "M7 7h.01"],
  FileUp: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6", "M12 18v-6", "m9 15 3-3 3 3"],
  ChevronRight: ["m9 18 6-6-6-6"],
  Calendar: ["M8 2v4", "M16 2v4", "M3 10h18", "M21 8V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8z"],
  Printer: ["M6 9V2h12v7", "M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2", "M6 14h12v8H6z"],
  Eraser: ["m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21", "M22 21H7", "m5 11 9 9"],
  Info: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "M12 16v-4", "M12 8h.01"],
  ArrowUpRight: ["M7 17 17 7", "M7 7h10v10"],
  Hash: ["M4 9h16", "M4 15h16", "M10 3 8 21", "M16 3l-2 18"],
};

const LI = ({ name, size = 16, className = '' }: { name: string, size?: number, className?: string }) => {
  const d = icons[name];
  if (!d) return null;
  return <Icon d={d} size={size} className={className} />;
};

// ─── UTILS ────────────────────────────────────────────────────────────────────
const cleanString = (str: any) => {
  if (!str) return '';
  return str.toString()
    .replace(/[\u0000-\u001F\u007F-\u009F\u00A0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*\(do not edit\)\s*/gi, '')
    .trim().toLowerCase();
};

const getAlphaNum = (str: any) => cleanString(str).replace(/[^a-z0-9]/g, '');

const parseNumber = (val: any) => {
  if (val === undefined || val === null || val === '') return 0;
  const s = val.toString();
  if (s.includes('#NV') || s.includes('#N/A')) return 0;
  let cleaned = s.replace(/[^\d,.\-]/g, '').trim();
  if (!cleaned) return 0;
  if (cleaned.includes(',') && cleaned.includes('.')) {
    cleaned = cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '');
  } else if (cleaned.includes(',')) {
    cleaned = cleaned.replace(',', '.');
  }
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
};

const parseSafeDate = (dateStr: any) => {
  if (!dateStr) return null;
  const c = dateStr.toString().trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(c)) return c.split('T')[0];
  if (c.includes('.')) {
    const parts = c.split('.');
    if (parts.length === 3) {
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
      return `${y}-${m}-${d}`;
    }
  }
  return null;
};

const fmtEur = (n: number, decimals = 2) =>
  n.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const parseCSV = (text: string) => {
  const delimiter = (text.split('\n')[0].match(/;/g) || []).length >
    (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const lines = text.split(/\r?\n/);
  const rows: string[][] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const row: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === delimiter && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    row.push(current.trim());
    rows.push(row);
  }
  return rows;
};

const getStem = (s: string) => s.split(/[-_.]/)[0];

const findInMaster = (sku: string, masterPrices: any[]) => {
  if (!sku || !masterPrices.length) return null;
  const invClean = cleanString(sku);
  if (!invClean) return null;
  
  const invAlpha = getAlphaNum(sku);

  // 1. Exact match (cleaned)
  let match = masterPrices.find(p => cleanString(p.sku) === invClean);
  if (match) return match;

  // 2. Alphanumeric match
  match = masterPrices.find(p => getAlphaNum(p.sku) === invAlpha);
  if (match) return match;

  // 3. Stem match
  const invStem = getStem(invClean);
  if (invStem.length > 3) {
    match = masterPrices.find(p => getStem(cleanString(p.sku)) === invStem);
    if (match) return match;
  }

  // 4. Partial match (more robust)
  match = masterPrices.find(p => {
    const mc = cleanString(p.sku);
    if (mc.length < 3 || invClean.length < 3) return false;
    return invClean.includes(mc) || mc.includes(invClean);
  });
  
  return match || null;
};

const calcBrutto = (netto: number, rabatt: number) => {
  return netto * (1 - (rabatt / 100));
};

const extractInvoiceNumberFromFilename = (filename: string) => {
  if (!filename) return '';
  const base = filename.replace(/\.[^/.]+$/, ''); // strip extension
  const digitMatch = base.match(/\d{4,}/); // prefer a long digit run, e.g. 1604869
  if (digitMatch) return digitMatch[0];
  return base.trim();
};

const newItem = (overrides = {}) => ({
  id: Date.now() + Math.random(),
  orderId: '',
  description: '',
  date: new Date().toISOString().split('T')[0],
  quantity: 1,
  discount: 0,
  expectedPrice: 0,
  actualPrice: 0,
  ...overrides,
});

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function App() {
  const [masterPrices, setMasterPrices] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [itemsDeleteConfirm, setItemsDeleteConfirm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [view, setView] = useState('reconcile');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddSku, setShowAddSku] = useState(false);
  const [newSkuData, setNewSkuData] = useState({ sku: '', price: '', discount: '0', clearance: '0' });
  const [filterErrors, setFilterErrors] = useState(false);
  const [metadata, setMetadata] = useState<any>({
    supplierName: '',
    invoiceNumber: '',
    poNumber: '',
    invoiceDate: new Date().toISOString().split('T')[0],
  });

  const [importState, setImportState] = useState<any>({ open: false, type: null, rows: [], mapping: {} });

  const invoiceRef = useRef<HTMLInputElement>(null);
  const masterRef = useRef<HTMLInputElement>(null);
  const discountRef = useRef<HTMLInputElement>(null);

  // Load from localStorage on init
  useEffect(() => {
    const savedMaster = localStorage.getItem('procontour_master');
    if (savedMaster) setMasterPrices(JSON.parse(savedMaster));
    
    const savedDraft = localStorage.getItem('procontour_draft');
    if (savedDraft) {
      const { items: i, metadata: m } = JSON.parse(savedDraft);
      if (i) setItems(i);
      if (m) setMetadata(m);
    }
  }, []);

  // Save master to localStorage
  useEffect(() => {
    if (masterPrices.length > 0) {
      localStorage.setItem('procontour_master', JSON.stringify(masterPrices));
    }
  }, [masterPrices]);

  // Auto-save draft
  useEffect(() => {
    if (items.length > 0 || metadata.supplierName || metadata.invoiceNumber) {
      localStorage.setItem('procontour_draft', JSON.stringify({ items, metadata }));
    }
  }, [items, metadata]);

  const reMatchItems = () => {
    if (masterPrices.length > 0 && items.length > 0) {
      setItems(prev => prev.map(item => {
        const match = findInMaster(item.description, masterPrices);
        if (match) {
          return {
            ...item,
            expectedPrice: match.price,
            discount: match.defaultDiscount || 0
          };
        }
        return item;
      }));
      showToast('Preise aktualisiert');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const uploadedFileName = file.name;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      if (rows.length < 2) return;

      // Smart Header Discovery: Find the first row containing SKU-like and price-like keywords
      let headerRowIndex = 0;
      for (let r = 0; r < Math.min(rows.length, 10); r++) {
        const rowLower = rows[r].map(c => c.toLowerCase().trim());
        const hasSku = rowLower.some(c => c.includes('sku') || c.includes('artikel') || c.includes('part') || c.includes('item'));
        const hasPriceOrDisc = rowLower.some(c => 
          c.includes('preis') || c.includes('price') || c.includes('netto') || c.includes('betrag') || c.includes('€') ||
          c.includes('rabatt') || c.includes('discount') || c.includes('%')
        );
        if (hasSku && hasPriceOrDisc) {
          headerRowIndex = r;
          break;
        }
      }

      const headers = rows[headerRowIndex].map(h => h.toLowerCase().trim());
      const mapping = { key: 0, price: -1, discount: -1, orderId: -1, date: -1, quantity: -1 };
      
      headers.forEach((h, i) => {
        // 1. SKU / Key
        if (h.includes('sku') || h.includes('artikel') || h.includes('part') || h === 'nr' || h === 'no' || h.includes('item') || h.includes('prod')) {
          mapping.key = i;
        }
        // 2. Quantity
        if (
          h.includes('menge') || 
          h.includes('qty') || 
          h.includes('quantity') || 
          h.includes('anzahl') || 
          h.includes('stk') || 
          h.includes('stück') || 
          h.includes('stueck') || 
          h.includes('anz') || 
          h.includes('pcs') || 
          h.includes('pieces') || 
          h.includes('count') || 
          h.includes('cnt')
        ) {
          if (!h.includes('date') && !h.includes('datum') && !h.includes('order') && !h.includes('bestell')) {
            mapping.quantity = i;
          }
        }
        // 3. Price
        if (h.includes('preis') || h.includes('netto') || h.includes('price') || h.includes('€') || h.includes('betrag') || h.includes('soll') || h.includes('ist')) {
          if (!h.includes('rabatt') && !h.includes('discount') && !h.includes('%')) {
            mapping.price = i;
          }
        }
        // 4. Discount
        if (h.includes('rabatt') || h.includes('discount') || h.includes('%')) {
          mapping.discount = i;
        }
        // 5. Order ID
        if (h.includes('auftrag') || h.includes('order') || h.includes('po') || h.includes('bestell')) {
          if (!h.includes('qty') && !h.includes('menge') && !h.includes('quantity')) {
            mapping.orderId = i;
          }
        }
        // 6. Date
        if (h.includes('datum') || h.includes('date')) {
          mapping.date = i;
        }
      });

      // Fallbacks if smart mapping failed
      if (type === 'master') {
        if (mapping.price === -1) mapping.price = 1;
      } else if (type === 'discount') {
        if (mapping.discount === -1) mapping.discount = rows[headerRowIndex].length > 2 ? 2 : 1;
      } else {
        if (mapping.orderId === -1) mapping.orderId = 0;
        if (mapping.key === -1) mapping.key = 1;
        if (mapping.price === -1) mapping.price = 2;
        if (mapping.date === -1) mapping.date = 3;
      }

      setImportState({ open: true, type, rows, mapping, discountType: 'standard', headerRowIndex, fileName: uploadedFileName });
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const confirmImport = () => {
    const { type, rows, mapping, headerRowIndex, fileName } = importState;
    const dataRows = rows.slice((headerRowIndex || 0) + 1).filter((r: string[]) => r.some(c => c.trim()));

    if (type === 'master') {
      const newMaster = dataRows
        .map((row: string[], i: number) => ({
          id: Date.now() + i,
          sku: (row[mapping.key] || '').trim(),
          price: parseNumber(row[mapping.price]),
          defaultDiscount: mapping.discount >= 0 ? parseNumber(row[mapping.discount]) : 0,
          clearanceDiscount: 0, // Master import defaults to standard discount
        }))
        .filter((p: any) => p.sku.length > 1 && p.price > 0 && p.sku.toUpperCase() !== 'SKU');
      setMasterPrices(newMaster);
    } else if (type === 'discount') {
      const updated = masterPrices.map(p => {
        const row = dataRows.find((r: string[]) => {
          const rSku = (r[mapping.key] || '').trim();
          return cleanString(rSku) === cleanString(p.sku) || getAlphaNum(rSku) === getAlphaNum(p.sku);
        });
        if (row) {
          const val = parseNumber(row[mapping.discount]);
          return importState.discountType === 'clearance'
            ? { ...p, clearanceDiscount: val }
            : { ...p, defaultDiscount: val };
        }
        return p;
      });
      setMasterPrices(updated);
    } else {
      // Extract metadata from all rows (e.g. invoice number at the bottom)
      const newMetadata = { ...metadata };
      // The invoice number is unreliable inside the CSV content but always
      // present in the uploaded file's name, so that wins.
      const fileInvoiceNumber = extractInvoiceNumberFromFilename(fileName || '');
      if (fileInvoiceNumber) newMetadata.invoiceNumber = fileInvoiceNumber;
      rows.forEach((row: string[]) => {
        row.forEach((cell: string, i: number) => {
          const lower = cell.toLowerCase().trim();
          if (lower.includes('rechnungsnummer') || lower.includes('re.-nr.') || lower.includes('invoice no')) {
            let val = row[i + 1] ? row[i + 1].trim() : cell.replace(/rechnungsnummer|re\.-nr\.|invoice no|[:\s]/gi, '').trim();
            if (val) newMetadata.invoiceNumber = val;
          }
          if (lower.includes('rechnungsdatum') || lower.includes('re.-datum') || lower.includes('invoice date')) {
            let val = row[i + 1] ? row[i + 1].trim() : cell.replace(/rechnungsdatum|re\.-datum|invoice date|[:\s]/gi, '').trim();
            const d = parseSafeDate(val);
            if (d) newMetadata.invoiceDate = d;
          }
          if (lower.includes('lieferant') || lower.includes('supplier')) {
            let val = row[i + 1] ? row[i + 1].trim() : cell.replace(/lieferant|supplier|[:\s]/gi, '').trim();
            if (val) newMetadata.supplierName = val;
          }
          if (lower.includes('po-nummer') || lower.includes('po no') || lower.includes('bestellnummer')) {
            let val = row[i + 1] ? row[i + 1].trim() : cell.replace(/po-nummer|po no|bestellnummer|[:\s]/gi, '').trim();
            if (val) newMetadata.poNumber = val;
          }
        });
      });
      setMetadata(newMetadata);

      const newItems = dataRows.map((row: string[], i: number) => {
        const sku = (row[mapping.key] || '').trim();
        const match = findInMaster(sku, masterPrices);
        const actualPrice = parseNumber(row[mapping.price]);
        let quantity = mapping.quantity >= 0 ? (parseNumber(row[mapping.quantity]) || 1) : 1;
        
        // Smart quantity detection: if quantity is 1 and we have a match, check if actual price is a multiple
        if (match && match.price > 0 && (mapping.quantity === -1 || !row[mapping.quantity])) {
          const expectedUnit = calcBrutto(match.price, match.defaultDiscount || 0);
          if (expectedUnit > 0) {
            const ratio = actualPrice / expectedUnit;
            // If it's close to an integer (e.g. 2.0, 3.0) and > 1.5
            if (Math.abs(ratio - Math.round(ratio)) < 0.05 && ratio > 1.1) {
              quantity = Math.round(ratio);
            }
          }
        }

        return newItem({
          id: Date.now() + i,
          orderId: mapping.orderId >= 0 ? (row[mapping.orderId] || '').trim() : '',
          description: sku,
          date: (mapping.date >= 0 ? parseSafeDate(row[mapping.date]) : null) || newMetadata.invoiceDate,
          discount: match ? (match.defaultDiscount || 0) : 0,
          expectedPrice: match ? match.price : 0,
          actualPrice: actualPrice,
          quantity: quantity
        });
      }).filter((it: any) => it.description || it.orderId);
      setItems(newItems);
    }
    setImportState((s: any) => ({ ...s, open: false }));
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const updateItem = (id: number, field: string, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      if (field === 'description') {
        const match = findInMaster(value, masterPrices);
        if (match) {
          updated.expectedPrice = match.price;
          updated.discount = match.defaultDiscount || 0;
        }
      }
      return updated;
    }));
  };

  const analysis = useMemo(() => {
    const monthly: Record<string, { count: number, sum: number }> = {};
    let totalExpected = 0, totalActual = 0, totalDiff = 0, discrepanciesCount = 0, missingPrices = 0, totalClearance = 0;

    for (const item of items) {
      const qty = parseNumber(item.quantity) || 0;
      const net = parseNumber(item.expectedPrice) || 0;
      const disc = parseNumber(item.discount) || 0;

      const stdUnit = calcBrutto(net, disc);
      const expectedTotal = stdUnit * qty; // Soll-Wert is standard expected price without clearance

      const match = findInMaster(item.description, masterPrices);
      const clearancePct = match?.clearanceDiscount || 0;
      const stammdatenWert = stdUnit * (1 - clearancePct / 100) * qty;

      const actualTotal = parseNumber(item.actualPrice) || 0;
      const diff = actualTotal - expectedTotal;

      const missingMaster = net === 0 && !!item.description;
      const isClearanceOutstanding = clearancePct > 0 && actualTotal > 0 && Math.abs(actualTotal - expectedTotal) < 0.05 * (qty || 1);
      const isClearanceApplied = clearancePct > 0 && actualTotal > 0 && Math.abs(actualTotal - stammdatenWert) < 0.05 * (qty || 1);
      
      const priceError = net > 0 && Math.abs(actualTotal - expectedTotal) > 0.01 && !isClearanceApplied;
      const clearanceError = net > 0 && isClearanceOutstanding;

      const hasDiscrepancy = missingMaster || priceError || clearanceError;

      if (clearancePct > 0 && actualTotal > 0) {
        if (isClearanceOutstanding) {
          totalClearance += expectedTotal * (clearancePct / 100);
        } else if (isClearanceApplied) {
          totalClearance += diff;
        }
      }

      totalExpected += expectedTotal;
      totalActual += actualTotal;
      totalDiff += diff;

      if (hasDiscrepancy) {
        if (net === 0) missingPrices++;
        else discrepanciesCount++;
      }

      let monthKey = 'Unbekannt';
      if (item.date) {
        const parts = item.date.split('-').map(Number);
        if (parts.length === 3) {
          const dt = new Date(parts[0], parts[1] - 1, parts[2], 12);
          if (!isNaN(dt.getTime()))
            monthKey = dt.toLocaleString('de-DE', { month: 'long', year: 'numeric' });
        }
      }
      if (!monthly[monthKey]) monthly[monthKey] = { count: 0, sum: 0 };
      monthly[monthKey].count++;
      monthly[monthKey].sum += actualTotal;
    }
    return { totalExpected, totalActual, totalDiff, unexplainedDiff: totalDiff - totalClearance, discrepanciesCount, missingPrices, monthly, totalClearance };
  }, [items, masterPrices]);

  const MONTH_ORDER = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  const sortedMonths = useMemo(() =>
    Object.keys(analysis.monthly).sort((a, b) => {
      if (a === 'Unbekannt') return 1;
      if (b === 'Unbekannt') return -1;
      const [mA, yA] = a.split(' ');
      const [mB, yB] = b.split(' ');
      return yA !== yB ? +yA - +yB : MONTH_ORDER.indexOf(mA) - MONTH_ORDER.indexOf(mB);
    }),
  [analysis.monthly]);

  const filteredItems = useMemo(() => {
    let result = items;

    if (searchTerm) {
      const s = cleanString(searchTerm);
      result = result.filter(item => 
        cleanString(item.description).includes(s) || 
        cleanString(item.orderId || '').includes(s)
      );
    }

    if (!filterErrors) return result;
    
    return result.filter(item => {
      const qty = parseNumber(item.quantity) || 0;
      const net = parseNumber(item.expectedPrice) || 0;
      const disc = parseNumber(item.discount) || 0;

      const stdUnit = calcBrutto(net, disc);
      const expectedTotal = stdUnit * qty; // Soll-Wert is standard expected price without clearance

      const match = findInMaster(item.description, masterPrices);
      const clearancePct = match?.clearanceDiscount || 0;
      const stammdatenWert = stdUnit * (1 - clearancePct / 100) * qty;

      const actualTotal = parseNumber(item.actualPrice) || 0;

      const missingMaster = net === 0 && !!item.description;
      const isClearanceOutstanding = clearancePct > 0 && actualTotal > 0 && Math.abs(actualTotal - expectedTotal) < 0.05 * (qty || 1);
      const isClearanceApplied = clearancePct > 0 && actualTotal > 0 && Math.abs(actualTotal - stammdatenWert) < 0.05 * (qty || 1);
      
      const priceError = net > 0 && Math.abs(actualTotal - expectedTotal) > 0.01 && !isClearanceApplied;
      const clearanceError = net > 0 && isClearanceOutstanding;

      return missingMaster || priceError || clearanceError;
    });
  }, [items, filterErrors, masterPrices, searchTerm]);

  const saveDraft = () => {
    localStorage.setItem('procontour_draft', JSON.stringify({ items, metadata }));
    showToast('Entwurf manuell gespeichert!');
  };

  return (
    <div className="min-h-screen bg-mokebo-dark text-mokebo-fg font-sans">
      <style>{`
        .mono { font-family: 'DM Mono', 'Manrope', monospace; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
        .fade-in { animation: fadeIn 0.3s ease; }
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
        }
      `}</style>

      <div className="max-w-screen-xl mx-auto px-4 py-6 md:px-8 md:py-8">
        {/* ── HEADER ── */}
        <header className="no-print mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-mokebo-surface rounded-2xl border border-mokebo-border shadow-sm p-5 px-6">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-mokebo-muted hover:text-mokebo-fg hover:bg-white/5 transition-all shrink-0"
              aria-label="Zur Übersicht"
            >
              <LI name="ArrowLeft" size={20} />
            </Link>
            <ProcontourMark height={48} />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight">Procontour Rechnungsprüfung</h1>
                <span className="text-[10px] font-black text-emerald-600 bg-emerald-500/15 border border-emerald-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <LI name="CheckCircle" size={10} /> AKTIV
                </span>
              </div>
              <p className="text-xs text-mokebo-muted font-medium">Rechnungsprüfung & Preisabgleich</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-mokebo-surface2 p-1 rounded-xl mr-2">
              {['reconcile', 'master', 'settings'].map(v => (
                <button key={v} onClick={() => setView(v)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${view === v ? 'bg-mokebo-surface text-mokebo-fg shadow-sm' : 'text-mokebo-muted hover:text-gray-300'}`}>
                  {v === 'reconcile' ? 'ABGLEICH' : v === 'master' ? 'STAMMDATEN' : 'EINSTELLUNGEN'}
                </button>
              ))}
            </div>

            {view === 'reconcile' && (
              <>
                <button onClick={() => invoiceRef.current?.click()}
                  className="flex items-center gap-2 bg-mokebo-green text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-mokebo-dark transition-all shadow-sm active:scale-95">
                  <LI name="Upload" size={14} /> RECHNUNG LADEN
                  <input type="file" ref={invoiceRef} accept=".csv,.tsv,.txt" className="hidden" onChange={e => handleFileUpload(e, 'invoice')} />
                </button>
                <button onClick={saveDraft} title="Entwurf manuell speichern (Auto-Save ist aktiv)"
                  className="p-2 bg-mokebo-surface2 text-mokebo-muted rounded-xl hover:bg-mokebo-surface2 transition-all group relative">
                  <LI name="Save" size={16} />
                </button>
              </>
            )}
          </div>
        </header>

        {/* ── SETTINGS VIEW ── */}
        {view === 'settings' && (
          <div className="fade-in bg-mokebo-surface rounded-2xl border border-mokebo-border shadow-sm p-8 max-w-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-mokebo-mint/15 text-mokebo-mint p-2 rounded-lg">
                <LI name="Settings" size={18} />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-gray-200">Metadaten & Einstellungen</h2>
                <p className="text-xs text-mokebo-muted mt-0.5">Diese Daten werden im Header des PDF-Exports angezeigt.</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
              {[
                { label: 'Lieferantenname', key: 'supplierName', type: 'text', placeholder: 'z.B. mokebo GmbH' },
                { label: 'Rechnungsnummer', key: 'invoiceNumber', type: 'text', placeholder: 'RE-2024-001' },
                { label: 'Bestellnummer (PO)', key: 'poNumber', type: 'text', placeholder: 'PO-998877' },
                { label: 'Rechnungsdatum', key: 'invoiceDate', type: 'date', placeholder: '' },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-mokebo-muted mb-1.5">{label}</label>
                  <input type={type} value={metadata[key] || ''} placeholder={placeholder}
                    onChange={e => setMetadata((m: any) => ({ ...m, [key]: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-mokebo-border rounded-xl text-sm font-medium bg-white/5 outline-none focus:ring-2 focus:ring-mokebo-mint/20 text-mokebo-fg placeholder:text-mokebo-muted" />
                </div>
              ))}
            </div>

            <div className="p-5 bg-white/5 rounded-xl border border-mokebo-border">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-mokebo-muted mb-3">Vorschau Header</h3>
              <div className="bg-mokebo-surface p-4 rounded-lg border border-mokebo-border shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-lg font-black text-mokebo-fg">{metadata.supplierName || 'Lieferant'}</div>
                    <div className="text-xs text-mokebo-muted">Rechnungsprüfung</div>
                  </div>
                  <div className="text-right text-[10px] font-bold text-mokebo-muted space-y-0.5">
                    <div>RE-NR: {metadata.invoiceNumber || '---'}</div>
                    <div>PO-NR: {metadata.poNumber || '---'}</div>
                    <div>DATUM: {metadata.invoiceDate || '---'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── MASTER VIEW ── */}
        {view === 'master' && (
          <div className="fade-in bg-mokebo-surface rounded-2xl border border-mokebo-border shadow-sm overflow-hidden">
            <div className="p-6 border-b bg-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-gray-200">Stammdaten</h2>
                <p className="text-xs text-mokebo-muted mt-0.5">{masterPrices.length} Preise gespeichert</p>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative">
                  <LI name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mokebo-muted" />
                  <input placeholder="SKU suchen..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    className="pl-8 pr-4 py-2 bg-mokebo-surface border border-mokebo-border rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-mokebo-mint/20 w-48 text-mokebo-fg placeholder:text-mokebo-muted" />
                </div>
                <button onClick={() => setShowAddSku(true)}
                  className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-emerald-500/15 text-emerald-600 border border-emerald-100 hover:bg-emerald-500/20 transition-all">
                  <LI name="Plus" size={13} /> SKU hinzufügen
                </button>
                <button onClick={() => discountRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-mokebo-mint/15 text-mokebo-mint border border-mokebo-mint/30 hover:bg-mokebo-mint/25 transition-all">
                  <LI name="Tag" size={13} /> Rabatt-Liste laden
                  <input type="file" ref={discountRef} accept=".csv" className="hidden" onChange={e => handleFileUpload(e, 'discount')} />
                </button>
                <button onClick={() => masterRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-mokebo-green text-white hover:bg-mokebo-dark transition-all shadow-sm">
                  <LI name="FileSpreadsheet" size={13} /> Netto-Preise laden
                  <input type="file" ref={masterRef} accept=".csv" className="hidden" onChange={e => handleFileUpload(e, 'master')} />
                </button>
                <button onClick={() => { 
                  if (deleteConfirm) {
                    setMasterPrices([]); 
                    localStorage.removeItem('auditor_master');
                    setDeleteConfirm(false);
                  } else {
                    setDeleteConfirm(true);
                    setTimeout(() => setDeleteConfirm(false), 3000);
                  }
                }}
                  className={`p-2 rounded-xl transition-all ${deleteConfirm ? 'bg-mokebo-rust text-white' : 'bg-mokebo-surface2 text-mokebo-muted hover:bg-mokebo-rust/15 hover:text-mokebo-rustlight'}`}
                  title={deleteConfirm ? "Sicher?" : "Alle Stammdaten löschen"}>
                  {deleteConfirm ? <LI name="CheckCircle" size={15} /> : <LI name="Eraser" size={15} />}
                </button>
              </div>
            </div>

            {masterPrices.length === 0 && !showAddSku ? (
              <div className="py-24 flex flex-col items-center justify-center text-mokebo-muted">
                <LI name="Database" size={48} className="mb-4 opacity-30" />
                <p className="font-bold text-mokebo-muted">Keine Stammdaten. CSV hochladen.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-6">
                {showAddSku && (
                  <div className="p-4 bg-emerald-500/15 rounded-xl border border-emerald-200 shadow-sm fade-in">
                    <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-3 flex justify-between items-center">
                      <span>Neue SKU anlegen</span>
                      <button onClick={() => setShowAddSku(false)} className="text-emerald-400 hover:text-emerald-600">
                        <LI name="X" size={14} />
                      </button>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[9px] font-bold text-mokebo-muted uppercase mb-1">SKU / Artikelnummer</label>
                        <input value={newSkuData.sku} onChange={e => setNewSkuData(s => ({ ...s, sku: e.target.value }))}
                          className="w-full px-3 py-2 bg-mokebo-surface border border-mokebo-border rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-300 text-mokebo-fg placeholder:text-mokebo-muted" placeholder="z.B. BS6.4-ant" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-bold text-mokebo-muted uppercase mb-1">Netto-Preis (€)</label>
                          <input type="number" step="0.01" value={newSkuData.price} onChange={e => setNewSkuData(s => ({ ...s, price: e.target.value }))}
                            className="w-full px-3 py-2 bg-mokebo-surface border border-mokebo-border rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-300 text-mokebo-fg placeholder:text-mokebo-muted" placeholder="0.00" />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-mokebo-muted uppercase mb-1">Std. Rabatt (%)</label>
                          <input type="number" value={newSkuData.discount} onChange={e => setNewSkuData(s => ({ ...s, discount: e.target.value }))}
                            className="w-full px-3 py-2 bg-mokebo-surface border border-mokebo-border rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-300 text-mokebo-fg placeholder:text-mokebo-muted" placeholder="0" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-mokebo-muted uppercase mb-1">Abverkaufsrabatt (%)</label>
                        <input type="number" value={newSkuData.clearance} onChange={e => setNewSkuData(s => ({ ...s, clearance: e.target.value }))}
                          className="w-full px-3 py-2 bg-mokebo-surface border border-mokebo-border rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-300 text-mokebo-fg placeholder:text-mokebo-muted" placeholder="0" />
                      </div>
                      <button onClick={() => {
                        if (!newSkuData.sku || !newSkuData.price) {
                          showToast('Bitte SKU und Preis angeben!');
                          return;
                        }
                        const entry = {
                          id: Date.now(),
                          sku: newSkuData.sku.trim(),
                          price: parseFloat(newSkuData.price),
                          defaultDiscount: parseFloat(newSkuData.discount) || 0,
                          clearanceDiscount: parseFloat(newSkuData.clearance) || 0
                        };
                        setMasterPrices(prev => [entry, ...prev]);
                        setNewSkuData({ sku: '', price: '', discount: '0', clearance: '0' });
                        setShowAddSku(false);
                        showToast('SKU erfolgreich hinzugefügt!');
                      }}
                        className="w-full py-2 bg-emerald-600 text-white rounded-lg text-xs font-black shadow-sm hover:bg-emerald-700 transition-all active:scale-95">
                        SPEICHERN
                      </button>
                    </div>
                  </div>
                )}
                {masterPrices
                  .filter(p => cleanString(p.sku).includes(cleanString(searchTerm)))
                  .map(p => (
                    <div key={p.id} className="group p-4 bg-white/5 rounded-xl border border-transparent hover:border-mokebo-border hover:bg-mokebo-surface transition-all shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-black text-mokebo-mint bg-mokebo-mint/15 px-2 py-0.5 rounded-md max-w-[80%] truncate">{p.sku}</span>
                        <button onClick={() => setMasterPrices(prev => prev.filter(x => x.id !== p.id))}
                          className="text-mokebo-muted hover:text-mokebo-rustlight opacity-0 group-hover:opacity-100 transition-all">
                          <LI name="Trash2" size={14} />
                        </button>
                      </div>
                      <div className="mono text-lg font-bold text-mokebo-fg">{fmtEur(p.price)} <span className="text-xs text-mokebo-muted font-normal">EUR Netto</span></div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {p.defaultDiscount > 0 && (
                          <div className="text-[9px] font-black text-mokebo-mint bg-mokebo-mint/15 border border-mokebo-mint/30 rounded-md px-2 py-0.5">
                            STD: {p.defaultDiscount}%
                          </div>
                        )}
                        {p.clearanceDiscount > 0 && (
                          <div className="text-[9px] font-black text-amber-600 bg-amber-500/15 border border-amber-500/30 rounded-md px-2 py-0.5 flex items-center gap-1">
                            <LI name="Percent" size={8} /> ABVERKAUF: {p.clearanceDiscount}%
                          </div>
                        )}
                      </div>
                      {(p.defaultDiscount > 0 || p.clearanceDiscount > 0) && (
                        <div className="mt-2 pt-2 border-t border-mokebo-border text-[10px] font-bold text-mokebo-muted flex justify-between">
                          <span>Soll-Preis:</span>
                          <span>{fmtEur(p.price)} €</span>
                        </div>
                      )}
                      {p.clearanceDiscount > 0 && (
                        <div className="mt-1 text-[10px] font-bold text-amber-600 flex justify-between">
                          <span>Basis (Rechnung):</span>
                          <span>{fmtEur(p.price / (1 - p.clearanceDiscount / 100))} €</span>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* ── RECONCILE VIEW ── */}
        {view === 'reconcile' && (
          <div className="fade-in grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-8 space-y-4">
              <div className="hidden print-only mb-6">
                <h1 className="text-xl font-black">Prüfbericht</h1>
                <div className="text-sm text-mokebo-muted mt-1">
                  {metadata.supplierName && <span>Lieferant: {metadata.supplierName} · </span>}
                  {metadata.invoiceNumber && <span>Re.-Nr.: {metadata.invoiceNumber} · </span>}
                  {metadata.invoiceDate && <span>Datum: {metadata.invoiceDate}</span>}
                </div>
              </div>

              <div className="bg-mokebo-surface rounded-2xl border border-mokebo-border shadow-sm overflow-hidden">
                <div className="no-print flex items-center justify-between gap-3 px-6 py-4 border-b bg-white/5">
                  <div className="text-[10px] font-black uppercase tracking-widest text-mokebo-muted">
                    Positions-Check · {filteredItems.length} {filteredItems.length === 1 ? 'Pos.' : 'Pos.'}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative no-print">
                      <LI name="Search" size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-mokebo-muted" />
                      <input 
                        placeholder="SKU / Auftrag..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-8 pr-4 py-1.5 bg-mokebo-surface border border-mokebo-border rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-mokebo-mint/30/20 w-40 transition-all focus:w-56 text-mokebo-fg placeholder:text-mokebo-muted" 
                      />
                    </div>
                    <button onClick={() => setFilterErrors(f => !f)}
                      className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${filterErrors ? 'bg-mokebo-rust text-white border-mokebo-rust' : 'bg-mokebo-surface text-mokebo-muted border-mokebo-border hover:border-mokebo-rust/30'}`}>
                      <LI name="Filter" size={13} /> Nur Abweichungen
                    </button>
                    {items.length > 0 && (
                      <button onClick={reMatchItems}
                        className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border bg-mokebo-surface text-mokebo-muted border-mokebo-border hover:border-mokebo-mint/40 hover:text-mokebo-mint transition-all">
                        <LI name="RefreshCw" size={13} /> Abgleichen
                      </button>
                    )}
                    {items.length > 0 && (
                      <button onClick={() => {
                        if (itemsDeleteConfirm) {
                          setItems([]);
                          setItemsDeleteConfirm(false);
                          showToast('Liste geleert');
                        } else {
                          setItemsDeleteConfirm(true);
                          setTimeout(() => setItemsDeleteConfirm(false), 3000);
                        }
                      }}
                        className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${itemsDeleteConfirm ? 'bg-mokebo-rust text-white border-mokebo-rust' : 'bg-mokebo-surface text-mokebo-muted border-mokebo-border hover:border-mokebo-rust/30 hover:text-mokebo-rustlight'}`}>
                        <LI name={itemsDeleteConfirm ? "CheckCircle" : "Trash2"} size={13} />
                        {itemsDeleteConfirm ? 'Sicher?' : 'Leeren'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  {items.length === 0 ? (
                    <div className="py-20 flex flex-col items-center justify-center text-mokebo-muted gap-4">
                      <div className="bg-mokebo-surface2 p-8 rounded-2xl">
                        <LI name="FileUp" size={48} className="opacity-40" />
                      </div>
                      <div className="text-center">
                        <p className="font-black text-gray-200 text-lg">Bereit zur Prüfung</p>
                        <p className="text-sm text-mokebo-muted mt-1">Rechnung als CSV hochladen um zu starten</p>
                      </div>
                      <button onClick={() => invoiceRef.current?.click()}
                        className="bg-mokebo-green text-white text-xs font-bold px-6 py-3 rounded-xl hover:bg-mokebo-dark transition-all shadow-sm">
                        RECHNUNG HOCHLADEN
                      </button>
                    </div>
                  ) : (
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-[10px] uppercase font-black text-mokebo-muted border-b bg-white/5 tracking-wider">
                          <th className="py-4 px-5">Auftrag / Datum</th>
                          <th className="py-4 px-3">SKU</th>
                          <th className="py-4 px-3 text-center">Menge</th>
                          <th className="py-4 px-3 text-center">Rabatt %</th>
                          <th className="py-4 px-3 text-right text-mokebo-mint bg-mokebo-mint/15">Soll (€)</th>
                          <th className="py-4 px-3 text-right text-amber-600 bg-amber-500/15">Ist Brutto (€)</th>
                          <th className="py-4 px-3 text-right">Diff.</th>
                          <th className="py-4 px-4 no-print"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredItems.map(item => {
                          const qty = parseNumber(item.quantity) || 0;
                          const net = parseNumber(item.expectedPrice) || 0;
                          const disc = parseNumber(item.discount) || 0;

                          const stdUnit = calcBrutto(net, disc);
                          const expectedTotal = stdUnit * qty; // Soll-Wert is standard expected price without clearance

                          const match = findInMaster(item.description, masterPrices);
                          const clearancePct = match?.clearanceDiscount || 0;
                          const stammdatenWert = stdUnit * (1 - clearancePct / 100) * qty;

                          const actualTotal = parseNumber(item.actualPrice) || 0;
                          const diff = actualTotal - expectedTotal;
                          
                          const missingMaster = net === 0 && !!item.description;
                          const isClearanceOutstanding = clearancePct > 0 && actualTotal > 0 && Math.abs(actualTotal - expectedTotal) < 0.05 * (qty || 1);
                          const isClearanceApplied = clearancePct > 0 && actualTotal > 0 && Math.abs(actualTotal - stammdatenWert) < 0.05 * (qty || 1);
                          
                          const priceError = net > 0 && Math.abs(actualTotal - expectedTotal) > 0.01 && !isClearanceApplied;
                          const clearanceError = net > 0 && isClearanceOutstanding;

                          const hasError = missingMaster || priceError || clearanceError;

                          const rowClass = missingMaster || priceError
                            ? 'bg-mokebo-rust/15 border-mokebo-rust/30'
                            : isClearanceOutstanding
                            ? 'bg-amber-500/15'
                            : isClearanceApplied
                            ? 'bg-emerald-500/15'
                            : 'hover:bg-white/5';

                          const badgeClass = Math.abs(diff) <= 0.01
                            ? 'bg-mokebo-surface2 text-mokebo-muted'
                            : isClearanceOutstanding
                            ? 'bg-amber-500/20 text-amber-700'
                            : isClearanceApplied
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : diff > 0
                            ? 'bg-mokebo-rust/20 text-mokebo-rustlight'
                            : 'bg-emerald-500/20 text-emerald-400';

                          return (
                            <tr key={item.id} className={`group transition-all ${rowClass}`}>
                              <td className="py-4 px-5">
                                <input className="block bg-transparent outline-none mono text-xs text-gray-200 font-medium w-32 text-mokebo-fg placeholder:text-mokebo-muted"
                                  value={item.orderId || ''} placeholder="Auftrag-Nr."
                                  onChange={e => updateItem(item.id, 'orderId', e.target.value)} />
                                <input type="date"
                                  className="block bg-transparent outline-none text-[10px] text-mokebo-muted mt-0.5 text-mokebo-fg placeholder:text-mokebo-muted"
                                  value={item.date || ''}
                                  onChange={e => updateItem(item.id, 'date', e.target.value)} />
                              </td>
                              <td className="py-4 px-3">
                                <input
                                  className={`bg-transparent outline-none text-sm font-medium w-36 ${missingMaster ? 'text-amber-600' : 'text-mokebo-fg'}`}
                                  value={item.description || ''} placeholder="SKU..."
                                  onChange={e => updateItem(item.id, 'description', e.target.value)} />
                                {missingMaster && (
                                  <div className="mt-1 flex flex-col gap-1 items-start">
                                    <span className="text-[9px] text-amber-500 font-black">Nicht in Stammdaten</span>
                                    <button onClick={() => {
                                      const entry = {
                                        id: Date.now(),
                                        sku: item.description.trim(),
                                        price: parseNumber(item.actualPrice) || 0,
                                        defaultDiscount: parseNumber(item.discount) || 0,
                                        clearanceDiscount: 0
                                      };
                                      setMasterPrices(prev => [entry, ...prev]);
                                      showToast(`SKU ${item.description} zu Stammdaten hinzugefügt!`);
                                    }}
                                      className="text-[9px] font-bold bg-amber-500/15 text-amber-700 hover:bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/30 transition-all no-print flex items-center gap-1">
                                      <LI name="Plus" size={8} /> Stammdaten anlegen
                                    </button>
                                  </div>
                                )}
                                {isClearanceOutstanding && (
                                  <p className="text-[9px] text-amber-600 font-black mt-0.5 flex items-center gap-1">
                                    <LI name="Info" size={10} /> Abverkauf-Gutschrift ausstehend ({clearancePct}%)
                                  </p>
                                )}
                                {isClearanceApplied && (
                                  <p className="text-[9px] text-emerald-600 font-black mt-0.5 flex items-center gap-1">
                                    <LI name="CheckCircle" size={10} /> Abverkauf-Rabatt abgezogen ({clearancePct}%)
                                  </p>
                                )}
                              </td>
                              <td className="py-4 px-3 text-center w-16">
                                <input type="number" min="0"
                                  className="w-full text-center bg-transparent outline-none font-bold text-gray-200 mono text-mokebo-fg placeholder:text-mokebo-muted"
                                  value={item.quantity || ''} onChange={e => updateItem(item.id, 'quantity', e.target.value)} />
                              </td>
                              <td className="py-4 px-3 text-center w-20">
                                <div className={`flex items-center justify-center gap-0.5 px-2 py-1 rounded-lg ${disc > 0 ? 'bg-mokebo-mint/15 text-mokebo-mint' : 'text-mokebo-muted'}`}>
                                  <input type="number" step="0.01" min="0" max="100"
                                    className="w-10 text-center bg-transparent outline-none text-xs font-bold text-mokebo-fg placeholder:text-mokebo-muted"
                                    value={item.discount || ''} onChange={e => updateItem(item.id, 'discount', e.target.value)} />
                                  <span className="text-[10px]">%</span>
                                </div>
                              </td>
                              <td className="py-4 px-3 text-right bg-mokebo-mint/15">
                                <div className="mono text-sm font-bold text-mokebo-mint">{fmtEur(expectedTotal)}</div>
                              </td>
                              <td className="py-4 px-3 text-right bg-amber-500/15">
                                <input type="number" step="0.01"
                                  className={`w-24 text-right bg-transparent outline-none mono text-sm font-bold ${hasError ? 'text-mokebo-rustlight' : 'text-gray-200'}`}
                                  value={item.actualPrice || ''} onChange={e => updateItem(item.id, 'actualPrice', e.target.value)} />
                              </td>
                              <td className="py-4 px-3 text-right">
                                <span className={`mono text-[11px] font-black px-2 py-1 rounded-lg ${badgeClass}`}>
                                  {diff > 0 ? '+' : ''}{fmtEur(diff)}
                                </span>
                              </td>
                              <td className="py-4 pr-5 no-print">
                                <button onClick={() => setItems(p => p.filter(i => i.id !== item.id))}
                                  className="text-mokebo-muted hover:text-mokebo-rustlight transition-all opacity-0 group-hover:opacity-100">
                                  <LI name="Trash2" size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
                {items.length > 0 && (
                  <button onClick={() => setItems(p => [...p, newItem({ date: metadata.invoiceDate })])}
                    className="no-print w-full py-4 text-xs font-bold text-mokebo-muted hover:text-gray-300 hover:bg-white/5 border-t border-mokebo-border transition-all flex items-center justify-center gap-2 uppercase tracking-wider">
                    <LI name="Plus" size={13} /> Eintrag hinzufügen
                  </button>
                )}
              </div>
            </div>

            <div className="lg:col-span-4 space-y-4">
              <div className="bg-mokebo-surface rounded-2xl border border-mokebo-border shadow-sm p-6">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-mokebo-muted mb-5 flex items-center gap-2">
                  <LI name="TrendingUp" size={14} className="text-mokebo-muted" /> Bilanz
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-mokebo-muted font-medium">Soll Brutto</span>
                    <span className="mono font-bold text-mokebo-mint">{fmtEur(analysis.totalExpected)} €</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-mokebo-muted font-medium">Ist (Rechnung)</span>
                    <span className="mono font-bold text-mokebo-fg">{fmtEur(analysis.totalActual)} €</span>
                  </div>
                  {analysis.totalClearance > 0 && (
                    <div className="flex justify-between items-center text-xs bg-amber-500/15 p-2 rounded-lg border border-amber-500/30">
                      <span className="text-amber-700 font-bold flex items-center gap-1">
                        <LI name="Info" size={12} /> Abverkauf-Gutschrift
                      </span>
                      <span className="mono font-bold text-amber-700">-{fmtEur(analysis.totalClearance)} €</span>
                    </div>
                  )}
                  <div className="pt-4 mt-2 border-t-2 border-mokebo-border">
                    <div className="text-[10px] font-black uppercase text-mokebo-muted tracking-wider mb-1">Differenz (ungeklärt)</div>
                    <div className={`mono text-3xl font-black ${Math.abs(analysis.unexplainedDiff) <= 0.01 ? 'text-emerald-600' : analysis.unexplainedDiff > 0 ? 'text-mokebo-rustlight' : 'text-emerald-600'}`}>
                      {analysis.unexplainedDiff > 0 ? '+' : ''}{fmtEur(analysis.unexplainedDiff)} €
                    </div>
                  </div>
                </div>
              </div>

              {items.length > 0 && (
                <div className="bg-mokebo-surface rounded-2xl border border-mokebo-border shadow-sm p-6">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-mokebo-muted mb-5 flex items-center gap-2">
                    <LI name="Calendar" size={14} className="text-mokebo-muted" /> Monats-Verteilung (IST)
                  </h3>
                  <div className="space-y-4">
                    {sortedMonths.map(m => {
                      const data = analysis.monthly[m];
                      const percent = analysis.totalActual > 0 ? (data.sum / analysis.totalActual) * 100 : 0;
                      return (
                        <div key={m} className="group">
                          <div className="flex justify-between items-end mb-1.5">
                            <div>
                              <div className="text-xs font-black text-gray-200">{m}</div>
                              <div className="text-[9px] text-mokebo-muted font-bold uppercase tracking-tighter">
                                {data.count} Pos.
                                {metadata.invoiceNumber && <> &middot; RE {metadata.invoiceNumber}</>}
                              </div>
                            </div>
                            <div className="text-sm font-black text-mokebo-fg mono">{fmtEur(data.sum)} €</div>
                          </div>
                          <div className="h-1.5 w-full bg-mokebo-surface2 rounded-full overflow-hidden">
                            <div className="h-full bg-mokebo-green rounded-full transition-all duration-500" style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="no-print grid grid-cols-2 gap-3">
                <button onClick={() => {
                  const csvContent = [
                    ['Auftrag', 'SKU', 'Datum', 'Menge', 'Rabatt %', 'Soll Brutto', 'Ist Brutto', 'Diff'].join(';'),
                    ...items.map(i => {
                      const qty = parseNumber(i.quantity) || 0;
                      const net = parseNumber(i.expectedPrice) || 0;
                      const disc = parseNumber(i.discount) || 0;
                      const sBrutto = calcBrutto(net, disc) * qty;
                      const actual = parseNumber(i.actualPrice) || 0;
                      const d = actual - sBrutto;

                      return [
                        i.orderId,
                        i.description,
                        i.date,
                        i.quantity,
                        i.discount,
                        sBrutto.toFixed(2),
                        actual.toFixed(2),
                        d.toFixed(2)
                      ].join(';');
                    })
                  ].join('\n');
                  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.setAttribute('href', url);
                  link.setAttribute('download', `Procontour_Export_${metadata.invoiceNumber || 'Draft'}.csv`);
                  link.click();
                  showToast('CSV Export gestartet');
                }}
                  className="flex flex-col items-center gap-1.5 bg-mokebo-surface border border-mokebo-border text-gray-300 py-4 rounded-xl text-xs font-bold hover:bg-white/5 transition-all">
                  <LI name="Download" size={16} /> CSV Export
                </button>
                <button onClick={() => {
                  try {
                    window.print();
                  } catch (e) {
                    showToast('Drucken fehlgeschlagen. Bitte Browser-Tab nutzen.');
                  }
                }}
                  className="flex flex-col items-center gap-1.5 bg-mokebo-green text-white py-4 rounded-xl text-xs font-bold hover:bg-mokebo-dark transition-all shadow-sm">
                  <LI name="Printer" size={16} /> PDF Export
                </button>
              </div>
              <p className="no-print text-[9px] text-mokebo-muted text-center mt-3 font-medium">
                Hinweis: PDF Export öffnet den Druckdialog. Falls blockiert, App im neuen Tab öffnen.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── TOAST ── */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-mokebo-green text-white px-6 py-3 rounded-2xl shadow-2xl z-[100] fade-in flex items-center gap-3 border border-mokebo-border">
          <LI name="CheckCircle" size={18} className="text-emerald-400" />
          <span className="text-sm font-bold">{toast}</span>
        </div>
      )}

      {/* ── IMPORT MODAL ── */}
      {importState.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-mokebo-surface rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col border border-mokebo-border overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b bg-white/5">
              <div className="flex items-center gap-3">
                <div className="bg-mokebo-green text-white p-2 rounded-lg">
                  <LI name="FileSpreadsheet" size={16} />
                </div>
                <div>
                  <h3 className="font-black text-mokebo-fg">Spalten-Mapping</h3>
                  <p className="text-xs text-mokebo-muted">Mapping für {importState.type}</p>
                </div>
              </div>
              <button onClick={() => setImportState((s: any) => ({ ...s, open: false }))}
                className="text-mokebo-muted hover:text-gray-300 p-1.5 rounded-lg hover:bg-mokebo-surface2 transition-all">
                <LI name="X" size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {importState.type === 'discount' && (
                <div className="bg-mokebo-mint/15 p-4 rounded-xl border border-mokebo-mint/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-black text-mokebo-mint uppercase tracking-wider">Rabatt-Typ wählen</div>
                    <p className="text-[10px] text-mokebo-mint font-medium">Wie sollen diese Rabatte angewendet werden?</p>
                  </div>
                  <div className="flex bg-mokebo-surface p-1 rounded-lg border border-mokebo-mint/40 self-start sm:self-auto">
                    <button onClick={() => setImportState((s: any) => ({ ...s, discountType: 'standard' }))}
                      className={`px-3 py-1.5 rounded-md text-[10px] font-black transition-all ${importState.discountType === 'standard' ? 'bg-mokebo-green text-white shadow-sm' : 'text-mokebo-muted hover:text-gray-300'}`}>
                      STANDARD
                    </button>
                    <button onClick={() => setImportState((s: any) => ({ ...s, discountType: 'clearance' }))}
                      className={`px-3 py-1.5 rounded-md text-[10px] font-black transition-all ${importState.discountType === 'clearance' ? 'bg-amber-500/150 text-white shadow-sm' : 'text-mokebo-muted hover:text-gray-300'}`}>
                      ABVERKAUF
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-white/5 p-4 rounded-xl border border-mokebo-border">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-mokebo-muted mb-3">Daten-Vorschau (Spalten-Übersicht)</h3>
                <div className="flex flex-wrap gap-2">
                  {(importState.rows[importState.headerRowIndex || 0] || importState.rows[0]).map((cell: string, i: number) => (
                    <div key={i} className="px-3 py-2 bg-mokebo-surface border border-mokebo-border rounded-lg text-[10px] font-mono shadow-sm">
                      <div className="text-mokebo-mint font-black mb-1">SPALTE {String.fromCharCode(65 + i)}</div>
                      <div className="text-mokebo-fg font-bold truncate max-w-[120px]">{cell || '(leer)'}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-mokebo-muted mb-1.5">Spalte: SKU / Artikelnummer</label>
                  <select value={importState.mapping.key}
                    onChange={e => setImportState((s: any) => ({ ...s, mapping: { ...s.mapping, key: +e.target.value } }))}
                    className="w-full px-3 py-2.5 border border-mokebo-border rounded-xl bg-white/5 text-sm font-medium outline-none focus:ring-2 focus:ring-mokebo-mint/20">
                    {(importState.rows[importState.headerRowIndex || 0] || importState.rows[0]).map((cell: string, i: number) => (
                      <option key={i} value={i}>Spalte {String.fromCharCode(65 + i)}: {cell || '(leer)'}</option>
                    ))}
                  </select>
                </div>
                {importState.type === 'invoice' && (
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-mokebo-muted mb-1.5">Spalte: Menge (Optional)</label>
                    <select value={importState.mapping.quantity}
                      onChange={e => setImportState((s: any) => ({ ...s, mapping: { ...s.mapping, quantity: +e.target.value } }))}
                      className="w-full px-3 py-2.5 border border-mokebo-border rounded-xl bg-white/5 text-sm font-medium outline-none focus:ring-2 focus:ring-mokebo-mint/20">
                      <option value={-1}>Nicht vorhanden (Auto-Berechnung)</option>
                      {(importState.rows[importState.headerRowIndex || 0] || importState.rows[0]).map((cell: string, i: number) => (
                        <option key={i} value={i}>Spalte {String.fromCharCode(65 + i)}: {cell || '(leer)'}</option>
                      ))}
                    </select>
                  </div>
                )}
                {(importState.type === 'discount' || importState.type === 'master') && (
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-mokebo-muted mb-1.5">Spalte: Rabatt (%)</label>
                    <select value={importState.mapping.discount}
                      onChange={e => setImportState((s: any) => ({ ...s, mapping: { ...s.mapping, discount: +e.target.value } }))}
                      className="w-full px-3 py-2.5 border border-mokebo-border rounded-xl bg-white/5 text-sm font-medium outline-none focus:ring-2 focus:ring-mokebo-mint/30 border-mokebo-mint/40 ring-1 ring-mokebo-mint/15">
                      <option value={-1}>Nicht vorhanden</option>
                      {(importState.rows[importState.headerRowIndex || 0] || importState.rows[0]).map((cell: string, i: number) => (
                        <option key={i} value={i}>Spalte {String.fromCharCode(65 + i)}: {cell || '(leer)'}</option>
                      ))}
                    </select>
                  </div>
                )}
                {importState.type !== 'discount' && (
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-mokebo-muted mb-1.5">Spalte: Preis (Netto)</label>
                    <select value={importState.mapping.price}
                      onChange={e => setImportState((s: any) => ({ ...s, mapping: { ...s.mapping, price: +e.target.value } }))}
                      className="w-full px-3 py-2.5 border border-mokebo-border rounded-xl bg-white/5 text-sm font-medium outline-none focus:ring-2 focus:ring-mokebo-mint/20">
                      <option value={-1}>Nicht vorhanden</option>
                      {(importState.rows[importState.headerRowIndex || 0] || importState.rows[0]).map((cell: string, i: number) => (
                        <option key={i} value={i}>Spalte {String.fromCharCode(65 + i)}: {cell || '(leer)'}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="p-5 border-t bg-white/5 flex justify-end gap-3">
              <button onClick={() => setImportState((s: any) => ({ ...s, open: false }))}
                className="text-xs font-bold text-mokebo-muted px-5 py-2.5 hover:text-gray-200 transition-all">
                Abbrechen
              </button>
              <button onClick={confirmImport}
                className="flex items-center gap-2 bg-mokebo-green text-white text-xs font-bold px-6 py-2.5 rounded-xl hover:bg-mokebo-dark transition-all shadow-sm">
                Import bestätigen <LI name="ChevronRight" size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
