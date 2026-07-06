import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, FileText, Table, CheckCircle, Loader, Database, Shield, Clock, Package } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate, formatDateTime } from '../utils/cn';
import * as XLSX from 'xlsx';

// Load JSZip from CDN dynamically — no npm install needed
const loadJSZip = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if ((window as any).JSZip) { resolve((window as any).JSZip); return; }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    script.onload = () => resolve((window as any).JSZip);
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

type BackupStatus = 'idle' | 'fetching' | 'done' | 'error';
type RestoreRowState = { row: any; tableKey: string; tableLabel: string; status: 'new'|'exists'|'conflict'; existingRow?: any };
type RestoreStatus = 'idle' | 'reading' | 'comparing' | 'ready' | 'restoring' | 'done' | 'error';

const tables = [
  { key: 'employees',          label: 'Employees',         icon: '👥', color: '#0891B2' },
  { key: 'attendance',         label: 'Attendance',        icon: '🕐', color: '#7C3AED' },
  { key: 'salary_payments',    label: 'Salary Payments',   icon: '💰', color: '#16A34A' },
  { key: 'invoices',           label: 'Invoices',          icon: '🧾', color: '#16A34A' },
  { key: 'transactions',       label: 'Cashflow',          icon: '📈', color: '#2563EB' },
  { key: 'products',           label: 'Inventory',         icon: '📦', color: '#EA580C' },
  { key: 'leads',              label: 'Sales Leads',       icon: '🛒', color: '#2563EB' },
  { key: 'sales_orders',       label: 'Sales Orders',      icon: '📋', color: '#6366F1' },
  { key: 'manufacturing_orders', label: 'Manufacturing',   icon: '🏭', color: '#DC2626' },
  { key: 'projects',           label: 'Projects',          icon: '📅', color: '#7C3AED' },
  { key: 'tasks',              label: 'Tasks',             icon: '✅', color: '#16A34A' },
  { key: 'campaigns',         label: 'Campaigns',          icon: '📣', color: '#DB2777' },
  { key: 'jobs',              label: 'Field Jobs',          icon: '🔧', color: '#059669' },
  { key: 'vendors',           label: 'Vendors',             icon: '🏪', color: '#D97706' },
  { key: 'purchase_bills',    label: 'Purchase Bills',      icon: '🧾', color: '#2563EB' },
  { key: 'purchase_items',    label: 'Purchase Items',      icon: '📦', color: '#EA580C' },
  { key: 'purchase_payments', label: 'Purchase Payments',   icon: '💸', color: '#16A34A' },
  { key: 'parties',           label: 'Parties/Customers',   icon: '👤', color: '#7C3AED' },
  { key: 'party_transactions', label: 'Party Ledger',       icon: '📒', color: '#DB2777' },
  { key: 'job_applications',  label: 'Recruitment',         icon: '💼', color: '#7C3AED' },
  { key: 'time_off',          label: 'Time Off',            icon: '🌴', color: '#2563EB' },
  { key: 'appraisals',        label: 'Appraisals',          icon: '⭐', color: '#D97706' },
  { key: 'work_tasks',        label: 'Work Tasks',          icon: '📝', color: '#059669' },
  { key: 'products_online',   label: 'eCommerce Products',  icon: '🛍️', color: '#D97706' },
  { key: 'online_orders',     label: 'Online Orders',       icon: '🛒', color: '#2563EB' },
  { key: 'contacts',          label: 'Contacts',            icon: '📒', color: '#0891B2' },
  { key: 'contact_history',   label: 'Contact History',     icon: '📋', color: '#0891B2' },
];

const Backup: React.FC = () => {
  const [excelStatus, setExcelStatus] = useState<BackupStatus>('idle');
  const [pdfStatus, setPdfStatus] = useState<BackupStatus>('idle');
  const [zipStatus, setZipStatus] = useState<BackupStatus>('idle');
  const [zipProgress, setZipProgress] = useState('');
  const [exportError, setExportError] = useState<string|null>(null);
  const [progress, setProgress] = useState<string[]>([]);
  const [selectedTables, setSelectedTables] = useState<string[]>(tables.map(t=>t.key));
  const [lastBackup, setLastBackup] = useState<string|null>(localStorage.getItem('last_backup')||null);

  // ── Restore state ──────────────────────────────────────────────────────
  const [restoreStatus, setRestoreStatus] = useState<RestoreStatus>('idle');
  const [restoreError, setRestoreError] = useState<string|null>(null);
  const [restorePreview, setRestorePreview] = useState<RestoreRowState[]>([]);
  const [restoreProgress, setRestoreProgress] = useState<string[]>([]);
  const [restoreSelectedNewIds, setRestoreSelectedNewIds] = useState<Set<string>>(new Set());

  const toggleTable = (key: string) => {
    setSelectedTables(prev => prev.includes(key) ? prev.filter(k=>k!==key) : [...prev,key]);
  };

  const fetchAllData = async () => {
    const data: Record<string, any[]> = {};
    const log: string[] = [];
    for(const table of tables.filter(t=>selectedTables.includes(t.key))) {
      try {
        const { data: rows, error } = await supabase.from(table.key).select('*').order('created_at', { ascending: false });
        if(error) { log.push(`⚠ ${table.label}: ${error.message}`); data[table.key] = []; }
        else { data[table.key] = rows || []; log.push(`✓ ${table.label}: ${rows?.length||0} records`); }
        setProgress([...log]);
      } catch(e) { log.push(`✗ ${table.label}: failed`); data[table.key] = []; }
    }
    return { data, log };
  };

  // ── Restore: read uploaded backup file and compare against live data ─────
  // Safety model: this NEVER deletes or overwrites anything automatically.
  // It only identifies rows that are missing from the live database (by id)
  // and lets the user choose exactly which ones to add back in.
  const handleRestoreFile = async (file: File) => {
    setRestoreStatus('reading');
    setRestoreError(null);
    setRestorePreview([]);
    setRestoreProgress([]);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      setRestoreStatus('comparing');
      const allRows: RestoreRowState[] = [];
      const log: string[] = [];

      for (const table of tables) {
        const sheet = wb.Sheets[table.label];
        if (!sheet) continue; // this table wasn't in the backup file
        const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });
        if (rows.length === 0) continue;
        if (!('id' in rows[0])) { log.push(`⚠ ${table.label}: no 'id' column, skipped (can't safely match rows)`); continue; }

        // Fetch live ids for this table to compare against
        const { data: liveRows, error } = await supabase.from(table.key).select('id, created_at');
        if (error) { log.push(`✗ ${table.label}: ${error.message}`); continue; }
        const liveIds = new Set((liveRows||[]).map((r:any)=>r.id));

        let newCount = 0, existsCount = 0;
        for (const row of rows) {
          if (!row.id) continue;
          if (liveIds.has(row.id)) {
            existsCount++;
            allRows.push({ row, tableKey: table.key, tableLabel: table.label, status: 'exists' });
          } else {
            newCount++;
            allRows.push({ row, tableKey: table.key, tableLabel: table.label, status: 'new' });
          }
        }
        log.push(`${table.label}: ${newCount} missing, ${existsCount} already present`);
        setRestoreProgress([...log]);
      }

      setRestorePreview(allRows);
      // Pre-select all "new" rows by default — user can deselect any they don't want
      setRestoreSelectedNewIds(new Set(allRows.filter(r=>r.status==='new').map(r=>r.row.id)));
      setRestoreStatus('ready');
    } catch (e: any) {
      console.error('Restore read failed:', e);
      setRestoreError(e?.message || String(e) || "Could not read this file. Make sure it's a valid OdooERP backup .xlsx file.");
      setRestoreStatus('error');
    }
  };

  const toggleRestoreRow = (id: string) => {
    setRestoreSelectedNewIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const runRestore = async () => {
    setRestoreStatus('restoring');
    const log: string[] = [];
    const toRestore = restorePreview.filter(r => r.status === 'new' && restoreSelectedNewIds.has(r.row.id));
    const byTable: Record<string, any[]> = {};
    for (const r of toRestore) { (byTable[r.tableKey] ||= []).push(r.row); }

    for (const [tableKey, rows] of Object.entries(byTable)) {
      const label = tables.find(t=>t.key===tableKey)?.label || tableKey;
      try {
        const cleanRows = rows.map(r => {
          const out: any = {};
          for (const [k,v] of Object.entries(r)) out[k] = (v === '' || v === undefined) ? null : v;
          return out;
        });
        const { error } = await supabase.from(tableKey).insert(cleanRows);
        if (error) log.push(`✗ ${label}: FAILED — ${error.message}`);
        else log.push(`✓ ${label}: restored ${rows.length} record(s)`);
      } catch (e: any) {
        log.push(`✗ ${label}: FAILED — ${e?.message || String(e)}`);
      }
      setRestoreProgress([...log]);
    }
    setRestoreStatus('done');
  };

  // ── Excel Export ────────────────────────────────────────────────────────
  // ── Download Everything as ZIP ─────────────────────────────────────────
  const downloadAllZip = async () => {
    setZipStatus('fetching');
    setZipProgress('Fetching all data...');
    setExportError(null);
    try {
      const JSZip = await loadJSZip();
      const zip = new JSZip();
      const date = new Date().toISOString().split('T')[0];

      // 1. Excel file
      setZipProgress('📊 Creating Excel backup...');
      const { data } = await fetchAllData();
      const wb = XLSX.utils.book_new();
      const summaryData = [
        ['Punjab Hitech Agro Machinery Works — Full Backup'],
        ['Generated:', new Date().toLocaleString('en-IN')],[''],
        ['Sheet', 'Records'],
        ...tables.map(t=>[t.label, data[t.key]?.length||0])
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), 'Summary');
      const usedNames = new Set<string>();
      for(const table of tables) {
        const rows = data[table.key];
        let name = table.label.replace(/[:\\/?*[\]]/g,'').slice(0,31).trim()||table.key.slice(0,31);
        let s=1; while(usedNames.has(name)){name=`${name.slice(0,28)}_${s++}`;} usedNames.add(name);
        if(!rows||rows.length===0){XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([[`No data`]]),name);continue;}
        XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),name);
      }
      const excelBuffer = XLSX.write(wb, { bookType:'xlsx', type:'array' });
      zip.file(`Data_Backup_${date}.xlsx`, excelBuffer);

      // 2. Contact documents from Supabase storage
      setZipProgress('📎 Fetching contact documents...');
      const { data: contactDocs } = await supabase.from('contact_documents').select('*, contacts(name)');
      if (contactDocs && contactDocs.length > 0) {
        const docsFolder = zip.folder('Contact_Documents');
        for (const doc of contactDocs) {
          try {
            setZipProgress(`📎 Downloading: ${doc.doc_name}...`);
            const res = await fetch(doc.file_url);
            if (res.ok) {
              const blob = await res.blob();
              const ext = doc.file_url.split('.').pop()?.split('?')[0] || 'jpg';
              const contactName = (doc.contacts?.name || 'Unknown').replace(/[^a-zA-Z0-9_\-. ]/g,'_');
              const docName = doc.doc_name.replace(/[^a-zA-Z0-9_\-. ]/g,'_');
              // Filename: ContactName — DocumentName.jpg
              docsFolder?.file(`${contactName} — ${docName}.${ext}`, blob);
            }
          } catch(e) { console.warn('Could not download:', doc.doc_name); }
        }
      }

      // 3. Employee documents from Supabase storage
      setZipProgress('📎 Fetching employee documents...');
      const { data: empDocs } = await supabase.from('employee_documents').select('*, employees(name)');
      if (empDocs && empDocs.length > 0) {
        const empFolder = zip.folder('Employee_Documents');
        for (const doc of empDocs) {
          try {
            setZipProgress(`📎 Downloading: ${doc.doc_name}...`);
            const res = await fetch(doc.file_url);
            if (res.ok) {
              const blob = await res.blob();
              const ext = doc.file_url.split('.').pop()?.split('?')[0] || 'jpg';
              const empName = (doc.employees?.name || 'Unknown').replace(/[^a-zA-Z0-9_\-. ]/g,'_');
              const docName = doc.doc_name.replace(/[^a-zA-Z0-9_\-. ]/g,'_');
              // Filename: EmployeeName — DocumentName.jpg
              empFolder?.file(`${empName} — ${docName}.${ext}`, blob);
            }
          } catch(e) { console.warn('Could not download:', doc.doc_name); }
        }
      }

      // 4. Generate ZIP
      setZipProgress('📦 Creating ZIP file...');
      const zipBlob = await zip.generateAsync({ type:'blob', compression:'DEFLATE' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url; a.download = `PunjabHitech_FullBackup_${date}.zip`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const now = new Date().toLocaleString('en-IN');
      localStorage.setItem('last_backup', now);
      setLastBackup(now);
      setZipProgress('✅ Done!');
      setZipStatus('done');
    } catch(e: any) {
      setExportError(e?.message || 'ZIP export failed');
      setZipStatus('error');
    }
  };

  const exportExcel = async () => {
    setExcelStatus('fetching');
    setExportError(null);
    setProgress([]);
    try {
      const { data, log } = await fetchAllData();
      const wb = XLSX.utils.book_new();

      // Summary sheet
      const summaryData = [
        ['OdooERP — Full Data Backup'],
        ['Generated:', new Date().toLocaleString('en-IN')],
        [''],
        ['Sheet', 'Records'],
        ...tables.filter(t=>selectedTables.includes(t.key)).map(t=>[t.label, data[t.key]?.length||0])
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      summarySheet['!cols'] = [{wch:30},{wch:15}];
      XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

      // One sheet per table
      const usedSheetNames = new Set<string>();
      for(const table of tables.filter(t=>selectedTables.includes(t.key))) {
        const rows = data[table.key];
        // Excel sheet names must be unique, <=31 chars, and can't contain : \ / ? * [ ]
        let sheetName = table.label.replace(/[:\\/?*\[\]]/g,'').slice(0,31).trim() || table.key.slice(0,31);
        let suffix = 1;
        while (usedSheetNames.has(sheetName)) { sheetName = `${sheetName.slice(0,28)}_${suffix++}`; }
        usedSheetNames.add(sheetName);
        if(!rows || rows.length === 0) {
          const emptySheet = XLSX.utils.aoa_to_sheet([[`No data in ${table.label}`]]);
          XLSX.utils.book_append_sheet(wb, emptySheet, sheetName);
          continue;
        }
        // Remove internal fields
        const cleanRows = rows.map(r => {
          const { id, created_at, ...rest } = r;
          return { id, ...rest, created_at };
        });
        const ws = XLSX.utils.json_to_sheet(cleanRows);
        // Auto column widths
        const maxWidths: number[] = [];
        const headers = Object.keys(cleanRows[0]);
        headers.forEach((h,i) => {
          const maxLen = Math.max(h.length, ...cleanRows.map(r=>String(r[h]??'').length).slice(0,50));
          maxWidths[i] = Math.min(Math.max(maxLen, 10), 40);
        });
        ws['!cols'] = maxWidths.map(w=>({wch:w}));
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }

      const date = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `OdooERP_Backup_${date}.xlsx`);
      const now = new Date().toLocaleString('en-IN');
      localStorage.setItem('last_backup', now);
      setLastBackup(now);
      setExcelStatus('done');
    } catch(e: any) {
      console.error('Excel export failed:', e);
      setExportError(e?.message || String(e) || 'Unknown error during Excel export.');
      setExcelStatus('error');
    }
  };

  // ── PDF Export ──────────────────────────────────────────────────────────
  const exportPDF = async () => {
    setPdfStatus('fetching');
    setExportError(null);
    setProgress([]);
    try {
      const { data } = await fetchAllData();
      const date = new Date().toLocaleString('en-IN');

      // Max columns that comfortably fit on one landscape page at readable size.
      // Tables wider than this get split into column groups instead of shrunk.
      const MAX_COLS_PER_GROUP = 7;

      const sections = tables.filter(t=>selectedTables.includes(t.key)).map(table => {
        const rows = data[table.key];
        if(!rows||rows.length===0) return `<div class="section"><h2>${table.icon} ${table.label}</h2><p class="empty">No data</p></div>`;
        const headers = Object.keys(rows[0]).filter(k=>!['id'].includes(k));
        const maxRows = 100; // limit per table in PDF
        const idCol = headers[0]; // repeated in every group so rows can be matched back together

        // Split into column groups if too wide to stay readable on one page
        const groups: string[][] = [];
        if (headers.length <= MAX_COLS_PER_GROUP) {
          groups.push(headers);
        } else {
          const restCols = headers.slice(1);
          for (let i = 0; i < restCols.length; i += (MAX_COLS_PER_GROUP - 1)) {
            groups.push([idCol, ...restCols.slice(i, i + (MAX_COLS_PER_GROUP - 1))]);
          }
        }

        const groupTables = groups.map((cols, gi) => `
          ${groups.length > 1 ? `<p class="group-label">Columns ${gi+1} of ${groups.length} (matched by ${idCol.replace(/_/g,' ').toUpperCase()})</p>` : ''}
          <div class="table-wrap">
          <table>
            <thead><tr>${cols.map(h=>`<th>${h.replace(/_/g,' ').toUpperCase()}</th>`).join('')}</tr></thead>
            <tbody>
              ${rows.slice(0,maxRows).map(row=>`<tr>${cols.map(h=>{
                const v = row[h];
                const isTimestamp = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v);
                const isPlainDate = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
                const display = isTimestamp ? formatDateTime(v) : isPlainDate ? formatDate(v) : (v??'-');
                return `<td>${display}</td>`;
              }).join('')}</tr>`).join('')}
              ${rows.length>maxRows?`<tr><td colspan="${cols.length}" style="text-align:center;color:#9CA3AF">... and ${rows.length-maxRows} more records (see Excel for full data)</td></tr>`:''}
            </tbody>
          </table>
          </div>`).join('');

        return `
          <div class="section">
            <h2>${table.icon} ${table.label} <span class="count">${rows.length} records · ${headers.length} columns</span></h2>
            ${groupTables}
          </div>`;
      }).join('');

      const html = `<html><head><title>OdooERP Backup ${date}</title>
      <style>
        @page { size: landscape; margin: 12mm 8mm; }
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,sans-serif;padding:20px;color:#111;font-size:10px}
        .cover{text-align:center;padding:40px 0;border-bottom:3px solid #7C3AED;margin-bottom:20px}
        .cover h1{font-size:24px;color:#7C3AED;font-weight:bold}
        .cover p{color:#6B7280;margin-top:6px}
        .section{margin-bottom:24px;page-break-inside:auto}
        .section h2{font-size:13px;font-weight:bold;color:#1F2937;background:#F3F4F6;padding:6px 10px;border-left:4px solid #7C3AED;margin-bottom:6px}
        .count{font-size:10px;color:#7C3AED;font-weight:normal;margin-left:8px}
        .group-label{font-size:10px;color:#6B7280;font-style:italic;margin:8px 0 4px}
        .empty{color:#9CA3AF;padding:8px;font-style:italic}
        .table-wrap{width:100%;page-break-inside:auto;margin-bottom:10px}
        table{width:100%;border-collapse:collapse;font-size:10px}
        th{background:#7C3AED;color:white;padding:5px 7px;text-align:left;word-break:break-word}
        td{padding:4px 7px;border-bottom:1px solid #F3F4F6;word-break:break-word;overflow-wrap:break-word}
        tr:nth-child(even) td{background:#FAFAFA}
        .footer{text-align:center;color:#9CA3AF;font-size:9px;margin-top:20px;border-top:1px solid #E5E7EB;padding-top:10px}
        @media print{.section h2{page-break-after:avoid}.group-label{page-break-after:avoid}}
      </style></head><body>
      <div class="cover">
        <h1>🗄 OdooERP — Full Data Backup</h1>
        <p>Generated: ${date}</p>
        <p>Tables: ${selectedTables.length} · Total Records: ${Object.values(data).reduce((s,r)=>s+r.length,0).toLocaleString('en-IN')}</p>
      </div>
      ${sections}
      <div class="footer">OdooERP System • ${date} • Confidential Business Data</div>
      </body></html>`;

      const win = window.open('','_blank');
      if(win) { win.document.write(html); win.document.close(); setTimeout(()=>win.print(),800); }
      const now = new Date().toLocaleString('en-IN');
      localStorage.setItem('last_backup', now);
      setLastBackup(now);
      setPdfStatus('done');
    } catch(e: any) {
      console.error('PDF export failed:', e);
      setExportError(e?.message || String(e) || 'Unknown error during PDF export.');
      setPdfStatus('error');
    }
  };

  const allSelected = selectedTables.length === tables.length;

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-gradient-to-br from-violet-600 to-indigo-700 rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2"><Database size={22}/><h2 className="text-xl font-bold">Data Backup & Export</h2></div>
            <p className="text-violet-200 text-sm">Export all your ERP data to Excel or PDF. Save to your laptop, USB drive, or Google Drive.</p>
          </div>
          <Shield size={40} className="text-violet-300 opacity-50"/>
        </div>
        {lastBackup && (
          <div className="mt-4 flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2 text-sm">
            <Clock size={14} className="text-violet-200"/>
            <span className="text-violet-200">Last backup: <span className="text-white font-medium">{lastBackup}</span></span>
          </div>
        )}
      </div>

      {/* ── Download Everything Button ── */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-5 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0">📦</div>
          <div className="flex-1">
            <h3 className="font-bold text-white text-lg">Download Everything as ZIP</h3>
            <p className="text-violet-200 text-xs mt-0.5">Excel data + all contact & employee documents in one ZIP file</p>
            {zipStatus==='fetching' && <p className="text-yellow-300 text-xs mt-1 animate-pulse">{zipProgress}</p>}
          </div>
          <button onClick={downloadAllZip} disabled={zipStatus==='fetching'}
            className="flex items-center gap-2 px-5 py-3 bg-white text-violet-700 rounded-xl font-bold text-sm hover:bg-violet-50 transition-colors disabled:opacity-60 flex-shrink-0">
            {zipStatus==='fetching'?<><Loader size={16} className="animate-spin text-violet-600"/>Working...</>
            :zipStatus==='done'?<><CheckCircle size={16} className="text-green-600"/>Download Again</>
            :zipStatus==='error'?<>⚠️ Retry</>
            :<><Package size={16}/>Download ZIP</>}
          </button>
        </div>
      </div>

      {/* Export buttons */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Excel */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-2xl">📊</div>
            <div>
              <h3 className="font-bold text-gray-800">Export to Excel</h3>
              <p className="text-xs text-gray-400">One sheet per module. Open in Excel, Google Sheets.</p>
            </div>
          </div>
          <ul className="text-xs text-gray-500 space-y-1 mb-4">
            <li>✓ All tables in one .xlsx file</li>
            <li>✓ Summary sheet with record counts</li>
            <li>✓ Auto column widths</li>
            <li>✓ Filter & sort in Excel</li>
          </ul>
          <button onClick={exportExcel} disabled={excelStatus==='fetching'||selectedTables.length===0}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-colors disabled:opacity-60 ${excelStatus==='error'?'bg-red-600 hover:bg-red-700 text-white':'bg-green-600 hover:bg-green-700 text-white'}`}>
            {excelStatus==='fetching'?<><Loader size={16} className="animate-spin"/>Exporting...</>
            :excelStatus==='done'?<><CheckCircle size={16}/>Downloaded! Export Again</>
            :excelStatus==='error'?<>⚠️ Failed — Click to Retry</>
            :<><Table size={16}/>Download Excel (.xlsx)</>}
          </button>
        </div>

        {/* PDF */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center text-2xl">📄</div>
            <div>
              <h3 className="font-bold text-gray-800">Export to PDF</h3>
              <p className="text-xs text-gray-400">Printable report of all data. Save as PDF file.</p>
            </div>
          </div>
          <ul className="text-xs text-gray-500 space-y-1 mb-4">
            <li>✓ All tables in one PDF</li>
            <li>✓ Formatted tables</li>
            <li>✓ Print or save as PDF</li>
            <li>✓ Max 100 rows per table shown</li>
            <li>✓ Wide tables split into readable column groups</li>
          </ul>
          <button onClick={exportPDF} disabled={pdfStatus==='fetching'||selectedTables.length===0}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-colors disabled:opacity-60 ${pdfStatus==='error'?'bg-red-700 hover:bg-red-800 text-white':'bg-red-500 hover:bg-red-600 text-white'}`}>
            {pdfStatus==='fetching'?<><Loader size={16} className="animate-spin"/>Generating...</>
            :pdfStatus==='done'?<><CheckCircle size={16}/>Generated! Export Again</>
            :pdfStatus==='error'?<>⚠️ Failed — Click to Retry</>
            :<><FileText size={16}/>Download PDF Report</>}
          </button>
        </div>
      </div>

      {/* Export error */}
      {exportError && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">
          <strong>⚠️ Export failed:</strong> {exportError}
        </div>
      )}

      {/* Table selector */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800">Select Tables to Export <span className="text-violet-500">({selectedTables.length}/{tables.length})</span></h3>
          <button onClick={()=>setSelectedTables(allSelected?[]:tables.map(t=>t.key))}
            className="text-xs text-violet-600 hover:text-violet-800 font-medium px-3 py-1.5 bg-violet-50 rounded-lg">
            {allSelected?'Deselect All':'Select All'}
          </button>
        </div>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
          {tables.map(table=>{
            const selected = selectedTables.includes(table.key);
            return (
              <button key={table.key} onClick={()=>toggleTable(table.key)}
                className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all ${selected?'border-violet-300 bg-violet-50':'border-gray-100 bg-gray-50 opacity-60 hover:opacity-80'}`}>
                <span className="text-base">{table.icon}</span>
                <span className="text-xs font-medium text-gray-700 truncate">{table.label}</span>
                {selected && <CheckCircle size={12} className="text-violet-500 ml-auto flex-shrink-0"/>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Progress log */}
      {progress.length > 0 && (
        <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className="bg-gray-900 rounded-2xl p-4">
          <p className="text-xs font-bold text-gray-400 mb-2">Export Progress:</p>
          <div className="space-y-0.5 max-h-48 overflow-y-auto">
            {progress.map((line,i)=>(
              <p key={i} className={`text-xs font-mono ${line.startsWith('✓')?'text-green-400':line.startsWith('⚠')?'text-yellow-400':'text-red-400'}`}>{line}</p>
            ))}
          </div>
        </motion.div>
      )}

      {/* Restore from backup */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-2xl">♻️</div>
          <div>
            <h3 className="font-bold text-gray-800">Restore from Backup</h3>
            <p className="text-xs text-gray-400">Upload a previous Excel backup to recover missing records.</p>
          </div>
        </div>
        <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700">
          <strong>🛡️ Safe by design:</strong> This never deletes or overwrites anything automatically. It only shows you what's <strong>missing</strong> from your live data, and adds back only what you approve.
        </div>

        {restoreStatus==='idle' && (
          <label className="mt-4 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-8 cursor-pointer hover:border-amber-300 hover:bg-amber-50/50 transition-colors">
            <Database size={28} className="text-gray-300"/>
            <span className="text-sm text-gray-500">Click to upload your backup .xlsx file</span>
            <input type="file" accept=".xlsx" className="hidden" onChange={e=>{ const f=e.target.files?.[0]; if(f) handleRestoreFile(f); }}/>
          </label>
        )}

        {(restoreStatus==='reading'||restoreStatus==='comparing') && (
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-500 py-6 justify-center">
            <Loader size={16} className="animate-spin"/> {restoreStatus==='reading'?'Reading backup file...':'Comparing against your live data...'}
          </div>
        )}

        {restoreStatus==='error' && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            ⚠️ {restoreError}
            <button onClick={()=>setRestoreStatus('idle')} className="ml-3 underline">Try again</button>
          </div>
        )}

        {restoreStatus==='ready' && (() => {
          const newRows = restorePreview.filter(r=>r.status==='new');
          const existsRows = restorePreview.filter(r=>r.status==='exists');
          const byTableNew: Record<string, RestoreRowState[]> = {};
          for (const r of newRows) { (byTableNew[r.tableLabel] ||= []).push(r); }
          return (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{newRows.length}</p>
                  <p className="text-xs text-green-700">Missing — can be restored</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-gray-500">{existsRows.length}</p>
                  <p className="text-xs text-gray-500">Already exist — will be skipped</p>
                </div>
              </div>

              {newRows.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">✅ Nothing missing — your live data already has every record from this backup.</p>
              ) : (
                <div className="max-h-80 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-100">
                  {Object.entries(byTableNew).map(([label, rows]) => (
                    <div key={label} className="p-3">
                      <p className="text-xs font-bold text-gray-600 mb-2">{label} — {rows.length} missing record(s)</p>
                      {rows.slice(0,8).map((r,i) => (
                        <label key={i} className="flex items-center gap-2 py-1 text-xs text-gray-600 cursor-pointer">
                          <input type="checkbox" checked={restoreSelectedNewIds.has(r.row.id)} onChange={()=>toggleRestoreRow(r.row.id)} className="rounded"/>
                          <span className="truncate">{r.row.bill_number || r.row.name || r.row.employee_name || r.row.product_name || r.row.vendor_name || r.row.date || r.row.id}</span>
                        </label>
                      ))}
                      {rows.length > 8 && <p className="text-xs text-gray-400 pl-6">...and {rows.length-8} more</p>}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={()=>{setRestoreStatus('idle');setRestorePreview([]);}} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600">Cancel</button>
                {newRows.length>0 && (
                  <button onClick={runRestore} disabled={restoreSelectedNewIds.size===0} className="flex-1 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50">
                    Restore {restoreSelectedNewIds.size} selected record(s)
                  </button>
                )}
              </div>
            </div>
          );
        })()}

        {restoreStatus==='restoring' && (
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-500 py-6 justify-center">
            <Loader size={16} className="animate-spin"/> Restoring records...
          </div>
        )}

        {restoreStatus==='done' && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
            ✅ Restore complete! Refresh the relevant page (e.g. Attendance) to see the recovered records.
            <button onClick={()=>{setRestoreStatus('idle');setRestorePreview([]);setRestoreProgress([]);}} className="ml-3 underline">Restore another file</button>
          </div>
        )}

        {restoreProgress.length > 0 && (restoreStatus==='comparing'||restoreStatus==='restoring'||restoreStatus==='done') && (
          <div className="mt-3 bg-gray-900 rounded-xl p-3 max-h-32 overflow-y-auto">
            {restoreProgress.map((line,i)=>(
              <p key={i} className={`text-xs font-mono ${line.startsWith('✓')?'text-green-400':line.startsWith('⚠')?'text-yellow-400':line.startsWith('✗')?'text-red-400':'text-gray-400'}`}>{line}</p>
            ))}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
        <h3 className="font-bold text-blue-800 mb-3">💡 How to save to USB Drive / Google Drive</h3>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 text-sm text-blue-700">
          <div>
            <p className="font-semibold mb-1">📥 After downloading Excel/PDF:</p>
            <ol className="space-y-1 text-xs list-decimal list-inside">
              <li>File will go to your Downloads folder</li>
              <li>Copy file (Ctrl+C)</li>
              <li>Open USB drive or Google Drive folder</li>
              <li>Paste (Ctrl+V) → Done! ✅</li>
            </ol>
          </div>
          <div>
            <p className="font-semibold mb-1">☁️ Upload to Google Drive:</p>
            <ol className="space-y-1 text-xs list-decimal list-inside">
              <li>Go to drive.google.com</li>
              <li>Click "+ New" → File upload</li>
              <li>Select the downloaded file</li>
              <li>Accessible from any device! ✅</li>
            </ol>
          </div>
        </div>
        <div className="mt-3 p-3 bg-white rounded-xl text-xs text-blue-600">
          <strong>💾 Recommended:</strong> Take backup every week. Your Supabase data is safe in cloud, but having local copy gives you extra security.
        </div>
        <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700">
          <strong>📄 PDF tip:</strong> In the print window, check that <strong>Layout</strong> is set to <strong>Landscape</strong> (not Portrait) before clicking Save — this prevents wide tables like Purchase Items from getting columns cut off the page.
        </div>
      </div>
    </div>
  );
};

export default Backup;
