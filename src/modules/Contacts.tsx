import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Phone, Plus, Search, Edit2, Trash2, X, User, PhoneCall } from 'lucide-react';

type Contact = {
  id?: string;
  name: string;
  phone: string;
  phone2: string;
  category: string;
  company: string;
  address: string;
  notes: string;
};

const CATEGORIES = [
  'All','Customer','Vendor','Painter','Welder','Transporter',
  'Electrician','Mechanic','Plumber','Carpenter','Labour',
  'Seller','Purchaser','Agent','Other'
];

const CAT_COLORS: Record<string,string> = {
  Customer:'bg-blue-100 text-blue-700', Vendor:'bg-purple-100 text-purple-700',
  Painter:'bg-yellow-100 text-yellow-700', Welder:'bg-orange-100 text-orange-700',
  Transporter:'bg-cyan-100 text-cyan-700', Electrician:'bg-red-100 text-red-700',
  Mechanic:'bg-gray-100 text-gray-700', Plumber:'bg-teal-100 text-teal-700',
  Carpenter:'bg-amber-100 text-amber-700', Labour:'bg-lime-100 text-lime-700',
  Seller:'bg-green-100 text-green-700', Purchaser:'bg-indigo-100 text-indigo-700',
  Agent:'bg-pink-100 text-pink-700', Other:'bg-gray-100 text-gray-600',
};

const empty: Contact = { name:'', phone:'', phone2:'', category:'Other', company:'', address:'', notes:'' };

export default function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Contact>(empty);
  const [editing, setEditing] = useState<Contact|null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => { loadContacts(); }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(()=>setToast(''),3000); };

  const loadContacts = async () => {
    const { data } = await supabase.from('contacts').select('*').order('name');
    setContacts(data||[]);
  };

  const openAdd = () => { setEditing(null); setForm(empty); setShowModal(true); };
  const openEdit = (c: Contact) => { setEditing(c); setForm({...c}); setShowModal(true); };

  const save = async () => {
    if (!form.name.trim()) { showToast('Name is required'); return; }
    if (!form.phone.trim()) { showToast('Phone number is required'); return; }
    setLoading(true);
    if (editing?.id) {
      const { id, ...rest } = form;
      await supabase.from('contacts').update(rest).eq('id', editing.id);
      showToast('Contact updated ✓');
    } else {
      const { id, ...rest } = form;
      await supabase.from('contacts').insert([rest]);
      showToast('Contact saved ✓');
    }
    setLoading(false);
    setShowModal(false);
    loadContacts();
  };

  const del = async (c: Contact) => {
    if (!confirm(`Delete "${c.name}"?`)) return;
    await supabase.from('contacts').delete().eq('id', c.id);
    showToast('Deleted');
    loadContacts();
  };

  const filtered = contacts.filter(c => {
    const matchCat = filterCat==='All' || c.category===filterCat;
    const q = search.toLowerCase();
    const matchQ = !q || c.name.toLowerCase().includes(q) || c.phone.includes(q) ||
      (c.phone2||'').includes(q) || (c.company||'').toLowerCase().includes(q) ||
      (c.category||'').toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded-xl shadow-lg text-sm">{toast}</div>}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {['Customer','Vendor','Transporter','Other'].map(cat=>(
          <div key={cat} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500">{cat}s</p>
            <p className="text-2xl font-bold text-gray-800">{contacts.filter(c=>c.category===cat).length}</p>
          </div>
        ))}
      </div>

      {/* Search + Filter + Add */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col md:flex-row gap-3 mb-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, phone, company..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"/>
          </div>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors">
            <Plus size={15}/> Add Contact
          </button>
        </div>
        {/* Category filter chips */}
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map(cat=>(
            <button key={cat} onClick={()=>setFilterCat(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filterCat===cat?'bg-blue-600 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {cat} {cat!=='All'?`(${contacts.filter(c=>c.category===cat).length})`:`(${contacts.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Contact List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-700 text-sm">📒 Number Diary <span className="text-gray-400 font-normal">({filtered.length} contacts)</span></h3>
        </div>
        {filtered.length===0?(
          <div className="text-center py-16 text-gray-400">
            <Phone size={32} className="mx-auto mb-2 opacity-30"/>
            <p className="text-sm">No contacts found</p>
          </div>
        ):(
          <div className="divide-y divide-gray-50">
            {filtered.map(c=>(
              <div key={c.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-sm">{c.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-800 text-sm">{c.name}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${CAT_COLORS[c.category]||'bg-gray-100 text-gray-600'}`}>{c.category}</span>
                    </div>
                    {c.company && <p className="text-xs text-gray-500">{c.company}</p>}
                    <div className="flex items-center gap-3 mt-0.5">
                      <a href={`tel:${c.phone}`} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                        <PhoneCall size={11}/>{c.phone}
                      </a>
                      {c.phone2 && <a href={`tel:${c.phone2}`} className="text-xs text-blue-500 flex items-center gap-1"><PhoneCall size={11}/>{c.phone2}</a>}
                    </div>
                    {c.address && <p className="text-[11px] text-gray-400 mt-0.5">📍 {c.address}</p>}
                    {c.notes && <p className="text-[11px] text-gray-400 italic">"{c.notes}"</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <a href={`tel:${c.phone}`} className="w-8 h-8 rounded-lg bg-green-50 hover:bg-green-100 flex items-center justify-center transition-colors">
                    <Phone size={14} className="text-green-600"/>
                  </a>
                  <button onClick={()=>openEdit(c)} className="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 flex items-center justify-center transition-colors">
                    <Edit2 size={14} className="text-blue-600"/>
                  </button>
                  <button onClick={()=>del(c)} className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors">
                    <Trash2 size={14} className="text-red-500"/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">{editing?'Edit Contact':'Add Contact'}</h3>
              <button onClick={()=>setShowModal(false)} className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X size={15}/></button>
            </div>
            <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
              {/* Name */}
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Full Name *</label>
                <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. Rajesh Kumar"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"/></div>
              {/* Category */}
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.filter(c=>c!=='All').map(cat=>(
                    <button key={cat} onClick={()=>setForm({...form,category:cat})}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${form.category===cat?'bg-blue-600 text-white border-blue-600':'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300'}`}>{cat}</button>
                  ))}
                </div>
              </div>
              {/* Phones */}
              <div className="grid grid-cols-2 gap-2">
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Phone No. 1 *</label>
                  <input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="98XXXXXXXX" type="tel"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"/></div>
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Phone No. 2</label>
                  <input value={form.phone2} onChange={e=>setForm({...form,phone2:e.target.value})} placeholder="Optional" type="tel"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"/></div>
              </div>
              {/* Company */}
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Company / Shop Name</label>
                <input value={form.company} onChange={e=>setForm({...form,company:e.target.value})} placeholder="e.g. Shiva Hardware Store"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"/></div>
              {/* Address */}
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Address</label>
                <input value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder="City / Area"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"/></div>
              {/* Notes */}
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Any extra info..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"/></div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
              <button onClick={()=>setShowModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={save} disabled={loading} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60">
                {loading?'Saving...':editing?'Update':'Save Contact'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
