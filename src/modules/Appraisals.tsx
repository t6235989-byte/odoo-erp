import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, TrendingUp, Clock, CheckCircle, Plus, X, Loader, Edit2, Trash2 } from 'lucide-react';
import StatCard from '../components/StatCard';
import { supabase } from '../lib/supabase';
import { handleEnterAsTab } from '../lib/formNav';

type Appraisal = {
  id?: string;
  employee_name: string;
  department: string;
  reviewer: string;
  period: string;
  score: number;
  status: string;
  feedback: string;
};

const departments = ['Engineering','Sales','Marketing','HR','Finance','Operations'];
const statuses = ['Draft','In Progress','Done'];
const statusStyle: Record<string,string> = { Draft:'bg-gray-100 text-gray-600', 'In Progress':'bg-blue-100 text-blue-700', Done:'bg-green-100 text-green-700' };
const scoreColor = (s:number) => s>=4?'#16A34A':s===3?'#D97706':'#DC2626';
const empty: Appraisal = { employee_name:'', department:'Engineering', reviewer:'', period:'Q1 2024', score:3, status:'Draft', feedback:'' };

const Appraisals: React.FC = () => {
  const [appraisals, setAppraisals] = useState<Appraisal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Appraisal>(empty);
  const [editing, setEditing] = useState<Appraisal | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast] = useState<{msg:string;type:'success'|'error'}|null>(null);

  const showToast = (msg:string,type:'success'|'error') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };
  const fetch = async () => { setLoading(true); const {data}=await supabase.from('appraisals').select('*').order('created_at',{ascending:false}); setAppraisals(data||[]); setLoading(false); };
  useEffect(()=>{fetch();},[]);

  const done = appraisals.filter(a=>a.status==='Done').length;
  const avgScore = appraisals.length>0?(appraisals.reduce((s,a)=>s+a.score,0)/appraisals.length).toFixed(1):'0';
  const inProgress = appraisals.filter(a=>a.status==='In Progress').length;

  const openAdd = () => { setEditing(null); setForm(empty); setShowModal(true); };
  const openEdit = (a:Appraisal) => { setEditing(a); setForm({...a}); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditing(null); };

  const handleSave = async () => {
    if(!form.employee_name) { showToast('Employee name required.','error'); return; }
    setSaving(true);
    if(editing?.id) { const {error}=await supabase.from('appraisals').update({...form}).eq('id',editing.id); if(error) showToast('Failed: '+error.message,'error'); else { showToast('Updated!','success'); closeModal(); fetch(); } }
    else { const {error}=await supabase.from('appraisals').insert([form]); if(error) showToast('Failed: '+error.message,'error'); else { showToast('Appraisal created!','success'); closeModal(); fetch(); } }
    setSaving(false);
  };
  const handleDelete = async (id:string) => { setDeleting(id); await supabase.from('appraisals').delete().eq('id',id); showToast('Deleted.','success'); fetch(); setDeleting(null); };

  return (
    <div className="space-y-6">
      <AnimatePresence>{toast&&<motion.div initial={{opacity:0,y:-20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-20}} className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${toast.type==='success'?'bg-green-600':'bg-red-500'}`}>{toast.msg}</motion.div>}</AnimatePresence>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Appraisals" value={loading?'...':String(appraisals.length)} change="+3" positive icon={<Star size={20}/>} color="#D97706" bg="#FEF3C7" delay={0.05}/>
        <StatCard title="Avg Score" value={loading?'...':String(avgScore)+'/5'} change="+0.3" positive icon={<TrendingUp size={20}/>} color="#16A34A" bg="#DCFCE7" delay={0.1}/>
        <StatCard title="In Progress" value={loading?'...':String(inProgress)} change="+1" positive={false} icon={<Clock size={20}/>} color="#2563EB" bg="#DBEAFE" delay={0.15}/>
        <StatCard title="Completed" value={loading?'...':String(done)} change="+2" positive icon={<CheckCircle size={20}/>} color="#7C3AED" bg="#EDE9FE" delay={0.2}/>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="font-bold text-gray-800">Appraisals <span className="text-amber-500">({appraisals.length})</span></h3>
          <button onClick={openAdd} className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600"><Plus size={14}/> New Appraisal</button>
        </div>

        {loading ? <div className="flex items-center justify-center py-16 text-gray-400"><Loader size={20} className="animate-spin mr-2"/>Loading...</div>
        : appraisals.length===0 ? <div className="text-center py-12 text-gray-400"><Star size={36} className="mx-auto mb-2 opacity-30"/><p>No appraisals yet</p></div>
        : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {appraisals.map(a=>(
              <div key={a.id} className="p-4 border border-gray-100 rounded-xl hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{background:scoreColor(a.score)}}>{a.employee_name[0]}</div>
                    <div>
                      <p className="font-semibold text-gray-800">{a.employee_name}</p>
                      <p className="text-xs text-gray-400">{a.department} · {a.period}</p>
                      <p className="text-xs text-gray-400">Reviewer: {a.reviewer}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusStyle[a.status]}`}>{a.status}</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex">{Array.from({length:5}).map((_,i)=><span key={i} style={{color:i<a.score?'#FBBF24':'#E5E7EB',fontSize:16}}>★</span>)}</div>
                  <span className="font-bold text-sm" style={{color:scoreColor(a.score)}}>{a.score}/5</span>
                </div>
                {a.feedback && <p className="text-xs text-gray-500 italic bg-gray-50 rounded-lg p-2 mb-3">"{a.feedback}"</p>}
                <div className="flex gap-2">
                  <button onClick={()=>openEdit(a)} className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-blue-50 text-blue-500 rounded-lg text-xs hover:bg-blue-100"><Edit2 size={11}/> Edit</button>
                  <button onClick={()=>handleDelete(a.id!)} disabled={deleting===a.id} className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-red-50 text-red-400 rounded-lg text-xs hover:bg-red-100">{deleting===a.id?<Loader size={11} className="animate-spin"/>:<Trash2 size={11}/>} Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>{showModal&&(
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onKeyDown={handleEnterAsTab} onClick={e=>{if(e.target===e.currentTarget)closeModal();}}>
          <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.9,opacity:0}} className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100"><h2 className="font-bold text-gray-800">{editing?'Edit Appraisal':'New Appraisal'}</h2><button onClick={closeModal} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"><X size={14}/></button></div>
            <div className="p-5 space-y-3">
              {[{label:'Employee Name *',key:'employee_name',ph:'e.g. Alice Walker'},{label:'Reviewer',key:'reviewer',ph:'e.g. Frank Miller'},{label:'Period',key:'period',ph:'e.g. Q1 2024'},{label:'Feedback',key:'feedback',ph:'Performance feedback...'}].map(f=>(
                <div key={f.key}><label className="block text-xs font-medium text-gray-700 mb-1">{f.label}</label>
                <input placeholder={f.ph} value={(form as any)[f.key]} onChange={e=>setForm({...form,[f.key]:e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"/></div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
                <select value={form.department} onChange={e=>setForm({...form,department:e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">{departments.map(d=><option key={d}>{d}</option>)}</select></div>
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">{statuses.map(s=><option key={s}>{s}</option>)}</select></div>
              </div>
              <div><label className="block text-xs font-medium text-gray-700 mb-2">Score</label>
              <div className="flex gap-2">{[1,2,3,4,5].map(r=><button key={r} onClick={()=>setForm({...form,score:r})} className={`w-9 h-9 rounded-xl text-sm font-bold transition-all ${form.score>=r?'text-white scale-110':'bg-gray-100 text-gray-400'}`} style={form.score>=r?{background:scoreColor(r)}:{}}>{r}</button>)}</div></div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-100">
              <button onClick={closeModal} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-60">{saving&&<Loader size={13} className="animate-spin"/>}{saving?'Saving...':editing?'Update':'Create'}</button>
            </div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>
    </div>
  );
};
export default Appraisals;
