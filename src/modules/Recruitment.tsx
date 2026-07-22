import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Briefcase, CheckCircle, XCircle, Plus, X, Loader, Edit2, Trash2, Search, Mail, Phone } from 'lucide-react';
import StatCard from '../components/StatCard';
import { supabase } from '../lib/supabase';
import { handleEnterAsTab } from '../lib/formNav';

type Application = {
  id?: string;
  candidate_name: string;
  position: string;
  department: string;
  email: string;
  phone: string;
  stage: string;
  rating: number;
  applied_date: string;
  notes: string;
};

const stages = ['New', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'];
const departments = ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance', 'Operations'];
const stageStyle: Record<string, string> = {
  New: 'bg-gray-100 text-gray-600',
  Screening: 'bg-blue-100 text-blue-700',
  Interview: 'bg-violet-100 text-violet-700',
  Offer: 'bg-orange-100 text-orange-700',
  Hired: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
};
const stageColor: Record<string, string> = {
  New: '#9CA3AF', Screening: '#3B82F6', Interview: '#7C3AED',
  Offer: '#F97316', Hired: '#22C55E', Rejected: '#EF4444',
};
const empty: Application = { candidate_name: '', position: '', department: 'Engineering', email: '', phone: '', stage: 'New', rating: 3, applied_date: new Date().toISOString().split('T')[0], notes: '' };

const Recruitment: React.FC = () => {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStage, setFilterStage] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Application>(empty);
  const [editing, setEditing] = useState<Application | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [view, setView] = useState<'list' | 'kanban'>('kanban');

  const showToast = (msg: string, type: 'success' | 'error') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase.from('job_applications').select('*').order('created_at', { ascending: false });
    setApps(data || []);
    setLoading(false);
  };
  useEffect(() => { fetch(); }, []);

  const hired = apps.filter(a => a.stage === 'Hired').length;
  const interviews = apps.filter(a => a.stage === 'Interview').length;
  const offers = apps.filter(a => a.stage === 'Offer').length;
  const rejected = apps.filter(a => a.stage === 'Rejected').length;

  const filtered = apps.filter(a =>
    (filterStage === 'All' || a.stage === filterStage) &&
    (a.candidate_name.toLowerCase().includes(search.toLowerCase()) || a.position.toLowerCase().includes(search.toLowerCase()))
  );

  const openAdd = () => { setEditing(null); setForm(empty); setShowModal(true); };
  const openEdit = (a: Application) => { setEditing(a); setForm({ ...a }); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditing(null); };

  const handleSave = async () => {
    if (!form.candidate_name || !form.position) { showToast('Name and Position required.', 'error'); return; }
    setSaving(true);
    if (editing?.id) {
      const { error } = await supabase.from('job_applications').update({ ...form }).eq('id', editing.id);
      if (error) showToast('Failed: ' + error.message, 'error');
      else { showToast('Updated!', 'success'); closeModal(); fetch(); }
    } else {
      const { error } = await supabase.from('job_applications').insert([form]);
      if (error) showToast('Failed: ' + error.message, 'error');
      else { showToast('Application added!', 'success'); closeModal(); fetch(); }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    await supabase.from('job_applications').delete().eq('id', id);
    showToast('Deleted.', 'success'); fetch();
    setDeleting(null);
  };

  const moveStage = async (app: Application, stage: string) => {
    await supabase.from('job_applications').update({ stage }).eq('id', app.id!);
    showToast(`Moved to ${stage}!`, 'success'); fetch();
  };

  return (
    <div className="space-y-6">
      <AnimatePresence>{toast && <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-500'}`}>{toast.msg}</motion.div>}</AnimatePresence>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Applicants" value={loading ? '...' : String(apps.length)} change="+8" positive icon={<UserPlus size={20} />} color="#7C3AED" bg="#EDE9FE" delay={0.05} />
        <StatCard title="Interviews" value={loading ? '...' : String(interviews)} change="+3" positive icon={<Briefcase size={20} />} color="#2563EB" bg="#DBEAFE" delay={0.1} />
        <StatCard title="Offers Sent" value={loading ? '...' : String(offers)} change="+2" positive icon={<CheckCircle size={20} />} color="#16A34A" bg="#DCFCE7" delay={0.15} />
        <StatCard title="Hired" value={loading ? '...' : String(hired)} change="+1" positive icon={<XCircle size={20} />} color="#D97706" bg="#FEF3C7" delay={0.2} />
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="font-bold text-gray-800">Job Applications <span className="text-violet-500">({filtered.length})</span></h3>
          <div className="flex gap-2 flex-wrap">
            <div className="relative"><Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-violet-200 w-36" /></div>
            <select value={filterStage} onChange={e => setFilterStage(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none">
              <option>All</option>{stages.map(s => <option key={s}>{s}</option>)}
            </select>
            <button onClick={() => setView(view === 'kanban' ? 'list' : 'kanban')} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs">{view === 'kanban' ? '☰ List' : '⊞ Kanban'}</button>
            <button onClick={openAdd} className="flex items-center gap-1 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs hover:bg-violet-700"><Plus size={13} /> Add Applicant</button>
          </div>
        </div>

        {loading ? <div className="flex items-center justify-center py-16 text-gray-400"><Loader size={20} className="animate-spin mr-2" /> Loading...</div>
        : view === 'kanban' ? (
          <div className="grid grid-cols-2 xl:grid-cols-6 gap-3">
            {stages.map(stage => {
              const stagApps = filtered.filter(a => a.stage === stage);
              return (
                <div key={stage} className="rounded-xl p-3 min-h-32" style={{ background: `${stageColor[stage]}10` }}>
                  <div className="flex items-center gap-1.5 mb-3">
                    <span className="w-2 h-2 rounded-full" style={{ background: stageColor[stage] }} />
                    <span className="text-xs font-bold text-gray-700">{stage}</span>
                    <span className="ml-auto text-xs bg-white px-1.5 py-0.5 rounded-full text-gray-500">{stagApps.length}</span>
                  </div>
                  {stagApps.map(a => (
                    <div key={a.id} className="bg-white rounded-lg p-2.5 mb-2 shadow-sm border border-gray-100">
                      <div className="flex items-start justify-between gap-1">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style={{ background: stageColor[stage] }}>{a.candidate_name[0]}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-gray-800 truncate">{a.candidate_name}</p>
                          <p className="text-[10px] text-gray-400 truncate">{a.position}</p>
                        </div>
                      </div>
                      <div className="flex gap-1 mt-2">
                        <button onClick={() => openEdit(a)} className="flex-1 text-[10px] py-0.5 bg-blue-50 text-blue-500 rounded hover:bg-blue-100">Edit</button>
                        <button onClick={() => handleDelete(a.id!)} className="flex-1 text-[10px] py-0.5 bg-red-50 text-red-400 rounded hover:bg-red-100">{deleting === a.id ? '...' : 'Del'}</button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
                <th className="pb-2 text-left">Candidate</th><th className="pb-2 text-left">Position</th><th className="pb-2 text-left">Dept</th>
                <th className="pb-2 text-left">Stage</th><th className="pb-2 text-left">Rating</th><th className="pb-2 text-left">Applied</th><th className="pb-2 text-left">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: stageColor[a.stage] }}>{a.candidate_name[0]}</div>
                        <div><p className="font-medium text-gray-800 text-sm">{a.candidate_name}</p><p className="text-[10px] text-gray-400">{a.email}</p></div>
                      </div>
                    </td>
                    <td className="py-2.5 text-gray-600 text-sm">{a.position}</td>
                    <td className="py-2.5 text-gray-400 text-xs">{a.department}</td>
                    <td className="py-2.5"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stageStyle[a.stage]}`}>{a.stage}</span></td>
                    <td className="py-2.5"><div className="flex">{Array.from({length:5}).map((_,i)=><span key={i} style={{color:i<a.rating?'#FBBF24':'#E5E7EB',fontSize:12}}>★</span>)}</div></td>
                    <td className="py-2.5 text-gray-400 text-xs">{a.applied_date}</td>
                    <td className="py-2.5">
                      <div className="flex gap-1">
                        <button onClick={() => window.open(`mailto:${a.email}`)} className="w-6 h-6 bg-blue-50 rounded flex items-center justify-center text-blue-500"><Mail size={10}/></button>
                        <button onClick={() => openEdit(a)} className="w-6 h-6 bg-gray-50 rounded flex items-center justify-center text-gray-500"><Edit2 size={10}/></button>
                        <button onClick={() => handleDelete(a.id!)} disabled={deleting===a.id} className="w-6 h-6 bg-red-50 rounded flex items-center justify-center text-red-400">{deleting===a.id?<Loader size={10} className="animate-spin"/>:<Trash2 size={10}/>}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>{showModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onKeyDown={handleEnterAsTab} onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100"><h2 className="font-bold text-gray-800">{editing ? 'Edit Application' : 'New Application'}</h2><button onClick={closeModal} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"><X size={14}/></button></div>
            <div className="p-5 space-y-3">
              {[{label:'Candidate Name *',key:'candidate_name',type:'text',ph:'e.g. John Doe'},{label:'Position *',key:'position',type:'text',ph:'e.g. Senior Developer'},{label:'Email',key:'email',type:'email',ph:'john@email.com'},{label:'Phone',key:'phone',type:'text',ph:'+91-9876540000'},{label:'Applied Date',key:'applied_date',type:'date',ph:''},{label:'Notes',key:'notes',type:'text',ph:'Any notes...'}].map(f=>(
                <div key={f.key}><label className="block text-xs font-medium text-gray-700 mb-1">{f.label}</label>
                <input type={f.type} placeholder={f.ph} value={(form as any)[f.key]} onChange={e=>setForm({...form,[f.key]:e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"/></div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
                <select value={form.department} onChange={e=>setForm({...form,department:e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200">{departments.map(d=><option key={d}>{d}</option>)}</select></div>
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Stage</label>
                <select value={form.stage} onChange={e=>setForm({...form,stage:e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200">{stages.map(s=><option key={s}>{s}</option>)}</select></div>
              </div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Rating</label>
              <div className="flex gap-2">{[1,2,3,4,5].map(r=><button key={r} onClick={()=>setForm({...form,rating:r})} className={`w-8 h-8 rounded-full text-sm transition-colors ${form.rating>=r?'bg-yellow-400 text-white':'bg-gray-100 text-gray-400'}`}>★</button>)}</div></div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-100">
              <button onClick={closeModal} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-60">{saving&&<Loader size={13} className="animate-spin"/>}{saving?'Saving...':editing?'Update':'Add'}</button>
            </div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>
    </div>
  );
};
export default Recruitment;
