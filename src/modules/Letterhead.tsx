import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Edit2, X, FileText, Search, Eye, Copy, Settings, AlignLeft, AlignCenter, AlignRight, Bold } from 'lucide-react';
import { handleEnterAsTab } from '../lib/formNav';

type LHTemplate = {
  showLogo: boolean; logoSize: number;
  line1: string; line1Color: string;
  line2: string; line2Color: string;
  tagline: string; taglineIntro: string;
  mobile: string; officeAddress: string;
};

const DEFAULT_LH_TEMPLATE: LHTemplate = {
  showLogo: true, logoSize: 90,
  line1: 'PUNJAB HITECH AGRO', line1Color: '#22c55e',
  line2: 'MACHINERY WORKS', line2Color: '#1e3a8a',
  taglineIntro: 'Mfrs. & Suppliers of :',
  tagline: 'Ultra Modern Rice Mills & Modern Rice Shelling Plants, Rice Whitener, Rice Cone Polishers (Sterling), Rice Grader, De-Stoner, Paddy Cleaner, Paddy Drier, Rice Cleaner, Paddy Separator, Silky Machine, Sizer, Plan Shifter, Centrifugal Machine, & All Kinds of Rice Sheller Repair & Spares.',
  mobile: '9478660161 , 9463053786',
  officeAddress: 'BHOGLA ROAD, NEAR CITI HOSPITAL, RAJPURA, DISTT. PATIALA, PUNJAB, 140401',
};

type Block = { id: string; text: string; align: 'left' | 'center' | 'right'; bold: boolean; size: number };
const newBlock = (): Block => ({ id: Math.random().toString(36).slice(2), text: '', align: 'left', bold: false, size: 12 });

type Letterhead = { id?: string; title: string; date: string; blocks_json: string; status: string; };
const emptyLH = (): Letterhead => ({ title: '', date: new Date().toISOString().split('T')[0], blocks_json: JSON.stringify([newBlock()]), status: 'Draft' });
const fmt = (d: string) => { if (!d) return ''; const [y, m, dd] = d.split('-'); return `${dd}-${m}-${y}`; };

export default function Letterhead() {
  const [docs, setDocs] = useState<Letterhead[]>([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [editing, setEditing] = useState<Letterhead | null>(null);
  const [form, setForm] = useState<Letterhead>(emptyLH());
  const [blocks, setBlocks] = useState<Block[]>([newBlock()]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [previewDoc, setPreviewDoc] = useState<Letterhead | null>(null);
  const [previewBlocks, setPreviewBlocks] = useState<Block[]>([]);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [template, setTemplate] = useState<LHTemplate>(DEFAULT_LH_TEMPLATE);
  const [templateSaving, setTemplateSaving] = useState(false);

  useEffect(() => { loadAll(); loadTemplate(); }, []);

  const loadTemplate = async () => {
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'letterhead_template').single();
    if (data?.value) { try { setTemplate({ ...DEFAULT_LH_TEMPLATE, ...JSON.parse(data.value) }); } catch {} }
  };
  const saveTemplate = async (t: LHTemplate) => {
    setTemplateSaving(true);
    await supabase.from('app_settings').upsert({ key: 'letterhead_template', value: JSON.stringify(t) }, { onConflict: 'key' });
    setTemplateSaving(false); showToast('Template saved ✓');
  };
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadAll = async () => {
    const { data } = await supabase.from('letterheads').select('*').order('created_at', { ascending: false });
    setDocs(data || []);
  };

  const openNew = () => { setEditing(null); setForm(emptyLH()); setBlocks([newBlock()]); setShowModal(true); };
  const openEdit = (d: Letterhead) => {
    setEditing(d); setForm({ ...d });
    try { setBlocks(JSON.parse(d.blocks_json || '[]')); } catch { setBlocks([newBlock()]); }
    setShowModal(true);
  };
  const openPreview = (d: Letterhead) => {
    setPreviewDoc(d);
    try { setPreviewBlocks(JSON.parse(d.blocks_json || '[]')); } catch { setPreviewBlocks([]); }
    setShowPreview(true);
  };

  const addBlock = () => setBlocks([...blocks, newBlock()]);
  const updateBlock = (id: string, field: keyof Block, val: any) => setBlocks(blocks.map(b => b.id === id ? { ...b, [field]: val } : b));
  const removeBlock = (id: string) => { if (blocks.length <= 1) return; setBlocks(blocks.filter(b => b.id !== id)); };
  const moveBlock = (idx: number, dir: -1 | 1) => {
    const target = idx + dir; if (target < 0 || target >= blocks.length) return;
    const copy = [...blocks]; [copy[idx], copy[target]] = [copy[target], copy[idx]]; setBlocks(copy);
  };

  const saveDoc = async () => {
    if (!form.title.trim()) { showToast('Title required'); return; }
    setSaving(true);
    const data = { ...form, blocks_json: JSON.stringify(blocks) };
    const { id, ...rest } = data;
    if (editing?.id) await supabase.from('letterheads').update(rest).eq('id', editing.id);
    else await supabase.from('letterheads').insert([rest]);
    showToast(editing ? 'Updated ✓' : 'Saved ✓');
    setSaving(false); setShowModal(false); loadAll();
  };

  const deleteDoc = async (d: Letterhead) => { if (!confirm(`Delete "${d.title}"?`)) return; await supabase.from('letterheads').delete().eq('id', d.id); showToast('Deleted'); loadAll(); };
  const duplicateDoc = async (d: Letterhead) => {
    const { id, ...rest } = d;
    await supabase.from('letterheads').insert([{ ...rest, title: rest.title + ' (Copy)', date: new Date().toISOString().split('T')[0], status: 'Draft' }]);
    showToast('Duplicated ✓'); loadAll();
  };

  const printPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !previewDoc) return;
    const t = template;
    const bodyHtml = previewBlocks.filter(b => b.text.trim()).map(b =>
      `<div style="text-align:${b.align};font-weight:${b.bold ? 900 : 400};font-size:${b.size}pt;margin-bottom:10px;white-space:pre-wrap">${b.text.replace(/</g, '&lt;')}</div>`
    ).join('');

    printWindow.document.write(`<!DOCTYPE html><html><head><title>${previewDoc.title}</title>
    <style>
      * { margin:0;padding:0;box-sizing:border-box; }
      body { font-family:Arial,sans-serif;color:#000;background:#fff; }
      @media print { @page { size:A4 portrait; margin:8mm; } body{margin:0} .page{border:none} }
      @media screen { body{padding:10px;background:#f0f0f0} .page{width:210mm;min-height:297mm;margin:0 auto;background:#fff;padding:8mm;border:1px solid #ccc} }
    </style></head><body>
    <div class="page">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:12px">
          ${t.showLogo ? `<img src="/logo.png" style="width:${t.logoSize}px;height:${t.logoSize}px;object-fit:contain" onerror="this.style.display='none'"/>` : ''}
          <div>
            <div style="font-size:26pt;font-weight:900"><span style="color:${t.line1Color}">${t.line1}</span> <span style="color:${t.line2Color}">${t.line2}</span></div>
          </div>
        </div>
        <div style="text-align:right;font-size:9pt;font-weight:bold;color:${t.line2Color}">M : ${t.mobile}</div>
      </div>
      <hr style="border:1.5px solid ${t.line2Color};margin:6px 0"/>
      <div style="text-align:center;font-size:10pt;font-weight:bold;color:${t.line2Color}">${t.taglineIntro}</div>
      <div style="text-align:center;font-size:9pt;font-weight:bold;color:${t.line2Color};margin-top:2px">${t.tagline}</div>
      <hr style="border:1.5px solid ${t.line2Color};margin:6px 0"/>

      <div style="text-align:right;font-size:10pt;font-weight:bold;margin-top:14px">Dated : ${fmt(previewDoc.date)}</div>
      <div style="margin-top:16px;min-height:420px">${bodyHtml}</div>

      <div style="position:absolute;bottom:14mm;left:8mm;right:8mm;text-align:center;font-size:9pt;font-weight:bold;color:${t.line2Color};border-top:1px solid ${t.line2Color};padding-top:4px">OFFICE : ${t.officeAddress}</div>
    </div>
    <script>window.onload=()=>{setTimeout(()=>window.print(),200)}</script>
    </body></html>`);
    printWindow.document.close();
  };

  const filtered = docs.filter(d => d.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-5">
      {toast && <div className="fixed top-5 right-5 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm">{toast}</div>}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search letters..." className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowTemplateEditor(true)} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"><Settings size={15} />Template</button>
          <button onClick={openNew} className="flex items-center gap-1.5 px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800"><Plus size={16} />New Letter</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr>
            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Title</th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Date</th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Status</th>
            <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500">Actions</th>
          </tr></thead>
          <tbody>
            {filtered.map(d => (
              <tr key={d.id} className="border-t border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-800">{d.title}</td>
                <td className="px-4 py-2.5 text-gray-500">{fmt(d.date)}</td>
                <td className="px-4 py-2.5"><span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs">{d.status}</span></td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => openPreview(d)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded"><Eye size={15} /></button>
                    <button onClick={() => openEdit(d)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded"><Edit2 size={15} /></button>
                    <button onClick={() => duplicateDoc(d)} className="p-1.5 text-gray-400 hover:text-green-600 rounded"><Copy size={15} /></button>
                    <button onClick={() => deleteDoc(d)} className="p-1.5 text-gray-400 hover:text-red-600 rounded"><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={4} className="text-center py-10 text-gray-400"><FileText className="mx-auto mb-2" size={28} />No letters yet — write anything on your letterhead and print it</td></tr>}
          </tbody>
        </table>
      </div>

      {/* ADD/EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto" onKeyDown={handleEnterAsTab}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-800 text-lg">{editing ? 'Edit Letter' : 'New Letter'}</h2>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2"><label className="block text-xs font-medium text-gray-700 mb-1">Title *</label><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Letter to ABC Traders" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" /></div>
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Date</label><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" /></div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-blue-700">LETTER CONTENT <span className="font-normal text-gray-400">— add text blocks anywhere, remove any you don't need</span></h3>
                  <button onClick={addBlock} className="flex items-center gap-1 text-xs font-medium text-blue-700"><Plus size={13} />Add Text Block</button>
                </div>
                <div className="space-y-3">
                  {blocks.map((b, idx) => (
                    <div key={b.id} className="border border-gray-200 rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <button onClick={() => updateBlock(b.id, 'align', 'left')} className={`p-1.5 rounded ${b.align === 'left' ? 'bg-blue-100 text-blue-700' : 'text-gray-400'}`}><AlignLeft size={14} /></button>
                        <button onClick={() => updateBlock(b.id, 'align', 'center')} className={`p-1.5 rounded ${b.align === 'center' ? 'bg-blue-100 text-blue-700' : 'text-gray-400'}`}><AlignCenter size={14} /></button>
                        <button onClick={() => updateBlock(b.id, 'align', 'right')} className={`p-1.5 rounded ${b.align === 'right' ? 'bg-blue-100 text-blue-700' : 'text-gray-400'}`}><AlignRight size={14} /></button>
                        <button onClick={() => updateBlock(b.id, 'bold', !b.bold)} className={`p-1.5 rounded ${b.bold ? 'bg-blue-100 text-blue-700' : 'text-gray-400'}`}><Bold size={14} /></button>
                        <select value={b.size} onChange={e => updateBlock(b.id, 'size', Number(e.target.value))} className="border border-gray-200 rounded px-1.5 py-1 text-xs">
                          {[9, 10, 11, 12, 14, 16, 18, 22].map(s => <option key={s} value={s}>{s}pt</option>)}
                        </select>
                        <div className="flex-1" />
                        <button onClick={() => moveBlock(idx, -1)} disabled={idx === 0} className="text-gray-400 disabled:opacity-30 text-xs px-1">↑</button>
                        <button onClick={() => moveBlock(idx, 1)} disabled={idx === blocks.length - 1} className="text-gray-400 disabled:opacity-30 text-xs px-1">↓</button>
                        <button onClick={() => removeBlock(b.id)} className="text-red-400 hover:text-red-600 ml-1"><Trash2 size={14} /></button>
                      </div>
                      <textarea value={b.text} onChange={e => updateBlock(b.id, 'text', e.target.value)} placeholder="Write anything here..." rows={3}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" style={{ textAlign: b.align, fontWeight: b.bold ? 700 : 400 }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600">Cancel</button>
              <button onClick={saveDoc} disabled={saving} className="px-5 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-60">{saving ? 'Saving...' : editing ? 'Update Letter' : 'Save Letter'}</button>
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW MODAL */}
      {showPreview && previewDoc && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">Preview — {previewDoc.title}</h2>
              <div className="flex gap-2">
                <button onClick={printPDF} className="px-3 py-1.5 bg-blue-700 text-white rounded-lg text-xs font-medium">Print / Save PDF</button>
                <button onClick={() => setShowPreview(false)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"><X size={14} /></button>
              </div>
            </div>
            <div className="p-5 text-sm text-gray-600 space-y-2">
              {previewBlocks.filter(b => b.text.trim()).map(b => <p key={b.id} style={{ textAlign: b.align, fontWeight: b.bold ? 700 : 400 }}>{b.text}</p>)}
              {previewBlocks.every(b => !b.text.trim()) && <p className="text-gray-400">This letter is empty so far.</p>}
            </div>
          </div>
        </div>
      )}

      {/* TEMPLATE EDITOR */}
      {showTemplateEditor && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto" onKeyDown={handleEnterAsTab}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl my-8">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">Letterhead Template</h2>
              <button onClick={() => setShowTemplateEditor(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto text-sm">
              {([
                ['line1', 'Company Name Line 1'], ['line2', 'Company Name Line 2'],
                ['taglineIntro', 'Tagline intro (e.g. "Mfrs. & Suppliers of :")'], ['tagline', 'Tagline / products list'],
                ['mobile', 'Mobile'], ['officeAddress', 'Office Address'],
              ] as [keyof LHTemplate, string][]).map(([key, label]) => (
                <div key={key}><label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                  <input value={template[key] as string} onChange={e => setTemplate({ ...template, [key]: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none" /></div>
              ))}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-100">
              <button onClick={() => setShowTemplateEditor(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600">Close</button>
              <button onClick={() => saveTemplate(template)} disabled={templateSaving} className="px-5 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium">{templateSaving ? 'Saving...' : 'Save Template'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
