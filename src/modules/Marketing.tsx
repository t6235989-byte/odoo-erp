import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Megaphone, Mail, Users, TrendingUp, Plus, X, Loader, Edit2, Trash2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import StatCard from '../components/StatCard';
import { supabase } from '../lib/supabase';
import { handleEnterAsTab } from '../lib/formNav';

type Campaign = {
  id?: string;
  name: string;
  type: string;
  sent: number;
  opened: number;
  clicked: number;
  status: string;
  roi: string;
  created_at?: string;
};

type Stat = {
  id?: string;
  week: string;
  email: number;
  social: number;
  display: number;
};

const campTypes = ['Email', 'Social', 'Display', 'SMS', 'Push'];
const campStatuses = ['Draft', 'Active', 'Completed', 'Paused'];

const statusStyle: Record<string, string> = {
  Active: 'bg-green-100 text-green-700',
  Completed: 'bg-blue-100 text-blue-700',
  Draft: 'bg-gray-100 text-gray-600',
  Paused: 'bg-orange-100 text-orange-700',
};

const emptyCampaign: Campaign = { name: '', type: 'Email', sent: 0, opened: 0, clicked: 0, status: 'Draft', roi: '-' };

const Marketing: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<Stat[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Campaign>(emptyCampaign);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    setLoading(true);
    const [{ data: c }, { data: s }] = await Promise.all([
      supabase.from('campaigns').select('*').order('created_at', { ascending: false }),
      supabase.from('campaign_stats').select('*').order('week'),
    ]);
    setCampaigns(c || []);
    setStats(s || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // ── Stats from real data ───────────────────────────────────────────────
  const active = campaigns.filter(c => c.status === 'Active').length;
  const totalSent = campaigns.reduce((s, c) => s + c.sent, 0);
  const totalOpened = campaigns.reduce((s, c) => s + c.opened, 0);
  const totalClicked = campaigns.reduce((s, c) => s + c.clicked, 0);
  const avgOpenRate = totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : '0';

  const openAdd = () => { setEditing(null); setForm(emptyCampaign); setShowModal(true); };
  const openEdit = (c: Campaign) => { setEditing(c); setForm({ ...c }); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditing(null); setForm(emptyCampaign); };

  const handleSave = async () => {
    if (!form.name) { showToast('Campaign name is required.', 'error'); return; }
    setSaving(true);
    if (editing?.id) {
      const { error } = await supabase.from('campaigns').update({ ...form }).eq('id', editing.id);
      if (error) showToast('Update failed: ' + error.message, 'error');
      else { showToast('Campaign updated!', 'success'); closeModal(); fetchData(); }
    } else {
      const { error } = await supabase.from('campaigns').insert([form]);
      if (error) showToast('Failed: ' + error.message, 'error');
      else { showToast('Campaign created!', 'success'); closeModal(); fetchData(); }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    const { error } = await supabase.from('campaigns').delete().eq('id', id);
    if (error) showToast('Delete failed: ' + error.message, 'error');
    else { showToast('Campaign deleted.', 'success'); fetchData(); }
    setDeleting(null);
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
        <StatCard title="Active Campaigns" value={loading ? '...' : String(active)} change="+3" positive icon={<Megaphone size={20} />} color="#DB2777" bg="#FCE7F3" delay={0.05} />
        <StatCard title="Emails Sent" value={loading ? '...' : `${(totalSent/1000).toFixed(0)}K`} change="+14.2%" positive icon={<Mail size={20} />} color="#7C3AED" bg="#EDE9FE" delay={0.1} />
        <StatCard title="Total Reach" value={loading ? '...' : `${(totalOpened/1000).toFixed(0)}K`} change="+28.4%" positive icon={<Users size={20} />} color="#2563EB" bg="#DBEAFE" delay={0.15} />
        <StatCard title="Avg Open Rate" value={loading ? '...' : `${avgOpenRate}%`} change="+2.1%" positive icon={<TrendingUp size={20} />} color="#16A34A" bg="#DCFCE7" delay={0.2} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Engagement Chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="xl:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4">Channel Engagement Rate (%)</h3>
          {loading ? (
            <div className="flex items-center justify-center h-48 text-gray-400"><Loader size={20} className="animate-spin mr-2" /> Loading...</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={stats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="email" stroke="#DB2777" strokeWidth={2} dot={{ r: 4 }} name="Email" />
                <Line type="monotone" dataKey="social" stroke="#7C3AED" strokeWidth={2} dot={{ r: 4 }} name="Social" />
                <Line type="monotone" dataKey="display" stroke="#D97706" strokeWidth={2} dot={{ r: 4 }} name="Display" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Quick Stats */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4">Campaign Overview</h3>
          {[
            { label: 'Total Reach', value: `${(totalOpened/1000).toFixed(0)}K`, color: '#DB2777', bg: '#FCE7F3' },
            { label: 'Total Clicks', value: `${(totalClicked/1000).toFixed(1)}K`, color: '#7C3AED', bg: '#EDE9FE' },
            { label: 'Click Rate', value: totalOpened > 0 ? `${((totalClicked/totalOpened)*100).toFixed(1)}%` : '0%', color: '#16A34A', bg: '#DCFCE7' },
            { label: 'Active Now', value: String(active), color: '#2563EB', bg: '#DBEAFE' },
          ].map((s, i) => (
            <div key={i} className="p-3 rounded-xl mb-3" style={{ background: s.bg }}>
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Campaigns Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
        className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="font-bold text-gray-800">Campaigns <span className="text-pink-500">({campaigns.length})</span></h3>
          <button onClick={openAdd} className="flex items-center gap-1 px-3 py-1.5 bg-pink-600 text-white rounded-lg text-sm hover:bg-pink-700">
            <Plus size={14} /> New Campaign
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400"><Loader size={20} className="animate-spin mr-2" /> Loading...</div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Megaphone size={36} className="mx-auto mb-2 opacity-30" />
            <p>No campaigns yet. Click "New Campaign" to start!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
                  <th className="pb-2 text-left font-medium">Campaign</th>
                  <th className="pb-2 text-left font-medium">Type</th>
                  <th className="pb-2 text-left font-medium">Sent</th>
                  <th className="pb-2 text-left font-medium">Opened</th>
                  <th className="pb-2 text-left font-medium">Clicked</th>
                  <th className="pb-2 text-left font-medium">Status</th>
                  <th className="pb-2 text-left font-medium">ROI</th>
                  <th className="pb-2 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 font-medium text-gray-800">{c.name}</td>
                    <td className="py-2.5 text-gray-500">{c.type}</td>
                    <td className="py-2.5 text-gray-600">{c.sent > 0 ? c.sent.toLocaleString() : '-'}</td>
                    <td className="py-2.5 text-gray-600">{c.opened.toLocaleString()}</td>
                    <td className="py-2.5 text-gray-600">{c.clicked.toLocaleString()}</td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle[c.status] || 'bg-gray-100 text-gray-600'}`}>{c.status}</span>
                    </td>
                    <td className="py-2.5 font-bold text-green-600">{c.roi}</td>
                    <td className="py-2.5">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(c)} className="w-6 h-6 bg-blue-50 rounded flex items-center justify-center text-blue-500 hover:bg-blue-100"><Edit2 size={11} /></button>
                        <button onClick={() => handleDelete(c.id!)} disabled={deleting === c.id} className="w-6 h-6 bg-red-50 rounded flex items-center justify-center text-red-400 hover:bg-red-100">
                          {deleting === c.id ? <Loader size={11} className="animate-spin" /> : <Trash2 size={11} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onKeyDown={handleEnterAsTab}
            onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800">{editing ? 'Edit Campaign' : 'New Campaign'}</h2>
                <button onClick={closeModal} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"><X size={16} /></button>
              </div>
              <div className="p-6 space-y-4">
                {[
                  { label: 'Campaign Name *', key: 'name', type: 'text', placeholder: 'e.g. Summer Sale 2024' },
                  { label: 'Emails Sent', key: 'sent', type: 'number', placeholder: '10000' },
                  { label: 'Opened / Reached', key: 'opened', type: 'number', placeholder: '3000' },
                  { label: 'Clicked', key: 'clicked', type: 'number', placeholder: '900' },
                  { label: 'ROI', key: 'roi', type: 'text', placeholder: '150%' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                    <input type={f.type} placeholder={f.placeholder} value={(form as any)[f.key]}
                      onChange={e => setForm({ ...form, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-200" />
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-200">
                      {campTypes.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-200">
                      {campStatuses.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
                <button onClick={closeModal} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 bg-pink-600 text-white rounded-lg text-sm font-medium hover:bg-pink-700 disabled:opacity-60">
                  {saving && <Loader size={14} className="animate-spin" />}
                  {saving ? 'Saving...' : editing ? 'Update' : 'Create Campaign'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Marketing;
