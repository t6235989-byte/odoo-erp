import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Edit2, X, FileText, Search, Eye, Copy, Settings } from 'lucide-react';
import { handleEnterAsTab } from '../lib/formNav';

type OFTemplate = {
  showLogo: boolean; logoSize: number;
  line1: string; line1Color: string;
  line2: string; line2Color: string;
  tagline: string;
  gstin: string; bank: string; accountNo: string; ifsc: string;
  mobile1: string; mobile2: string; email: string;
  officeAddress: string;
  noteText: string;
  termsLine: string;
  forLine: string; signatoryText: string;
};

const DEFAULT_OF_TEMPLATE: OFTemplate = {
  showLogo: true, logoSize: 70,
  line1: 'PUNJAB HITECH AGRO', line1Color: '#22c55e',
  line2: 'MACHINERY WORKS', line2Color: '#1e3a8a',
  tagline: 'Mfrs. & Suppliers of : MODERN RICE SHELLING PLANTS, PARBOILING PLANTS, PADDY DRIER, & ALL KINDS OF RICE SHELLER REPAIRS & SPARES',
  gstin: '03AMDPT2761L1ZV', bank: 'AXIS BANK', accountNo: '924020019371354', ifsc: 'UTIB0000304',
  mobile1: '94786-60161', mobile2: '94630-53786', email: 'tahir786punjabhitechagro@gmail.com',
  officeAddress: 'BHOGLA ROAD, NEAR CITI HOSPITAL, RAJPURA, DISTT. PATIALA, PUNJAB, 140401',
  noteText: "GST 18% on Rice Machines.28%Electric Motor Chassis, Elevator, Readymade Cone. GST will be applicable extra at the time (if applicable). Transportation Charges Extra.",
  termsLine: 'Terms & Condition are on Backside.',
  forLine: 'For PUNJAB HITECH AGRO MACHINERY WORKS', signatoryText: 'AUTH. SIGNATORY',
};

type OFItem = { id?: string; order_form_id?: string; sno: number; particulars: string; description?: string; qty: number; rate: number; amount: number; };
type OrderForm = {
  id?: string; order_no: string; date: string;
  customer_name: string; customer_address: string; customer_mobile: string; customer_gstin: string;
  gst_rate: number; gst_applicable: boolean;
  advance_amount: number; advance_ref: string;
  extra_fields: string; notes: string; status: string; total_amount: number;
};

const emptyOF = (): OrderForm => ({
  order_no: '', date: new Date().toISOString().split('T')[0],
  customer_name: '', customer_address: '', customer_mobile: '', customer_gstin: '',
  gst_rate: 18, gst_applicable: true, advance_amount: 0, advance_ref: '',
  extra_fields: '[]', notes: '', status: 'Draft', total_amount: 0,
});
const emptyItem = (sno: number): OFItem => ({ sno, particulars: '', description: '', qty: 1, rate: 0, amount: 0 });
const fmt = (d: string) => { if (!d) return ''; const [y, m, dd] = d.split('-'); return `${dd}-${m}-${y}`; };
const fmtAmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2 });

export default function OrderForm() {
  const [orders, setOrders] = useState<OrderForm[]>([]);
  const [items, setItems] = useState<Record<string, OFItem[]>>({});
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [editing, setEditing] = useState<OrderForm | null>(null);
  const [form, setForm] = useState<OrderForm>(emptyOF());
  const [formItems, setFormItems] = useState<OFItem[]>([emptyItem(1), emptyItem(2), emptyItem(3), emptyItem(4)]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [previewO, setPreviewO] = useState<OrderForm | null>(null);
  const [previewItems, setPreviewItems] = useState<OFItem[]>([]);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [template, setTemplate] = useState<OFTemplate>(DEFAULT_OF_TEMPLATE);
  const [templateSaving, setTemplateSaving] = useState(false);

  useEffect(() => { loadAll(); loadTemplate(); }, []);

  const loadTemplate = async () => {
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'orderform_template').single();
    if (data?.value) { try { setTemplate({ ...DEFAULT_OF_TEMPLATE, ...JSON.parse(data.value) }); } catch {} }
  };
  const saveTemplate = async (t: OFTemplate) => {
    setTemplateSaving(true);
    await supabase.from('app_settings').upsert({ key: 'orderform_template', value: JSON.stringify(t) }, { onConflict: 'key' });
    setTemplateSaving(false); showToast('Template saved ✓');
  };
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadAll = async () => {
    const { data: os } = await supabase.from('order_forms').select('*').order('created_at', { ascending: false });
    setOrders(os || []);
    if (os && os.length > 0) {
      const { data: its } = await supabase.from('order_form_items').select('*').in('order_form_id', os.map(o => o.id!));
      const grouped: Record<string, OFItem[]> = {};
      (its || []).forEach(i => { if (!grouped[i.order_form_id]) grouped[i.order_form_id] = []; grouped[i.order_form_id].push(i); });
      setItems(grouped);
    }
  };

  const genOrderNo = () => { const yr = new Date().getFullYear().toString().slice(2); return `OF-${yr}-${(orders.length + 1).toString().padStart(3, '0')}`; };

  const openNew = () => { setEditing(null); setForm({ ...emptyOF(), order_no: genOrderNo() }); setFormItems([emptyItem(1), emptyItem(2), emptyItem(3), emptyItem(4)]); setShowModal(true); };
  const openEdit = (o: OrderForm) => {
    setEditing(o); setForm({ ...o });
    const its = (items[o.id!] || []).sort((a, b) => a.sno - b.sno);
    setFormItems(its.length > 0 ? [...its, emptyItem(its.length + 1)] : [emptyItem(1), emptyItem(2), emptyItem(3), emptyItem(4)]);
    setShowModal(true);
  };
  const openPreview = (o: OrderForm) => {
    setPreviewO(o);
    setPreviewItems((items[o.id!] || []).filter(i => i.particulars?.trim()).sort((a, b) => a.sno - b.sno));
    setShowPreview(true);
  };

  // Autofill particulars from history, same pattern as Purchase / Quotation.
  const particularsHistory = (() => {
    const sorted = [...orders].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const map: Record<string, OFItem> = {};
    for (const o of sorted) for (const it of (items[o.id!] || [])) {
      const key = it.particulars.trim().toLowerCase();
      if (key && !map[key]) map[key] = it;
    }
    return map;
  })();
  const knownParticulars = Object.values(particularsHistory).map(i => i.particulars);

  const updateItem = (idx: number, field: keyof OFItem, val: any) => {
    const updated = [...formItems];
    updated[idx] = { ...updated[idx], [field]: val };
    if (field === 'particulars') {
      const hist = particularsHistory[String(val).trim().toLowerCase()];
      if (hist) { updated[idx].description = hist.description; updated[idx].rate = hist.rate; updated[idx].amount = updated[idx].qty * updated[idx].rate; }
    }
    if (field === 'qty' || field === 'rate') updated[idx].amount = updated[idx].qty * updated[idx].rate;
    if (idx === formItems.length - 1 && updated[idx].particulars) updated.push(emptyItem(formItems.length + 1));
    setFormItems(updated);
  };
  const removeItem = (idx: number) => { if (formItems.length <= 1) return; setFormItems(formItems.filter((_, i) => i !== idx).map((it, i) => ({ ...it, sno: i + 1 }))); };

  const calcTotals = (f = form, its = formItems) => {
    const validItems = its.filter(i => i.particulars.trim());
    const subtotal = validItems.reduce((s, i) => s + i.amount, 0);
    const gstAmt = f.gst_applicable ? Math.round(subtotal * f.gst_rate / 100) : 0;
    const total = subtotal + gstAmt;
    const balance = total - (f.advance_amount || 0);
    return { subtotal, gstAmt, total, balance };
  };

  const extraFields = (() => { try { return JSON.parse(form.extra_fields || '[]'); } catch { return []; } })() as { label: string; value: string }[];
  const setExtraFields = (list: { label: string; value: string }[]) => setForm({ ...form, extra_fields: JSON.stringify(list) });
  const addExtraField = () => setExtraFields([...extraFields, { label: '', value: '' }]);
  const updateExtraField = (i: number, key: 'label' | 'value', val: string) => { const l = [...extraFields]; l[i] = { ...l[i], [key]: val }; setExtraFields(l); };
  const removeExtraField = (i: number) => setExtraFields(extraFields.filter((_, idx) => idx !== i));

  const saveOrderForm = async () => {
    if (!form.customer_name.trim()) { showToast('Customer name required'); return; }
    setSaving(true);
    const { total } = calcTotals();
    const oData = { ...form, total_amount: total };
    const { id, ...rest } = oData;
    let oId = editing?.id;
    if (editing?.id) {
      await supabase.from('order_forms').update(rest).eq('id', editing.id);
      await supabase.from('order_form_items').delete().eq('order_form_id', editing.id);
    } else {
      const { data } = await supabase.from('order_forms').insert([rest]).select().single();
      oId = data?.id;
    }
    const validItems = formItems.filter(i => i.particulars.trim());
    if (oId && validItems.length > 0) {
      await supabase.from('order_form_items').insert(validItems.map((it, i) => ({
        order_form_id: oId, sno: i + 1, particulars: it.particulars, description: it.description || '', qty: it.qty, rate: it.rate, amount: it.amount,
      })));
    }
    showToast(editing ? 'Updated ✓' : 'Saved ✓');
    setSaving(false); setShowModal(false); loadAll();
  };

  const deleteOF = async (o: OrderForm) => { if (!confirm(`Delete ${o.order_no}?`)) return; await supabase.from('order_forms').delete().eq('id', o.id); showToast('Deleted'); loadAll(); };
  const duplicateOF = async (o: OrderForm) => {
    const its = items[o.id!] || []; const { id, ...rest } = o;
    const { data } = await supabase.from('order_forms').insert([{ ...rest, order_no: genOrderNo(), date: new Date().toISOString().split('T')[0], status: 'Draft' }]).select().single();
    if (data && its.length > 0) await supabase.from('order_form_items').insert(its.map(it => { const { id: iid, order_form_id, ...ir } = it; return { ...ir, order_form_id: data.id }; }));
    showToast('Duplicated ✓'); loadAll();
  };

  const printPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !previewO) return;
    const its = previewItems;
    const { subtotal, gstAmt, total, balance } = calcTotals(previewO, its);
    const t = template;
    let ef: { label: string; value: string }[] = [];
    try { ef = JSON.parse(previewO.extra_fields || '[]'); } catch {}
    const efHtml = ef.filter(f => f.label || f.value).map(f => `<div style="font-size:10pt;font-weight:bold;margin-top:2px">${f.label}${f.label && f.value ? ' : ' : ''}${f.value}</div>`).join('');

    const filled = its.filter(it => it.particulars?.trim());
    const blankRows = Math.max(0, 8 - filled.length);
    const rows = [
      ...filled.map((it, idx) => `<tr style="height:34px">
        <td style="border:1px solid #4c1d95;text-align:center;font-size:10pt;font-weight:bold">${idx + 1}</td>
        <td style="border:1px solid #4c1d95;padding:3px 8px;font-size:10pt;font-weight:bold">${it.particulars}${it.description ? `<br><span style="font-size:8.5pt;font-weight:normal;font-style:italic;color:#555">${it.description}</span>` : ''}</td>
        <td style="border:1px solid #4c1d95;text-align:center;font-size:10pt;font-weight:bold">${it.qty || ''}</td>
        <td style="border:1px solid #4c1d95;text-align:right;padding-right:6px;font-size:10pt;font-weight:bold">${it.rate ? fmtAmt(it.rate) : ''}</td>
        <td style="border:1px solid #4c1d95;text-align:right;padding-right:4px;font-size:10pt;font-weight:bold">${it.amount ? Math.floor(it.amount).toLocaleString('en-IN') : ''}</td>
        <td style="border:1px solid #4c1d95;text-align:left;font-size:10pt;font-weight:bold">${it.amount ? (it.amount % 1).toFixed(2).slice(2) : ''}</td>
      </tr>`),
      ...Array.from({ length: blankRows }, () => `<tr style="height:34px"><td style="border:1px solid #4c1d95"></td><td style="border:1px solid #4c1d95"></td><td style="border:1px solid #4c1d95"></td><td style="border:1px solid #4c1d95"></td><td style="border:1px solid #4c1d95"></td><td style="border:1px solid #4c1d95"></td></tr>`)
    ].join('');

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Order Form - ${previewO.order_no}</title>
    <style>
      * { margin:0;padding:0;box-sizing:border-box; }
      body { font-family:Arial,sans-serif;color:#000;background:#fff; }
      @media print { @page { size:A4 portrait; margin:8mm; } body{margin:0} .page{border:none} }
      @media screen { body{padding:10px;background:#f0f0f0} .page{width:210mm;min-height:297mm;margin:0 auto;background:#fff;padding:8mm;border:1px solid #ccc} }
      table { width:100%;border-collapse:collapse; }
    </style></head><body>
    <div class="page" style="border:2px solid #4c1d95;padding:10px">
      <div style="display:flex;justify-content:space-between;font-size:9pt;font-weight:bold;color:#4c1d95">
        <div>GSTIN : ${t.gstin}<br/>Bank : ${t.bank}<br/>A/C No. : ${t.accountNo}<br/>IFSC Code : ${t.ifsc}</div>
        <div style="text-align:center"><span style="border:1.5px solid #4c1d95;border-radius:14px;padding:4px 14px;font-weight:900">ORDER FORM</span></div>
        <div style="text-align:right">M : ${t.mobile1}<br/>${t.mobile2}<br/>E-mail : ${t.email}</div>
      </div>
      <div style="text-align:center;margin-top:8px">
        ${t.showLogo ? `<img src="/logo.png" style="width:${t.logoSize}px;height:${t.logoSize}px;object-fit:contain;float:left" onerror="this.style.display='none'"/>` : ''}
        <div style="font-size:24pt;font-weight:900;letter-spacing:1px"><span style="color:${t.line1Color}">${t.line1}</span> <span style="color:${t.line2Color}">${t.line2}</span></div>
        <div style="font-size:9pt;font-weight:bold;color:#4c1d95;margin-top:2px">${t.tagline}</div>
      </div>
      <div style="background:#312e81;color:#fff;text-align:center;font-size:9pt;font-weight:bold;padding:3px;margin-top:6px">OFFICE : ${t.officeAddress}</div>

      <div style="margin-top:10px;font-size:10.5pt;font-weight:bold;color:#312e81">
        <div style="text-align:right">Dated : ${fmt(previewO.date)}</div>
        <div style="margin-top:8px">TO : M/s ${previewO.customer_name.toUpperCase()}</div>
        ${previewO.customer_address ? `<div>${previewO.customer_address.toUpperCase()}</div>` : ''}
        <div style="display:flex;justify-content:space-between;margin-top:4px">
          <span>GSTIN : ${previewO.customer_gstin || ''}</span><span>MOBILE NO : ${previewO.customer_mobile || ''}</span>
        </div>
        ${efHtml}
      </div>

      <table style="margin-top:10px">
        <thead><tr style="background:#ede9fe">
          <th style="border:1px solid #4c1d95;padding:4px;font-size:9pt">SR.NO.</th>
          <th style="border:1px solid #4c1d95;padding:4px;font-size:9pt">DESCRIPTION OF GOODS</th>
          <th style="border:1px solid #4c1d95;padding:4px;font-size:9pt">QTY.</th>
          <th style="border:1px solid #4c1d95;padding:4px;font-size:9pt">RATE PER UNIT</th>
          <th colspan="2" style="border:1px solid #4c1d95;padding:4px;font-size:9pt">AMOUNT (RS. / P.)</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr><td colspan="4" style="border:1px solid #4c1d95;text-align:right;padding-right:6px;font-size:9pt;font-weight:bold">GST@${previewO.gst_applicable ? previewO.gst_rate : 0}%</td><td colspan="2" style="border:1px solid #4c1d95;text-align:right;padding-right:6px;font-size:10pt;font-weight:bold">${fmtAmt(gstAmt)}</td></tr>
          <tr><td colspan="4" style="border:1px solid #4c1d95;text-align:right;padding-right:6px;font-size:9pt;font-weight:bold">ADVANCE CASH / Ch. No. ${previewO.advance_ref || ''}</td><td colspan="2" style="border:1px solid #4c1d95;text-align:right;padding-right:6px;font-size:10pt;font-weight:bold">${fmtAmt(previewO.advance_amount || 0)}</td></tr>
          <tr style="background:#ede9fe"><td colspan="4" style="border:1px solid #4c1d95;text-align:right;padding-right:6px;font-size:10pt;font-weight:900">BALANCE</td><td colspan="2" style="border:1px solid #4c1d95;text-align:right;padding-right:6px;font-size:11pt;font-weight:900">${fmtAmt(balance)}</td></tr>
        </tfoot>
      </table>

      <div style="display:flex;justify-content:space-between;margin-top:14px;font-size:8.5pt">
        <div style="max-width:70%"><b>NOTE :-</b> ${t.noteText}<br/><b>${t.termsLine}</b> &nbsp; E. &amp; O. E.</div>
        <div style="text-align:right;font-weight:bold">${t.forLine}<br/><br/><br/>${t.signatoryText}</div>
      </div>
    </div>
    <script>window.onload=()=>{setTimeout(()=>window.print(),200)}</script>
    </body></html>`);
    printWindow.document.close();
  };

  const filtered = orders.filter(o => (o.order_no + o.customer_name).toLowerCase().includes(search.toLowerCase()));
  const { subtotal, gstAmt, total, balance } = calcTotals();

  return (
    <div className="space-y-5">
      {toast && <div className="fixed top-5 right-5 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm">{toast}</div>}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search order forms..." className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-200" />
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowTemplateEditor(true)} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"><Settings size={15} />Template</button>
          <button onClick={openNew} className="flex items-center gap-1.5 px-4 py-2 bg-purple-700 text-white rounded-lg text-sm font-medium hover:bg-purple-800"><Plus size={16} />New Order Form</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr>
            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Order No.</th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Date</th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Customer</th>
            <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500">Amount</th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Status</th>
            <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500">Actions</th>
          </tr></thead>
          <tbody>
            {filtered.map(o => (
              <tr key={o.id} className="border-t border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-800">{o.order_no}</td>
                <td className="px-4 py-2.5 text-gray-500">{fmt(o.date)}</td>
                <td className="px-4 py-2.5 text-gray-700">{o.customer_name}</td>
                <td className="px-4 py-2.5 text-right font-medium">₹{fmtAmt(o.total_amount)}</td>
                <td className="px-4 py-2.5"><span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-xs">{o.status}</span></td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => openPreview(o)} className="p-1.5 text-gray-400 hover:text-purple-600 rounded"><Eye size={15} /></button>
                    <button onClick={() => openEdit(o)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded"><Edit2 size={15} /></button>
                    <button onClick={() => duplicateOF(o)} className="p-1.5 text-gray-400 hover:text-green-600 rounded"><Copy size={15} /></button>
                    <button onClick={() => deleteOF(o)} className="p-1.5 text-gray-400 hover:text-red-600 rounded"><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-gray-400"><FileText className="mx-auto mb-2" size={28} />No order forms yet</td></tr>}
          </tbody>
        </table>
      </div>

      {/* ADD/EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto" onKeyDown={handleEnterAsTab}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-800 text-lg">{editing ? 'Edit Order Form' : 'New Order Form'}</h2>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Order No. *</label><input value={form.order_no} onChange={e => setForm({ ...form, order_no: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200" /></div>
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Date</label><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200" /></div>
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200">
                    <option>Draft</option><option>Confirmed</option><option>Delivered</option><option>Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="bg-purple-50 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-purple-700">CUSTOMER DETAILS</h3>
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Customer Name *</label><input value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Address</label><input value={form.customer_address} onChange={e => setForm({ ...form, customer_address: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" /></div>
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Mobile</label><input value={form.customer_mobile} onChange={e => setForm({ ...form, customer_mobile: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" /></div>
                </div>
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Customer GSTIN</label><input value={form.customer_gstin} onChange={e => setForm({ ...form, customer_gstin: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none font-mono" /></div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-purple-700">EXTRA TEXT FIELDS <span className="font-normal text-gray-400">(add anything, appears on the printed form)</span></h3>
                  <button onClick={addExtraField} className="flex items-center gap-1 text-xs font-medium text-purple-700"><Plus size={13} />Add Field</button>
                </div>
                {extraFields.length === 0 && <p className="text-xs text-gray-400">No extra fields. Click "+ Add Field" to add PO No., Reference No., etc.</p>}
                {extraFields.map((f, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input value={f.label} onChange={e => updateExtraField(i, 'label', e.target.value)} placeholder="Label (e.g. PO No.)" className="w-1/3 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none" />
                    <input value={f.value} onChange={e => updateExtraField(i, 'value', e.target.value)} placeholder="Value" className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none" />
                    <button onClick={() => removeExtraField(i)} className="text-red-400 hover:text-red-600"><X size={16} /></button>
                  </div>
                ))}
              </div>

              <datalist id="of-particulars-list">{knownParticulars.map(n => <option key={n} value={n} />)}</datalist>
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50"><tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-8">#</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Description of Goods</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 w-16">Qty</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 w-24">Rate (₹)</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 w-24">Amount (₹)</th>
                    <th className="w-8"></th>
                  </tr></thead>
                  <tbody>
                    {formItems.map((it, idx) => (
                      <tr key={idx} className="border-t border-gray-100">
                        <td className="px-3 py-1 text-xs text-gray-400">{idx + 1}</td>
                        <td className="px-1 py-1">
                          <input value={it.particulars} onChange={e => updateItem(idx, 'particulars', e.target.value)} list="of-particulars-list" placeholder="e.g. RICE DRYER 24 TON" className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-300" />
                          <input value={it.description || ''} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder="description / spec..." className="w-full border border-gray-100 rounded-lg px-2 py-1 text-[11px] italic text-gray-500 focus:outline-none mt-1" />
                        </td>
                        <td className="px-1 py-1"><input type="number" value={it.qty || ''} onChange={e => updateItem(idx, 'qty', Number(e.target.value))} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none" /></td>
                        <td className="px-1 py-1"><input type="number" value={it.rate || ''} onChange={e => updateItem(idx, 'rate', Number(e.target.value))} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-right focus:outline-none" /></td>
                        <td className="px-3 py-1 text-right text-xs font-medium">{it.amount ? fmtAmt(it.amount) : ''}</td>
                        <td className="px-1"><button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600"><X size={14} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-medium text-gray-700"><input type="checkbox" checked={form.gst_applicable} onChange={e => setForm({ ...form, gst_applicable: e.target.checked })} />Apply GST</label>
                  {form.gst_applicable && <div><label className="block text-xs font-medium text-gray-700 mb-1">GST Rate (%)</label><input type="number" value={form.gst_rate} onChange={e => setForm({ ...form, gst_rate: Number(e.target.value) })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" /></div>}
                </div>
                <div className="space-y-2">
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Advance Cash / Ch. No.</label><input value={form.advance_ref} onChange={e => setForm({ ...form, advance_ref: e.target.value })} placeholder="e.g. Ch. No. 167825" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" /></div>
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Advance Amount (₹)</label><input type="number" value={form.advance_amount || ''} onChange={e => setForm({ ...form, advance_amount: Number(e.target.value) })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" /></div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 flex justify-end">
                <div className="w-64 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>₹{fmtAmt(subtotal)}</span></div>
                  {form.gst_applicable && <div className="flex justify-between"><span className="text-gray-500">GST @{form.gst_rate}%</span><span>₹{fmtAmt(gstAmt)}</span></div>}
                  <div className="flex justify-between font-bold border-t border-gray-200 pt-1"><span>Total</span><span>₹{fmtAmt(total)}</span></div>
                  <div className="flex justify-between text-gray-500"><span>Advance</span><span>- ₹{fmtAmt(form.advance_amount || 0)}</span></div>
                  <div className="flex justify-between font-bold text-purple-700"><span>Balance</span><span>₹{fmtAmt(balance)}</span></div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600">Cancel</button>
              <button onClick={saveOrderForm} disabled={saving} className="px-5 py-2 bg-purple-700 text-white rounded-lg text-sm font-medium hover:bg-purple-800 disabled:opacity-60">{saving ? 'Saving...' : editing ? 'Update Order Form' : 'Save Order Form'}</button>
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW MODAL */}
      {showPreview && previewO && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">Preview — {previewO.order_no}</h2>
              <div className="flex gap-2">
                <button onClick={printPDF} className="px-3 py-1.5 bg-purple-700 text-white rounded-lg text-xs font-medium">Print / Save PDF</button>
                <button onClick={() => setShowPreview(false)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"><X size={14} /></button>
              </div>
            </div>
            <div className="p-5 text-sm text-gray-600">
              <p><b>{previewO.customer_name}</b> — {fmt(previewO.date)}</p>
              <p className="mt-1">{previewItems.length} item(s) — Total ₹{fmtAmt(previewO.total_amount)}</p>
              <p className="mt-2 text-xs text-gray-400">Click "Print / Save PDF" to see the full formatted order form and print it.</p>
            </div>
          </div>
        </div>
      )}

      {/* TEMPLATE EDITOR */}
      {showTemplateEditor && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto" onKeyDown={handleEnterAsTab}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl my-8">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">Order Form Template</h2>
              <button onClick={() => setShowTemplateEditor(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto text-sm">
              {([
                ['line1', 'Company Name Line 1'], ['line2', 'Company Name Line 2'], ['tagline', 'Tagline / Products list'],
                ['gstin', 'GSTIN'], ['bank', 'Bank Name'], ['accountNo', 'Account No.'], ['ifsc', 'IFSC Code'],
                ['mobile1', 'Mobile 1'], ['mobile2', 'Mobile 2'], ['email', 'E-mail'], ['officeAddress', 'Office Address'],
                ['noteText', 'Note (GST/transport terms)'], ['termsLine', 'Terms line'], ['forLine', 'For-company line'], ['signatoryText', 'Signatory label'],
              ] as [keyof OFTemplate, string][]).map(([key, label]) => (
                <div key={key}><label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                  <input value={template[key] as string} onChange={e => setTemplate({ ...template, [key]: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none" /></div>
              ))}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-100">
              <button onClick={() => setShowTemplateEditor(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600">Close</button>
              <button onClick={() => saveTemplate(template)} disabled={templateSaving} className="px-5 py-2 bg-purple-700 text-white rounded-lg text-sm font-medium">{templateSaving ? 'Saving...' : 'Save Template'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
