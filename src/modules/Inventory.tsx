import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, AlertTriangle, TrendingUp, Truck, Plus, Search, X, Loader, Edit2, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import StatCard from '../components/StatCard';
import { supabase } from '../lib/supabase';
import { handleEnterAsTab } from '../lib/formNav';

type Product = {
  id?: string;
  sku: string;
  name: string;
  category: string;
  stock: number;
  reorder_level: number;
  price: number;
  status: string;
  created_at?: string;
};

type Movement = {
  id?: string;
  product_id: string;
  product_name: string;
  type: string;
  quantity: number;
  note: string;
};

const statusColor: Record<string, string> = {
  'In Stock': 'bg-green-100 text-green-700',
  'Low Stock': 'bg-orange-100 text-orange-700',
  'Out of Stock': 'bg-red-100 text-red-700',
};
const categories = ['Electronics', 'Furniture', 'Office', 'Accessories', 'Other'];
const catColors = ['#EA580C', '#D97706', '#16A34A', '#2563EB', '#7C3AED'];

const emptyProduct: Product = { sku: '', name: '', category: 'Electronics', stock: 0, reorder_level: 10, price: 0, status: 'In Stock' };

const getStatus = (stock: number, reorder: number) => {
  if (stock === 0) return 'Out of Stock';
  if (stock <= reorder) return 'Low Stock';
  return 'In Stock';
};

const Inventory: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [form, setForm] = useState<Product>(emptyProduct);
  const [editing, setEditing] = useState<Product | null>(null);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [stockQty, setStockQty] = useState(0);
  const [stockNote, setStockNote] = useState('');
  const [stockType, setStockType] = useState<'in' | 'out'>('in');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (error) showToast('Failed to load: ' + error.message, 'error');
    else setProducts(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchProducts(); }, []);

  // ── Stats from real data ───────────────────────────────────────────────
  const totalValue = products.reduce((s, p) => s + p.stock * p.price, 0);
  const lowStock = products.filter(p => p.status === 'Low Stock').length;
  const outOfStock = products.filter(p => p.status === 'Out of Stock').length;

  // ── Category chart from real data ──────────────────────────────────────
  const categoryData = categories.map(cat => ({
    name: cat, qty: products.filter(p => p.category === cat).reduce((s, p) => s + p.stock, 0)
  })).filter(c => c.qty > 0);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  // ── Add / Edit product ─────────────────────────────────────────────────
  const openAdd = () => { setEditing(null); setForm(emptyProduct); setShowModal(true); };
  const openEdit = (p: Product) => { setEditing(p); setForm({ ...p }); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditing(null); setForm(emptyProduct); };

  const handleSave = async () => {
    if (!form.sku || !form.name) { showToast('SKU and Name are required.', 'error'); return; }
    const payload = { ...form, status: getStatus(form.stock, form.reorder_level) };
    setSaving(true);
    if (editing?.id) {
      const { error } = await supabase.from('products').update(payload).eq('id', editing.id);
      if (error) showToast('Update failed: ' + error.message, 'error');
      else { showToast('Product updated!', 'success'); closeModal(); fetchProducts(); }
    } else {
      const { error } = await supabase.from('products').insert([payload]);
      if (error) showToast('Failed to add: ' + error.message, 'error');
      else { showToast('Product added!', 'success'); closeModal(); fetchProducts(); }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) showToast('Delete failed: ' + error.message, 'error');
    else { showToast('Product deleted.', 'success'); fetchProducts(); }
    setDeleting(null);
  };

  // ── Stock movement (receive / issue stock) ─────────────────────────────
  const openStock = (p: Product, type: 'in' | 'out') => {
    setStockProduct(p); setStockType(type); setStockQty(0); setStockNote(''); setShowStockModal(true);
  };

  const handleStockMove = async () => {
    if (!stockProduct || stockQty <= 0) { showToast('Enter a valid quantity.', 'error'); return; }
    const newStock = stockType === 'in' ? stockProduct.stock + stockQty : Math.max(0, stockProduct.stock - stockQty);
    const newStatus = getStatus(newStock, stockProduct.reorder_level);
    setSaving(true);
    const { error: upErr } = await supabase.from('products').update({ stock: newStock, status: newStatus }).eq('id', stockProduct.id!);
    if (upErr) { showToast('Failed: ' + upErr.message, 'error'); setSaving(false); return; }
    await supabase.from('stock_movements').insert([{
      product_id: stockProduct.id, product_name: stockProduct.name,
      type: stockType === 'in' ? 'Receive' : 'Issue', quantity: stockQty, note: stockNote,
    }]);
    showToast(`Stock ${stockType === 'in' ? 'added' : 'removed'} successfully!`, 'success');
    setShowStockModal(false); fetchProducts();
    setSaving(false);
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
        <StatCard title="Total Products" value={loading ? '...' : String(products.length)} change="+3.2%" positive icon={<Package size={20} />} color="#EA580C" bg="#FFEDD5" delay={0.05} />
        <StatCard title="Low Stock Items" value={loading ? '...' : String(lowStock + outOfStock)} change="+6" positive={false} icon={<AlertTriangle size={20} />} color="#D97706" bg="#FEF3C7" delay={0.1} />
        <StatCard title="Stock Value" value={loading ? '...' : `₹${totalValue.toLocaleString()}`} change="+8.5%" positive icon={<TrendingUp size={20} />} color="#16A34A" bg="#DCFCE7" delay={0.15} />
        <StatCard title="Out of Stock" value={loading ? '...' : String(outOfStock)} change="-5" positive={false} icon={<Truck size={20} />} color="#2563EB" bg="#DBEAFE" delay={0.2} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Products Table */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="xl:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h3 className="font-bold text-gray-800">Products <span className="text-orange-500">({filtered.length})</span></h3>
            <div className="flex gap-2 flex-wrap">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search..." className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 w-36" />
              </div>
              <button onClick={openAdd} className="flex items-center gap-1 px-3 py-1.5 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600">
                <Plus size={14} /> Add Product
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400"><Loader size={24} className="animate-spin mr-2" /> Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400"><Package size={40} className="mx-auto mb-2 opacity-30" /><p>No products found</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
                    <th className="pb-2 text-left font-medium">SKU</th>
                    <th className="pb-2 text-left font-medium">Product</th>
                    <th className="pb-2 text-left font-medium">Category</th>
                    <th className="pb-2 text-left font-medium">Stock</th>
                    <th className="pb-2 text-left font-medium">Price</th>
                    <th className="pb-2 text-left font-medium">Status</th>
                    <th className="pb-2 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 text-gray-400 font-mono text-xs">{p.sku}</td>
                      <td className="py-2.5 font-medium text-gray-800">{p.name}</td>
                      <td className="py-2.5 text-gray-500">{p.category}</td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-12 bg-gray-100 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full bg-orange-400 transition-all"
                              style={{ width: `${Math.min((p.stock / Math.max(p.reorder_level * 5, 1)) * 100, 100)}%` }} />
                          </div>
                          <span className={`font-medium ${p.stock === 0 ? 'text-red-500' : p.stock <= p.reorder_level ? 'text-orange-500' : 'text-gray-700'}`}>{p.stock}</span>
                        </div>
                      </td>
                      <td className="py-2.5 text-gray-700">${p.price}</td>
                      <td className="py-2.5"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[p.status]}`}>{p.status}</span></td>
                      <td className="py-2.5">
                        <div className="flex gap-1">
                          <button onClick={() => openStock(p, 'in')} title="Receive stock" className="w-6 h-6 bg-green-50 rounded flex items-center justify-center text-green-600 hover:bg-green-100"><ArrowDown size={11} /></button>
                          <button onClick={() => openStock(p, 'out')} title="Issue stock" className="w-6 h-6 bg-orange-50 rounded flex items-center justify-center text-orange-500 hover:bg-orange-100"><ArrowUp size={11} /></button>
                          <button onClick={() => openEdit(p)} className="w-6 h-6 bg-blue-50 rounded flex items-center justify-center text-blue-500 hover:bg-blue-100"><Edit2 size={11} /></button>
                          <button onClick={() => handleDelete(p.id!)} disabled={deleting === p.id} className="w-6 h-6 bg-red-50 rounded flex items-center justify-center text-red-400 hover:bg-red-100">
                            {deleting === p.id ? <Loader size={11} className="animate-spin" /> : <Trash2 size={11} />}
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

        {/* Sidebar */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4">Stock by Category</h3>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={categoryData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={75} />
                <Tooltip />
                <Bar dataKey="qty" radius={[0, 6, 6, 0]}>
                  {catColors.map((c, i) => <Cell key={i} fill={c} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-300 text-sm">No data yet</div>
          )}

          <div className="mt-4 space-y-2">
            <h4 className="font-semibold text-gray-700 text-sm">⚠️ Reorder Alerts</h4>
            {products.filter(p => p.status !== 'In Stock').length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">All products well stocked ✅</p>
            ) : (
              products.filter(p => p.status !== 'In Stock').map((p) => (
                <div key={p.id} className="flex items-center justify-between p-2 bg-orange-50 rounded-lg">
                  <div>
                    <p className="text-xs font-medium text-gray-700">{p.name}</p>
                    <p className="text-[10px] text-gray-400">Reorder at: {p.reorder_level}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[p.status]}`}>{p.stock}</span>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Add/Edit Product Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onKeyDown={handleEnterAsTab}
            onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800">{editing ? 'Edit Product' : 'Add New Product'}</h2>
                <button onClick={closeModal} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"><X size={16} /></button>
              </div>
              <div className="p-6 space-y-4">
                {[
                  { label: 'SKU *', key: 'sku', type: 'text', placeholder: 'SKU-009' },
                  { label: 'Product Name *', key: 'name', type: 'text', placeholder: 'e.g. Wireless Keyboard' },
                  { label: 'Price ($)', key: 'price', type: 'number', placeholder: '99' },
                  { label: 'Stock Quantity', key: 'stock', type: 'number', placeholder: '50' },
                  { label: 'Reorder Level', key: 'reorder_level', type: 'number', placeholder: '10' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                    <input type={f.type} placeholder={f.placeholder} value={(form as any)[f.key]}
                      onChange={e => setForm({ ...form, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200" />
                  </div>
                ))}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200">
                    {categories.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
                <button onClick={closeModal} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-60">
                  {saving && <Loader size={14} className="animate-spin" />}
                  {saving ? 'Saving...' : editing ? 'Update' : 'Add Product'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stock Movement Modal */}
      <AnimatePresence>
        {showStockModal && stockProduct && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onKeyDown={handleEnterAsTab}
            onClick={e => { if (e.target === e.currentTarget) setShowStockModal(false); }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800">{stockType === 'in' ? '📦 Receive Stock' : '📤 Issue Stock'}</h2>
                <button onClick={() => setShowStockModal(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"><X size={16} /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Product</p>
                  <p className="font-semibold text-gray-800">{stockProduct.name}</p>
                  <p className="text-xs text-gray-500 mt-1">Current stock: <span className="font-bold text-orange-500">{stockProduct.stock}</span></p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                  <input type="number" min={1} value={stockQty} onChange={e => setStockQty(Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
                  <input type="text" value={stockNote} onChange={e => setStockNote(e.target.value)} placeholder="e.g. Purchase order #123"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200" />
                </div>
                {stockQty > 0 && (
                  <div className={`p-2 rounded-lg text-xs font-medium ${stockType === 'in' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
                    New stock will be: {stockType === 'in' ? stockProduct.stock + stockQty : Math.max(0, stockProduct.stock - stockQty)} units
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
                <button onClick={() => setShowStockModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={handleStockMove} disabled={saving}
                  className={`flex items-center gap-2 px-5 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-60 ${stockType === 'in' ? 'bg-green-500 hover:bg-green-600' : 'bg-orange-500 hover:bg-orange-600'}`}>
                  {saving && <Loader size={14} className="animate-spin" />}
                  {saving ? 'Saving...' : stockType === 'in' ? 'Receive Stock' : 'Issue Stock'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Inventory;
