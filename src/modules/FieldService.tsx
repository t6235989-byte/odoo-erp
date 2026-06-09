import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wrench, CheckCircle, Clock, AlertTriangle, Plus, X, Loader, Edit2, Trash2, MapPin, Phone, Star } from 'lucide-react';
import StatCard from '../components/StatCard';
import { supabase } from '../lib/supabase';

type Job = {
  id?: string;
  title: string;
  customer: string;
  technician: string;
  location: string;
  priority: string;
  status: string;
  eta: string;
  description: string;
  created_at?: string;
};

type Technician = {
  id?: string;
  name: string;
  jobs_count: number;
  rating: number;
  status: string;
  color: string;
};

const priorities = ['Normal', 'High', 'Urgent'];
const statuses = ['Scheduled', 'In Progress', 'Completed', 'Cancelled'];

const priorityStyle: Record<string, string> = {
  Urgent: 'bg-red-100 text-red-700',
  High: 'bg-orange-100 text-orange-700',
  Normal: 'bg-gray-100 text-gray-600',
};
const statusStyle: Record<string, string> = {
  'In Progress': 'bg-blue-100 text-blue-700',
  Completed: 'bg-green-100 text-green-700',
  Scheduled: 'bg-violet-100 text-violet-700',
  Cancelled: 'bg-red-100 text-red-700',
};

const emptyJob: Job = { title: '', customer: '', technician: '', location: '', priority: 'Normal', status: 'Scheduled', eta: '', description: '' };

const FieldService: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [techs, setTechs] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Job>(emptyJob);
  const [editing, setEditing] = useState<Job | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [filter, setFilter] = useState<string>('All');

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    setLoading(true);
    const [{ data: j }, { data: t }] = await Promise.all([
      supabase.from('jobs').select('*').order('created_at', { ascending: false }),
      supabase.from('technicians').select('*').order('name'),
    ]);
    setJobs(j || []);
    setTechs(t || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // ── Stats ──────────────────────────────────────────────────────────────
  const activeJobs = jobs.filter(j => j.status === 'In Progress').length;
  const completedToday = jobs.filter(j => j.status === 'Completed').length;
  const urgentJobs = jobs.filter(j => j.priority === 'Urgent').length;
  const availableTechs = techs.filter(t => t.status === 'Available').length;

  const filteredJobs = filter === 'All' ? jobs : jobs.filter(j => j.status === filter);

  const openAdd = () => { setEditing(null); setForm(emptyJob); setShowModal(true); };
  const openEdit = (j: Job) => { setEditing(j); setForm({ ...j }); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditing(null); setForm(emptyJob); };

  const handleSave = async () => {
    if (!form.title || !form.customer) { showToast('Title and Customer are required.', 'error'); return; }
    setSaving(true);
    if (editing?.id) {
      const { error } = await supabase.from('jobs').update({ ...form }).eq('id', editing.id);
      if (error) showToast('Update failed: ' + error.message, 'error');
      else { showToast('Job updated!', 'success'); closeModal(); fetchData(); }
    } else {
      const { error } = await supabase.from('jobs').insert([form]);
      if (error) showToast('Failed: ' + error.message, 'error');
      else { showToast('Job created!', 'success'); closeModal(); fetchData(); }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    const { error } = await supabase.from('jobs').delete().eq('id', id);
    if (error) showToast('Delete failed: ' + error.message, 'error');
    else { showToast('Job deleted.', 'success'); fetchData(); }
    setDeleting(null);
  };

  const quickStatus = async (job: Job, status: string) => {
    const { error } = await supabase.from('jobs').update({ status }).eq('id', job.id!);
    if (!error) { showToast(`Marked as ${status}!`, 'success'); fetchData(); }
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-500'}`}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Active Jobs" value={loading ? '...' : String(activeJobs)} change="+4" positive icon={<Wrench size={20} />} color="#059669" bg="#D1FAE5" delay={0.05} />
        <StatCard title="Completed" value={loading ? '...' : String(completedToday)} change="+3" positive icon={<CheckCircle size={20} />} color="#16A34A" bg="#DCFCE7" delay={0.1} />
        <StatCard title="Available Techs" value={loading ? '...' : String(availableTechs)} change="+1" positive icon={<Clock size={20} />} color="#2563EB" bg="#DBEAFE" delay={0.15} />
        <StatCard title="Urgent Jobs" value={loading ? '...' : String(urgentJobs)} change="+1" positive={false} icon={<AlertTriangle size={20} />} color="#DC2626" bg="#FEE2E2" delay={0.2} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Jobs List */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="xl:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h3 className="font-bold text-gray-800">Jobs <span className="text-emerald-600">({filteredJobs.length})</span></h3>
            <div className="flex gap-2 flex-wrap">
              {['All', 'Scheduled', 'In Progress', 'Completed'].map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${filter === f ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {f}
                </button>
              ))}
              <button onClick={openAdd} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-sm hover:bg-emerald-600">
                <Plus size={14} /> New Job
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400"><Loader size={24} className="animate-spin mr-2" /> Loading...</div>
          ) : filteredJobs.length === 0 ? (
            <div className="text-center py-16 text-gray-400"><Wrench size={40} className="mx-auto mb-2 opacity-30" /><p>No jobs found</p></div>
          ) : (
            <div className="space-y-3">
              {filteredJobs.map((job) => (
                <div key={job.id} className="p-4 border border-gray-100 rounded-xl hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-800 text-sm">{job.title}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${priorityStyle[job.priority]}`}>{job.priority}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{job.customer}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 flex-wrap">
                        {job.location && <span className="flex items-center gap-1"><MapPin size={10} />{job.location}</span>}
                        {job.technician && <span className="flex items-center gap-1"><Phone size={10} />{job.technician}</span>}
                        {job.eta && <span className="flex items-center gap-1"><Clock size={10} />ETA: {job.eta}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusStyle[job.status] || 'bg-gray-100 text-gray-600'}`}>{job.status}</span>
                      <div className="flex gap-1">
                        {job.status !== 'Completed' && (
                          <button onClick={() => quickStatus(job, 'Completed')} title="Mark complete" className="w-6 h-6 bg-green-50 rounded flex items-center justify-center text-green-500 hover:bg-green-100"><CheckCircle size={11} /></button>
                        )}
                        {job.status === 'Scheduled' && (
                          <button onClick={() => quickStatus(job, 'In Progress')} title="Start job" className="w-6 h-6 bg-blue-50 rounded flex items-center justify-center text-blue-500 hover:bg-blue-100"><Wrench size={11} /></button>
                        )}
                        <button onClick={() => openEdit(job)} className="w-6 h-6 bg-gray-50 rounded flex items-center justify-center text-gray-400 hover:text-blue-500"><Edit2 size={11} /></button>
                        <button onClick={() => handleDelete(job.id!)} disabled={deleting === job.id} className="w-6 h-6 bg-gray-50 rounded flex items-center justify-center text-gray-400 hover:text-red-500">
                          {deleting === job.id ? <Loader size={11} className="animate-spin" /> : <Trash2 size={11} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Technicians */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4">Technicians</h3>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-400"><Loader size={20} className="animate-spin" /></div>
          ) : (
            <div className="space-y-3">
              {techs.map((t) => (
                <div key={t.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                    style={{ background: t.color }}>{t.name[0]}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{t.name}</p>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Star size={10} className="text-yellow-400" />{t.rating} · {t.jobs_count} jobs
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${t.status === 'Available' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{t.status}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 space-y-2">
            <h4 className="font-semibold text-gray-700 text-sm">Job Summary</h4>
            {[
              { label: 'In Progress', count: activeJobs, color: '#2563EB', bg: '#DBEAFE' },
              { label: 'Scheduled', count: jobs.filter(j => j.status === 'Scheduled').length, color: '#7C3AED', bg: '#EDE9FE' },
              { label: 'Completed', count: completedToday, color: '#16A34A', bg: '#DCFCE7' },
              { label: 'Urgent', count: urgentJobs, color: '#DC2626', bg: '#FEE2E2' },
            ].map((s, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg" style={{ background: s.bg }}>
                <span className="text-xs font-medium" style={{ color: s.color }}>{s.label}</span>
                <span className="text-sm font-bold" style={{ color: s.color }}>{s.count}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800">{editing ? 'Edit Job' : 'New Field Service Job'}</h2>
                <button onClick={closeModal} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"><X size={16} /></button>
              </div>
              <div className="p-6 space-y-4">
                {[
                  { label: 'Job Title *', key: 'title', type: 'text', placeholder: 'e.g. HVAC Maintenance' },
                  { label: 'Customer *', key: 'customer', type: 'text', placeholder: 'e.g. Acme Corp' },
                  { label: 'Technician', key: 'technician', type: 'text', placeholder: 'e.g. James Wright' },
                  { label: 'Location', key: 'location', type: 'text', placeholder: 'e.g. 123 Main St' },
                  { label: 'ETA', key: 'eta', type: 'text', placeholder: 'e.g. 2:30 PM' },
                  { label: 'Description', key: 'description', type: 'text', placeholder: 'Job details...' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                    <input type={f.type} placeholder={f.placeholder} value={(form as any)[f.key]}
                      onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200" />
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200">
                      {priorities.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200">
                      {statuses.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
                <button onClick={closeModal} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 disabled:opacity-60">
                  {saving && <Loader size={14} className="animate-spin" />}
                  {saving ? 'Saving...' : editing ? 'Update Job' : 'Create Job'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FieldService;
