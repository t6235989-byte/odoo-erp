import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Users, TrendingUp, Star, Plus, Phone, Mail, MoreHorizontal, X, Loader, Edit2, Trash2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import StatCard from '../components/StatCard';
import { supabase } from '../lib/supabase';

type Lead = {
  id?: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  deal_value: number;
  stage: string;
  rating: number;
  created_at?: string;
};

type SalesOrder = {
  id?: string;
  order_number: string;
  customer: string;
  amount: number;
  status: string;
  order_date: string;
  created_at?: string;
};

const stageColor: Record<string, string> = {
  Lead: 'bg-blue-100 text-blue-700',
  Qualified: 'bg-indigo-100 text-indigo-700',
  Proposal: 'bg-violet-100 text-violet-700',
  Negotiation: 'bg-purple-100 text-purple-700',
  Won: 'bg-green-100 text-green-700',
  Lost: 'bg-red-100 text-red-700',
};
const orderStatusColor: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-600',
  Confirmed: 'bg-blue-100 text-blue-700',
  Done: 'bg-green-100 text-green-700',
  Cancelled: 'bg-red-100 text-red-700',
};
const stages = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];
const orderStatuses = ['Draft', 'Confirmed', 'Done', 'Cancelled'];
const pipelineColors = ['#60A5FA', '#818CF8', '#A78BFA', '#7C3AED', '#16A34A', '#EF4444'];

const salesTrend = [
  { month: 'Jan', sales: 38000, target: 45000 },
  { month: 'Feb', sales: 52000, target: 45000 },
  { month: 'Mar', sales: 41000, target: 50000 },
  { month: 'Apr', sales: 63000, target: 55000 },
  { month: 'May', sales: 57000, target: 55000 },
  { month: 'Jun', sales: 78000, target: 60000 },
];

const emptyLead: Lead = { name: '', company: '', email: '', phone: '', deal_value: 0, stage: 'Lead', rating: 3 };
const emptyOrder: SalesOrder = { order_number: '', customer: '', amount: 0, status: 'Draft', order_date: new Date().toISOString().split('T')[0] };

const Sales: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'crm' | 'orders'>('crm');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [leadForm, setLeadForm] = useState<Lead>(emptyLead);
  const [orderForm, setOrderForm] = useState<SalesOrder>(emptyOrder);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [editingOrder, setEditingOrder] = useState<SalesOrder | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showActions, setShowActions] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    setLoading(true);
    const [{ data: l }, { data: o }] = await Promise.all([
      supabase.from('leads').select('*').order('created_at', { ascending: false }),
      supabase.from('sales_orders').select('*').order('created_at', { ascending: false }),
    ]);
    setLeads(l || []);
    setOrders(o || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // ── Stats ──────────────────────────────────────────────────────────────
  const totalSales = orders.filter(o => o.status === 'Done').reduce((s, o) => s + o.amount, 0);
  const wonLeads = leads.filter(l => l.stage === 'Won').length;
  const winRate = leads.length > 0 ? ((wonLeads / leads.length) * 100).toFixed(1) : '0';
  const avgDeal = leads.length > 0 ? leads.reduce((s, l) => s + l.deal_value, 0) / leads.length : 0;

  // ── Pipeline from real data ────────────────────────────────────────────
  const pipelineStages = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won'];
  const pipeline = pipelineStages.map((stage, i) => ({
    stage, color: pipelineColors[i],
    count: leads.filter(l => l.stage === stage).length,
    value: leads.filter(l => l.stage === stage).reduce((s, l) => s + l.deal_value, 0),
  }));

  // ── CRUD ───────────────────────────────────────────────────────────────
  const openAdd = () => {
    if (activeTab === 'crm') { setEditingLead(null); setLeadForm(emptyLead); }
    else { setEditingOrder(null); setOrderForm(emptyOrder); }
    setShowModal(true);
  };
  const openEditLead = (l: Lead) => { setEditingLead(l); setLeadForm({ ...l }); setShowModal(true); setShowActions(null); };
  const openEditOrder = (o: SalesOrder) => { setEditingOrder(o); setOrderForm({ ...o }); setShowModal(true); setShowActions(null); };
  const closeModal = () => { setShowModal(false); setEditingLead(null); setEditingOrder(null); };

  const handleSaveLead = async () => {
    if (!leadForm.name || !leadForm.company) { showToast('Name and Company are required.', 'error'); return; }
    setSaving(true);
    if (editingLead?.id) {
      const { error } = await supabase.from('leads').update({ ...leadForm }).eq('id', editingLead.id);
      if (error) showToast('Update failed: ' + error.message, 'error');
      else { showToast('Lead updated!', 'success'); closeModal(); fetchData(); }
    } else {
      const { error } = await supabase.from('leads').insert([leadForm]);
      if (error) showToast('Failed: ' + error.message, 'error');
      else { showToast('Lead added!', 'success'); closeModal(); fetchData(); }
    }
    setSaving(false);
  };

  const handleSaveOrder = async () => {
    if (!orderForm.order_number || !orderForm.customer) { showToast('Order # and Customer are required.', 'error'); return; }
    setSaving(true);
    if (editingOrder?.id) {
      const { error } = await supabase.from('sales_orders').update({ ...orderForm }).eq('id', editingOrder.id);
      if (error) showToast('Update failed: ' + error.message, 'error');
      else { showToast('Order updated!', 'success'); closeModal(); fetchData(); }
    } else {
      const { error } = await supabase.from('sales_orders').insert([orderForm]);
      if (error) showToast('Failed: ' + error.message, 'error');
      else { showToast('Order added!', 'success'); closeModal(); fetchData(); }
    }
    setSaving(false);
  };

  const handleDeleteLead = async (id: string) => {
    setDeleting(id);
    const { error } = await supabase.from('leads').delete().eq('id', id);
    if (error) showToast('Delete failed: ' + error.message, 'error');
    else { showToast('Lead deleted.', 'success'); fetchData(); }
    setDeleting(null); setShowActions(null);
  };

  const handleDeleteOrder = async (id: string) => {
    setDeleting(id);
    const { error } = await supabase.from('sales_orders').delete().eq('id', id);
    if (error) showToast('Delete failed: ' + error.message, 'error');
    else { showToast('Order deleted.', 'success'); fetchData(); }
    setDeleting(null); setShowActions(null);
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
        <StatCard title="Total Sales" value={loading ? '...' : `₹${totalSales.toLocaleString()}`} change="+22.4%" positive icon={<ShoppingCart size={20} />} color="#2563EB" bg="#DBEAFE" delay={0.05} />
        <StatCard title="Active Leads" value={loading ? '...' : String(leads.length)} change="+18" positive icon={<Users size={20} />} color="#7C3AED" bg="#EDE9FE" delay={0.1} />
        <StatCard title="Win Rate" value={loading ? '...' : `${winRate}%`} change="+3.2%" positive icon={<TrendingUp size={20} />} color="#16A34A" bg="#DCFCE7" delay={0.15} />
        <StatCard title="Avg Deal Size" value={loading ? '...' : `₹${Math.round(avgDeal).toLocaleString()}`} change="+7.8%" positive icon={<Star size={20} />} color="#D97706" bg="#FEF3C7" delay={0.2} />
      </div>

      {/* Pipeline */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
        className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-800 mb-4">Sales Pipeline — Live</h3>
        <div className="grid grid-cols-5 gap-3">
          {pipeline.map((p, i) => (
            <div key={i} className="text-center">
              <div className="h-2 rounded-full mb-3" style={{ background: p.color, opacity: 0.4 + i * 0.12 }} />
              <p className="text-xs text-gray-400 font-medium uppercase">{p.stage}</p>
              <p className="text-xl font-bold text-gray-800 mt-1">{p.count}</p>
              <p className="text-xs text-gray-500">${(p.value / 1000).toFixed(0)}k</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex h-3 rounded-full overflow-hidden">
          {pipeline.map((p, i) => (
            <div key={i} className="flex-1 transition-all" style={{ background: p.color, opacity: 0.5 + i * 0.1 }} />
          ))}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="xl:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4">Sales vs Target</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={salesTrend}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v / 1000}k`} />
              <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} />
              <Area type="monotone" dataKey="sales" stroke="#2563EB" strokeWidth={2} fill="url(#salesGrad)" name="Sales" />
              <Area type="monotone" dataKey="target" stroke="#D97706" strokeWidth={2} strokeDasharray="5 5" fill="none" name="Target" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-3">Pipeline Value by Stage</h3>
          {pipeline.filter(p => p.value > 0).map((p, i) => (
            <div key={i} className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-gray-700">{p.stage}</span>
                <span className="text-gray-500">${(p.value / 1000).toFixed(0)}k</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min((p.value / 200000) * 100, 100)}%`, background: p.color }} />
              </div>
            </div>
          ))}
          {pipeline.every(p => p.value === 0) && (
            <p className="text-xs text-gray-400 text-center py-6">Add leads to see pipeline data</p>
          )}
        </motion.div>
      </div>

      {/* CRM / Orders Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex gap-2">
            {(['crm', 'orders'] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === t ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {t === 'crm' ? `CRM Leads (${leads.length})` : `Sales Orders (${orders.length})`}
              </button>
            ))}
          </div>
          <button onClick={openAdd} className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600">
            <Plus size={14} /> {activeTab === 'crm' ? 'New Lead' : 'New Order'}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400"><Loader size={20} className="animate-spin mr-2" /> Loading...</div>
        ) : activeTab === 'crm' ? (
          leads.length === 0 ? (
            <div className="text-center py-12 text-gray-400"><Users size={36} className="mx-auto mb-2 opacity-30" /><p>No leads yet. Click "New Lead" to add one.</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
                  <th className="pb-2 text-left font-medium">Contact</th>
                  <th className="pb-2 text-left font-medium">Company</th>
                  <th className="pb-2 text-left font-medium">Deal Value</th>
                  <th className="pb-2 text-left font-medium">Stage</th>
                  <th className="pb-2 text-left font-medium">Rating</th>
                  <th className="pb-2 text-left font-medium">Actions</th>
                </tr></thead>
                <tbody>
                  {leads.map((l) => (
                    <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">{l.name[0]}</div>
                          <span className="font-medium text-gray-800">{l.name}</span>
                        </div>
                      </td>
                      <td className="py-3 text-gray-500">{l.company}</td>
                      <td className="py-3 font-semibold text-gray-800">${l.deal_value.toLocaleString()}</td>
                      <td className="py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stageColor[l.stage] || 'bg-gray-100 text-gray-600'}`}>{l.stage}</span></td>
                      <td className="py-3">
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, j) => (
                            <Star key={j} size={12} className={j < l.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'} />
                          ))}
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="flex gap-1 relative">
                          <button onClick={() => window.open(`mailto:${l.email}`)} className="w-6 h-6 bg-blue-50 rounded flex items-center justify-center text-blue-500 hover:bg-blue-100"><Mail size={11} /></button>
                          <button onClick={() => window.open(`tel:${l.phone}`)} className="w-6 h-6 bg-green-50 rounded flex items-center justify-center text-green-500 hover:bg-green-100"><Phone size={11} /></button>
                          <button onClick={() => setShowActions(showActions === l.id ? null : l.id!)} className="w-6 h-6 bg-gray-50 rounded flex items-center justify-center text-gray-500 hover:bg-gray-100"><MoreHorizontal size={11} /></button>
                          {showActions === l.id && (
                            <div className="absolute right-0 top-7 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden w-32">
                              <button onClick={() => openEditLead(l)} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"><Edit2 size={12} /> Edit</button>
                              <button onClick={() => handleDeleteLead(l.id!)} disabled={deleting === l.id} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-600 hover:bg-red-50">
                                {deleting === l.id ? <Loader size={12} className="animate-spin" /> : <Trash2 size={12} />} Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          orders.length === 0 ? (
            <div className="text-center py-12 text-gray-400"><ShoppingCart size={36} className="mx-auto mb-2 opacity-30" /><p>No orders yet. Click "New Order" to add one.</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
                  <th className="pb-2 text-left font-medium">Order #</th>
                  <th className="pb-2 text-left font-medium">Customer</th>
                  <th className="pb-2 text-left font-medium">Amount</th>
                  <th className="pb-2 text-left font-medium">Date</th>
                  <th className="pb-2 text-left font-medium">Status</th>
                  <th className="pb-2 text-left font-medium">Actions</th>
                </tr></thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-3 font-mono text-xs text-gray-500">{o.order_number}</td>
                      <td className="py-3 font-medium text-gray-800">{o.customer}</td>
                      <td className="py-3 font-semibold">${o.amount.toLocaleString()}</td>
                      <td className="py-3 text-gray-500">{o.order_date}</td>
                      <td className="py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${orderStatusColor[o.status] || 'bg-gray-100 text-gray-600'}`}>{o.status}</span></td>
                      <td className="py-3">
                        <div className="flex gap-1">
                          <button onClick={() => openEditOrder(o)} className="w-6 h-6 bg-blue-50 rounded flex items-center justify-center text-blue-500 hover:bg-blue-100"><Edit2 size={11} /></button>
                          <button onClick={() => handleDeleteOrder(o.id!)} disabled={deleting === o.id} className="w-6 h-6 bg-red-50 rounded flex items-center justify-center text-red-400 hover:bg-red-100">
                            {deleting === o.id ? <Loader size={11} className="animate-spin" /> : <Trash2 size={11} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </motion.div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800">
                  {activeTab === 'crm' ? (editingLead ? 'Edit Lead' : 'New Lead') : (editingOrder ? 'Edit Order' : 'New Order')}
                </h2>
                <button onClick={closeModal} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"><X size={16} /></button>
              </div>
              <div className="p-6 space-y-4">
                {activeTab === 'crm' ? (
                  <>
                    {[
                      { label: 'Full Name *', key: 'name', type: 'text', placeholder: 'e.g. Emily Johnson' },
                      { label: 'Company *', key: 'company', type: 'text', placeholder: 'e.g. TechNova Ltd' },
                      { label: 'Email', key: 'email', type: 'email', placeholder: 'emily@company.com' },
                      { label: 'Phone', key: 'phone', type: 'text', placeholder: '+91-9876540001' },
                      { label: 'Deal Value ($)', key: 'deal_value', type: 'number', placeholder: '50000' },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                        <input type={f.type} placeholder={f.placeholder} value={(leadForm as any)[f.key]}
                          onChange={e => setLeadForm({ ...leadForm, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                      </div>
                    ))}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
                        <select value={leadForm.stage} onChange={e => setLeadForm({ ...leadForm, stage: e.target.value })}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
                          {stages.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Rating (1-5)</label>
                        <input type="number" min={1} max={5} value={leadForm.rating}
                          onChange={e => setLeadForm({ ...leadForm, rating: Number(e.target.value) })}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {[
                      { label: 'Order Number *', key: 'order_number', type: 'text', placeholder: 'SO-2024-006' },
                      { label: 'Customer *', key: 'customer', type: 'text', placeholder: 'e.g. Acme Corp' },
                      { label: 'Amount ($)', key: 'amount', type: 'number', placeholder: '50000' },
                      { label: 'Order Date', key: 'order_date', type: 'date', placeholder: '' },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                        <input type={f.type} placeholder={f.placeholder} value={(orderForm as any)[f.key]}
                          onChange={e => setOrderForm({ ...orderForm, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                      </div>
                    ))}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select value={orderForm.status} onChange={e => setOrderForm({ ...orderForm, status: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
                        {orderStatuses.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  </>
                )}
              </div>
              <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
                <button onClick={closeModal} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={activeTab === 'crm' ? handleSaveLead : handleSaveOrder} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-60">
                  {saving && <Loader size={14} className="animate-spin" />}
                  {saving ? 'Saving...' : (editingLead || editingOrder) ? 'Update' : 'Add'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Sales;
