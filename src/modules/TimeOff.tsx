import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, CheckCircle, XCircle, Plus, X, Loader, Edit2, Trash2 } from 'lucide-react';
import StatCard from '../components/StatCard';
import { supabase } from '../lib/supabase';
import { handleEnterAsTab } from '../lib/formNav';

type TimeOff = {
  id?: string;
  employee_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  status: string;
  reason: string;
};

const leaveTypes = ['Annual Leave', 'Sick Leave', 'Work From Home', 'Maternity Leave', 'Paternity Leave', 'Unpaid Leave'];
const statuses = ['Pending', 'Approved', 'Rejected'];
const statusStyle: Record<string,string> = { Pending:'bg-yellow-100 text-yellow-700', Approved:'bg-green-100 text-green-700', Rejected:'bg-red-100 text-red-700' };
const empty: TimeOff = { employee_name:'', leave_type:'Annual Leave', start_date:new Date().toISOString().split('T')[0], end_date:new Date().toISOString().split('T')[0], days:1, status:'Pending', reason:'' };

const TimeOffModule: React.FC = () => {
  const [leaves, setLeaves] = useState<TimeOff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<TimeOff>(empty);
  const [editing, setEditing] = useState<TimeOff | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast] = useState<{msg:string;type:'success'|'error'}|null>(null);
  const [filterStatus, setFilterStatus] = useState('All');

  const showToast = (msg:string,type:'success'|'error') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };
  const fetch = async () => { setLoading(true); const {data}=await supabase.from('time_off').select('*').order('created_at',{ascending:false}); setLeaves(data||[]); setLoading(false); };
  useEffect(()=>{fetch();},[]);

  const approved = leaves.filter(l=>l.status==='Approved').length;
  const pending = leaves.filter(l=>l.status==='Pending').length;
  const totalDays = leaves.filter(l=>l.status==='Approved').reduce((s,l)=>s+l.days,0);

  const filtered = filterStatus==='All' ? leaves : leaves.filter(l=>l.status===filterStatus);

  const openAdd = () => { setEditing(null); setForm(empty); setShowModal(true); };
  const openEdit = (l:TimeOff) => { setEditing(l); setForm({...l}); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditing(null); };

  const handleSave = async () => {
    if(!form.employee_name) { showToast('Employee name required.','error'); return; }
    setSaving(true);
    if(editing?.id) { const {error}=await supabase.from('time_off').update({...form}).eq('id',editing.id); if(error) showToast('Failed: '+error.message,'error'); else { showToast('Updated!','success'); closeModal(); fetch(); } }
    else { const {error}=await supabase.from('time_off').insert([form]); if(error) showToast('Failed: '+error.message,'error'); else { showToast('Leave request added!','success'); closeModal(); fetch(); } }
    setSaving(false);
  };

  const handleDelete = async (id:string) => { setDeleting(id); await supabase.from('time_off').delete().eq('id',id); showToast('Deleted.','success'); fetch(); setDeleting(null); };
  const updateStatus = async (id:string, status:string) => { await supabase.from('time_off').update({status}).eq('id',id); showToast(`${status}!`,'success'); fetch(); };

  return (
    <div className="space-y-6">
      <AnimatePresence>{toast&&<motion.div initial={{opacity:0,y:-20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-20}} className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${toast.type==='success'?'bg-green-600':'bg-red-500'}`}>{toast.msg}</motion.div>}</AnimatePresence>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Requests" value={loading?'...':String(leaves.length)} change="+5" positive icon={<Calendar size={20}/>} color="#2563EB" bg="#DBEAFE" delay={0.05}/>
        <StatCard title="Approved" value={loading?'...':String(approved)} change="+3" positive icon={<CheckCircle size={20}/>} color="#16A34A" bg="#DCFCE7" delay={0.1}/>
        <StatCard title="Pending" value={loading?'...':String(pending)} change="+2" positive={false} icon={<Clock size={20}/>} color="#D97706" bg="#FEF3C7" delay={0.15}/>
        <StatCard title="Days Approved" value={loading?'...':String(totalDays)} change="+8" positive icon={<XCircle size={20}/>} color="#7C3AED" bg="#EDE9FE" delay={0.2}/>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="font-bold text-gray-800">Leave Requests <span className="text-blue-500">({filtered.length})</span></h3>
          <div className="flex gap-2 flex-wrap">
            {['All','Pending','Approved','Rejected'].map(s=>(
              <button key={s} onClick={()=>setFilterStatus(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus===s?'bg-blue-500 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{s}</button>
            ))}
            <button onClick={openAdd} className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs hover:bg-blue-600"><Plus size={13}/> New Request</button>
          </div>
        </div>

        {loading ? <div className="flex items-center justify-center py-16 text-gray-400"><Loader size={20} className="animate-spin mr-2"/>Loading...</div>
        : filtered.length===0 ? <div className="text-center py-12 text-gray-400"><Calendar size={36} className="mx-auto mb-2 opacity-30"/><p>No leave requests</p></div>
        : (
          <div className="space-y-3">
            {filtered.map(l=>(
              <div key={l.id} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:bg-gray-50 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 font-bold">{l.employee_name[0]}</div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{l.employee_name}</p>
                    <p className="text-xs text-gray-400">{l.leave_type} · {l.days} day{l.days>1?'s':''}</p>
                    <p className="text-xs text-gray-400">{l.start_date} → {l.end_date}</p>
                    {l.reason && <p className="text-xs text-gray-500 italic">"{l.reason}"</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle[l.status]}`}>{l.status}</span>
                  {l.status==='Pending' && <>
                    <button onClick={()=>updateStatus(l.id!,'Approved')} className="px-2 py-1 bg-green-50 text-green-600 rounded-lg text-xs hover:bg-green-100">✓ Approve</button>
                    <button onClick={()=>updateStatus(l.id!,'Rejected')} className="px-2 py-1 bg-red-50 text-red-500 rounded-lg text-xs hover:bg-red-100">✗ Reject</button>
                  </>}
                  <button onClick={()=>openEdit(l)} className="w-6 h-6 bg-gray-50 rounded flex items-center justify-center text-gray-400 hover:text-blue-500"><Edit2 size={11}/></button>
                  <button onClick={()=>handleDelete(l.id!)} disabled={deleting===l.id} className="w-6 h-6 bg-gray-50 rounded flex items-center justify-center text-gray-400 hover:text-red-500">{deleting===l.id?<Loader size={11} className="animate-spin"/>:<Trash2 size={11}/>}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>{showModal&&(
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onKeyDown={handleEnterAsTab} onClick={e=>{if(e.target===e.currentTarget)closeModal();}}>
          <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.9,opacity:0}} className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100"><h2 className="font-bold text-gray-800">{editing?'Edit Request':'New Leave Request'}</h2><button onClick={closeModal} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"><X size={14}/></button></div>
            <div className="p-5 space-y-3">
              {[{label:'Employee Name *',key:'employee_name',type:'text',ph:'e.g. Alice Walker'},{label:'Start Date',key:'start_date',type:'date',ph:''},{label:'End Date',key:'end_date',type:'date',ph:''},{label:'Days',key:'days',type:'number',ph:'1'},{label:'Reason',key:'reason',type:'text',ph:'Optional reason...'}].map(f=>(
                <div key={f.key}><label className="block text-xs font-medium text-gray-700 mb-1">{f.label}</label>
                <input type={f.type} placeholder={f.ph} value={(form as any)[f.key]} onChange={e=>setForm({...form,[f.key]:f.type==='number'?Number(e.target.value):e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"/></div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Leave Type</label>
                <select value={form.leave_type} onChange={e=>setForm({...form,leave_type:e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">{leaveTypes.map(t=><option key={t}>{t}</option>)}</select></div>
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">{statuses.map(s=><option key={s}>{s}</option>)}</select></div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-100">
              <button onClick={closeModal} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-60">{saving&&<Loader size={13} className="animate-spin"/>}{saving?'Saving...':editing?'Update':'Submit'}</button>
            </div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>
    </div>
  );
};
export default TimeOffModule;
