import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Edit2, X, FileText, Download, Search, Eye, EyeOff, Copy } from 'lucide-react';

type QuotationItem = {
  id?: string; quotation_id?: string; sno: number;
  particulars: string; qty: number; load_value: number; rate: number; amount: number;
};
type Quotation = {
  id?: string; quotation_no: string; date: string;
  customer_name: string; customer_address: string; customer_mobile: string;
  subject: string; gst_rate: number; gst_applicable: boolean;
  discount_type: string; discount_value: number; discount_position: string; show_total_only: boolean; gst_label_only: boolean; visible_rows: string;
  notes: string; status: string; total_amount: number;
};

const emptyQ = (): Quotation => ({
  quotation_no: '', date: new Date().toISOString().split('T')[0],
  customer_name: '', customer_address: '', customer_mobile: '',
  subject: '', gst_rate: 18, gst_applicable: true,
  discount_type: 'none', discount_value: 0, discount_position: 'before_gst', show_total_only: false, gst_label_only: false, visible_rows: '{"gtotal":true,"less":true,"after_discount":true,"gst":true,"final_total":true}',
  notes: '', status: 'Draft', total_amount: 0,
});
const emptyItem = (sno: number): QuotationItem => ({ sno, particulars: '', qty: 1, load_value: 0, rate: 0, amount: 0 });
const fmt = (d: string) => { if (!d) return ''; const [y, m, dd] = d.split('-'); return `${dd}-${m}-${y}`; };
const fmtAmt = (n: number) => '₹ ' + n.toLocaleString('en-IN', { minimumFractionDigits: 0 });

export default function Quotation() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [items, setItems] = useState<Record<string, QuotationItem[]>>({});
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [editing, setEditing] = useState<Quotation | null>(null);
  const [form, setForm] = useState<Quotation>(emptyQ());
  const [formItems, setFormItems] = useState<QuotationItem[]>([emptyItem(1), emptyItem(2), emptyItem(3), emptyItem(4)]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [previewQ, setPreviewQ] = useState<Quotation | null>(null);
  const [previewItems, setPreviewItems] = useState<QuotationItem[]>([]);

  useEffect(() => { loadAll(); }, []);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadAll = async () => {
    const { data: qs } = await supabase.from('quotations').select('*').order('created_at', { ascending: false });
    setQuotations(qs || []);
    if (qs && qs.length > 0) {
      const { data: its } = await supabase.from('quotation_items').select('*').in('quotation_id', qs.map(q => q.id!));
      const grouped: Record<string, QuotationItem[]> = {};
      (its || []).forEach(i => { if (!grouped[i.quotation_id]) grouped[i.quotation_id] = []; grouped[i.quotation_id].push(i); });
      setItems(grouped);
    }
  };

  const genQNo = () => {
    const yr = new Date().getFullYear().toString().slice(2);
    const next = (quotations.length + 1).toString().padStart(3, '0');
    return `QT-${yr}-${next}`;
  };

  const openNew = () => { setEditing(null); setForm({ ...emptyQ(), quotation_no: genQNo() }); setFormItems([emptyItem(1), emptyItem(2), emptyItem(3), emptyItem(4)]); setShowModal(true); };
  const openEdit = (q: Quotation) => {
    setEditing(q); setForm({ ...q });
    const its = (items[q.id!] || []).sort((a, b) => a.sno - b.sno);
    setFormItems(its.length > 0 ? [...its, emptyItem(its.length + 1)] : [emptyItem(1), emptyItem(2), emptyItem(3), emptyItem(4)]);
    setShowModal(true);
  };
  const openPreview = (q: Quotation) => {
    setPreviewQ(q);
    setPreviewItems((items[q.id!] || []).filter(i => i.particulars && i.particulars.trim()).sort((a, b) => a.sno - b.sno));
    setShowPreview(true);
  };

  const updateItem = (idx: number, field: keyof QuotationItem, val: any) => {
    const updated = [...formItems];
    updated[idx] = { ...updated[idx], [field]: val };
    if (field === 'qty' || field === 'rate') updated[idx].amount = updated[idx].qty * updated[idx].rate;
    if (idx === formItems.length - 1 && updated[idx].particulars) updated.push(emptyItem(formItems.length + 1));
    setFormItems(updated);
  };
  const removeItem = (idx: number) => {
    if (formItems.length <= 1) return;
    setFormItems(formItems.filter((_, i) => i !== idx).map((it, i) => ({ ...it, sno: i + 1 })));
  };

  const calcTotals = (f = form) => {
    const validItems = formItems.filter(i => i.particulars.trim());
    const subtotal = validItems.reduce((s, i) => s + i.amount, 0);
    let discountAmt = 0;
    if (f.discount_type === 'percent') discountAmt = Math.round(subtotal * f.discount_value / 100);
    else if (f.discount_type === 'fixed') discountAmt = f.discount_value;
    const pos = f.discount_position || 'before_gst';
    // GST base depends on position
    const gstBase = pos === 'before_gst' ? subtotal - discountAmt : subtotal;
    const gstAmt = f.gst_applicable ? Math.round(gstBase * f.gst_rate / 100) : 0;
    const subtotalPlusGst = subtotal + gstAmt;
    const total = pos === 'before_gst'
      ? (subtotal - discountAmt) + gstAmt
      : subtotalPlusGst - discountAmt;
    return { subtotal, discountAmt, gstAmt, subtotalPlusGst, total };
  };

  const saveQuotation = async () => {
    if (!form.customer_name.trim()) { showToast('Customer name required'); return; }
    setSaving(true);
    const { total } = calcTotals();
    const qData = { ...form, total_amount: total };
    const { id, ...rest } = qData;
    let qId = editing?.id;
    if (editing?.id) {
      await supabase.from('quotations').update(rest).eq('id', editing.id);
      await supabase.from('quotation_items').delete().eq('quotation_id', editing.id);
    } else {
      const { data } = await supabase.from('quotations').insert([rest]).select().single();
      qId = data?.id;
    }
    const validItems = formItems.filter(i => i.particulars.trim());
    if (qId && validItems.length > 0) {
      await supabase.from('quotation_items').insert(validItems.map((it, i) => ({
        quotation_id: qId, sno: i + 1, particulars: it.particulars,
        qty: it.qty, load_value: it.load_value, rate: it.rate, amount: it.amount,
      })));
    }
    showToast(editing ? 'Updated ✓' : 'Saved ✓');
    setSaving(false); setShowModal(false); loadAll();
  };

  const deleteQ = async (q: Quotation) => {
    if (!confirm(`Delete ${q.quotation_no}?`)) return;
    await supabase.from('quotations').delete().eq('id', q.id);
    showToast('Deleted'); loadAll();
  };

  const duplicateQ = async (q: Quotation) => {
    const its = items[q.id!] || [];
    const { id, ...rest } = q;
    const { data } = await supabase.from('quotations').insert([{ ...rest, quotation_no: genQNo(), date: new Date().toISOString().split('T')[0], status: 'Draft' }]).select().single();
    if (data && its.length > 0) await supabase.from('quotation_items').insert(its.map(it => { const { id: iid, quotation_id, ...ir } = it; return { ...ir, quotation_id: data.id }; }));
    showToast('Duplicated ✓'); loadAll();
  };

  const calcPreviewTotals = (q: Quotation, its: QuotationItem[]) => {
    const subtotal = its.reduce((s, i) => s + i.amount, 0);
    let discountAmt = 0;
    if (q.discount_type === 'percent') discountAmt = Math.round(subtotal * q.discount_value / 100);
    else if (q.discount_type === 'fixed') discountAmt = q.discount_value;
    const pos = q.discount_position || 'before_gst';
    // before_gst: GST on (subtotal - discount)
    // after_gst: GST on subtotal, then deduct discount
    // after_gst_label: GST label only, then deduct discount from subtotal+gst
    let gstBase = subtotal;
    if (pos === 'before_gst') gstBase = subtotal - discountAmt;
    const gstAmt = q.gst_applicable ? Math.round(gstBase * q.gst_rate / 100) : 0;
    const subtotalPlusGst = subtotal + (pos !== 'before_gst' ? gstAmt : 0);
    const total = pos === 'before_gst'
      ? (subtotal - discountAmt) + gstAmt
      : subtotalPlusGst - discountAmt;
    return { subtotal, discountAmt, gstAmt, subtotalPlusGst, total };
  };

  const printPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !previewQ) return;
    const its = previewItems;
    const { subtotal, discountAmt, gstAmt, subtotalPlusGst, total } = calcPreviewTotals(previewQ, its);
    // Visibility helper for print
    let vr: Record<string,boolean> = {gtotal:true,less:true,after_discount:true,gst:true,final_total:true};
    try { vr = {...vr, ...JSON.parse(previewQ.visible_rows||'{}')}; } catch {}
    const V = (key: string) => vr[key] !== false;

    const filledIts = its.filter(it => it.particulars && it.particulars.trim());
    const blankRows = Math.max(0, 6 - filledIts.length);
    const itemRows = [
      ...filledIts.map((it, idx) => `<tr style="height:40px">
        <td style="border:1px solid #000;text-align:center;font-size:11pt;font-weight:bold">${idx + 1}</td>
        <td style="border:1px solid #000;padding:4px 8px;font-size:11pt;font-weight:bold">${it.particulars}</td>
        <td style="border:1px solid #000;text-align:center;font-size:11pt;font-weight:bold">${it.qty}</td>
        <td style="border:1px solid #000;text-align:center;font-size:11pt;font-weight:bold">${it.load_value||''}</td>
        <td style="border:1px solid #000;text-align:right;padding-right:6px;font-size:11pt;font-weight:bold">${it.rate?fmtAmt(it.rate):''}</td>
        <td style="border:1px solid #000;text-align:right;padding-right:6px;font-size:11pt;font-weight:bold">${it.amount?fmtAmt(it.amount):''}</td>
      </tr>`),
      ...Array.from({length:blankRows},()=>`<tr style="height:40px"><td style="border:1px solid #000"></td><td style="border:1px solid #000"></td><td style="border:1px solid #000"></td><td style="border:1px solid #000"></td><td style="border:1px solid #000"></td><td style="border:1px solid #000"></td></tr>`)
    ].join('');
    const _unused = Array.from({ length: Math.max(its.length, 6) }, (_, idx) => {
      const it = its[idx];
      return `<tr style="height:40px">
        <td style="border:1px solid #000;text-align:center;font-size:11px;font-weight:bold">${it ? idx + 1 : ''}</td>
        <td style="border:1px solid #000;padding:4px 6px;font-size:11px;font-weight:bold">${it ? it.particulars : ''}</td>
        <td style="border:1px solid #000;text-align:center;font-size:11px;font-weight:bold">${it ? it.qty : ''}</td>
        <td style="border:1px solid #000;text-align:center;font-size:11px;font-weight:bold">${it && it.load_value ? it.load_value : ''}</td>
        <td style="border:1px solid #000;text-align:right;padding-right:6px;font-size:11px;font-weight:bold">${it && it.rate ? fmtAmt(it.rate) : ''}</td>
        <td style="border:1px solid #000;text-align:right;padding-right:6px;font-size:11px;font-weight:bold">${it && it.amount ? fmtAmt(it.amount) : ''}</td>
      </tr>`;
    }).join('');

    // Build total rows based on options
    const pos = previewQ.discount_position || 'before_gst';
    const discLabel2 = previewQ.discount_type==='percent' ? `LESS ${previewQ.discount_value}%` : 'LESS';
    const R = (label: string, amt: string, bg='', color='#000') =>
      `<tr style="background:${bg}"><td colspan="4" style="border:1px solid #000"></td><td style="border:1px solid #000;text-align:right;padding-right:6px;font-size:11px;font-weight:bold;color:${color}">${label}</td><td style="border:1px solid #000;text-align:right;padding-right:6px;font-size:11px;font-weight:bold;color:${color}">${amt}</td></tr>`;
    const RB = (label: string, amt: string) =>
      `<tr style="background:#f3f4f6"><td colspan="4" style="border:1px solid #000"></td><td style="border:1px solid #000;text-align:right;padding-right:6px;font-size:12px;font-weight:900">${label}</td><td style="border:1px solid #000;text-align:right;padding-right:6px;font-size:12px;font-weight:900">${amt}</td></tr>`;
    const REmpty = (label: string, color='#1e3a8a') =>
      `<tr><td colspan="4" style="border:1px solid #000"></td><td style="border:1px solid #000;text-align:right;padding-right:6px;font-size:10px;font-weight:bold;color:${color}">${label}</td><td style="border:1px solid #000"></td></tr>`;

    let totalRows = '';
    if (previewQ.show_total_only) {
      totalRows = RB('TOTAL', fmtAmt(total));
    } else {
      if(V('gtotal')) totalRows += R('G.TOTAL', fmtAmt(subtotal));
      if (pos === 'before_gst') {
        if (discountAmt>0) { if(V('less')) totalRows += R(discLabel2, `- ${fmtAmt(discountAmt)}`, '', '#dc2626'); if(V('after_discount')) totalRows += R('TOTAL', fmtAmt(subtotal-discountAmt)); }
        if (previewQ.gst_applicable) {
          if (previewQ.gst_label_only) { if(V('gst')) totalRows += REmpty(`GSTN@${previewQ.gst_rate}%<br/>EXTRA`); if(V('final_total')) totalRows += RB('TOTAL', ''); }
          else { if(V('gst')) totalRows += R(`GSTN@${previewQ.gst_rate}%<br/>EXTRA`, fmtAmt(gstAmt), '', '#1e3a8a'); if(V('final_total')) totalRows += RB('TOTAL', fmtAmt(total)); }
        } else { if(V('final_total')) totalRows += RB('TOTAL', fmtAmt(total)); }
      } else if (pos === 'after_gst') {
        if (previewQ.gst_applicable) { if(V('gst')) totalRows += R(`GSTN@${previewQ.gst_rate}%<br/>EXTRA`, fmtAmt(gstAmt), '', '#1e3a8a'); totalRows += R('TOTAL', fmtAmt(subtotalPlusGst)); }
        if (discountAmt>0 && V('less')) totalRows += R(discLabel2, `- ${fmtAmt(discountAmt)}`, '', '#dc2626');
        if(V('final_total')) totalRows += RB('TOTAL', fmtAmt(total));
      } else {
        if (previewQ.gst_applicable) { if(V('gst')) totalRows += REmpty(`GSTN@${previewQ.gst_rate}%<br/>EXTRA`); totalRows += R('TOTAL', fmtAmt(subtotalPlusGst)); }
        if (discountAmt>0 && V('less')) totalRows += R(discLabel2, `- ${fmtAmt(discountAmt)}`, '', '#dc2626');
        if(V('final_total')) totalRows += RB('TOTAL', fmtAmt(total));
      }
    }

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Quotation - ${previewQ.quotation_no}</title>
    <style>
      * { margin:0;padding:0;box-sizing:border-box; }
      body { font-family:Arial,sans-serif;color:#000;background:#fff; }
      @media print {
        @page { size:A4 portrait; margin:8mm; }
        body { margin:0;padding:0; }
        .page { width:100%;min-height:277mm;padding:0; border:none; }
      }
      @media screen {
        body { padding:10px;background:#f0f0f0; }
        .page { width:210mm;min-height:297mm;margin:0 auto;background:#fff;padding:8mm;border:1px solid #ccc; }
      }
      table { width:100%;border-collapse:collapse; }
      th,td { font-size:11pt; }
    </style>
    </head><body>
    <div class="page">
      <!-- Header -->
      <div style="display:flex;align-items:flex-start;margin-bottom:6px">
        <img src="/logo.png" style="width:75px;height:75px;object-fit:contain;margin-right:12px;flex-shrink:0" onerror="this.style.display='none'"/>
        <div style="flex:1">
          <div style="text-align:right;font-size:10pt;font-weight:bold">E-mail : tahir786punjabhitechagro@gmail.com</div>
          <div style="font-size:28pt;font-weight:900;color:#22c55e;letter-spacing:3px;line-height:1.1">PUNJAB HITECH AGRO</div>
          <div style="font-size:24pt;font-weight:900;color:#1e3a8a;letter-spacing:3px;line-height:1.1">MACHINERY WORKS</div>
          <div style="display:flex;justify-content:space-between;margin-top:3px">
            <span style="font-size:9pt;font-weight:bold">OFFICE : BHOGLA ROAD, NEAR CITI HOSPITAL, RAJPURA, DISTT. PATIALA, PUNJAB, 140401</span>
            <span style="font-size:9pt;font-weight:bold;white-space:nowrap;margin-left:8px">M : 9478660161 , 9463053786</span>
          </div>
        </div>
      </div>
      <hr style="border:1.5px solid #000;margin:4px 0"/>

      <!-- Customer / Quotation Info -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin:8px 0">
        <div style="flex:1">
          <div style="font-size:11pt;font-weight:bold">T o</div>
          <div style="font-size:11pt;font-weight:bold;margin-top:3px">M / s - ${previewQ.customer_name.toUpperCase()}</div>
          ${previewQ.customer_address ? `<div style="font-size:11pt;font-weight:bold">A D D - ${previewQ.customer_address.toUpperCase()}</div>` : ''}
          ${previewQ.customer_mobile ? `<div style="font-size:11pt;font-weight:bold">M O B - ${previewQ.customer_mobile}</div>` : ''}
        </div>
        <div style="text-align:center;flex-shrink:0;padding:0 20px">
          <div style="font-size:15pt;font-weight:900;text-decoration:underline">QUOTATION</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:11pt;font-weight:bold">Dated- ${fmt(previewQ.date)}</div>
          <div style="font-size:11pt;font-weight:bold">No: ${previewQ.quotation_no}</div>
        </div>
      </div>

      ${previewQ.subject ? `<div style="font-size:11pt;font-weight:bold;text-decoration:underline;margin:5px 0">S U B J E C T : ${previewQ.subject.toUpperCase()}</div>` : ''}
      <div style="font-size:10pt;font-weight:bold;margin:5px 0;line-height:1.5">R E S P E C T E D &nbsp; S I R , &nbsp; I N &nbsp; R E F E R E N C E &nbsp; T O &nbsp; O U R &nbsp; D I S C U S S I O N , &nbsp; W E &nbsp; A R E &nbsp; P L E A S E D &nbsp; T O &nbsp; P R O V I D E &nbsp; O U R &nbsp; L O W E S T &nbsp; P R I C E &nbsp; F O R &nbsp; T H E &nbsp; A F O R E M E N T I O N E D &nbsp; M A C H I N E R Y , &nbsp; D E T A I L E D &nbsp; A S &nbsp; F O L L O W S :</div>

      <!-- Items Table -->
      <table style="width:100%;border-collapse:collapse;margin-top:6px">
        <thead>
          <tr style="background:#e5e7eb">
            <th style="border:1px solid #000;padding:6px 4px;font-size:10pt;width:42px;text-align:center">S.NO.</th>
            <th style="border:1px solid #000;padding:6px 8px;font-size:10pt;text-align:left">PARTICULARS</th>
            <th style="border:1px solid #000;padding:6px 4px;font-size:10pt;width:55px;text-align:center">QTY.</th>
            <th style="border:1px solid #000;padding:6px 4px;font-size:10pt;width:55px;text-align:center">LOAD</th>
            <th style="border:1px solid #000;padding:6px 8px;font-size:10pt;width:110px;text-align:right">RATE</th>
            <th style="border:1px solid #000;padding:6px 8px;font-size:10pt;width:110px;text-align:right">AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
          ${totalRows}
        </tbody>
      </table>

      <!-- Notes -->
      <div style="margin-top:14px;font-size:9.5pt;font-weight:bold;line-height:1.5">
        NOTE : TOTAL PLANT COMPLETE WITHOUT SWITCH STARTER, ELECTRIC WIRING, HUSKER RUBBER ROLL, POLISHER RUBBER, JALI, EMERY SALT, MAIN MOTOR, V-BELT AND PULLY SET, CIVIL WORK, PLUMBER WORK &amp; ABCD PLANT ETC.
      </div>
      ${previewQ.notes ? `<div style="margin-top:4px;font-size:9.5pt;font-weight:bold">${previewQ.notes}</div>` : ''}

      <div style="margin-top:10px;font-size:11pt;font-weight:bold;font-style:italic;color:#1e3a8a">FOR PUNJAB HITECH AGRO MACHINERY WORKS</div>
      <div style="margin-top:14px;font-size:11pt;font-weight:bold;color:#1e3a8a">AUTH. SIGNATORY</div>
      <div style="margin-top:6px;font-size:9.5pt;font-weight:bold;line-height:1.8">
        *GST 18% ON RICE MACHINERY.<br/>
        *QUOTATION IS VALID FOR 15 DAYS.<br/>
        *SUBJECT TO RAJPURA JURISDICTION.<br/>
        *ADVANCE 25% PAYMENT ON ORDER AND REST ON DELIVERY.<br/>
        *FREIGHT CHARGES EXTRA.
      </div>
      <hr style="border:1px solid #000;margin-top:14px"/>
    </div>
    <script>window.onload=()=>{window.print();}</script></body></html>`);
    printWindow.document.close();
  };

  const filtered = quotations.filter(q => !search || q.customer_name.toLowerCase().includes(search.toLowerCase()) || q.quotation_no.toLowerCase().includes(search.toLowerCase()) || (q.subject || '').toLowerCase().includes(search.toLowerCase()));
  const { subtotal, discountAmt, gstAmt, subtotalPlusGst, total } = calcTotals();

  // Visible rows helper
  const getVR = (f = form) => {
    try { return JSON.parse(f.visible_rows || '{}'); } catch { return {}; }
  };
  const isVisible = (key: string) => { const vr = getVR(); return vr[key] !== false; };
  const toggleRow = (key: string) => {
    const vr = getVR();
    vr[key] = !isVisible(key);
    setForm({...form, visible_rows: JSON.stringify(vr)});
  };
  const EyeBtn = ({rowKey}: {rowKey: string}) => (
    <button onClick={()=>toggleRow(rowKey)} className="ml-2 opacity-50 hover:opacity-100 transition-opacity flex-shrink-0" title={isVisible(rowKey)?'Hide from print':'Show in print'}>
      {isVisible(rowKey) ? <Eye size={12} className="text-gray-500"/> : <EyeOff size={12} className="text-red-400"/>}
    </button>
  );
  const STATUS_COLORS: Record<string, string> = { Draft:'bg-gray-100 text-gray-600', Sent:'bg-blue-100 text-blue-700', Accepted:'bg-green-100 text-green-700', Rejected:'bg-red-100 text-red-700' };

  return (
    <div className="space-y-4">
      {toast && <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded-xl shadow-lg text-sm">{toast}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {['Draft','Sent','Accepted','Rejected'].map(s=>(
          <div key={s} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500">{s}</p>
            <p className="text-2xl font-bold text-gray-800">{quotations.filter(q=>q.status===s).length}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search customer, quotation no..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 shadow-sm"/>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm">
          <Plus size={15}/> New Quotation
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-700 text-sm">📄 Quotations ({filtered.length})</h3>
        </div>
        {filtered.length===0?(
          <div className="text-center py-16 text-gray-400"><FileText size={32} className="mx-auto mb-2 opacity-30"/><p className="text-sm">No quotations yet.</p></div>
        ):(
          <div className="divide-y divide-gray-50">
            {filtered.map(q=>{
              const qItems=(items[q.id!]||[]).filter(i=>i.particulars);
              return(
                <div key={q.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-800 text-sm">{q.quotation_no}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[q.status]||'bg-gray-100 text-gray-600'}`}>{q.status}</span>
                      <span className="text-xs text-gray-400">{fmt(q.date)}</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-700 mt-0.5">{q.customer_name}</p>
                    {q.customer_address&&<p className="text-xs text-gray-400">{q.customer_address}</p>}
                    {q.subject&&<p className="text-xs text-blue-600 italic">{q.subject}</p>}
                    <p className="text-xs text-gray-400">{qItems.length} item{qItems.length!==1?'s':''}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 ml-4">
                    <p className="font-bold text-gray-800">₹{q.total_amount.toLocaleString('en-IN')}</p>
                    <div className="flex gap-1">
                      <button onClick={()=>openPreview(q)} className="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 flex items-center justify-center"><Eye size={14} className="text-blue-600"/></button>
                      <button onClick={()=>openEdit(q)} className="w-8 h-8 rounded-lg bg-amber-50 hover:bg-amber-100 flex items-center justify-center"><Edit2 size={14} className="text-amber-600"/></button>
                      <button onClick={()=>duplicateQ(q)} className="w-8 h-8 rounded-lg bg-green-50 hover:bg-green-100 flex items-center justify-center"><Copy size={14} className="text-green-600"/></button>
                      <button onClick={()=>deleteQ(q)} className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center"><Trash2 size={14} className="text-red-500"/></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal&&(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl my-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-3xl z-10">
              <h2 className="font-bold text-gray-800 text-lg">{editing?'Edit Quotation':'New Quotation'}</h2>
              <button onClick={()=>setShowModal(false)} className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X size={15}/></button>
            </div>
            <div className="p-6 space-y-5">
              {/* Header */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div><label className="block text-xs font-semibold text-gray-600 mb-1">Quotation No. *</label>
                  <input value={form.quotation_no} onChange={e=>setForm({...form,quotation_no:e.target.value})}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"/></div>
                <div><label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
                  <input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"/></div>
                <div><label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                  <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
                    {['Draft','Sent','Accepted','Rejected'].map(s=><option key={s}>{s}</option>)}
                  </select></div>
              </div>

              {/* Customer */}
              <div className="bg-blue-50 rounded-2xl p-4 space-y-3">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Customer Details</p>
                <div><label className="block text-xs font-semibold text-gray-600 mb-1">Customer Name *</label>
                  <input value={form.customer_name} onChange={e=>setForm({...form,customer_name:e.target.value})} placeholder="e.g. JDS Industries"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"/></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1">Address</label>
                    <input value={form.customer_address} onChange={e=>setForm({...form,customer_address:e.target.value})} placeholder="e.g. Nabha, PB"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"/></div>
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1">Mobile</label>
                    <input value={form.customer_mobile} onChange={e=>setForm({...form,customer_mobile:e.target.value})} placeholder="98XXXXXXXX" type="tel"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"/></div>
                </div>
                <div><label className="block text-xs font-semibold text-gray-600 mb-1">Subject</label>
                  <input value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})} placeholder="e.g. Rice Milling Plant Machinery"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"/></div>
              </div>

              {/* Items */}
              <div>
                <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Items</p>
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-8">#</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Particulars</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 w-16">Qty</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 w-16">Load</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 w-24">Rate (₹)</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 w-24">Amount (₹)</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {formItems.map((it,idx)=>(
                        <tr key={idx} className="border-t border-gray-100">
                          <td className="px-3 py-1 text-xs text-gray-400">{idx+1}</td>
                          <td className="px-1 py-1"><input value={it.particulars} onChange={e=>updateItem(idx,'particulars',e.target.value)} placeholder="Description..."
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300"/></td>
                          <td className="px-1 py-1"><input type="number" value={it.qty||''} onChange={e=>updateItem(idx,'qty',Number(e.target.value))}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-300"/></td>
                          <td className="px-1 py-1"><input type="number" value={it.load_value||''} onChange={e=>updateItem(idx,'load_value',Number(e.target.value))}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-300"/></td>
                          <td className="px-1 py-1"><input type="number" value={it.rate||''} onChange={e=>updateItem(idx,'rate',Number(e.target.value))}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-300"/></td>
                          <td className="px-3 py-1 text-xs font-semibold text-gray-700 text-right">{it.amount>0?'₹'+it.amount.toLocaleString('en-IN'):''}</td>
                          <td className="px-1 py-1"><button onClick={()=>removeItem(idx)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-red-50"><X size={12} className="text-red-400"/></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button onClick={()=>setFormItems([...formItems,emptyItem(formItems.length+1)])}
                  className="mt-2 text-xs text-blue-600 hover:underline flex items-center gap-1"><Plus size={12}/> Add Row</button>
              </div>

              {/* Discount + GST + Totals */}
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 space-y-3">
                  {/* Discount */}
                  <div className="bg-red-50 border border-red-100 rounded-2xl p-3">
                    <p className="text-xs font-bold text-red-700 mb-2">💸 Discount / LESS</p>
                    <div className="flex gap-2 mb-2">
                      {['none','percent','fixed'].map(t=>(
                        <button key={t} onClick={()=>setForm({...form,discount_type:t,discount_value:0})}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${form.discount_type===t?'bg-red-500 text-white border-red-500':'bg-white text-gray-600 border-gray-200'}`}>
                          {t==='none'?'No Discount':t==='percent'?'% Percent':'₹ Fixed'}
                        </button>
                      ))}
                    </div>
                    {form.discount_type!=='none'&&(
                      <>
                        <input type="number" value={form.discount_value||''} onChange={e=>setForm({...form,discount_value:Number(e.target.value)})}
                          placeholder={form.discount_type==='percent'?'e.g. 5 (for 5%)':'e.g. 5000'}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 bg-white"/>
                        <div>
                          <p className="text-xs font-semibold text-gray-600 mb-1.5">Where to apply LESS:</p>
                          <div className="space-y-1.5">
                            {[
                              {val:'before_gst',      label:'LESS before GST',           desc:'G.Total → LESS → Total → GST → Final Total'},
                              {val:'after_gst',       label:'LESS after GST (with amt)',  desc:'G.Total → GST ₹X → Total → LESS → Final Total'},
                              {val:'after_gst_label', label:'LESS after GST (label only)',desc:'G.Total → GST EXTRA → Total → LESS → Final Total'},
                            ].map(opt=>(
                              <button key={opt.val} onClick={()=>setForm({...form,discount_position:opt.val})}
                                className={`w-full text-left px-3 py-2 rounded-xl border text-xs transition-colors ${(form.discount_position||'before_gst')===opt.val?'bg-red-500 text-white border-red-500':'bg-white text-gray-600 border-gray-200 hover:border-red-300'}`}>
                                <span className="font-semibold">{opt.label}</span>
                                <span className={`block text-[10px] mt-0.5 ${(form.discount_position||'before_gst')===opt.val?'text-red-100':'text-gray-400'}`}>{opt.desc}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* GST */}
                  <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3">
                    <p className="text-xs font-bold text-blue-700 mb-2">🧾 GST Settings</p>
                    <div className="flex items-center gap-3 mb-2">
                      <input type="checkbox" id="gst" checked={form.gst_applicable} onChange={e=>setForm({...form,gst_applicable:e.target.checked})} className="w-4 h-4"/>
                      <label htmlFor="gst" className="text-sm font-semibold text-gray-700">Apply GST</label>
                      {form.gst_applicable&&(
                        <div className="flex items-center gap-1">
                          <input type="number" value={form.gst_rate} onChange={e=>setForm({...form,gst_rate:Number(e.target.value)})}
                            className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-xs text-center focus:outline-none bg-white"/>
                          <span className="text-xs text-gray-500">%</span>
                        </div>
                      )}
                    </div>
                    {/* Show total only toggle */}
                    <div className="flex items-center gap-3 border-t border-blue-100 pt-2">
                      <input type="checkbox" id="totalonly" checked={form.show_total_only} onChange={e=>setForm({...form,show_total_only:e.target.checked})} className="w-4 h-4"/>
                      <label htmlFor="totalonly" className="text-xs font-semibold text-gray-700">Show TOTAL only (hide all rows)</label>
                    </div>
                    <div className="flex items-center gap-3 border-t border-blue-100 pt-2">
                      <input type="checkbox" id="gstlabel" checked={form.gst_label_only} onChange={e=>setForm({...form,gst_label_only:e.target.checked})} className="w-4 h-4"/>
                      <label htmlFor="gstlabel" className="text-xs font-semibold text-gray-700">GST label only — no amount <span className="text-gray-400">(shows "GSTN@18% EXTRA" without ₹)</span></label>
                    </div>
                  </div>

                  {/* Notes */}
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1">Extra Notes</label>
                    <textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} rows={2} placeholder="Any additional notes..."
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200"/></div>
                </div>

                {/* Live Totals */}
                <div className="bg-gray-50 rounded-2xl p-4 min-w-[230px] space-y-1.5 h-fit">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Summary <span className="font-normal normal-case text-gray-400 text-[10px]">👁 = show in print</span></p>
                  <div className="flex justify-between text-sm items-center gap-1">
                    <div className="flex items-center gap-1"><span className="text-gray-500">G. Total</span><button onClick={()=>toggleRow('gtotal')} title={isVisible('gtotal')?'Hide':'Show'}>{isVisible('gtotal')?<Eye size={11} className="text-gray-400"/>:<EyeOff size={11} className="text-red-400"/>}</button></div>
                    <span className={`font-semibold ${!isVisible('gtotal')?'line-through text-gray-300':''}`}>₹{subtotal.toLocaleString('en-IN')}</span>
                  </div>
                  {discountAmt>0&&<div className="flex justify-between text-sm items-center gap-1">
                    <div className="flex items-center gap-1"><span className="text-red-500">LESS {form.discount_type==='percent'?`${form.discount_value}%`:''}</span><button onClick={()=>toggleRow('less')} title={isVisible('less')?'Hide':'Show'}>{isVisible('less')?<Eye size={11} className="text-gray-400"/>:<EyeOff size={11} className="text-red-400"/>}</button></div>
                    <span className={`font-semibold text-red-500 ${!isVisible('less')?'line-through text-gray-300':''}`}>- ₹{discountAmt.toLocaleString('en-IN')}</span>
                  </div>}
                  {discountAmt>0&&(form.discount_position||'before_gst')==='before_gst'&&<div className="flex justify-between text-sm items-center gap-1">
                    <div className="flex items-center gap-1"><span className="text-gray-500">After Discount</span><button onClick={()=>toggleRow('after_discount')} title={isVisible('after_discount')?'Hide':'Show'}>{isVisible('after_discount')?<Eye size={11} className="text-gray-400"/>:<EyeOff size={11} className="text-red-400"/>}</button></div>
                    <span className={`font-semibold ${!isVisible('after_discount')?'line-through text-gray-300':''}`}>₹{(subtotal-discountAmt).toLocaleString('en-IN')}</span>
                  </div>}
                  {form.gst_applicable&&<div className="flex justify-between text-sm items-center gap-1">
                    <div className="flex items-center gap-1"><span className="text-blue-600">GST @{form.gst_rate}%</span><button onClick={()=>toggleRow('gst')} title={isVisible('gst')?'Hide':'Show'}>{isVisible('gst')?<Eye size={11} className="text-gray-400"/>:<EyeOff size={11} className="text-red-400"/>}</button></div>
                    <span className={`font-semibold text-blue-600 ${!isVisible('gst')?'line-through text-gray-300':''}`}>{form.gst_label_only?'(label)':'₹'+gstAmt.toLocaleString('en-IN')}</span>
                  </div>}
                  <div className="border-t border-gray-200 pt-1.5 flex justify-between items-center gap-1">
                    <div className="flex items-center gap-1"><span className="font-bold text-gray-800">TOTAL</span><button onClick={()=>toggleRow('final_total')} title={isVisible('final_total')?'Hide':'Show'}>{isVisible('final_total')?<Eye size={11} className="text-gray-400"/>:<EyeOff size={11} className="text-red-400"/>}</button></div>
                    <span className={`font-black text-gray-800 text-lg ${!isVisible('final_total')?'line-through text-gray-300':''}`}>₹{total.toLocaleString('en-IN')}</span>
                  </div>
                  {form.show_total_only&&<p className="text-[10px] text-amber-600 bg-amber-50 rounded-lg px-2 py-1">ℹ️ Show TOTAL only mode on</p>}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 sticky bottom-0 bg-white rounded-b-3xl">
              <button onClick={()=>setShowModal(false)} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={saveQuotation} disabled={saving} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-60">
                {saving?'Saving...':editing?'Update Quotation':'Save Quotation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview&&previewQ&&(()=>{
        const { subtotal: ps, discountAmt: pd, gstAmt: pg, subtotalPlusGst: psg, total: pt } = calcPreviewTotals(previewQ, previewItems);
        return(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl my-4">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-3xl z-10">
                <h2 className="font-bold text-gray-800">Preview — {previewQ.quotation_no}</h2>
                <div className="flex gap-2">
                  <button onClick={printPDF} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold"><Download size={14}/> Print / Save PDF</button>
                  <button onClick={()=>setShowPreview(false)} className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X size={15}/></button>
                </div>
              </div>
              <div className="p-6">
                <div className="border-2 border-gray-300 p-5 rounded-xl font-mono text-xs">
                  <div className="flex items-start gap-4 mb-3">
                    <img src="/logo.png" alt="Logo" className="w-16 h-16 object-contain" onError={e=>{(e.target as any).style.display='none'}}/>
                    <div className="flex-1">
                      <div className="text-right text-[10px] font-semibold">E-mail : tahir786punjabhitechagro@gmail.com</div>
                      <div className="text-2xl font-black" style={{color:'#22c55e'}}>PUNJAB HITECH AGRO</div>
                      <div className="text-xl font-black" style={{color:'#1e3a8a'}}>MACHINERY WORKS</div>
                      <div className="flex justify-between text-[10px] font-semibold mt-1">
                        <span>OFFICE : BHOGLA ROAD, NEAR CITI HOSPITAL, RAJPURA, DISTT. PATIALA, PUNJAB, 140401</span>
                        <span>M : 9478660161 , 9463053786</span>
                      </div>
                    </div>
                  </div>
                  <hr className="border-black mb-3"/>
                  <div className="flex justify-between mb-2">
                    <div>
                      <div className="font-bold">T o</div>
                      <div className="font-bold">M / s - {previewQ.customer_name.toUpperCase()}</div>
                      {previewQ.customer_address&&<div className="font-bold">A D D - {previewQ.customer_address.toUpperCase()}</div>}
                      {previewQ.customer_mobile&&<div className="font-bold">M O B - {previewQ.customer_mobile}</div>}
                    </div>
                    <div className="text-center font-black text-base underline">QUOTATION</div>
                    <div className="text-right">
                      <div className="font-bold">Dated- {fmt(previewQ.date)}</div>
                      <div className="font-bold">No: {previewQ.quotation_no}</div>
                    </div>
                  </div>
                  {previewQ.subject&&<div className="font-bold underline mb-2">S U B J E C T : {previewQ.subject.toUpperCase()}</div>}
                  <div className="font-bold mb-3 text-[10px]">RESPECTED SIR, IN REFERENCE TO OUR DISCUSSION, WE ARE PLEASED TO PROVIDE OUR LOWEST PRICE FOR THE AFOREMENTIONED MACHINERY, DETAILED AS FOLLOWS:</div>
                  <table className="w-full border-collapse text-[10px]">
                    <thead><tr className="bg-gray-100">
                      <th className="border border-gray-400 p-1 w-6">S.NO.</th>
                      <th className="border border-gray-400 p-1 text-left">PARTICULARS</th>
                      <th className="border border-gray-400 p-1 w-10">QTY.</th>
                      <th className="border border-gray-400 p-1 w-10">LOAD</th>
                      <th className="border border-gray-400 p-1 w-20">RATE</th>
                      <th className="border border-gray-400 p-1 w-20">AMOUNT</th>
                    </tr></thead>
                    <tbody>
                      {previewItems.map((it,i)=>(
                        <tr key={i} className="h-8">
                          <td className="border border-gray-400 text-center font-bold">{i+1}</td>
                          <td className="border border-gray-400 px-2 font-bold">{it.particulars}</td>
                          <td className="border border-gray-400 text-center font-bold">{it.qty}</td>
                          <td className="border border-gray-400 text-center font-bold">{it.load_value||''}</td>
                          <td className="border border-gray-400 text-right pr-1 font-bold">{fmtAmt(it.rate)}</td>
                          <td className="border border-gray-400 text-right pr-1 font-bold">{fmtAmt(it.amount)}</td>
                        </tr>
                      ))}
                      {Array.from({length:Math.max(0,4-previewItems.length)},(_,i)=>(
                        <tr key={`e${i}`} className="h-8">{[...Array(6)].map((_,j)=><td key={j} className="border border-gray-400"></td>)}</tr>
                      ))}
                      {/* Total rows */}
                      {previewQ.show_total_only?(
                        <tr className="bg-gray-100">
                          <td colSpan={4} className="border border-gray-400"></td>
                          <td className="border border-gray-400 text-right pr-1 font-black">TOTAL</td>
                          <td className="border border-gray-400 text-right pr-1 font-black">{fmtAmt(pt)}</td>
                        </tr>
                      ):<>{/* Position-aware total rows */}
                        {(()=>{
                          let pvr: Record<string,boolean> = {gtotal:true,less:true,after_discount:true,gst:true,final_total:true}; try { pvr = {...pvr,...JSON.parse(previewQ.visible_rows||'{}')}; } catch {}
                          const VP = (k:string) => pvr[k] !== false;
                          const ppos = previewQ.discount_position||'before_gst';
                          const dl = previewQ.discount_type==='percent'?`LESS ${previewQ.discount_value}%`:'LESS';
                          const C4 = {colSpan:4,className:"border border-gray-400"};
                          const TL = (label:string,val:string,bold=false,red=false,empty=false) => (
                            <tr className={bold?"bg-gray-100":""}><td {...C4}></td>
                              <td className={`border border-gray-400 text-right pr-1 font-bold text-[10px] ${red?"text-red-600":bold?"text-blue-700":""}`}>{label}</td>
                              <td className={`border border-gray-400 text-right pr-1 ${bold?"font-black":"font-bold"} ${red?"text-red-600":""}`}>{empty?"":val}</td>
                            </tr>);
                          const gstLabel = `GSTN@${previewQ.gst_rate}% EXTRA`;
                          return <>
                            {VP('gtotal')&&TL('G.TOTAL',fmtAmt(ps))}
                            {ppos==='before_gst'&&<>
                              {pd>0&&VP('less')&&TL(dl,`- ${fmtAmt(pd)}`,false,true)}
                              {pd>0&&VP('after_discount')&&TL('TOTAL',fmtAmt(ps-pd))}
                              {previewQ.gst_applicable&&(previewQ.gst_label_only?<>{VP('gst')&&TL(gstLabel,'',false,false,true)}{VP('final_total')&&TL('TOTAL','',true,false,true)}</>:<>{VP('gst')&&TL(gstLabel,fmtAmt(pg))}{VP('final_total')&&TL('TOTAL',fmtAmt(pt),true)}</>)}
                              {!previewQ.gst_applicable&&VP('final_total')&&TL('TOTAL',fmtAmt(pt),true)}
                            </>}
                            {ppos==='after_gst'&&<>
                              {previewQ.gst_applicable&&<>{VP('gst')&&TL(gstLabel,fmtAmt(pg))}{TL('TOTAL',fmtAmt(ps+pg))}</>}
                              {pd>0&&VP('less')&&TL(dl,`- ${fmtAmt(pd)}`,false,true)}
                              {VP('final_total')&&TL('TOTAL',fmtAmt(pt),true)}
                            </>}
                            {ppos==='after_gst_label'&&<>
                              {previewQ.gst_applicable&&<>{VP('gst')&&TL(gstLabel,'',false,false,true)}{TL('TOTAL',fmtAmt(ps+pg))}</>}
                              {pd>0&&VP('less')&&TL(dl,`- ${fmtAmt(pd)}`,false,true)}
                              {VP('final_total')&&TL('TOTAL',fmtAmt(pt),true)}
                            </>}
                          </>;
                        })()}
                      </>}
                    </tbody>
                  </table>
                  <div className="mt-3 text-[9px] font-bold">NOTE : TOTAL PLANT COMPLETE WITHOUT SWITCH STARTER, ELECTRIC WIRING, HUSKER RUBBER ROLL, POLISHER RUBBER, JALI, EMERY SALT, MAIN MOTOR, V-BELT AND PULLY SET, CIVIL WORK, PLUMBER WORK & ABCD PLANT ETC.</div>
                  {previewQ.notes&&<div className="text-[9px] font-bold mt-1">{previewQ.notes}</div>}
                  <div className="mt-2 text-[10px] font-bold italic text-blue-800">FOR PUNJAB HITECH AGRO MACHINERY WORKS</div>
                  <div className="mt-2 text-[10px] font-bold text-blue-800">AUTH. SIGNATORY</div>
                  <div className="mt-1 text-[9px] font-bold leading-relaxed">*GST 18% ON RICE MACHINERY.<br/>*QUOTATION IS VALID FOR 15 DAYS.<br/>*SUBJECT TO RAJPURA JURISDICTION.<br/>*ADVANCE 25% PAYMENT ON ORDER AND REST ON DELIVERY.<br/>*FREIGHT CHARGES EXTRA.</div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
