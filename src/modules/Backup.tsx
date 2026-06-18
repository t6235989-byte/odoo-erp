import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, FileText, Table, CheckCircle, Loader, Database, Shield, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';

type BackupStatus = 'idle' | 'fetching' | 'done' | 'error';

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
];

const Backup: React.FC = () => {
  const [excelStatus, setExcelStatus] = useState<BackupStatus>('idle');
  const [pdfStatus, setPdfStatus] = useState<BackupStatus>('idle');
  const [progress, setProgress] = useState<string[]>([]);
  const [selectedTables, setSelectedTables] = useState<string[]>(tables.map(t=>t.key));
  const [lastBackup, setLastBackup] = useState<string|null>(localStorage.getItem('last_backup')||null);

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

  // ── Excel Export ────────────────────────────────────────────────────────
  const exportExcel = async () => {
    setExcelStatus('fetching');
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
      for(const table of tables.filter(t=>selectedTables.includes(t.key))) {
        const rows = data[table.key];
        if(rows.length === 0) {
          const emptySheet = XLSX.utils.aoa_to_sheet([[`No data in ${table.label}`]]);
          XLSX.utils.book_append_sheet(wb, emptySheet, table.label.slice(0,31));
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
          const maxLen = Math.max(h.length, ...cleanRows.map(r=>String(r[h]||'').length).slice(0,50));
          maxWidths[i] = Math.min(Math.max(maxLen, 10), 40);
        });
        ws['!cols'] = maxWidths.map(w=>({wch:w}));
        XLSX.utils.book_append_sheet(wb, ws, table.label.slice(0,31));
      }

      const date = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `OdooERP_Backup_${date}.xlsx`);
      const now = new Date().toLocaleString('en-IN');
      localStorage.setItem('last_backup', now);
      setLastBackup(now);
      setExcelStatus('done');
    } catch(e) {
      setExcelStatus('error');
    }
  };

  // ── PDF Export ──────────────────────────────────────────────────────────
  const exportPDF = async () => {
    setPdfStatus('fetching');
    setProgress([]);
    try {
      const { data } = await fetchAllData();
      const date = new Date().toLocaleString('en-IN');

      const sections = tables.filter(t=>selectedTables.includes(t.key)).map(table => {
        const rows = data[table.key];
        if(!rows||rows.length===0) return `<div class="section"><h2>${table.icon} ${table.label}</h2><p class="empty">No data</p></div>`;
        const headers = Object.keys(rows[0]).filter(k=>!['id'].includes(k));
        const maxRows = 100; // limit per table in PDF
        return `
          <div class="section">
            <h2>${table.icon} ${table.label} <span class="count">${rows.length} records</span></h2>
            <div class="table-wrap">
            <table>
              <thead><tr>${headers.map(h=>`<th>${h.replace(/_/g,' ').toUpperCase()}</th>`).join('')}</tr></thead>
              <tbody>
                ${rows.slice(0,maxRows).map(row=>`<tr>${headers.map(h=>`<td>${row[h]??'-'}</td>`).join('')}</tr>`).join('')}
                ${rows.length>maxRows?`<tr><td colspan="${headers.length}" style="text-align:center;color:#9CA3AF">... and ${rows.length-maxRows} more records (see Excel for full data)</td></tr>`:''}
              </tbody>
            </table>
            </div>
          </div>`;
      }).join('');

      const html = `<html><head><title>OdooERP Backup ${date}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,sans-serif;padding:20px;color:#111;font-size:10px}
        .cover{text-align:center;padding:40px 0;border-bottom:3px solid #7C3AED;margin-bottom:20px}
        .cover h1{font-size:24px;color:#7C3AED;font-weight:bold}
        .cover p{color:#6B7280;margin-top:6px}
        .section{margin-bottom:24px;page-break-inside:avoid}
        .section h2{font-size:13px;font-weight:bold;color:#1F2937;background:#F3F4F6;padding:6px 10px;border-left:4px solid #7C3AED;margin-bottom:6px}
        .count{font-size:10px;color:#7C3AED;font-weight:normal;margin-left:8px}
        .empty{color:#9CA3AF;padding:8px;font-style:italic}
        .table-wrap{overflow-x:auto}
        table{width:100%;border-collapse:collapse;font-size:9px}
        th{background:#7C3AED;color:white;padding:4px 6px;text-align:left;white-space:nowrap}
        td{padding:3px 6px;border-bottom:1px solid #F3F4F6;white-space:nowrap;max-width:200px;overflow:hidden;text-overflow:ellipsis}
        tr:nth-child(even) td{background:#FAFAFA}
        .footer{text-align:center;color:#9CA3AF;font-size:9px;margin-top:20px;border-top:1px solid #E5E7EB;padding-top:10px}
        @media print{.section{page-break-inside:auto}.section h2{page-break-after:avoid}}
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
    } catch(e) {
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
            className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-60 transition-colors">
            {excelStatus==='fetching'?<><Loader size={16} className="animate-spin"/>Exporting...</>
            :excelStatus==='done'?<><CheckCircle size={16}/>Downloaded! Export Again</>
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
          </ul>
          <button onClick={exportPDF} disabled={pdfStatus==='fetching'||selectedTables.length===0}
            className="w-full flex items-center justify-center gap-2 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 disabled:opacity-60 transition-colors">
            {pdfStatus==='fetching'?<><Loader size={16} className="animate-spin"/>Generating...</>
            :pdfStatus==='done'?<><CheckCircle size={16}/>Generated! Export Again</>
            :<><FileText size={16}/>Download PDF Report</>}
          </button>
        </div>
      </div>

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
      </div>
    </div>
  );
};

export default Backup;
