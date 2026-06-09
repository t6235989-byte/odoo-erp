import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, DollarSign, Package, ShoppingBag, Factory, FolderOpen, Megaphone, Wrench, MessageCircle, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import StatCard from '../components/StatCard';
import { supabase } from '../lib/supabase';

const COLORS = ['#7C3AED','#2563EB','#EA580C','#16A34A','#D97706','#DC2626','#0891B2','#DB2777','#059669','#6366F1'];

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    employees: 0, totalPayroll: 0, onLeave: 0,
    revenue: 0, outstanding: 0, overdue: 0,
    products: 0, stockValue: 0, lowStock: 0,
    leads: 0, wonDeals: 0, pipeline: 0,
    mfgOrders: 0, mfgDone: 0,
    projects: 0, tasksDone: 0, hoursLogged: 0,
    campaigns: 0, totalReach: 0,
    jobs: 0, jobsDone: 0,
    activeChats: 0,
    onlineRevenue: 0, onlineOrders: 0,
  });
  const [cashflow, setCashflow] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [modulePerf, setModulePerf] = useState<any[]>([]);
  const [pieData, setPieData] = useState<any[]>([]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [
        { data: emps }, { data: invoices }, { data: prods },
        { data: leads }, { data: mfgOrders }, { data: projects },
        { data: tasks }, { data: campaigns }, { data: jobs },
        { data: convs }, { data: onlineProds }, { data: onlineOrders },
        { data: txns },
      ] = await Promise.all([
        supabase.from('employees').select('salary,status'),
        supabase.from('invoices').select('amount,status'),
        supabase.from('products').select('stock,price,status'),
        supabase.from('leads').select('deal_value,stage'),
        supabase.from('manufacturing_orders').select('status,quantity'),
        supabase.from('projects').select('id'),
        supabase.from('tasks').select('stage,hours_logged'),
        supabase.from('campaigns').select('status,opened'),
        supabase.from('jobs').select('status'),
        supabase.from('conversations').select('status'),
        supabase.from('products_online').select('revenue'),
        supabase.from('online_orders').select('id'),
        supabase.from('transactions').select('month,income,expenses'),
      ]);

      // ── Compute stats ────────────────────────────────────────────────
      const employees = emps?.length || 0;
      const totalPayroll = (emps || []).reduce((s: number, e: any) => s + (e.salary || 0), 0) / 12;
      const onLeave = (emps || []).filter((e: any) => e.status === 'On Leave').length;

      const paidInvoices = (invoices || []).filter((i: any) => i.status === 'Paid');
      const revenue = paidInvoices.reduce((s: number, i: any) => s + i.amount, 0);
      const outstanding = (invoices || []).filter((i: any) => i.status === 'Pending').reduce((s: number, i: any) => s + i.amount, 0);
      const overdue = (invoices || []).filter((i: any) => i.status === 'Overdue').reduce((s: number, i: any) => s + i.amount, 0);

      const products = prods?.length || 0;
      const stockValue = (prods || []).reduce((s: number, p: any) => s + p.stock * p.price, 0);
      const lowStock = (prods || []).filter((p: any) => p.status !== 'In Stock').length;

      const wonDeals = (leads || []).filter((l: any) => l.stage === 'Won').length;
      const pipeline = (leads || []).reduce((s: number, l: any) => s + (l.deal_value || 0), 0);

      const mfgDone = (mfgOrders || []).filter((o: any) => o.status === 'Done').length;
      const tasksDone = (tasks || []).filter((t: any) => t.stage === 'Done').length;
      const hoursLogged = (tasks || []).reduce((s: number, t: any) => s + (t.hours_logged || 0), 0);

      const totalReach = (campaigns || []).reduce((s: number, c: any) => s + (c.opened || 0), 0);
      const jobsDone = (jobs || []).filter((j: any) => j.status === 'Completed').length;
      const activeChats = (convs || []).filter((c: any) => c.status === 'active').length;

      const onlineRevenue = (onlineProds || []).reduce((s: number, p: any) => s + (p.revenue || 0), 0);

      setStats({
        employees, totalPayroll, onLeave,
        revenue, outstanding, overdue,
        products, stockValue, lowStock,
        leads: leads?.length || 0, wonDeals, pipeline,
        mfgOrders: mfgOrders?.length || 0, mfgDone,
        projects: projects?.length || 0, tasksDone, hoursLogged,
        campaigns: campaigns?.length || 0, totalReach,
        jobs: jobs?.length || 0, jobsDone,
        activeChats,
        onlineRevenue, onlineOrders: onlineOrders?.length || 0,
      });

      // ── Cashflow chart ───────────────────────────────────────────────
      setCashflow((txns || []).map((t: any) => ({ month: t.month, income: t.income, expense: t.expenses })));

      // ── Module performance ───────────────────────────────────────────
      setModulePerf([
        { name: 'HR', score: employees > 0 ? 88 : 0 },
        { name: 'Accounting', score: revenue > 0 ? 94 : 0 },
        { name: 'Sales', score: wonDeals > 0 ? 76 : 0 },
        { name: 'Inventory', score: products > 0 ? 82 : 0 },
        { name: 'Mfg', score: mfgDone > 0 ? 70 : 0 },
        { name: 'eComm', score: onlineRevenue > 0 ? 91 : 0 },
        { name: 'Project', score: tasksDone > 0 ? 85 : 0 },
        { name: 'Marketing', score: totalReach > 0 ? 78 : 0 },
      ]);

      // ── Pie chart ────────────────────────────────────────────────────
      setPieData([
        { name: 'Accounting', value: revenue },
        { name: 'eCommerce', value: onlineRevenue },
        { name: 'Sales', value: pipeline },
        { name: 'Inventory', value: stockValue },
      ].filter(d => d.value > 0));

      // ── Recent activities ────────────────────────────────────────────
      setActivities([
        { icon: '👥', color: '#0891B2', bg: '#CFFAFE', msg: `${employees} employees · ${onLeave} on leave`, time: 'HR Module' },
        { icon: '💰', color: '#16A34A', bg: '#DCFCE7', msg: `₹${revenue.toLocaleString()} revenue · ₹${overdue.toLocaleString()} overdue`, time: 'Accounting' },
        { icon: '🛒', color: '#2563EB', bg: '#DBEAFE', msg: `${wonDeals} deals won · ₹${(pipeline/1000).toFixed(0)}K pipeline`, time: 'Sales CRM' },
        { icon: '📦', color: '#EA580C', bg: '#FFEDD5', msg: `${products} products · ${lowStock} need reorder`, time: 'Inventory' },
        { icon: '🏭', color: '#DC2626', bg: '#FEE2E2', msg: `${mfgOrders?.length || 0} orders · ${mfgDone} completed`, time: 'Manufacturing' },
        { icon: '📅', color: '#7C3AED', bg: '#EDE9FE', msg: `${projects?.length || 0} projects · ${tasksDone} tasks done`, time: 'Project' },
        { icon: '📣', color: '#DB2777', bg: '#FCE7F3', msg: `${campaigns?.length || 0} campaigns · ${(totalReach/1000).toFixed(0)}K reach`, time: 'Marketing' },
        { icon: '🔧', color: '#059669', bg: '#D1FAE5', msg: `${jobs?.length || 0} jobs · ${jobsDone} completed`, time: 'Field Service' },
        { icon: '🛍️', color: '#D97706', bg: '#FEF3C7', msg: `₹${(onlineRevenue/1000).toFixed(0)}K revenue · ${onlineOrders?.length || 0} orders`, time: 'eCommerce' },
        { icon: '💬', color: '#6366F1', bg: '#E0E7FF', msg: `${activeChats} active chats`, time: 'Live Chat' },
      ]);

    } catch (err) {
      console.error('Dashboard fetch error:', err);
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const totalRevenue = stats.revenue + stats.onlineRevenue;

  return (
    <div className="space-y-6">
      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Revenue" value={loading ? '...' : `₹${(totalRevenue/1000).toFixed(0)}K`} change="+12.5%" positive icon={<DollarSign size={20} />} color="#16A34A" bg="#DCFCE7" delay={0.05} />
        <StatCard title="Employees" value={loading ? '...' : String(stats.employees)} change="+5" positive icon={<Users size={20} />} color="#0891B2" bg="#CFFAFE" delay={0.1} />
        <StatCard title="Stock Value" value={loading ? '...' : `₹${(stats.stockValue/1000).toFixed(0)}K`} change="+8.5%" positive icon={<Package size={20} />} color="#EA580C" bg="#FFEDD5" delay={0.15} />
        <StatCard title="Online Orders" value={loading ? '...' : String(stats.onlineOrders)} change="+21%" positive icon={<ShoppingBag size={20} />} color="#D97706" bg="#FEF3C7" delay={0.2} />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Active MFG Orders', value: stats.mfgOrders, icon: <Factory size={16} />, color: '#DC2626', trend: true },
          { label: 'Active Projects', value: stats.projects, icon: <FolderOpen size={16} />, color: '#7C3AED', trend: true },
          { label: 'Active Campaigns', value: stats.campaigns, icon: <Megaphone size={16} />, color: '#DB2777', trend: true },
          { label: 'Field Jobs', value: stats.jobs, icon: <Wrench size={16} />, color: '#059669', trend: true },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + i * 0.05 }}
            className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${s.color}15`, color: s.color }}>
              {s.icon}
            </div>
            <div>
              <p className="text-xs text-gray-400">{s.label}</p>
              <p className="text-xl font-bold text-gray-800">{loading ? '...' : s.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Cashflow */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="xl:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-gray-800">Revenue vs Expense</h3>
              <p className="text-xs text-gray-400">Monthly cashflow from real data</p>
            </div>
            <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">▲ Live Data</span>
          </div>
          {cashflow.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={cashflow}>
                <defs>
                  <linearGradient id="ig" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.3} /><stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="eg2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EA580C" stopOpacity={0.2} /><stop offset="95%" stopColor="#EA580C" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${v / 1000}k`} />
                <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} />
                <Area type="monotone" dataKey="income" stroke="#7C3AED" strokeWidth={2} fill="url(#ig)" name="Income" />
                <Area type="monotone" dataKey="expense" stroke="#EA580C" strokeWidth={2} fill="url(#eg2)" name="Expense" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-300 text-sm">Loading chart...</div>
          )}
        </motion.div>

        {/* Revenue by module pie */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-1">Revenue by Source</h3>
          <p className="text-xs text-gray-400 mb-3">From real module data</p>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={4} dataKey="value">
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {pieData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i] }} />
                      <span className="text-gray-500">{item.name}</span>
                    </div>
                    <span className="font-bold text-gray-700">${(item.value / 1000).toFixed(0)}K</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-40 text-gray-300 text-sm">Loading...</div>
          )}
        </motion.div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Live Module Activity */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800">Live Module Summary</h3>
            <button onClick={fetchAll} className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">↻ Refresh</button>
          </div>
          <div className="space-y-2">
            {activities.map((a, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.04 }}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0" style={{ background: a.bg }}>
                  {a.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700 truncate">{a.msg}</p>
                  <p className="text-[10px] text-gray-400">{a.time}</p>
                </div>
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: a.color }} />
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Module Performance */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4">Module Performance</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={modulePerf}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
              <Tooltip formatter={(v: number) => `${v}%`} />
              <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                {COLORS.map((c, i) => <Cell key={i} fill={c} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Quick alerts */}
          <div className="mt-3 space-y-2">
            {stats.lowStock > 0 && (
              <div className="flex items-center gap-2 p-2 bg-orange-50 rounded-lg">
                <AlertTriangle size={13} className="text-orange-500 flex-shrink-0" />
                <p className="text-xs text-orange-700">{stats.lowStock} inventory items need reordering</p>
              </div>
            )}
            {stats.overdue > 0 && (
              <div className="flex items-center gap-2 p-2 bg-red-50 rounded-lg">
                <TrendingDown size={13} className="text-red-500 flex-shrink-0" />
                <p className="text-xs text-red-700">₹${stats.overdue.toLocaleString()} in overdue invoices</p>
              </div>
            )}
            {stats.activeChats > 0 && (
              <div className="flex items-center gap-2 p-2 bg-indigo-50 rounded-lg">
                <MessageCircle size={13} className="text-indigo-500 flex-shrink-0" />
                <p className="text-xs text-indigo-700">{stats.activeChats} active customer chats need attention</p>
              </div>
            )}
            {stats.lowStock === 0 && stats.overdue === 0 && (
              <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg">
                <TrendingUp size={13} className="text-green-500 flex-shrink-0" />
                <p className="text-xs text-green-700">All systems running smoothly ✅</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
