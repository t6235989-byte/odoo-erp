import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, TrendingUp, Star, Eye, Plus, X, Loader, Edit2, Trash2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import StatCard from '../components/StatCard';
import { supabase } from '../lib/supabase';

type Product = {
  id?: string;
  product_id?: string; // links to the real Inventory product (products table)
  name: string;
  price: number;
  sold: number;
  stock: number; // kept for backward compatibility, but display uses live Inventory stock when linked
  rating: number;
  revenue: number;
  category: string;
  status: string;
  created_at?: string;
};

type InventoryProduct = { id: string; name: string; sku: string; stock: number; reorder_level: number; price: number; status: string; };

type Order = {
  id?: string;
  order_number: string;
  customer: string;
  amount: number;
  status: string;
  product: string;
  product_id?: string; // links to products_online.id, which itself links to real Inventory
  quantity?: number;
  order_date: string;
  created_at?: string;
  stock_deducted?: boolean; // prevents double-deducting stock if the order is edited again
};

type WeeklySale = { day: string; orders: number; revenue: number; };

const orderStatusStyle: Record<string, string> = {
  Delivered: 'bg-green-100 text-green-700',
  Processing: 'bg-blue-100 text-blue-700',
  Shipped: 'bg-violet-100 text-violet-700',
  Pending: 'bg-yellow-100 text-yellow-700',
  Cancelled: 'bg-red-100 text-red-700',
};
const orderStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
const categories = ['Electronics', 'Accessories', 'Clothing', 'Home', 'Sports', 'General'];
const emptyProduct: Product = { name: '', price: 0, sold: 0, stock: 0, rating: 4.5, revenue: 0, category: 'Electronics', status: 'Active' };
const emptyOrder: Order = { order_number: '', customer: '', amount: 0, status: 'Pending', product: '', quantity: 1, order_date: new Date().toISOString().split('T')[0] };
// Matches Inventory module's exact status convention so stock state stays consistent everywhere
const getInventoryStatus = (stock: number, reorder: number) => {
  if (stock === 0) return 'Out of Stock';
  if (stock <= reorder) return 'Low Stock';
  return 'In Stock';
};

const Ecommerce: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [inventoryProducts, setInventoryProducts] = useState<InventoryProduct[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [weeklySales, setWeeklySales] = useState<WeeklySale[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'products' | 'orders'>('products');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'product' | 'order'>('product');
  const [productForm, setProductForm] = useState<Product>(emptyProduct);
  const [orderForm, setOrderForm] = useState<Order>(emptyOrder);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    setLoading(true);
    const [{ data: p }, { data: o }, { data: w }, { data: ip }] = await Promise.all([
      supabase.from('products_online').select('*').order('revenue', { ascending: false }),
      supabase.from('online_orders').select('*').order('created_at', { ascending: false }),
      supabase.from('weekly_sales').select('*').order('created_at', { ascending: true }),
      supabase.from('products').select('id,name,sku,stock,reorder_level,price,status').order('name'),
    ]);
    setProducts(p || []);
    setOrders(o || []);
    setWeeklySales(w || []);
    setInventoryProducts(ip || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Live stock comes from the real Inventory product when linked; falls back
  // to the eCommerce product's own stored stock only if never linked.
  const getLiveStock = (p: Product): number => {
    if (p.product_id) {
      const inv = inventoryProducts.find(ip => ip.id === p.product_id);
      if (inv) return inv.stock;
    }
    return p.stock;
  };

  // ── Stats ──────────────────────────────────────────────────────────────
  const totalRevenue = products.reduce((s, p) => s + p.revenue, 0);
  const totalOrders = orders.length;
  const avgRating = products.length > 0 ? (products.reduce((s, p) => s + p.rating, 0) / products.length).toFixed(1) : '0';
  const totalVisitors = weeklySales.reduce((s, w) => s + w.orders, 0);

  // ── Product CRUD ───────────────────────────────────────────────────────
  const openAddProduct = () => { setEditingProduct(null); setProductForm(emptyProduct); setModalType('product'); setShowModal(true); };
  const openEditProduct = (p: Product) => { setEditingProduct(p); setProductForm({ ...p }); setModalType('product'); setShowModal(true); };

  const handleSaveProduct = async () => {
    if (!productForm.name) { showToast('Product name is required.', 'error'); return; }
    if (!productForm.product_id) { showToast('Please link this listing to a real Inventory product.', 'error'); return; }
    setSaving(true);
    if (editingProduct?.id) {
      const { error } = await supabase.from('products_online').update({ ...productForm }).eq('id', editingProduct.id);
      if (error) showToast('Update failed: ' + error.message, 'error');
      else { showToast('Product updated!', 'success'); setShowModal(false); fetchData(); }
    } else {
      const { error } = await supabase.from('products_online').insert([productForm]);
      if (error) showToast('Failed: ' + error.message, 'error');
      else { showToast('Product added!', 'success'); setShowModal(false); fetchData(); }
    }
    setSaving(false);
  };

  const handleDeleteProduct = async (id: string) => {
    setDeleting(id);
    const { error } = await supabase.from('products_online').delete().eq('id', id);
    if (error) showToast('Delete failed: ' + error.message, 'error');
    else { showToast('Product deleted.', 'success'); fetchData(); }
    setDeleting(null);
  };

  // ── Order CRUD ─────────────────────────────────────────────────────────
  const openAddOrder = () => { setEditingOrder(null); setOrderForm(emptyOrder); setModalType('order'); setShowModal(true); };
  const openEditOrder = (o: Order) => { setEditingOrder(o); setOrderForm({ ...o }); setModalType('order'); setShowModal(true); };

  const handleSaveOrder = async () => {
    if (!orderForm.order_number || !orderForm.customer) { showToast('Order # and Customer are required.', 'error'); return; }
    setSaving(true);
    if (editingOrder?.id) {
      // Editing an existing order never re-deducts stock — that already happened when it was first created.
      const { error } = await supabase.from('online_orders').update({ ...orderForm }).eq('id', editingOrder.id);
      if (error) { showToast('Update failed: ' + error.message, 'error'); setSaving(false); return; }
      showToast('Order updated!', 'success'); setShowModal(false); fetchData();
    } else {
      // New order: deduct stock from the linked Inventory product first, so we
      // never record a sale that couldn't actually be fulfilled from stock.
      let invProduct: InventoryProduct | undefined;
      if (orderForm.product_id) {
        const ecomProduct = products.find(p => p.id === orderForm.product_id);
        if (ecomProduct?.product_id) invProduct = inventoryProducts.find(ip => ip.id === ecomProduct.product_id);
      }
      const qty = orderForm.quantity || 1;
      if (invProduct) {
        if (invProduct.stock < qty) {
          const proceed = window.confirm(`⚠️ Only ${invProduct.stock} in stock, but this order needs ${qty}.\n\nSave anyway? Stock will go negative.`);
          if (!proceed) { setSaving(false); return; }
        }
        const newStock = invProduct.stock - qty;
        const newStatus = getInventoryStatus(Math.max(0, newStock), invProduct.reorder_level);
        const { error: stockErr } = await supabase.from('products').update({ stock: newStock, status: newStatus }).eq('id', invProduct.id);
        if (stockErr) { showToast('Failed to update Inventory stock: ' + stockErr.message, 'error'); setSaving(false); return; }
        await supabase.from('stock_movements').insert([{
          product_id: invProduct.id, product_name: invProduct.name,
          type: 'Issue', quantity: qty, note: `eCommerce order ${orderForm.order_number}`,
        }]);
      }
      const { error } = await supabase.from('online_orders').insert([{ ...orderForm, stock_deducted: !!invProduct }]);
      if (error) { showToast('Failed: ' + error.message, 'error'); setSaving(false); return; }
      showToast(invProduct ? `Order added & ${qty} unit(s) deducted from Inventory!` : 'Order added!', 'success');
      setShowModal(false); fetchData();
    }
    setSaving(false);
  };

  const handleDeleteOrder = async (id: string) => {
    setDeleting(id);
    const { error } = await supabase.from('online_orders').delete().eq('id', id);
    if (error) showToast('Delete failed: ' + error.message, 'error');
    else { showToast('Order deleted.', 'success'); fetchData(); }
    setDeleting(null);
  };

  const closeModal = () => { setShowModal(false); setEditingProduct(null); setEditingOrder(null); };

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
        <StatCard title="Online Revenue" value={loading ? '...' : `₹${(totalRevenue/1000).toFixed(0)}K`} change="+31.4%" positive icon={<TrendingUp size={20} />} color="#D97706" bg="#FEF3C7" delay={0.05} />
        <StatCard title="Total Orders" value={loading ? '...' : String(totalOrders)} change="+21.2%" positive icon={<ShoppingBag size={20} />} color="#2563EB" bg="#DBEAFE" delay={0.1} />
        <StatCard title="Avg Rating" value={loading ? '...' : `${avgRating} ★`} change="+0.2" positive icon={<Star size={20} />} color="#7C3AED" bg="#EDE9FE" delay={0.15} />
        <StatCard title="Weekly Visitors" value={loading ? '...' : `${totalVisitors.toLocaleString()}`} change="+12.8%" positive icon={<Eye size={20} />} color="#16A34A" bg="#DCFCE7" delay={0.2} />
      </div>

      {/* Weekly Sales Chart */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
        className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-800 mb-4">Weekly Sales & Revenue</h3>
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400"><Loader size={20} className="animate-spin mr-2" /> Loading...</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={weeklySales}>
              <defs>
                <linearGradient id="eg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#D97706" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#D97706" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${v/1000}k`} />
              <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} />
              <Area type="monotone" dataKey="revenue" stroke="#D97706" fill="url(#eg)" strokeWidth={2} name="Revenue ($)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      {/* Products / Orders Tabs */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex gap-2">
            {(['products', 'orders'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {t === 'products' ? `Products (${products.length})` : `Orders (${orders.length})`}
              </button>
            ))}
          </div>
          <button onClick={tab === 'products' ? openAddProduct : openAddOrder}
            className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600">
            <Plus size={14} /> {tab === 'products' ? 'Add Product' : 'Add Order'}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400"><Loader size={20} className="animate-spin mr-2" /> Loading...</div>
        ) : tab === 'products' ? (
          products.length === 0 ? (
            <div className="text-center py-12 text-gray-400"><ShoppingBag size={36} className="mx-auto mb-2 opacity-30" /><p>No products yet</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
                    <th className="pb-2 text-left font-medium">Product</th>
                    <th className="pb-2 text-left font-medium">Price</th>
                    <th className="pb-2 text-left font-medium">Sold</th>
                    <th className="pb-2 text-left font-medium">Stock</th>
                    <th className="pb-2 text-left font-medium">Rating</th>
                    <th className="pb-2 text-left font-medium">Revenue</th>
                    <th className="pb-2 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 font-medium text-gray-800">{p.name}</td>
                      <td className="py-2.5 text-gray-600">${p.price}</td>
                      <td className="py-2.5 font-semibold text-gray-700">{p.sold.toLocaleString()}</td>
                      <td className="py-2.5"><span className={getLiveStock(p) < 100 ? 'text-orange-500 font-bold' : 'text-gray-600'}>{getLiveStock(p)}{p.product_id && <span className="text-[10px] text-gray-400 ml-1">(live)</span>}</span></td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-1">
                          <Star size={11} className="text-yellow-400 fill-yellow-400" />
                          <span className="text-gray-600">{p.rating}</span>
                        </div>
                      </td>
                      <td className="py-2.5 font-bold text-green-600">${p.revenue.toLocaleString()}</td>
                      <td className="py-2.5">
                        <div className="flex gap-1">
                          <button onClick={() => openEditProduct(p)} className="w-6 h-6 bg-blue-50 rounded flex items-center justify-center text-blue-500 hover:bg-blue-100"><Edit2 size={11} /></button>
                          <button onClick={() => handleDeleteProduct(p.id!)} disabled={deleting === p.id} className="w-6 h-6 bg-red-50 rounded flex items-center justify-center text-red-400 hover:bg-red-100">
                            {deleting === p.id ? <Loader size={11} className="animate-spin" /> : <Trash2 size={11} />}
                          </button>
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
            <div className="text-center py-12 text-gray-400"><ShoppingBag size={36} className="mx-auto mb-2 opacity-30" /><p>No orders yet</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
                    <th className="pb-2 text-left font-medium">Order #</th>
                    <th className="pb-2 text-left font-medium">Customer</th>
                    <th className="pb-2 text-left font-medium">Product</th>
                    <th className="pb-2 text-left font-medium">Amount</th>
                    <th className="pb-2 text-left font-medium">Date</th>
                    <th className="pb-2 text-left font-medium">Status</th>
                    <th className="pb-2 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 font-mono text-xs text-gray-500">{o.order_number}</td>
                      <td className="py-2.5 font-medium text-gray-800">{o.customer}</td>
                      <td className="py-2.5 text-gray-500 text-xs">{o.product}</td>
                      <td className="py-2.5 font-bold text-gray-700">${o.amount}</td>
                      <td className="py-2.5 text-gray-400 text-xs">{o.order_date}</td>
                      <td className="py-2.5"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${orderStatusStyle[o.status] || 'bg-gray-100 text-gray-600'}`}>{o.status}</span></td>
                      <td className="py-2.5">
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
                  {modalType === 'product' ? (editingProduct ? 'Edit Product' : 'Add Product') : (editingOrder ? 'Edit Order' : 'Add Order')}
                </h2>
                <button onClick={closeModal} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"><X size={16} /></button>
              </div>
              <div className="p-6 space-y-4">
                {modalType === 'product' ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Inventory Product *</label>
                      <select
                        value={productForm.product_id || ''}
                        onChange={e => {
                          const inv = inventoryProducts.find(ip => ip.id === e.target.value);
                          setProductForm({
                            ...productForm,
                            product_id: e.target.value || undefined,
                            name: inv?.name || productForm.name,
                            price: inv?.price ?? productForm.price,
                            stock: inv?.stock ?? productForm.stock,
                          });
                        }}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200">
                        <option value="">— Select a product from Inventory —</option>
                        {inventoryProducts.map(ip => <option key={ip.id} value={ip.id}>{ip.name} (SKU: {ip.sku}) — Stock: {ip.stock}</option>)}
                      </select>
                      <p className="text-xs text-gray-400 mt-1">Stock for this listing is the same as Inventory's live stock — manage quantity from the Inventory module.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Storefront Name</label>
                      <input type="text" placeholder="e.g. Bluetooth Speaker" value={productForm.name}
                        onChange={e => setProductForm({ ...productForm, name: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
                    </div>
                    {[
                      { label: 'Price ($)', key: 'price', type: 'number', placeholder: '99' },
                      { label: 'Units Sold', key: 'sold', type: 'number', placeholder: '0' },
                      { label: 'Rating', key: 'rating', type: 'number', placeholder: '4.5' },
                      { label: 'Revenue ($)', key: 'revenue', type: 'number', placeholder: '0' },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                        <input type={f.type} placeholder={f.placeholder} value={(productForm as any)[f.key]}
                          onChange={e => setProductForm({ ...productForm, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
                      </div>
                    ))}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Stock (live from Inventory)</label>
                      <input type="number" disabled value={productForm.product_id ? (inventoryProducts.find(ip=>ip.id===productForm.product_id)?.stock ?? productForm.stock) : productForm.stock}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                      <select value={productForm.category} onChange={e => setProductForm({ ...productForm, category: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200">
                        {categories.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    {[
                      { label: 'Order Number *', key: 'order_number', type: 'text', placeholder: 'ORD-006' },
                      { label: 'Customer *', key: 'customer', type: 'text', placeholder: 'e.g. John Doe' },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                        <input type={f.type} placeholder={f.placeholder} value={(orderForm as any)[f.key]}
                          onChange={e => setOrderForm({ ...orderForm, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
                      </div>
                    ))}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                      <select disabled={!!editingOrder} value={orderForm.product_id || ''} onChange={e => {
                        const prod = products.find(p => p.id === e.target.value);
                        setOrderForm({ ...orderForm, product_id: e.target.value || undefined, product: prod?.name || orderForm.product, amount: prod ? prod.price * (orderForm.quantity||1) : orderForm.amount });
                      }} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:bg-gray-50 disabled:text-gray-400">
                        <option value="">— Type product name manually below —</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name} — Stock: {getLiveStock(p)}</option>)}
                      </select>
                      {!orderForm.product_id && (
                        <input type="text" placeholder="e.g. Wireless Headphones" value={orderForm.product}
                          onChange={e => setOrderForm({ ...orderForm, product: e.target.value })}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none mt-2" />
                      )}
                      {editingOrder && <p className="text-xs text-gray-400 mt-1">Product/quantity can't be changed after creation, since stock was already deducted.</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                        <input type="number" disabled={!!editingOrder} min={1} value={orderForm.quantity||1}
                          onChange={e => {
                            const qty = Math.max(1, Number(e.target.value));
                            const prod = products.find(p => p.id === orderForm.product_id);
                            setOrderForm({ ...orderForm, quantity: qty, amount: prod ? prod.price * qty : orderForm.amount });
                          }}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:bg-gray-50 disabled:text-gray-400" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
                        <input type="number" placeholder="149" value={orderForm.amount}
                          onChange={e => setOrderForm({ ...orderForm, amount: Number(e.target.value) })}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Order Date</label>
                      <input type="date" value={orderForm.order_date}
                        onChange={e => setOrderForm({ ...orderForm, order_date: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select value={orderForm.status} onChange={e => setOrderForm({ ...orderForm, status: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200">
                        {orderStatuses.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  </>
                )}
              </div>
              <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
                <button onClick={closeModal} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={modalType === 'product' ? handleSaveProduct : handleSaveOrder} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-60">
                  {saving && <Loader size={14} className="animate-spin" />}
                  {saving ? 'Saving...' : (editingProduct || editingOrder) ? 'Update' : 'Add'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Ecommerce;
