import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Phone, Plus, Search, Edit2, Trash2, X, PhoneCall, History, ChevronDown, ChevronUp } from 'lucide-react';

type Contact = {
  id?: string; name: string; phone: string; phone2: string;
  category: string; company: string; address: string; notes: string;
};
type HistoryEntry = {
  id?: string; contact_id: string; work_date: string;
  work_description: string; rate: number; notes: string;
};

const CATEGORIES = ['All','Customer','Vendor','Painter','Welder','Transporter','Electrician','Mechanic','Plumber','Carpenter','Labour','Seller','Purchaser','Agent','Other'];
const CAT_COLORS: Record<string,string> = {
  Customer:'bg-blue-100 text-blue-700',Vendor:'bg-purple-100 text-purple-700',Painter:'bg-yellow-100 text-yellow-700',
  Welder:'bg-orange-100 text-orange-700',Transporter:'bg-cyan-100 text-cyan-700',Electrician:'bg-red-100 text-red-700',
  Mechanic:'bg-gray-100 text-gray-700',Plumber:'bg-teal-100 text-teal-700',Carpenter:'bg-amber-100 text-amber-700',
  Labour:'bg-lime-100 text-lime-700',Seller:'bg-green-100 text-green-700',Purchaser:'bg-indigo-100 text-indigo-700',
  Agent:'bg-pink-100 text-pink-700',Other:'bg-gray-100 text-gray-600',
};
const emptyC: Contact = { name:'',phone:'',phone2:'',category:'Other',company:'',address:'',notes:'' };
const emptyH = (cid=''):HistoryEntry => ({ contact_id:cid,work_date:new Date().toISOString().split('T')[0],work_description:'',rate:0,notes:'' });
const fmt = (d:string) => { if(!d) return ''; const [y,m,dd]=d.split('-'); return `${dd}/${m}/${y}`; };

export default function Contacts() {
  const [contacts,setContacts]=useState<Contact[]>([]);
  const [history,setHistory]=useState<HistoryEntry[]>([]);
  const [search,setSearch]=useState('');
  const [filterCat,setFilterCat]=useState('All');
  const [showModal,setShowModal]=useState(false);
  const [form,setForm]=useState<Contact>(emptyC);
  const [editing,setEditing]=useState<Contact|null>(null);
  const [expandedId,setExpandedId]=useState<string|null>(null);
  const [showHModal,setShowHModal]=useState(false);
  const [hForm,setHForm]=useState<HistoryEntry>(emptyH());
  const [editingH,setEditingH]=useState<HistoryEntry|null>(null);
  const [activeC,setActiveC]=useState<Contact|null>(null);
  const [loading,setLoading]=useState(false);
  const [toast,setToast]=useState('');

  useEffect(()=>{loadAll();},[]);
  const showToast=(msg:string)=>{setToast(msg);setTimeout(()=>setToast(''),3000);};
  const loadAll=async()=>{
    const [{data:c},{data:h}]=await Promise.all([
      supabase.from('contacts').select('*').order('name'),
      supabase.from('contact_history').select('*').order('work_date',{ascending:false}),
    ]);
    setContacts(c||[]);setHistory(h||[]);
  };

  const openAdd=()=>{setEditing(null);setForm(emptyC);setShowModal(true);};
  const openEdit=(c:Contact)=>{setEditing(c);setForm({...c});setShowModal(true);};
  const saveContact=async()=>{
    if(!form.name.trim()){showToast('Name required');return;}
    if(!form.phone.trim()){showToast('Phone required');return;}
    setLoading(true);
    if(editing?.id){const{id,...r}=form;await supabase.from('contacts').update(r).eq('id',editing.id);showToast('Updated ✓');}
    else{const{id,...r}=form;await supabase.from('contacts').insert([r]);showToast('Saved ✓');}
    setLoading(false);setShowModal(false);loadAll();
  };
  const delContact=async(c:Contact)=>{
    if(!confirm(`Delete "${c.name}" and all history?`))return;
    await supabase.from('contacts').delete().eq('id',c.id);
    showToast('Deleted');loadAll();
  };

  const openAddH=(c:Contact)=>{setActiveC(c);setEditingH(null);setHForm(emptyH(c.id!));setShowHModal(true);};
  const openEditH=(c:Contact,h:HistoryEntry)=>{setActiveC(c);setEditingH(h);setHForm({...h});setShowHModal(true);};
  const saveH=async()=>{
    if(!hForm.work_description.trim()){showToast('Work description required');return;}
    setLoading(true);
    if(editingH?.id){const{id,...r}=hForm;await supabase.from('contact_history').update(r).eq('id',editingH.id);showToast('Updated ✓');}
    else{const{id,...r}=hForm;await supabase.from('contact_history').insert([r]);showToast('Saved ✓');}
    setLoading(false);setShowHModal(false);loadAll();
  };
  const delH=async(h:HistoryEntry)=>{
    if(!confirm('Delete this entry?'))return;
    await supabase.from('contact_history').delete().eq('id',h.id);
    showToast('Deleted');loadAll();
  };

  const filtered=contacts.filter(c=>{
    const matchCat=filterCat==='All'||c.category===filterCat;
    const q=search.toLowerCase();
    return matchCat&&(!q||c.name.toLowerCase().includes(q)||c.phone.includes(q)||(c.phone2||'').includes(q)||(c.company||'').toLowerCase().includes(q));
  });
  const getH=(id:string)=>history.filter(h=>h.contact_id===id);
  const getLatest=(id:string)=>{const h=getH(id);return h.length>0&&h[0].rate>0?h[0].rate:null;};

  return (
    <div className="space-y-4">
      {toast&&<div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded-xl shadow-lg text-sm">{toast}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {['Customer','Vendor','Transporter','Other'].map(cat=>(
          <div key={cat} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500">{cat}s</p>
            <p className="text-2xl font-bold text-gray-800">{contacts.filter(c=>c.category===cat).length}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex gap-3 mb-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, phone, company..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"/>
          </div>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium">
            <Plus size={15}/>Add Contact
          </button>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map(cat=>(
            <button key={cat} onClick={()=>setFilterCat(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filterCat===cat?'bg-blue-600 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {cat} ({cat==='All'?contacts.length:contacts.filter(c=>c.category===cat).length})
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-700 text-sm">📒 Number Diary <span className="text-gray-400 font-normal">({filtered.length} contacts)</span></h3>
        </div>
        {filtered.length===0?(
          <div className="text-center py-16 text-gray-400"><Phone size={32} className="mx-auto mb-2 opacity-30"/><p className="text-sm">No contacts found</p></div>
        ):(
          <div className="divide-y divide-gray-50">
            {filtered.map(c=>{
              const cH=getH(c.id!);const lr=getLatest(c.id!);const isExp=expandedId===c.id;
              return(
                <div key={c.id}>
                  <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-sm">{c.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-800 text-sm">{c.name}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${CAT_COLORS[c.category]||'bg-gray-100 text-gray-600'}`}>{c.category}</span>
                          {lr&&<span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">Latest: ₹{lr.toLocaleString('en-IN')}</span>}
                          {cH.length>0&&<span className="text-[10px] text-gray-400">{cH.length} job{cH.length>1?'s':''}</span>}
                        </div>
                        {c.company&&<p className="text-xs text-gray-500">{c.company}</p>}
                        <div className="flex items-center gap-3 mt-0.5">
                          <a href={`tel:${c.phone}`} className="text-xs text-blue-600 flex items-center gap-1"><PhoneCall size={11}/>{c.phone}</a>
                          {c.phone2&&<a href={`tel:${c.phone2}`} className="text-xs text-blue-500 flex items-center gap-1"><PhoneCall size={11}/>{c.phone2}</a>}
                        </div>
                        {c.address&&<p className="text-[11px] text-gray-400">📍 {c.address}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                      <button onClick={()=>openAddH(c)} title="Add work history" className="w-8 h-8 rounded-lg bg-amber-50 hover:bg-amber-100 flex items-center justify-center">
                        <History size={14} className="text-amber-600"/>
                      </button>
                      <a href={`tel:${c.phone}`} className="w-8 h-8 rounded-lg bg-green-50 hover:bg-green-100 flex items-center justify-center">
                        <Phone size={14} className="text-green-600"/>
                      </a>
                      <button onClick={()=>openEdit(c)} className="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 flex items-center justify-center">
                        <Edit2 size={14} className="text-blue-600"/>
                      </button>
                      <button onClick={()=>delContact(c)} className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center">
                        <Trash2 size={14} className="text-red-500"/>
                      </button>
                      {cH.length>0&&(
                        <button onClick={()=>setExpandedId(isExp?null:c.id!)} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
                          {isExp?<ChevronUp size={14} className="text-gray-600"/>:<ChevronDown size={14} className="text-gray-600"/>}
                        </button>
                      )}
                    </div>
                  </div>

                  {isExp&&cH.length>0&&(
                    <div className="bg-amber-50 border-t border-amber-100 px-4 py-3">
                      <p className="text-xs font-semibold text-amber-700 mb-2">📋 Work & Rate History</p>
                      <div className="space-y-2">
                        {cH.map((h,i)=>(
                          <div key={h.id} className="flex items-start justify-between bg-white rounded-xl px-3 py-2 shadow-sm">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-gray-700">{fmt(h.work_date)}</span>
                                {i===0&&<span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Latest</span>}
                                {h.rate>0&&<span className="text-xs font-bold text-green-700">₹{h.rate.toLocaleString('en-IN')}</span>}
                              </div>
                              <p className="text-xs text-gray-600 mt-0.5">{h.work_description}</p>
                              {h.notes&&<p className="text-[11px] text-gray-400 italic">"{h.notes}"</p>}
                            </div>
                            <div className="flex gap-1 ml-2">
                              <button onClick={()=>openEditH(c,h)} className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 flex items-center justify-center"><Edit2 size={12} className="text-blue-600"/></button>
                              <button onClick={()=>delH(h)} className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center"><Trash2 size={12} className="text-red-500"/></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Contact Modal */}
      {showModal&&(
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">{editing?'Edit Contact':'Add Contact'}</h3>
              <button onClick={()=>setShowModal(false)} className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X size={15}/></button>
            </div>
            <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Full Name *</label>
                <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. Rajesh Kumar"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"/></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.filter(c=>c!=='All').map(cat=>(
                    <button key={cat} onClick={()=>setForm({...form,category:cat})}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${form.category===cat?'bg-blue-600 text-white border-blue-600':'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300'}`}>{cat}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Phone 1 *</label>
                  <input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="98XXXXXXXX" type="tel"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"/></div>
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Phone 2</label>
                  <input value={form.phone2} onChange={e=>setForm({...form,phone2:e.target.value})} placeholder="Optional" type="tel"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"/></div>
              </div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Company / Shop</label>
                <input value={form.company} onChange={e=>setForm({...form,company:e.target.value})} placeholder="e.g. Shiva Hardware"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"/></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Address</label>
                <input value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder="City / Area"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"/></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Extra info..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"/></div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
              <button onClick={()=>setShowModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Cancel</button>
              <button onClick={saveContact} disabled={loading} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-60">
                {loading?'Saving...':editing?'Update':'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHModal&&(
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-800">{editingH?'Edit Entry':'Add Work / Rate'}</h3>
                <p className="text-xs text-amber-600 font-medium">{activeC?.name}</p>
              </div>
              <button onClick={()=>setShowHModal(false)} className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X size={15}/></button>
            </div>
            <div className="p-5 space-y-3">
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                <input type="date" value={hForm.work_date} onChange={e=>setHForm({...hForm,work_date:e.target.value})}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"/></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Work Description *</label>
                <input value={hForm.work_description} onChange={e=>setHForm({...hForm,work_description:e.target.value})}
                  placeholder="e.g. Painted Paddy Cleaner Machine"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"/></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Rate / Amount (₹)</label>
                <input type="number" value={hForm.rate||''} onChange={e=>setHForm({...hForm,rate:Number(e.target.value)})} placeholder="e.g. 5000"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"/>
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  {[500,1000,2000,5000,10000,15000,20000].map(a=>(
                    <button key={a} onClick={()=>setHForm({...hForm,rate:a})}
                      className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-lg text-xs hover:bg-amber-100 hover:text-amber-700">₹{a.toLocaleString('en-IN')}</button>
                  ))}
                </div>
              </div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <input value={hForm.notes} onChange={e=>setHForm({...hForm,notes:e.target.value})}
                  placeholder="e.g. Rate increased due to material cost"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"/></div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
              <button onClick={()=>setShowHModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Cancel</button>
              <button onClick={saveH} disabled={loading} className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60">
                {loading?'Saving...':editingH?'Update':'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
