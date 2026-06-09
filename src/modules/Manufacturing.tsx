import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Factory, Package, CheckCircle, Clock, Plus, X, Loader, Edit2, Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import StatCard from '../components/StatCard';
import { supabase } from '../lib/supabase';

type MOrder = {
  id?: string;
  order_number: string;
  product: string;
  quantity: number;
  progress: number;
  status: string;
  due_date: string;
  workcenter: string;
  created_at?: string;
};

type Workcenter = {
  id?: string;
  name: string;
  efficiency: number;
  load_percent: number;
};

const statusColor: Record<string, string> = {
  'In Progress': 'bg-blue-100 text-blue-700',
  'Done': 'bg-green-100 text-green-700',
  'Pending': 'bg-gray-100 text-gray-600',
  'Cancelled': 'bg-red-100 text-red-700',
};
const statuses = ['Pending', 'In Progress', 'Done', 'Cancelled'];
const workcenters = ['Assembly A', 'Assembly B', 'QC', 'Packaging'];
const barColors = ['#DC2626', '#7C3AED', '#2563EB', '#16A34A', '#D97706'];

const emptyOrder: MOrder = {
  order_number: '', product: '', quantity: 1, progress: 0,
  status: 'Pending', due_date: new Date().toISOString().split('T')[0], workcenter: 'Assembly A',
};

const Manufacturing: React.FC = () => {
  const [orders, setOrders] = useState<MOrder[]>([]);
  const [wcs, setWcs] = useState<Workcenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<MOrder>(emptyOrder);
  const [editing, setEditing] = useState<MOrder | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    setLoading(true);
    const [{ data: o }, { data: w }] = await Promise.all([
      supabase.from('manufacturing_orders').select('*').order('created_at', { ascending: false }),
      supabase.from('workcenters').select('*').order('name'),
    ]);
    setOrders(o || []);
    setWcs(w || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // ── Stats ──────────────────────────────────────────────────────────────
  const active = orders.filter(o => o.status === 'In Progress').length;
  const done = orders.filter(o => o.status === 'Done').length;
  const pending = orders.filter(o => o.status === 'Pending').length;
  const totalUnits = orders.filter(o => o.status === 'Done').reduce((s, o) => s + o.quantity, 0);
  const avgEff = wcs.length > 0 ? (wcs.reduce((s, w) => s + w.efficiency, 0) / wcs.length).toFixed(1) : '0';

  // ── Production chart ───────────────────────────────────────────────────
  const prodData = orders.slice(0, 5).map(o => ({
    name: o.product.length > 10 ? o.product.slice(0, 10) + '…' : o.product,
    planned: o.quantity,
    actual: Math.round(o.quantity * o.progress / 100),
  }));

  const openAdd = () => { setEditing(null); setForm(emptyOrder); setShowModal(true); };
  const openEdit = (o: MOrder) => { setEditing(o); setForm({ ...o }); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditing(null); setForm(emptyOrder); };

  const handleSave = async () => {
    if (!form.order_number || !form.product) { showToast('Order # and Product are required.', 'error'); return; }
    setSaving(true);
    if (editing?.id) {
      const { error } = await supabase.from('manufacturing_orders').update({ ...form }).eq('id', editing.id);
      if (error) showToast('Update failed: ' + error.message, 'error');
      else { showToast('Order updated!', 'success'); closeModal(); fetchData(); }
    } else {
      const { error } = await supabase.from('manufacturing_orders').insert([form]);
      if (error) showToast('Failed: ' + error.message, 'error');
      else { showToast('Order created!', 'success'); closeModal(); fetchData(); }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    const { error } = await supabase.from('manufacturing_orders').delete().eq('id', id);
    if (error) showToast('Delete failed: ' + error.message, 'error');
    else { showToast('Order deleted.', 'success'); fetchData(); }
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
        <StatCard title="Active Orders" value={loading ? '...' : String(active)} change="+4" positive icon={<Factory size={20} />} color="#DC2626" bg="#FEE2E2" delay={0.05} />
        <StatCard title="Units Produced" value={loading ? '...' : totalUnits.toLocaleString()} change="+9.3%" positive icon={<Package size={20} />} color="#7C3AED" bg="#EDE9FE" delay={0.1} />
        <StatCard title="Avg Efficiency" value={loading ? '...' : `${avgEff}%`} change="+1.8%" positive icon={<CheckCircle size={20} />} color="#16A34A" bg="#DCFCE7" delay={0.15} />
        <StatCard title="Pending Orders" value={loading ? '...' : String(pending)} change="-2" positive icon={<Clock size={20} />} color="#D97706" bg="#FEF3C7" delay={0.2} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Orders Table */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="xl:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800">Manufacturing Orders <span className="text-red-500">({orders.length})</span></h3>
            <button onClick={openAdd} className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600">
              <Plus size={14} /> New Order
            </button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400"><Loader size={24} className="animate-spin mr-2" /> Loading...</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-16 text-gray-400"><Factory size={40} className="mx-auto mb-2 opacity-30" /><p>No orders yet</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
                    <th className="pb-2 text-left font-medium">Order</th>
                    <th className="pb-2 text-left font-medium">Product</th>
                    <th className="pb-2 text-left font-medium">Qty</th>
                    <th className="pb-2 text-left font-medium">Progress</th>
                    <th className="pb-2 text-left font-medium">Status</th>
                    <th className="pb-2 text-left font-medium">Due</th>
                    <th className="pb-2 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 font-mono text-xs text-gray-500">{o.order_number}</td>
                      <td className="py-2.5 font-medium text-gray-800">{o.product}</td>
                      <td className="py-2.5 text-gray-600">{o.quantity}</td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-100 rounded-full h-2">
                            <div className="h-2 rounded-full bg-red-500 transition-all"
                              style={{ width: `${o.progress}%` }} />
                          </div>
                          <span className="text-xs font-bold text-gray-600">{o.progress}%</span>
                        </div>
                      </td>
                      <td className="py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[o.status] || 'bg-gray-100 text-gray-600'}`}>{o.status}</span>
                      </td>
                      <td className="py-2.5 text-gray-500 text-xs">{o.due_date}</td>
                      <td className="py-2.5">
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(o)} className="w-6 h-6 bg-blue-50 rounded flex items-center justify-center text-blue-500 hover:bg-blue-100"><Edit2 size={11} /></button>
                          <button onClick={() => handleDelete(o.id!)} disabled={deleting === o.id} className="w-6 h-6 bg-red-50 rounded flex items-center justify-center text-red-400 hover:bg-red-100">
                            {deleting === o.id ? <Loader size={11} className="animate-spin" /> : <Trash2 size={11} />}
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

        {/* Workcenters */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4">Workcenters</h3>
          {wcs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No workcenters found</p>
          ) : (
            <div className="space-y-4">
              {wcs.map((w, i) => (
                <div key={w.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{w.name}</span>
                    <span className="text-green-600 font-bold">{w.efficiency}% eff</span>
                  </div>
                  <p className="text-xs text-gray-400 mb-1">Load: {w.load_percent}%</p>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="h-2 rounded-full transition-all"
                      style={{ width: `${w.load_percent}%`, background: w.load_percent > 90 ? '#DC2626' : '#2563EB' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-6">
            <h4 className="font-semibold text-gray-700 text-sm mb-3">Order Summary</h4>
            {[
              { label: 'In Progress', count: active, color: '#2563EB', bg: '#DBEAFE' },
              { label: 'Done', count: done, color: '#16A34A', bg: '#DCFCE7' },
              { label: 'Pending', count: pending, color: '#D97706', bg: '#FEF3C7' },
            ].map((s, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg mb-2" style={{ background: s.bg }}>
                <span className="text-xs font-medium" style={{ color: s.color }}>{s.label}</span>
                <span className="text-sm font-bold" style={{ color: s.color }}>{s.count}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Production Chart */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
        className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-800 mb-4">Planned vs Actual Production</h3>
        {prodData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={prodData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="planned" fill="#E5E7EB" radius={[4, 4, 0, 0]} name="Planned" />
              <Bar dataKey="actual" fill="#DC2626" radius={[4, 4, 0, 0]} name="Actual">
                {prodData.map((_, i) => <Cell key={i} fill={barColors[i % barColors.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-40 flex items-center justify-center text-gray-300">No production data yet</div>
        )}
      </motion.div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800">{editing ? 'Edit Order' : 'New Manufacturing Order'}</h2>
                <button onClick={closeModal} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"><X size={16} /></button>
              </div>
              <div className="p-6 space-y-4">
                {[
                  { label: 'Order Number *', key: 'order_number', type: 'text', placeholder: 'MO-006' },
                  { label: 'Product *', key: 'product', type: 'text', placeholder: 'e.g. Widget B' },
                  { label: 'Quantity', key: 'quantity', type: 'number', placeholder: '100' },
                  { label: 'Progress (%)', key: 'progress', type: 'number', placeholder: '0' },
                  { label: 'Due Date', key: 'due_date', type: 'date', placeholder: '' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                    <input type={f.type} placeholder={f.placeholder} value={(form as any)[f.key]}
                      onChange={e => setForm({ ...form, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200">
                      {statuses.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Workcenter</label>
                    <select value={form.workcenter} onChange={e => setForm({ ...form, workcenter: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200">
                      {workcenters.map(w => <option key={w}>{w}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
                <button onClick={closeModal} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-60">
                  {saving && <Loader size={14} className="animate-spin" />}
                  {saving ? 'Saving...' : editing ? 'Update' : 'Create Order'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Manufacturing;
