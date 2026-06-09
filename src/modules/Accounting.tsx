import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DollarSign, TrendingUp, TrendingDown, FileText, Plus, CheckCircle, Clock, XCircle, X, Loader, Trash2, Edit2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import StatCard from '../components/StatCard';
import { supabase } from '../lib/supabase';

type Invoice = {
  id?: string;
  invoice_number: string;
  client: string;
  amount: number;
  due_date: string;
  status: string;
  type: string;
  created_at?: string;
};

type Transaction = {
  id?: string;
  month: string;
  income: number;
  expenses: number;
};

const statusIcon: Record<string, React.ReactNode> = {
  Paid: <CheckCircle size={14} className="text-green-500" />,
  Pending: <Clock size={14} className="text-yellow-500" />,
  Overdue: <XCircle size={14} className="text-red-500" />,
};
const statusColor: Record<string, string> = {
  Paid: 'bg-green-100 text-green-700',
  Pending: 'bg-yellow-100 text-yellow-700',
  Overdue: 'bg-red-100 text-red-700',
};
const expenseColors = ['#16A34A', '#2563EB', '#D97706', '#7C3AED', '#DC2626'];
const staticExpenses = [
  { name: 'Salaries', value: 48000 },
  { name: 'Operations', value: 12000 },
  { name: 'Marketing', value: 8500 },
  { name: 'IT & Tech', value: 6200 },
  { name: 'Travel', value: 3100 },
];

const emptyInvoice: Invoice = {
  invoice_number: '', client: '', amount: 0,
  due_date: new Date().toISOString().split('T')[0],
  status: 'Pending', type: 'invoice',
};

const Accounting: React.FC = () => {
  const [tab, setTab] = useState<'invoices' | 'bills'>('invoices');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [cashflow, setCashflow] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Invoice>(emptyInvoice);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    setLoading(true);
    const [{ data: inv }, { data: tx }] = await Promise.all([
      supabase.from('invoices').select('*').order('created_at', { ascending: false }),
      supabase.from('transactions').select('*').order('created_at', { ascending: true }),
    ]);
    setInvoices(inv || []);
    setCashflow(tx || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // ── Stats computed from real data ──────────────────────────────────────
  const totalRevenue = invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.amount, 0);
  const outstanding = invoices.filter(i => i.status === 'Pending').reduce((s, i) => s + i.amount, 0);
  const overdue = invoices.filter(i => i.status === 'Overdue').reduce((s, i) => s + i.amount, 0);
  const netProfit = totalRevenue - staticExpenses.reduce((s, e) => s + e.value, 0);

  const filtered = invoices.filter(i => i.type === (tab === 'invoices' ? 'invoice' : 'bill'));

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyInvoice, type: tab === 'invoices' ? 'invoice' : 'bill' });
    setShowModal(true);
  };
  const openEdit = (inv: Invoice) => { setEditing(inv); setForm({ ...inv }); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditing(null); setForm(emptyInvoice); };

  const handleSave = async () => {
    if (!form.invoice_number || !form.client || !form.amount) {
      showToast('Please fill in Invoice #, Client and Amount.', 'error'); return;
    }
    setSaving(true);
    if (editing?.id) {
      const { error } = await supabase.from('invoices').update({ ...form }).eq('id', editing.id);
      if (error) showToast('Update failed: ' + error.message, 'error');
      else { showToast('Invoice updated!', 'success'); closeModal(); fetchData(); }
    } else {
      const { error } = await supabase.from('invoices').insert([form]);
      if (error) showToast('Failed to add: ' + error.message, 'error');
      else { showToast('Invoice added!', 'success'); closeModal(); fetchData(); }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (error) showToast('Delete failed: ' + error.message, 'error');
    else { showToast('Invoice deleted.', 'success'); fetchData(); }
    setDeleting(null);
  };

  const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0';

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
        <StatCard title="Total Revenue" value={loading ? '...' : `₹${totalRevenue.toLocaleString()}`} change="+14.2%" positive icon={<DollarSign size={20} />} color="#16A34A" bg="#DCFCE7" delay={0.05} />
        <StatCard title="Outstanding" value={loading ? '...' : `₹${outstanding.toLocaleString()}`} change="+3" positive={false} icon={<FileText size={20} />} color="#D97706" bg="#FEF3C7" delay={0.1} />
        <StatCard title="Net Profit" value={loading ? '...' : `₹${netProfit.toLocaleString()}`} change="+18.7%" positive icon={<TrendingUp size={20} />} color="#2563EB" bg="#DBEAFE" delay={0.15} />
        <StatCard title="Overdue" value={loading ? '...' : `₹${overdue.toLocaleString()}`} change="-2" positive={false} icon={<TrendingDown size={20} />} color="#DC2626" bg="#FEE2E2" delay={0.2} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Cashflow Chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="xl:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4">Cash Flow Overview</h3>
          {loading ? (
            <div className="flex items-center justify-center h-48 text-gray-400"><Loader size={24} className="animate-spin mr-2" /> Loading...</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={cashflow}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v / 1000}k`} />
                <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} />
                <Line type="monotone" dataKey="income" stroke="#16A34A" strokeWidth={2.5} dot={{ r: 4 }} name="Income" />
                <Line type="monotone" dataKey="expenses" stroke="#DC2626" strokeWidth={2.5} dot={{ r: 4 }} name="Expenses" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Expense Breakdown */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4">Expense Breakdown</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={staticExpenses} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${v / 1000}k`} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={70} />
              <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                {expenseColors.map((c, i) => <Cell key={i} fill={c} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 p-3 bg-green-50 rounded-xl">
            <p className="text-xs text-gray-500">Profit Margin</p>
            <p className="text-2xl font-bold text-green-600">{profitMargin}%</p>
            <div className="w-full bg-gray-100 rounded-full h-2 mt-2">
              <div className="bg-green-500 h-2 rounded-full transition-all duration-700" style={{ width: `${Math.min(parseFloat(profitMargin), 100)}%` }} />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Invoices Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
        className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex gap-2">
            {(['invoices', 'bills'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {t} {t === 'invoices' ? `(${invoices.filter(i => i.type === 'invoice').length})` : `(${invoices.filter(i => i.type === 'bill').length})`}
              </button>
            ))}
          </div>
          <button onClick={openAdd} className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600">
            <Plus size={14} /> New {tab === 'invoices' ? 'Invoice' : 'Bill'}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400"><Loader size={20} className="animate-spin mr-2" /> Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FileText size={36} className="mx-auto mb-2 opacity-30" />
            <p>No {tab} yet. Click "New {tab === 'invoices' ? 'Invoice' : 'Bill'}" to add one.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
                  <th className="pb-2 text-left font-medium">Invoice #</th>
                  <th className="pb-2 text-left font-medium">Client</th>
                  <th className="pb-2 text-left font-medium">Amount</th>
                  <th className="pb-2 text-left font-medium">Due Date</th>
                  <th className="pb-2 text-left font-medium">Status</th>
                  <th className="pb-2 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => (
                  <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 font-mono text-xs text-gray-500">{inv.invoice_number}</td>
                    <td className="py-2.5 font-medium text-gray-800">{inv.client}</td>
                    <td className="py-2.5 text-gray-700 font-semibold">${inv.amount.toLocaleString()}</td>
                    <td className="py-2.5 text-gray-500">{inv.due_date}</td>
                    <td className="py-2.5">
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium w-fit ${statusColor[inv.status] || 'bg-gray-100 text-gray-600'}`}>
                        {statusIcon[inv.status]} {inv.status}
                      </span>
                    </td>
                    <td className="py-2.5">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(inv)} className="w-6 h-6 bg-blue-50 rounded flex items-center justify-center text-blue-500 hover:bg-blue-100"><Edit2 size={11} /></button>
                        <button onClick={() => handleDelete(inv.id!)} disabled={deleting === inv.id} className="w-6 h-6 bg-red-50 rounded flex items-center justify-center text-red-400 hover:bg-red-100">
                          {deleting === inv.id ? <Loader size={11} className="animate-spin" /> : <Trash2 size={11} />}
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
            className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800">{editing ? 'Edit Invoice' : `New ${tab === 'invoices' ? 'Invoice' : 'Bill'}`}</h2>
                <button onClick={closeModal} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"><X size={16} /></button>
              </div>
              <div className="p-6 space-y-4">
                {[
                  { label: 'Invoice Number *', key: 'invoice_number', type: 'text', placeholder: 'INV-2024-001' },
                  { label: 'Client Name *', key: 'client', type: 'text', placeholder: 'e.g. Acme Corp' },
                  { label: 'Amount *', key: 'amount', type: 'number', placeholder: '10000' },
                  { label: 'Due Date', key: 'due_date', type: 'date', placeholder: '' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                    <input type={field.type} placeholder={field.placeholder}
                      value={(form as any)[field.key]}
                      onChange={e => setForm({ ...form, [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-200" />
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-200">
                      {['Pending', 'Paid', 'Overdue'].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-200">
                      <option value="invoice">Invoice</option>
                      <option value="bill">Bill</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
                <button onClick={closeModal} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 disabled:opacity-60">
                  {saving && <Loader size={14} className="animate-spin" />}
                  {saving ? 'Saving...' : editing ? 'Update' : 'Add'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Accounting;
