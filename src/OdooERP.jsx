import { useState, useRef, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";

// ── Icons (inline SVGs to avoid lucide version issues) ──────────────────
const Icon = ({ d, size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);
const icons = {
  dashboard: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10",
  inventory: "M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12",
  accounting: "M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6",
  sales: "M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z M3 6h18 M16 10a4 4 0 01-8 0",
  manufacturing: "M10 2v7.31l-3.24 5.4A1 1 0 007.63 16h8.74a1 1 0 00.87-1.5L14 9.31V2 M8.5 2h7 M7 16l2 6h6l2-6",
  ecommerce: "M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0",
  hr: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M23 21v-2a4 4 0 00-3-3.87 M9 11a4 4 0 100-8 4 4 0 000 8z M16 3.13a4 4 0 010 7.75",
  project: "M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z",
  marketing: "M3 11l19-9-9 19-2-8-8-2z",
  fieldservice: "M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z",
  livechat: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
  collapse: "M15 18l-6-6 6-6",
  expand: "M9 18l6-6-6-6",
  bell: "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0",
  search: "M11 17a6 6 0 100-12 6 6 0 000 12zM21 21l-4.35-4.35",
  settings: "M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z",
  user: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z",
  trendUp: "M23 6l-9.5 9.5-5-5L1 18 M17 6h6v6",
  trendDown: "M23 18l-9.5-9.5-5 5L1 6 M17 18h6v-6",
  plus: "M12 5v14M5 12h14",
  check: "M22 11.08V12a10 10 0 11-5.93-9.14 M22 4L12 14.01l-3-3",
  clock: "M12 2a10 10 0 110 20A10 10 0 0112 2z M12 6v6l4 2",
  x: "M18 6L6 18M6 6l12 12",
  phone: "M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z",
  mail: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6",
  more: "M12 13a1 1 0 100-2 1 1 0 000 2z M19 13a1 1 0 100-2 1 1 0 000 2z M5 13a1 1 0 100-2 1 1 0 000 2z",
  star: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  filter: "M22 3H2l8 9.46V19l4 2v-8.54L22 3z",
  send: "M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z",
  truck: "M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11a2 2 0 012 2v3 M9 17h6 M13 17h3a2 2 0 002-2V9a2 2 0 00-2-2h-3 M16 17l2.6-2.6A2 2 0 0119 13h0a2 2 0 012 2v2 M17 21a2 2 0 100-4 2 2 0 000 4z M7 21a2 2 0 100-4 2 2 0 000 4z",
  alert: "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z M12 9v4 M12 17h.01",
  video: "M23 7l-7 5 7 5V7z M1 5h15a2 2 0 012 2v10a2 2 0 01-2 2H1",
  map: "M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z M8 2v16 M16 6v16",
  wrench: "M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z",
  eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 100 6 3 3 0 000-6z",
  shoppingBag: "M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0",
  cpu: "M18 4h2a2 2 0 012 2v12a2 2 0 01-2 2h-2 M6 4H4a2 2 0 00-2 2v12a2 2 0 002 2h2 M4 9h16 M4 15h16 M9 4v16 M15 4v16",
  check2: "M20 6L9 17l-5-5",
  folder: "M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z",
  megaphone: "M3 11l19-9-9 19-2-8-8-2z",
};
const Ic = ({ name, size = 16, className = "" }) => <Icon d={icons[name] || icons.search} size={size} className={className} />;

// ── StatCard ─────────────────────────────────────────────────────────────
const StatCard = ({ title, value, change, positive, iconName, color, bg, delay = 0 }) => (
  <div className="stat-card" style={{ "--delay": `${delay}s` }}>
    <div>
      <p className="stat-label">{title}</p>
      <p className="stat-value">{value}</p>
      <div className="stat-change">
        <Ic name={positive ? "trendUp" : "trendDown"} size={13} className={positive ? "green" : "red"} />
        <span className={positive ? "green bold" : "red bold"}>{change}</span>
        <span className="muted">vs last month</span>
      </div>
    </div>
    <div className="stat-icon" style={{ background: bg, color }}>
      <Ic name={iconName} size={20} />
    </div>
  </div>
);

// ── MODULES ──────────────────────────────────────────────────────────────
const COLORS = ["#7C3AED","#2563EB","#EA580C","#16A34A","#D97706","#DC2626","#0891B2","#DB2777","#059669","#6366F1","#D97706"];

// Dashboard
const revenueData = [
  { month:"Jan", revenue:42000, expense:28000 },{ month:"Feb", revenue:53000, expense:31000 },
  { month:"Mar", revenue:48000, expense:27000 },{ month:"Apr", revenue:61000, expense:34000 },
  { month:"May", revenue:55000, expense:29000 },{ month:"Jun", revenue:67000, expense:38000 },
  { month:"Jul", revenue:72000, expense:41000 },{ month:"Aug", revenue:68000, expense:36000 },
];
const salesByModule = [
  { name:"Inventory",value:30 },{ name:"Sales",value:25 },{ name:"eCommerce",value:20 },
  { name:"Manufacturing",value:15 },{ name:"Others",value:10 },
];
const modulePerf = [
  { name:"Inventory",score:88 },{ name:"Accounting",score:94 },{ name:"Sales",score:76 },
  { name:"HR",score:82 },{ name:"Mfg",score:70 },{ name:"eComm",score:91 },
];
const activities = [
  { icon:"check",color:"#16A34A",bg:"#DCFCE7",msg:"Sales Order SO-2024-1089 confirmed",time:"2 min ago" },
  { icon:"alert",color:"#D97706",bg:"#FEF3C7",msg:"Low stock: Office Chair (5 left)",time:"15 min ago" },
  { icon:"accounting",color:"#2563EB",bg:"#DBEAFE",msg:"Invoice INV-2024-445 paid — $4,200",time:"1 hr ago" },
  { icon:"hr",color:"#7C3AED",bg:"#EDE9FE",msg:"New employee Michael Scott onboarded",time:"2 hr ago" },
  { icon:"manufacturing",color:"#DC2626",bg:"#FEE2E2",msg:"Manufacturing order MO-332 completed",time:"3 hr ago" },
  { icon:"sales",color:"#6366F1",bg:"#E0E7FF",msg:"New online order from eCommerce #9821",time:"4 hr ago" },
];
const Dashboard = () => (
  <div className="module-content">
    <div className="grid4">
      <StatCard title="Total Revenue" value="$284,500" change="+12.5%" positive iconName="accounting" color="#16A34A" bg="#DCFCE7" delay={0.05} />
      <StatCard title="Sales Orders" value="1,284" change="+8.3%" positive iconName="sales" color="#2563EB" bg="#DBEAFE" delay={0.1} />
      <StatCard title="Stock Items" value="8,432" change="-2.1%" positive={false} iconName="inventory" color="#EA580C" bg="#FFEDD5" delay={0.15} />
      <StatCard title="Employees" value="342" change="+5.0%" positive iconName="hr" color="#7C3AED" bg="#EDE9FE" delay={0.2} />
    </div>
    <div className="grid3">
      <div className="card span2">
        <div className="card-header">
          <div><h3>Revenue vs Expense</h3><p className="muted small">Monthly performance</p></div>
          <span className="badge green">▲ +12.5% this year</span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={revenueData}>
            <defs>
              <linearGradient id="gr1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.3}/><stop offset="95%" stopColor="#7C3AED" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="gr2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#EA580C" stopOpacity={0.2}/><stop offset="95%" stopColor="#EA580C" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
            <XAxis dataKey="month" tick={{ fontSize:11 }}/>
            <YAxis tick={{ fontSize:11 }} tickFormatter={v=>`$${v/1000}k`}/>
            <Tooltip formatter={v=>`$${v.toLocaleString()}`}/>
            <Area type="monotone" dataKey="revenue" stroke="#7C3AED" strokeWidth={2} fill="url(#gr1)" name="Revenue"/>
            <Area type="monotone" dataKey="expense" stroke="#EA580C" strokeWidth={2} fill="url(#gr2)" name="Expense"/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="card">
        <h3>Sales by Module</h3><p className="muted small">Distribution this quarter</p>
        <ResponsiveContainer width="100%" height={160}>
          <PieChart>
            <Pie data={salesByModule} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={4} dataKey="value">
              {salesByModule.map((_,i)=><Cell key={i} fill={COLORS[i]}/>)}
            </Pie>
            <Tooltip/>
          </PieChart>
        </ResponsiveContainer>
        <div className="legend">
          {salesByModule.map((item,i)=>(
            <div key={i} className="legend-row">
              <span className="dot" style={{background:COLORS[i]}}/>
              <span className="muted small">{item.name}</span>
              <span className="bold small">{item.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
    <div className="grid2">
      <div className="card">
        <h3>Recent Activity</h3>
        <div className="activity-list">
          {activities.map((a,i)=>(
            <div key={i} className="activity-item">
              <div className="activity-icon" style={{background:a.bg,color:a.color}}><Ic name={a.icon} size={14}/></div>
              <div><p className="small">{a.msg}</p><p className="muted tiny">{a.time}</p></div>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <h3>Module Performance</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={modulePerf}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
            <XAxis dataKey="name" tick={{ fontSize:10 }}/>
            <YAxis tick={{ fontSize:10 }}/>
            <Tooltip/>
            <Bar dataKey="score" radius={[6,6,0,0]}>
              {COLORS.map((c,i)=><Cell key={i} fill={c}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  </div>
);

// Inventory
const inventoryProducts = [
  { id:"SKU-001", name:"Office Chair Pro", category:"Furniture", stock:5, reorder:10, price:299, status:"Low Stock" },
  { id:"SKU-002", name:"Laptop Stand", category:"Electronics", stock:142, reorder:20, price:49, status:"In Stock" },
  { id:"SKU-003", name:"Standing Desk", category:"Furniture", stock:0, reorder:5, price:899, status:"Out of Stock" },
  { id:"SKU-004", name:"USB-C Hub", category:"Electronics", stock:87, reorder:15, price:79, status:"In Stock" },
  { id:"SKU-005", name:"Ergonomic Mouse", category:"Electronics", stock:3, reorder:25, price:59, status:"Low Stock" },
  { id:"SKU-006", name:'Monitor 27"', category:"Electronics", stock:62, reorder:10, price:449, status:"In Stock" },
  { id:"SKU-007", name:"Whiteboard 4x3", category:"Office", stock:18, reorder:5, price:129, status:"In Stock" },
  { id:"SKU-008", name:"Desk Organizer", category:"Office", stock:0, reorder:30, price:24, status:"Out of Stock" },
];
const stockByCategory = [
  { name:"Electronics",qty:294 },{ name:"Furniture",qty:23 },{ name:"Office",qty:18 },{ name:"Accessories",qty:156 },
];
const statusColor = { "In Stock":"#DCFCE7 #16A34A","Low Stock":"#FEF3C7 #D97706","Out of Stock":"#FEE2E2 #DC2626" };
const StatusBadge = ({ s }) => { const [bg,col] = statusColor[s].split(" "); return <span className="badge" style={{background:bg,color:col}}>{s}</span>; };

const Inventory = () => {
  const [search, setSearch] = useState("");
  const filtered = inventoryProducts.filter(p=>p.name.toLowerCase().includes(search.toLowerCase())||p.category.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="module-content">
      <div className="grid4">
        <StatCard title="Total Products" value="8,432" change="+3.2%" positive iconName="inventory" color="#EA580C" bg="#FFEDD5" delay={0.05}/>
        <StatCard title="Low Stock Items" value="24" change="+6" positive={false} iconName="alert" color="#D97706" bg="#FEF3C7" delay={0.1}/>
        <StatCard title="Stock Value" value="$1.2M" change="+8.5%" positive iconName="trendUp" color="#16A34A" bg="#DCFCE7" delay={0.15}/>
        <StatCard title="Pending Shipments" value="38" change="-5" positive iconName="truck" color="#2563EB" bg="#DBEAFE" delay={0.2}/>
      </div>
      <div className="grid3">
        <div className="card span2">
          <div className="card-header">
            <h3>Product Inventory</h3>
            <div className="row-gap">
              <div className="search-wrap"><Ic name="search" size={14} className="search-icon"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search products..." className="search-input"/></div>
              <button className="btn" style={{background:"#EA580C",color:"#fff",border:"none"}}><Ic name="filter" size={13}/> Filter</button>
            </div>
          </div>
          <div className="table-wrap">
            <table><thead><tr><th>SKU</th><th>Product</th><th>Category</th><th>Stock</th><th>Reorder</th><th>Price</th><th>Status</th></tr></thead>
            <tbody>
              {filtered.map((p,i)=>(
                <tr key={i}>
                  <td className="mono muted">{p.id}</td><td className="bold">{p.name}</td><td className="muted">{p.category}</td>
                  <td className={p.stock===0?"red bold":p.stock<p.reorder?"amber bold":"bold"}>{p.stock}</td>
                  <td className="muted">{p.reorder}</td><td>${p.price}</td><td><StatusBadge s={p.status}/></td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </div>
        <div className="card">
          <h3>Stock by Category</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stockByCategory} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false}/>
              <XAxis type="number" tick={{ fontSize:10 }}/>
              <YAxis dataKey="name" type="category" tick={{ fontSize:10 }} width={70}/>
              <Tooltip/>
              <Bar dataKey="qty" radius={[0,6,6,0]}>
                {["#EA580C","#7C3AED","#2563EB","#16A34A"].map((c,i)=><Cell key={i} fill={c}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="info-box" style={{background:"#FFEDD5",marginTop:16}}>
            <p className="small muted">Reorder alerts</p>
            <p className="big bold" style={{color:"#EA580C"}}>24 items</p>
            <p className="tiny muted">require immediate reorder</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Accounting
const cashflow = [
  { month:"Jan",income:52000,expenses:31000 },{ month:"Feb",income:61000,expenses:38000 },
  { month:"Mar",income:47000,expenses:29000 },{ month:"Apr",income:73000,expenses:42000 },
  { month:"May",income:68000,expenses:35000 },{ month:"Jun",income:85000,expenses:48000 },
];
const invoices = [
  { id:"INV-2024-089", client:"Acme Corp", amount:12400, due:"2024-02-15", status:"Paid" },
  { id:"INV-2024-090", client:"TechNova Ltd", amount:8750, due:"2024-02-20", status:"Pending" },
  { id:"INV-2024-091", client:"GreenBuild Co", amount:31200, due:"2024-02-10", status:"Overdue" },
  { id:"INV-2024-092", client:"StarMedia Inc", amount:5600, due:"2024-03-01", status:"Paid" },
  { id:"INV-2024-093", client:"BlueSky Group", amount:19800, due:"2024-03-05", status:"Pending" },
  { id:"INV-2024-094", client:"RedBrick LLC", amount:7300, due:"2024-01-30", status:"Overdue" },
];
const invStatusColor = { Paid:"#DCFCE7 #16A34A", Pending:"#FEF9C3 #D97706", Overdue:"#FEE2E2 #DC2626" };
const expensesData = [{ name:"Salaries",value:48000 },{ name:"Operations",value:12000 },{ name:"Marketing",value:8500 },{ name:"IT & Tech",value:6200 },{ name:"Travel",value:3100 }];

const Accounting = () => {
  const [tab, setTab] = useState("invoices");
  return (
    <div className="module-content">
      <div className="grid4">
        <StatCard title="Total Revenue" value="$386,000" change="+14.2%" positive iconName="accounting" color="#16A34A" bg="#DCFCE7" delay={0.05}/>
        <StatCard title="Outstanding" value="$58,550" change="+3" positive={false} iconName="clock" color="#D97706" bg="#FEF3C7" delay={0.1}/>
        <StatCard title="Net Profit" value="$163,000" change="+18.7%" positive iconName="trendUp" color="#2563EB" bg="#DBEAFE" delay={0.15}/>
        <StatCard title="Overdue" value="$38,500" change="-2" positive iconName="trendDown" color="#DC2626" bg="#FEE2E2" delay={0.2}/>
      </div>
      <div className="grid3">
        <div className="card span2">
          <h3>Cash Flow Overview</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={cashflow}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
              <XAxis dataKey="month" tick={{ fontSize:11 }}/>
              <YAxis tick={{ fontSize:11 }} tickFormatter={v=>`$${v/1000}k`}/>
              <Tooltip formatter={v=>`$${v.toLocaleString()}`}/>
              <Line type="monotone" dataKey="income" stroke="#16A34A" strokeWidth={2.5} dot={{ r:4 }} name="Income"/>
              <Line type="monotone" dataKey="expenses" stroke="#DC2626" strokeWidth={2.5} dot={{ r:4 }} name="Expenses"/>
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3>Expense Breakdown</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={expensesData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false}/>
              <XAxis type="number" tick={{ fontSize:10 }} tickFormatter={v=>`$${v/1000}k`}/>
              <YAxis dataKey="name" type="category" tick={{ fontSize:10 }} width={70}/>
              <Tooltip/>
              <Bar dataKey="value" radius={[0,6,6,0]}>
                {["#16A34A","#2563EB","#D97706","#7C3AED","#DC2626"].map((c,i)=><Cell key={i} fill={c}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="info-box" style={{background:"#DCFCE7",marginTop:12}}>
            <p className="small muted">Profit Margin</p>
            <p className="big bold" style={{color:"#16A34A"}}>42.3%</p>
            <div className="progress-bar"><div style={{width:"42.3%",background:"#16A34A"}}/></div>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-header">
          <div className="row-gap">
            {["invoices","bills"].map(t=>(
              <button key={t} onClick={()=>setTab(t)} className="tab-btn" style={tab===t?{background:"#16A34A",color:"#fff"}:{}}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>
            ))}
          </div>
          <button className="btn" style={{background:"#16A34A",color:"#fff",border:"none"}}><Ic name="plus" size={13}/> New Invoice</button>
        </div>
        <div className="table-wrap">
          <table><thead><tr><th>Invoice #</th><th>Client</th><th>Amount</th><th>Due Date</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {invoices.map((inv,i)=>{
              const [bg,col] = invStatusColor[inv.status].split(" ");
              return (
                <tr key={i}>
                  <td className="mono muted">{inv.id}</td><td className="bold">{inv.client}</td>
                  <td className="bold">${inv.amount.toLocaleString()}</td><td className="muted">{inv.due}</td>
                  <td><span className="badge" style={{background:bg,color:col}}>{inv.status}</span></td>
                  <td><button className="link-btn">View</button></td>
                </tr>
              );
            })}
          </tbody></table>
        </div>
      </div>
    </div>
  );
};

// Sales
const pipeline = [
  { stage:"Lead",count:142,value:284000,color:"#60A5FA" },
  { stage:"Qualified",count:87,value:435000,color:"#818CF8" },
  { stage:"Proposal",count:54,value:810000,color:"#A78BFA" },
  { stage:"Negotiation",count:28,value:1120000,color:"#7C3AED" },
  { stage:"Won",count:21,value:2100000,color:"#16A34A" },
];
const salesTrend = [
  { month:"Jan",sales:38000,target:45000 },{ month:"Feb",sales:52000,target:45000 },
  { month:"Mar",sales:41000,target:50000 },{ month:"Apr",sales:63000,target:55000 },
  { month:"May",sales:57000,target:55000 },{ month:"Jun",sales:78000,target:60000 },
];
const leads = [
  { name:"Emily Johnson", company:"TechNova Ltd", value:48000, stage:"Proposal", rating:4 },
  { name:"Mark Thompson", company:"BlueSky Group", value:125000, stage:"Negotiation", rating:5 },
  { name:"Sarah Chen", company:"GreenBuild Co", value:32000, stage:"Qualified", rating:3 },
  { name:"David Wilson", company:"Acme Corp", value:85000, stage:"Won", rating:5 },
  { name:"Laura Martinez", company:"StarMedia Inc", value:21000, stage:"Lead", rating:2 },
];
const stageColors = { Lead:"#DBEAFE #2563EB", Qualified:"#E0E7FF #6366F1", Proposal:"#EDE9FE #7C3AED", Negotiation:"#DDD6FE #7C3AED", Won:"#DCFCE7 #16A34A" };

const Sales = () => {
  const [tab, setTab] = useState("crm");
  return (
    <div className="module-content">
      <div className="grid4">
        <StatCard title="Total Sales" value="$2.75M" change="+22.4%" positive iconName="sales" color="#2563EB" bg="#DBEAFE" delay={0.05}/>
        <StatCard title="Active Leads" value="332" change="+18" positive iconName="hr" color="#7C3AED" bg="#EDE9FE" delay={0.1}/>
        <StatCard title="Win Rate" value="24.1%" change="+3.2%" positive iconName="trendUp" color="#16A34A" bg="#DCFCE7" delay={0.15}/>
        <StatCard title="Avg Deal Size" value="$18,500" change="+7.8%" positive iconName="star" color="#D97706" bg="#FEF3C7" delay={0.2}/>
      </div>
      <div className="card">
        <h3>Sales Pipeline</h3>
        <div className="pipeline-grid">
          {pipeline.map((p,i)=>(
            <div key={i} className="pipeline-col">
              <div style={{height:8,borderRadius:4,background:p.color,marginBottom:12}}/>
              <p className="tiny muted upper">{p.stage}</p>
              <p className="big bold">{p.count}</p>
              <p className="tiny muted">${(p.value/1000).toFixed(0)}k</p>
            </div>
          ))}
        </div>
        <div className="pipeline-bar">
          {pipeline.map((p,i)=><div key={i} style={{flex:1,background:p.color,opacity:0.5+i*0.1}}/>)}
        </div>
      </div>
      <div className="grid3">
        <div className="card span2">
          <h3>Sales vs Target</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={salesTrend}>
              <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563EB" stopOpacity={0.3}/><stop offset="95%" stopColor="#2563EB" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
              <XAxis dataKey="month" tick={{ fontSize:11 }}/><YAxis tick={{ fontSize:11 }} tickFormatter={v=>`$${v/1000}k`}/>
              <Tooltip formatter={v=>`$${v.toLocaleString()}`}/>
              <Area type="monotone" dataKey="sales" stroke="#2563EB" strokeWidth={2} fill="url(#sg)" name="Sales"/>
              <Area type="monotone" dataKey="target" stroke="#D97706" strokeWidth={2} strokeDasharray="5 5" fill="none" name="Target"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3>Top Performers</h3>
          {[{ name:"Alex Rivera",sales:182000,pct:94 },{ name:"Jamie Lee",sales:156000,pct:81 },{ name:"Sam Patel",sales:134000,pct:69 },{ name:"Casey Kim",sales:98000,pct:51 }].map((rep,i)=>(
            <div key={i} style={{marginBottom:12}}>
              <div className="row-between small" style={{marginBottom:4}}><span className="bold">{rep.name}</span><span className="muted">${(rep.sales/1000).toFixed(0)}k</span></div>
              <div className="progress-bar"><div style={{width:`${rep.pct}%`,background:"linear-gradient(90deg,#2563EB,#6366F1)"}}/></div>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="card-header">
          <div className="row-gap">
            {["crm","orders"].map(t=>(
              <button key={t} onClick={()=>setTab(t)} className="tab-btn" style={tab===t?{background:"#2563EB",color:"#fff"}:{}}>{t==="crm"?"CRM Leads":"Sales Orders"}</button>
            ))}
          </div>
          <button className="btn" style={{background:"#2563EB",color:"#fff",border:"none"}}><Ic name="plus" size={13}/> New Lead</button>
        </div>
        <div className="table-wrap">
          <table><thead><tr><th>Contact</th><th>Company</th><th>Deal Value</th><th>Stage</th><th>Rating</th><th>Actions</th></tr></thead>
          <tbody>
            {leads.map((l,i)=>{
              const [bg,col] = stageColors[l.stage].split(" ");
              return (
                <tr key={i}>
                  <td><div className="row-gap"><div className="avatar" style={{background:"linear-gradient(135deg,#60A5FA,#818CF8)"}}>{l.name[0]}</div><span className="bold">{l.name}</span></div></td>
                  <td className="muted">{l.company}</td>
                  <td className="bold">${l.value.toLocaleString()}</td>
                  <td><span className="badge" style={{background:bg,color:col}}>{l.stage}</span></td>
                  <td><div className="stars">{Array.from({length:5}).map((_,j)=><span key={j} style={{color:j<l.rating?"#FBBF24":"#E5E7EB"}}>★</span>)}</div></td>
                  <td><div className="row-gap"><button className="icon-btn" style={{background:"#DBEAFE",color:"#2563EB"}}><Ic name="phone" size={11}/></button><button className="icon-btn" style={{background:"#DCFCE7",color:"#16A34A"}}><Ic name="mail" size={11}/></button><button className="icon-btn" style={{background:"#F3F4F6",color:"#6B7280"}}><Ic name="more" size={11}/></button></div></td>
                </tr>
              );
            })}
          </tbody></table>
        </div>
      </div>
    </div>
  );
};

// Manufacturing
const mfgOrders = [
  { id:"MO-001", product:"Widget A", qty:500, progress:85, status:"In Progress", due:"2024-02-15" },
  { id:"MO-002", product:"Gadget Pro", qty:200, progress:100, status:"Done", due:"2024-02-10" },
  { id:"MO-003", product:"Component X", qty:1200, progress:30, status:"In Progress", due:"2024-02-28" },
  { id:"MO-004", product:"Device Y", qty:75, progress:0, status:"Pending", due:"2024-03-05" },
  { id:"MO-005", product:"Module Z", qty:350, progress:60, status:"In Progress", due:"2024-02-20" },
];
const prodData = [{ day:"Mon",planned:400,actual:380 },{ day:"Tue",planned:420,actual:435 },{ day:"Wed",planned:400,actual:390 },{ day:"Thu",planned:450,actual:420 },{ day:"Fri",planned:430,actual:450 }];
const mfgStatusColor = { "In Progress":"#DBEAFE #2563EB","Done":"#DCFCE7 #16A34A","Pending":"#F3F4F6 #6B7280" };

const Manufacturing = () => (
  <div className="module-content">
    <div className="grid4">
      <StatCard title="Active Orders" value="24" change="+4" positive iconName="manufacturing" color="#DC2626" bg="#FEE2E2" delay={0.05}/>
      <StatCard title="Units Produced" value="12,840" change="+9.3%" positive iconName="cpu" color="#7C3AED" bg="#EDE9FE" delay={0.1}/>
      <StatCard title="Avg Efficiency" value="90.2%" change="+1.8%" positive iconName="check" color="#16A34A" bg="#DCFCE7" delay={0.15}/>
      <StatCard title="Pending Orders" value="8" change="-2" positive iconName="clock" color="#D97706" bg="#FEF3C7" delay={0.2}/>
    </div>
    <div className="grid3">
      <div className="card span2">
        <div className="card-header"><h3>Manufacturing Orders</h3><button className="btn" style={{background:"#DC2626",color:"#fff",border:"none"}}><Ic name="plus" size={13}/> New Order</button></div>
        <div className="table-wrap">
          <table><thead><tr><th>Order</th><th>Product</th><th>Qty</th><th>Progress</th><th>Status</th><th>Due</th></tr></thead>
          <tbody>
            {mfgOrders.map((o,i)=>{
              const [bg,col] = mfgStatusColor[o.status].split(" ");
              return (
                <tr key={i}>
                  <td className="mono muted">{o.id}</td><td className="bold">{o.product}</td><td>{o.qty}</td>
                  <td><div className="row-gap"><div className="progress-bar" style={{flex:1}}><div style={{width:`${o.progress}%`,background:"#DC2626"}}/></div><span className="tiny bold">{o.progress}%</span></div></td>
                  <td><span className="badge" style={{background:bg,color:col}}>{o.status}</span></td>
                  <td className="muted">{o.due}</td>
                </tr>
              );
            })}
          </tbody></table>
        </div>
      </div>
      <div className="card">
        <h3>Workcenters</h3>
        {[{ name:"Assembly A",eff:91,load:78 },{ name:"Assembly B",eff:85,load:95 },{ name:"QC",eff:97,load:62 },{ name:"Packaging",eff:88,load:71 }].map((w,i)=>(
          <div key={i} style={{marginBottom:16}}>
            <div className="row-between small bold"><span>{w.name}</span><span style={{color:"#16A34A"}}>{w.eff}%</span></div>
            <p className="tiny muted">Load: {w.load}%</p>
            <div className="progress-bar"><div style={{width:`${w.load}%`,background:w.load>90?"#DC2626":"#2563EB"}}/></div>
          </div>
        ))}
      </div>
    </div>
    <div className="card">
      <h3>Production: Planned vs Actual</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={prodData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
          <XAxis dataKey="day" tick={{ fontSize:11 }}/><YAxis tick={{ fontSize:11 }}/>
          <Tooltip/>
          <Bar dataKey="planned" fill="#E5E7EB" radius={[4,4,0,0]} name="Planned"/>
          <Bar dataKey="actual" fill="#DC2626" radius={[4,4,0,0]} name="Actual"/>
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);

// Ecommerce
const ecomProducts = [
  { name:"Wireless Headphones", price:149, sold:842, stock:234, rating:4.8, revenue:125358 },
  { name:"Smart Watch Series 5", price:299, sold:521, stock:87, rating:4.6, revenue:155779 },
  { name:"Portable Charger 20K", price:49, sold:1240, stock:512, rating:4.5, revenue:60760 },
  { name:"Mechanical Keyboard", price:129, sold:384, stock:145, rating:4.7, revenue:49536 },
  { name:"Webcam 4K Pro", price:199, sold:276, stock:64, rating:4.4, revenue:54924 },
];
const weekSales = [
  { day:"Mon",orders:124,revenue:8400 },{ day:"Tue",orders:98,revenue:7200 },{ day:"Wed",orders:145,revenue:10800 },
  { day:"Thu",orders:162,revenue:12400 },{ day:"Fri",orders:189,revenue:14200 },{ day:"Sat",orders:241,revenue:18100 },{ day:"Sun",orders:198,revenue:15300 },
];

const Ecommerce = () => (
  <div className="module-content">
    <div className="grid4">
      <StatCard title="Online Revenue" value="$446K" change="+31.4%" positive iconName="ecommerce" color="#D97706" bg="#FEF3C7" delay={0.05}/>
      <StatCard title="Total Orders" value="3,263" change="+21.2%" positive iconName="shoppingBag" color="#2563EB" bg="#DBEAFE" delay={0.1}/>
      <StatCard title="Avg Rating" value="4.6 ★" change="+0.2" positive iconName="star" color="#7C3AED" bg="#EDE9FE" delay={0.15}/>
      <StatCard title="Visitors Today" value="8,492" change="+12.8%" positive iconName="eye" color="#16A34A" bg="#DCFCE7" delay={0.2}/>
    </div>
    <div className="card">
      <h3>Weekly Sales & Revenue</h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={weekSales}>
          <defs><linearGradient id="eg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#D97706" stopOpacity={0.3}/><stop offset="95%" stopColor="#D97706" stopOpacity={0}/></linearGradient></defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
          <XAxis dataKey="day" tick={{ fontSize:11 }}/><YAxis tick={{ fontSize:11 }}/>
          <Tooltip formatter={v=>`$${v.toLocaleString()}`}/>
          <Area type="monotone" dataKey="revenue" stroke="#D97706" fill="url(#eg)" strokeWidth={2} name="Revenue ($)"/>
        </AreaChart>
      </ResponsiveContainer>
    </div>
    <div className="card">
      <div className="card-header"><h3>Top Products</h3><button className="btn" style={{background:"#D97706",color:"#fff",border:"none"}}><Ic name="plus" size={13}/> Add Product</button></div>
      <div className="table-wrap">
        <table><thead><tr><th>Product</th><th>Price</th><th>Sold</th><th>Stock</th><th>Rating</th><th>Revenue</th></tr></thead>
        <tbody>
          {ecomProducts.map((p,i)=>(
            <tr key={i}>
              <td className="bold">{p.name}</td><td>${p.price}</td><td className="bold">{p.sold.toLocaleString()}</td>
              <td className={p.stock<100?"amber bold":"muted"}>{p.stock}</td>
              <td><div className="stars">{Array.from({length:5}).map((_,j)=><span key={j} style={{color:j<Math.floor(p.rating)?"#FBBF24":"#E5E7EB",fontSize:12}}>★</span>)}<span className="tiny muted"> {p.rating}</span></div></td>
              <td className="bold green">${p.revenue.toLocaleString()}</td>
            </tr>
          ))}
        </tbody></table>
      </div>
    </div>
  </div>
);

// HR
const employees = [
  { name:"Alice Walker", dept:"Engineering", role:"Senior Dev", salary:95000, status:"Active", joined:"2021-03-15", avatar:"A" },
  { name:"Bob Chen", dept:"Sales", role:"Sales Manager", salary:78000, status:"Active", joined:"2020-08-22", avatar:"B" },
  { name:"Carol Davis", dept:"HR", role:"HR Director", salary:88000, status:"Active", joined:"2019-01-10", avatar:"C" },
  { name:"David Kim", dept:"Marketing", role:"CMO", salary:110000, status:"Active", joined:"2018-06-01", avatar:"D" },
  { name:"Emma Stone", dept:"Finance", role:"CFO", salary:125000, status:"On Leave", joined:"2017-09-14", avatar:"E" },
  { name:"Frank Miller", dept:"Engineering", role:"DevOps Lead", salary:98000, status:"Active", joined:"2022-11-03", avatar:"F" },
];
const deptData = [{ dept:"Engineering",count:82 },{ dept:"Sales",count:54 },{ dept:"Marketing",count:38 },{ dept:"HR",count:21 },{ dept:"Finance",count:28 },{ dept:"Operations",count:47 }];
const avatarBgs = ["#7C3AED","#2563EB","#16A34A","#D97706","#DC2626","#0891B2"];

const HR = () => {
  const [search, setSearch] = useState("");
  const filtered = employees.filter(e=>e.name.toLowerCase().includes(search.toLowerCase())||e.dept.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="module-content">
      <div className="grid4">
        <StatCard title="Total Employees" value="342" change="+12" positive iconName="hr" color="#0891B2" bg="#CFFAFE" delay={0.05}/>
        <StatCard title="New Hires (MTD)" value="18" change="+5" positive iconName="hr" color="#7C3AED" bg="#EDE9FE" delay={0.1}/>
        <StatCard title="Payroll (Monthly)" value="$1.24M" change="+3.1%" positive iconName="accounting" color="#16A34A" bg="#DCFCE7" delay={0.15}/>
        <StatCard title="On Leave Today" value="14" change="+3" positive={false} iconName="clock" color="#D97706" bg="#FEF3C7" delay={0.2}/>
      </div>
      <div className="grid3">
        <div className="card span2">
          <div className="card-header">
            <h3>Employee Directory</h3>
            <div className="row-gap">
              <div className="search-wrap"><Ic name="search" size={14} className="search-icon"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search employees..." className="search-input"/></div>
              <button className="btn" style={{background:"#0891B2",color:"#fff",border:"none"}}><Ic name="plus" size={13}/> Add</button>
            </div>
          </div>
          <div className="table-wrap">
            <table><thead><tr><th>Employee</th><th>Department</th><th>Role</th><th>Salary</th><th>Status</th><th>Joined</th></tr></thead>
            <tbody>
              {filtered.map((e,i)=>(
                <tr key={i}>
                  <td><div className="row-gap"><div className="avatar" style={{background:avatarBgs[i%6]}}>{e.avatar}</div><span className="bold">{e.name}</span></div></td>
                  <td className="muted">{e.dept}</td><td>{e.role}</td>
                  <td className="bold">${e.salary.toLocaleString()}</td>
                  <td><span className="badge" style={e.status==="Active"?{background:"#DCFCE7",color:"#16A34A"}:{background:"#FEF3C7",color:"#D97706"}}>{e.status}</span></td>
                  <td className="muted">{e.joined}</td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </div>
        <div className="card">
          <h3>By Department</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={deptData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false}/>
              <XAxis type="number" tick={{ fontSize:10 }}/>
              <YAxis dataKey="dept" type="category" tick={{ fontSize:10 }} width={80}/>
              <Tooltip/>
              <Bar dataKey="count" radius={[0,6,6,0]}>
                {COLORS.map((c,i)=><Cell key={i} fill={c}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

// Project
const kanban = {
  "Todo": [
    { id:"T-101", title:"Design new landing page", priority:"High", assignee:"Alice" },
    { id:"T-102", title:"Set up CI/CD pipeline", priority:"Medium", assignee:"Frank" },
    { id:"T-103", title:"Write API documentation", priority:"Low", assignee:"Carol" },
  ],
  "In Progress": [
    { id:"T-104", title:"Integrate payment gateway", priority:"High", assignee:"David" },
    { id:"T-105", title:"Mobile app testing", priority:"High", assignee:"Emma" },
  ],
  "Review": [
    { id:"T-106", title:"Security audit report", priority:"High", assignee:"Bob" },
    { id:"T-107", title:"Database optimization", priority:"Medium", assignee:"Frank" },
  ],
  "Done": [
    { id:"T-108", title:"User auth module", priority:"High", assignee:"Alice" },
    { id:"T-109", title:"Email notification system", priority:"Medium", assignee:"Carol" },
    { id:"T-110", title:"Dashboard redesign", priority:"Low", assignee:"David" },
  ],
};
const colStyles = {
  "Todo":{ bg:"#F3F4F6",dot:"#9CA3AF" },
  "In Progress":{ bg:"#EFF6FF",dot:"#3B82F6" },
  "Review":{ bg:"#FEFCE8",dot:"#EAB308" },
  "Done":{ bg:"#F0FDF4",dot:"#22C55E" },
};
const prioColor = { High:"#FEE2E2 #DC2626",Medium:"#FEF9C3 #D97706",Low:"#DCFCE7 #16A34A" };
const projects = [
  { name:"ERP Platform v3", progress:72, team:8, due:"Mar 15", color:"#7C3AED" },
  { name:"Mobile App 2.0", progress:45, team:5, due:"Apr 02", color:"#2563EB" },
  { name:"Data Warehouse", progress:89, team:4, due:"Feb 28", color:"#16A34A" },
  { name:"Customer Portal", progress:31, team:6, due:"May 10", color:"#D97706" },
];

const Project = () => {
  const [view, setView] = useState("kanban");
  return (
    <div className="module-content">
      <div className="grid4">
        <StatCard title="Active Projects" value="12" change="+2" positive iconName="project" color="#7C3AED" bg="#EDE9FE" delay={0.05}/>
        <StatCard title="Tasks Done" value="284" change="+42" positive iconName="check2" color="#16A34A" bg="#DCFCE7" delay={0.1}/>
        <StatCard title="Hours Logged" value="1,842" change="+8.2%" positive iconName="clock" color="#2563EB" bg="#DBEAFE" delay={0.15}/>
        <StatCard title="Team Members" value="34" change="+4" positive iconName="hr" color="#D97706" bg="#FEF3C7" delay={0.2}/>
      </div>
      <div className="card">
        <h3 style={{marginBottom:16}}>Active Projects</h3>
        <div className="grid4">
          {projects.map((p,i)=>(
            <div key={i} className="project-card">
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                <div style={{width:12,height:12,borderRadius:"50%",background:p.color}}/>
                <button className="icon-btn" style={{background:"#F3F4F6",color:"#9CA3AF"}}><Ic name="more" size={11}/></button>
              </div>
              <h4 className="bold small">{p.name}</h4>
              <p className="tiny muted" style={{margin:"4px 0 12px"}}>Due: {p.due} · {p.team} members</p>
              <div className="progress-bar"><div style={{width:`${p.progress}%`,background:p.color}}/></div>
              <p className="tiny bold" style={{color:p.color,marginTop:4}}>{p.progress}% complete</p>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="card-header">
          <h3>Kanban Board</h3>
          <div className="row-gap">
            {["kanban","list"].map(v=>(
              <button key={v} onClick={()=>setView(v)} className="tab-btn" style={view===v?{background:"#7C3AED",color:"#fff"}:{}}>{v.charAt(0).toUpperCase()+v.slice(1)}</button>
            ))}
            <button className="btn" style={{background:"#7C3AED",color:"#fff",border:"none"}}><Ic name="plus" size={13}/> Add Task</button>
          </div>
        </div>
        {view==="kanban" ? (
          <div className="kanban-grid">
            {Object.entries(kanban).map(([col, tasks])=>{
              const cs = colStyles[col];
              return (
                <div key={col} className="kanban-col" style={{background:cs.bg}}>
                  <div className="row-gap" style={{marginBottom:12}}>
                    <span style={{width:8,height:8,borderRadius:"50%",background:cs.dot,display:"inline-block"}}/>
                    <span className="small bold">{col}</span>
                    <span className="badge muted" style={{marginLeft:"auto",background:"#fff"}}>{tasks.length}</span>
                  </div>
                  {tasks.map((t,i)=>{
                    const [pbg,pc] = prioColor[t.priority].split(" ");
                    return (
                      <div key={i} className="kanban-card">
                        <p className="small bold">{t.title}</p>
                        <p className="tiny muted">{t.id}</p>
                        <div className="row-between" style={{marginTop:8}}>
                          <span className="badge" style={{background:pbg,color:pc,fontSize:10}}>{t.priority}</span>
                          <div className="avatar" style={{width:20,height:20,fontSize:10,background:"#EDE9FE",color:"#7C3AED"}}>{t.assignee[0]}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="table-wrap">
            <table><thead><tr><th>ID</th><th>Title</th><th>Priority</th><th>Assignee</th><th>Stage</th></tr></thead>
            <tbody>
              {Object.entries(kanban).flatMap(([col, tasks])=>tasks.map((t,i)=>{
                const [pbg,pc] = prioColor[t.priority].split(" ");
                return <tr key={t.id}><td className="mono muted">{t.id}</td><td className="bold">{t.title}</td><td><span className="badge" style={{background:pbg,color:pc}}>{t.priority}</span></td><td>{t.assignee}</td><td className="muted">{col}</td></tr>;
              }))}
            </tbody></table>
          </div>
        )}
      </div>
    </div>
  );
};

// Marketing
const campaigns = [
  { name:"Summer Sale 2024", type:"Email", sent:42000, opened:12600, clicked:3780, status:"Active", roi:"342%" },
  { name:"Product Launch Q1", type:"Social", sent:0, opened:85000, clicked:14200, status:"Active", roi:"218%" },
  { name:"Holiday Promo", type:"Email", sent:38000, opened:9500, clicked:2850, status:"Completed", roi:"187%" },
  { name:"Retargeting Ads", type:"Display", sent:0, opened:120000, clicked:8400, status:"Active", roi:"156%" },
  { name:"Newsletter Mar", type:"Email", sent:15000, opened:5250, clicked:1050, status:"Draft", roi:"-" },
];
const engagementData = [{ week:"W1",email:24,social:42,display:18 },{ week:"W2",email:31,social:38,display:22 },{ week:"W3",email:28,social:55,display:29 },{ week:"W4",email:42,social:61,display:35 }];
const campStatusColor = { Active:"#DCFCE7 #16A34A", Completed:"#DBEAFE #2563EB", Draft:"#F3F4F6 #6B7280" };

const Marketing = () => (
  <div className="module-content">
    <div className="grid4">
      <StatCard title="Active Campaigns" value="8" change="+3" positive iconName="megaphone" color="#DB2777" bg="#FCE7F3" delay={0.05}/>
      <StatCard title="Emails Sent" value="95K" change="+14.2%" positive iconName="mail" color="#7C3AED" bg="#EDE9FE" delay={0.1}/>
      <StatCard title="Leads Generated" value="2,841" change="+28.4%" positive iconName="hr" color="#2563EB" bg="#DBEAFE" delay={0.15}/>
      <StatCard title="Avg Open Rate" value="30%" change="+2.1%" positive iconName="trendUp" color="#16A34A" bg="#DCFCE7" delay={0.2}/>
    </div>
    <div className="grid3">
      <div className="card span2">
        <h3>Channel Engagement Rate (%)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={engagementData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
            <XAxis dataKey="week" tick={{ fontSize:11 }}/><YAxis tick={{ fontSize:11 }}/>
            <Tooltip/>
            <Line type="monotone" dataKey="email" stroke="#DB2777" strokeWidth={2} dot={{ r:4 }} name="Email"/>
            <Line type="monotone" dataKey="social" stroke="#7C3AED" strokeWidth={2} dot={{ r:4 }} name="Social"/>
            <Line type="monotone" dataKey="display" stroke="#D97706" strokeWidth={2} dot={{ r:4 }} name="Display"/>
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="card">
        <h3>Campaign Stats</h3>
        {[{ label:"Total Reach",value:"295K",color:"#DB2777" },{ label:"Total Clicks",value:"27.4K",color:"#7C3AED" },{ label:"Conversion Rate",value:"9.3%",color:"#16A34A" },{ label:"Avg ROI",value:"226%",color:"#2563EB" }].map((s,i)=>(
          <div key={i} className="info-box" style={{background:`${s.color}10`,marginBottom:8}}>
            <p className="tiny muted">{s.label}</p>
            <p className="big bold" style={{color:s.color}}>{s.value}</p>
          </div>
        ))}
      </div>
    </div>
    <div className="card">
      <div className="card-header"><h3>Campaigns</h3><button className="btn" style={{background:"#DB2777",color:"#fff",border:"none"}}><Ic name="plus" size={13}/> New Campaign</button></div>
      <div className="table-wrap">
        <table><thead><tr><th>Campaign</th><th>Type</th><th>Sent</th><th>Opened</th><th>Clicked</th><th>Status</th><th>ROI</th></tr></thead>
        <tbody>
          {campaigns.map((c,i)=>{
            const [bg,col] = campStatusColor[c.status].split(" ");
            return (
              <tr key={i}>
                <td className="bold">{c.name}</td><td className="muted">{c.type}</td>
                <td>{c.sent>0?c.sent.toLocaleString():"-"}</td>
                <td>{c.opened.toLocaleString()}</td><td>{c.clicked.toLocaleString()}</td>
                <td><span className="badge" style={{background:bg,color:col}}>{c.status}</span></td>
                <td className="bold green">{c.roi}</td>
              </tr>
            );
          })}
        </tbody></table>
      </div>
    </div>
  </div>
);

// FieldService
const jobs = [
  { id:"JOB-001", title:"HVAC Maintenance", customer:"Acme Corp", tech:"James Wright", location:"123 Main St", priority:"Urgent", status:"In Progress", eta:"2:30 PM" },
  { id:"JOB-002", title:"Electrical Inspection", customer:"BlueSky Group", tech:"Maria Lopez", location:"456 Oak Ave", priority:"Normal", status:"Scheduled", eta:"4:00 PM" },
  { id:"JOB-003", title:"Plumbing Repair", customer:"TechNova Ltd", tech:"Tom Harris", location:"789 Elm St", priority:"High", status:"Completed", eta:"11:00 AM" },
  { id:"JOB-004", title:"Security System Install", customer:"GreenBuild Co", tech:"Sara Adams", location:"321 Pine Rd", priority:"Normal", status:"In Progress", eta:"3:00 PM" },
  { id:"JOB-005", title:"Fire Suppression Check", customer:"StarMedia Inc", tech:"Bob Chen", location:"654 Cedar Ln", priority:"High", status:"Scheduled", eta:"Tomorrow" },
];
const technicians = [
  { name:"James Wright", jobs:4, rating:4.9, status:"On Job", color:"#7C3AED" },
  { name:"Maria Lopez", jobs:3, rating:4.7, status:"Available", color:"#16A34A" },
  { name:"Tom Harris", jobs:5, rating:4.8, status:"On Job", color:"#2563EB" },
  { name:"Sara Adams", jobs:2, rating:4.6, status:"On Job", color:"#D97706" },
  { name:"Bob Chen", jobs:3, rating:4.5, status:"Available", color:"#DC2626" },
];
const jobStatusStyle = { "In Progress":"#EFF6FF #2563EB","Completed":"#F0FDF4 #16A34A","Scheduled":"#F5F3FF #7C3AED","Urgent":"#FEF2F2 #DC2626" };

const FieldService = () => (
  <div className="module-content">
    <div className="grid4">
      <StatCard title="Active Jobs" value="18" change="+4" positive iconName="wrench" color="#059669" bg="#D1FAE5" delay={0.05}/>
      <StatCard title="Completed Today" value="12" change="+3" positive iconName="check" color="#16A34A" bg="#DCFCE7" delay={0.1}/>
      <StatCard title="Avg Response Time" value="28 min" change="-5 min" positive iconName="clock" color="#2563EB" bg="#DBEAFE" delay={0.15}/>
      <StatCard title="Urgent Jobs" value="3" change="+1" positive={false} iconName="alert" color="#DC2626" bg="#FEE2E2" delay={0.2}/>
    </div>
    <div className="grid3">
      <div className="card span2">
        <div className="card-header"><h3>Today's Jobs</h3><button className="btn" style={{background:"#059669",color:"#fff",border:"none"}}><Ic name="plus" size={13}/> New Job</button></div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {jobs.map((job,i)=>{
            const [bg,col] = (jobStatusStyle[job.status]||"#F3F4F6 #6B7280").split(" ");
            const prioBg = job.priority==="Urgent"?"#FEE2E2":job.priority==="High"?"#FEF3C7":"#F3F4F6";
            const prioCol = job.priority==="Urgent"?"#DC2626":job.priority==="High"?"#D97706":"#6B7280";
            return (
              <div key={i} className="job-card">
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
                  <div style={{flex:1}}>
                    <div className="row-gap"><span className="bold small">{job.title}</span><span className="badge" style={{background:prioBg,color:prioCol,fontSize:10}}>{job.priority}</span></div>
                    <p className="tiny muted">{job.customer} · <Ic name="map" size={11}/> {job.location}</p>
                    <p className="tiny muted">Tech: {job.tech} · ETA: {job.eta}</p>
                  </div>
                  <span className="badge" style={{background:bg,color:col,flexShrink:0}}>{job.status}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="card">
        <h3>Technicians</h3>
        {technicians.map((t,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:"1px solid #F3F4F6"}}>
            <div className="avatar" style={{background:t.color}}>{t.name[0]}</div>
            <div style={{flex:1}}>
              <p className="small bold">{t.name}</p>
              <p className="tiny muted">{t.jobs} jobs · ★ {t.rating}</p>
            </div>
            <span className="badge" style={t.status==="Available"?{background:"#DCFCE7",color:"#16A34A"}:{background:"#DBEAFE",color:"#2563EB"}}>{t.status}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// LiveChat
const conversations = [
  { id:1, name:"Sarah Miller", issue:"Order tracking issue", time:"2m", status:"active", unread:3, color:"#7C3AED" },
  { id:2, name:"John Park", issue:"Refund request for #8821", time:"8m", status:"waiting", unread:1, color:"#2563EB" },
  { id:3, name:"Priya Kumar", issue:"Product availability query", time:"15m", status:"active", unread:0, color:"#DB2777" },
  { id:4, name:"Alex Johnson", issue:"Payment failed - need help", time:"22m", status:"resolved", unread:0, color:"#16A34A" },
  { id:5, name:"Emma White", issue:"Shipping delay complaint", time:"35m", status:"waiting", unread:2, color:"#D97706" },
];
const initMsgs = [
  { from:"user", text:"Hi, I placed an order 3 days ago but I can't see any tracking info.", time:"10:42 AM" },
  { from:"agent", text:"Hello Sarah! I'm happy to help. Could you share your order number?", time:"10:43 AM" },
  { from:"user", text:"Sure, it's #ORD-2024-7821", time:"10:43 AM" },
  { from:"agent", text:"Thank you! I can see your order is currently in our warehouse and will be shipped within 24 hours. You'll receive a tracking email shortly.", time:"10:44 AM" },
  { from:"user", text:"Oh great, thank you so much!", time:"10:45 AM" },
];
const statusDot = { active:"#22C55E", waiting:"#FBBF24", resolved:"#9CA3AF" };

const LiveChat = () => {
  const [selected, setSelected] = useState(conversations[0]);
  const [messages, setMessages] = useState(initMsgs);
  const [input, setInput] = useState("");
  const endRef = useRef(null);
  useEffect(()=>{ endRef.current?.scrollIntoView({ behavior:"smooth" }); },[messages]);
  const send = () => {
    if(!input.trim()) return;
    const now = new Date().toLocaleTimeString([],{ hour:"2-digit",minute:"2-digit" });
    setMessages(prev=>[...prev,{ from:"agent",text:input,time:now }]);
    setInput("");
    setTimeout(()=>setMessages(prev=>[...prev,{ from:"user",text:"Thanks for the quick response! That's very helpful.",time:new Date().toLocaleTimeString([],{ hour:"2-digit",minute:"2-digit" }) }]),1500);
  };
  return (
    <div className="module-content">
      <div className="grid4">
        <StatCard title="Active Chats" value="14" change="+3" positive iconName="livechat" color="#6366F1" bg="#E0E7FF" delay={0.05}/>
        <StatCard title="Resolved Today" value="86" change="+12" positive iconName="check" color="#16A34A" bg="#DCFCE7" delay={0.1}/>
        <StatCard title="Avg Response" value="1.8 min" change="-0.3m" positive iconName="clock" color="#D97706" bg="#FEF3C7" delay={0.15}/>
        <StatCard title="Satisfaction" value="96.4%" change="+1.2%" positive iconName="star" color="#DB2777" bg="#FCE7F3" delay={0.2}/>
      </div>
      <div className="card" style={{padding:0,overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"280px 1fr",height:520}}>
          <div style={{borderRight:"1px solid #F3F4F6",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"12px 16px",borderBottom:"1px solid #F3F4F6"}}>
              <div className="row-between" style={{marginBottom:8}}><h3 style={{margin:0}}>Conversations</h3><button className="icon-btn" style={{background:"#E0E7FF",color:"#6366F1"}}><Ic name="plus" size={12}/></button></div>
              <div className="search-wrap"><Ic name="search" size={14} className="search-icon"/><input placeholder="Search..." className="search-input"/></div>
            </div>
            <div style={{flex:1,overflowY:"auto"}}>
              {conversations.map(c=>(
                <div key={c.id} onClick={()=>setSelected(c)} style={{padding:"10px 16px",cursor:"pointer",background:selected.id===c.id?"#F5F3FF":"#fff",borderBottom:"1px solid #FAFAFA",transition:"background 0.15s"}}>
                  <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                    <div style={{position:"relative",flexShrink:0}}>
                      <div className="avatar" style={{background:c.color}}>{c.name[0]}</div>
                      <span style={{position:"absolute",bottom:-1,right:-1,width:8,height:8,borderRadius:"50%",background:statusDot[c.status],border:"1.5px solid #fff"}}/>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div className="row-between"><span className="small bold">{c.name}</span><span className="tiny muted">{c.time}</span></div>
                      <p className="tiny muted" style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.issue}</p>
                    </div>
                    {c.unread>0 && <span style={{background:"#6366F1",color:"#fff",borderRadius:"50%",width:16,height:16,fontSize:10,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{c.unread}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column"}}>
            <div style={{padding:"12px 16px",borderBottom:"1px solid #F3F4F6",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div className="row-gap">
                <div className="avatar" style={{background:selected.color}}>{selected.name[0]}</div>
                <div><p className="small bold" style={{margin:0}}>{selected.name}</p><p className="tiny muted" style={{margin:0}}>{selected.issue}</p></div>
              </div>
              <div className="row-gap">
                <button className="icon-btn" style={{background:"#F3F4F6",color:"#6B7280"}}><Ic name="phone" size={14}/></button>
                <button className="icon-btn" style={{background:"#F3F4F6",color:"#6B7280"}}><Ic name="video" size={14}/></button>
                <button className="icon-btn" style={{background:"#F3F4F6",color:"#6B7280"}}><Ic name="more" size={14}/></button>
              </div>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:16,display:"flex",flexDirection:"column",gap:10}}>
              {messages.map((m,i)=>(
                <div key={i} style={{display:"flex",justifyContent:m.from==="agent"?"flex-end":"flex-start"}}>
                  <div style={{maxWidth:"70%"}}>
                    <div style={{padding:"8px 12px",borderRadius:m.from==="agent"?"12px 12px 2px 12px":"12px 12px 12px 2px",background:m.from==="agent"?"#6366F1":"#F3F4F6",color:m.from==="agent"?"#fff":"#1F2937",fontSize:13,lineHeight:1.5}}>{m.text}</div>
                    <p style={{fontSize:10,color:"#9CA3AF",margin:"2px 4px",textAlign:m.from==="agent"?"right":"left"}}>{m.time}</p>
                  </div>
                </div>
              ))}
              <div ref={endRef}/>
            </div>
            <div style={{padding:"12px 16px",borderTop:"1px solid #F3F4F6",display:"flex",gap:8}}>
              <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Type a message..." style={{flex:1,border:"1px solid #E5E7EB",borderRadius:10,padding:"8px 12px",fontSize:13,outline:"none"}}/>
              <button onClick={send} style={{background:"#6366F1",color:"#fff",border:"none",borderRadius:10,padding:"0 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:6,fontSize:13}}><Ic name="send" size={14}/> Send</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── NAV ITEMS ─────────────────────────────────────────────────────────────
const navItems = [
  { id:"dashboard", label:"Dashboard", icon:"dashboard", color:"#7C3AED", bg:"#EDE9FE" },
  { id:"inventory", label:"Inventory", icon:"inventory", color:"#EA580C", bg:"#FFEDD5" },
  { id:"accounting", label:"Accounting", icon:"accounting", color:"#16A34A", bg:"#DCFCE7" },
  { id:"sales", label:"Sales & CRM", icon:"sales", color:"#2563EB", bg:"#DBEAFE" },
  { id:"manufacturing", label:"Manufacturing", icon:"manufacturing", color:"#DC2626", bg:"#FEE2E2" },
  { id:"ecommerce", label:"eCommerce", icon:"ecommerce", color:"#D97706", bg:"#FEF3C7" },
  { id:"hr", label:"Human Resources", icon:"hr", color:"#0891B2", bg:"#CFFAFE" },
  { id:"project", label:"Project", icon:"project", color:"#7C3AED", bg:"#EDE9FE" },
  { id:"marketing", label:"Marketing", icon:"megaphone", color:"#DB2777", bg:"#FCE7F3" },
  { id:"fieldservice", label:"Field Service", icon:"fieldservice", color:"#059669", bg:"#D1FAE5" },
  { id:"livechat", label:"Live Chat", icon:"livechat", color:"#6366F1", bg:"#E0E7FF" },
];

const moduleConfig = {
  dashboard:     { title:"📊 Main Dashboard", subtitle:"Overview of all business operations", color:"#7C3AED" },
  inventory:     { title:"📦 Inventory", subtitle:"Stock management, warehousing & logistics", color:"#EA580C" },
  accounting:    { title:"💰 Accounting", subtitle:"Invoicing, payments & financial reports", color:"#16A34A" },
  sales:         { title:"🛒 Sales & CRM", subtitle:"Quotations, sales orders & lead management", color:"#2563EB" },
  manufacturing: { title:"🏭 Manufacturing", subtitle:"Production planning, BOMs & work orders", color:"#DC2626" },
  ecommerce:     { title:"🛍️ eCommerce", subtitle:"Online store, products & order tracking", color:"#D97706" },
  hr:            { title:"👥 Human Resources", subtitle:"Employees, payroll & recruitment", color:"#0891B2" },
  project:       { title:"📅 Project Management", subtitle:"Tasks, timesheets & kanban boards", color:"#7C3AED" },
  marketing:     { title:"📣 Marketing", subtitle:"Email campaigns, social media & analytics", color:"#DB2777" },
  fieldservice:  { title:"🔧 Field Service", subtitle:"On-site jobs, technicians & scheduling", color:"#059669" },
  livechat:      { title:"💬 Live Chat", subtitle:"Customer support & real-time messaging", color:"#6366F1" },
};

const ModuleView = ({ id }) => {
  switch(id) {
    case "dashboard": return <Dashboard/>;
    case "inventory": return <Inventory/>;
    case "accounting": return <Accounting/>;
    case "sales": return <Sales/>;
    case "manufacturing": return <Manufacturing/>;
    case "ecommerce": return <Ecommerce/>;
    case "hr": return <HR/>;
    case "project": return <Project/>;
    case "marketing": return <Marketing/>;
    case "fieldservice": return <FieldService/>;
    case "livechat": return <LiveChat/>;
    default: return <Dashboard/>;
  }
};

// ── APP ───────────────────────────────────────────────────────────────────
export default function App() {
  const [active, setActive] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const config = moduleConfig[active];

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F9FAFB; }

        .layout { display: flex; height: 100vh; overflow: hidden; }

        /* Sidebar */
        .sidebar { background: #1e1e2e; display: flex; flex-direction: column; position: fixed; left: 0; top: 0; height: 100vh; z-index: 50; transition: width 0.3s ease; overflow: hidden; }
        .sidebar.open { width: 240px; } .sidebar.closed { width: 72px; }
        .sidebar-logo { display: flex; align-items: center; gap: 12px; padding: 18px 16px; border-bottom: 1px solid rgba(255,255,255,0.1); flex-shrink: 0; }
        .logo-icon { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #7C3AED, #6366F1); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 900; font-size: 14px; flex-shrink: 0; }
        .logo-text { color: #fff; font-weight: 700; font-size: 17px; white-space: nowrap; }
        .logo-text span { color: #A78BFA; }
        .nav-list { flex: 1; overflow-y: auto; padding: 12px 8px; display: flex; flex-direction: column; gap: 2px; scrollbar-width: none; }
        .nav-list::-webkit-scrollbar { display: none; }
        .nav-btn { width: 100%; display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 12px; border: none; cursor: pointer; transition: all 0.15s; background: transparent; color: #9CA3AF; position: relative; }
        .nav-btn:hover { background: rgba(255,255,255,0.06); color: #fff; }
        .nav-btn.active { background: rgba(255,255,255,0.1); color: #fff; }
        .nav-btn-indicator { position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 3px; height: 20px; border-radius: 0 4px 4px 0; }
        .nav-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background 0.15s; }
        .nav-label { font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .collapse-btn { display: flex; align-items: center; justify-content: center; padding: 10px; margin: 8px; border-radius: 12px; background: rgba(255,255,255,0.05); border: none; color: #9CA3AF; cursor: pointer; flex-shrink: 0; }
        .collapse-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }

        /* Header */
        .header { height: 60px; background: #fff; border-bottom: 1px solid #E5E7EB; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; position: sticky; top: 0; z-index: 40; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .header-title { font-size: 18px; font-weight: 700; }
        .header-sub { font-size: 11px; color: #9CA3AF; margin-top: 1px; }
        .header-right { display: flex; align-items: center; gap: 10px; }
        .hbtn { width: 36px; height: 36px; border-radius: 10px; background: #F3F4F6; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #6B7280; transition: background 0.15s; position: relative; }
        .hbtn:hover { background: #E5E7EB; }
        .notif-dot { position: absolute; top: 6px; right: 6px; width: 7px; height: 7px; background: #EF4444; border-radius: 50%; }
        .notif-panel { position: absolute; right: 0; top: 44px; width: 280px; background: #fff; border: 1px solid #E5E7EB; border-radius: 14px; box-shadow: 0 10px 40px rgba(0,0,0,0.12); overflow: hidden; z-index: 100; }
        .notif-header { padding: 12px 16px; border-bottom: 1px solid #F3F4F6; font-weight: 600; font-size: 13px; color: #374151; }
        .notif-item { padding: 10px 16px; border-bottom: 1px solid #FAFAFA; display: flex; align-items: flex-start; gap: 10px; cursor: pointer; }
        .notif-item:hover { background: #F9FAFB; }
        .notif-dot2 { width: 7px; height: 7px; border-radius: 50%; margin-top: 5px; flex-shrink: 0; }
        .user-block { display: flex; align-items: center; gap: 8px; cursor: pointer; }
        .user-avatar { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #7C3AED, #6366F1); display: flex; align-items: center; justify-content: center; color: #fff; }
        .user-name { font-size: 13px; font-weight: 600; color: #374151; }
        .user-role { font-size: 11px; color: #9CA3AF; }

        /* Main */
        .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; transition: margin-left 0.3s ease; }
        .content { flex: 1; overflow-y: auto; padding: 24px; }

        /* Module */
        .module-content { display: flex; flex-direction: column; gap: 20px; }
        .grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        .grid3 { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; }
        .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .span2 { grid-column: span 1; }

        /* Cards */
        .card { background: #fff; border-radius: 18px; padding: 20px; border: 1px solid #F3F4F6; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
        .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
        .card h3 { font-size: 15px; font-weight: 700; color: #1F2937; }

        /* StatCard */
        .stat-card { background: #fff; border-radius: 16px; padding: 20px; border: 1px solid #F3F4F6; box-shadow: 0 1px 3px rgba(0,0,0,0.04); display: flex; align-items: flex-start; justify-content: space-between; animation: fadeUp 0.4s ease both; animation-delay: var(--delay, 0s); }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .stat-label { font-size: 12px; color: #9CA3AF; font-weight: 500; }
        .stat-value { font-size: 24px; font-weight: 700; color: #111827; margin: 4px 0; }
        .stat-change { display: flex; align-items: center; gap: 4px; font-size: 11px; }
        .stat-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

        /* Utils */
        .row-gap { display: flex; align-items: center; gap: 8px; }
        .row-between { display: flex; align-items: center; justify-content: space-between; }
        .badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
        .badge.green { background: #DCFCE7; color: #16A34A; }
        .badge.muted { background: #F3F4F6; color: #6B7280; font-size: 11px; }
        .progress-bar { background: #F3F4F6; border-radius: 4px; height: 6px; overflow: hidden; }
        .progress-bar div { height: 100%; border-radius: 4px; transition: width 0.6s ease; }
        .legend { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
        .legend-row { display: flex; align-items: center; gap: 8px; }
        .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .activity-list { display: flex; flex-direction: column; gap: 12px; }
        .activity-item { display: flex; align-items: flex-start; gap: 10px; }
        .activity-icon { width: 32px; height: 32px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .info-box { padding: 12px 14px; border-radius: 10px; }
        .big { font-size: 22px; }
        .bold { font-weight: 600; }
        .small { font-size: 13px; }
        .tiny { font-size: 11px; }
        .muted { color: #9CA3AF; }
        .green { color: #16A34A; }
        .red { color: #EF4444; }
        .amber { color: #D97706; }
        .upper { text-transform: uppercase; letter-spacing: 0.5px; }
        .mono { font-family: monospace; }
        .search-wrap { position: relative; }
        .search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #9CA3AF; }
        .search-input { padding: 6px 10px 6px 30px; border: 1px solid #E5E7EB; border-radius: 10px; font-size: 12px; outline: none; color: #374151; width: 170px; }
        .search-input:focus { border-color: #A78BFA; box-shadow: 0 0 0 2px rgba(167,139,250,0.2); }
        .table-wrap { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        thead tr { border-bottom: 1px solid #F3F4F6; }
        th { padding: 8px 10px; text-align: left; font-size: 11px; color: #9CA3AF; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; }
        td { padding: 10px; border-bottom: 1px solid #FAFAFA; color: #374151; }
        tr:hover td { background: #FAFAFA; }
        .btn { display: inline-flex; align-items: center; gap: 5px; padding: 6px 14px; border-radius: 9px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid #E5E7EB; background: #fff; color: #374151; transition: opacity 0.15s; }
        .btn:hover { opacity: 0.85; }
        .tab-btn { padding: 5px 14px; border-radius: 8px; font-size: 12px; font-weight: 500; border: 1px solid #E5E7EB; background: #F9FAFB; color: #6B7280; cursor: pointer; transition: all 0.15s; }
        .tab-btn:hover { background: #F3F4F6; }
        .link-btn { background: none; border: none; color: #2563EB; font-size: 12px; cursor: pointer; text-decoration: underline; }
        .icon-btn { width: 26px; height: 26px; border: none; border-radius: 7px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .avatar { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 11px; font-weight: 700; flex-shrink: 0; }
        .stars { display: flex; align-items: center; gap: 1px; font-size: 12px; }
        .pipeline-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; text-align: center; }
        .pipeline-col { padding: 8px; }
        .pipeline-bar { display: flex; height: 8px; border-radius: 6px; overflow: hidden; margin-top: 12px; }
        .pipeline-bar div { transition: all 0.3s; }
        .kanban-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .kanban-col { padding: 12px; border-radius: 12px; min-height: 200px; }
        .kanban-card { background: #fff; border-radius: 10px; padding: 12px; margin-bottom: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); border: 1px solid #F3F4F6; }
        .project-card { padding: 14px; border: 1px solid #F3F4F6; border-radius: 12px; transition: box-shadow 0.15s; }
        .project-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        .job-card { padding: 12px 14px; border: 1px solid #F3F4F6; border-radius: 12px; background: #fff; }
      `}</style>
      <div className="layout">
        {/* Sidebar */}
        <div className={`sidebar ${collapsed?"closed":"open"}`}>
          <div className="sidebar-logo">
            <div className="logo-icon">O</div>
            {!collapsed && <span className="logo-text">Odoo<span>ERP</span></span>}
          </div>
          <nav className="nav-list">
            {navItems.map(item=>(
              <button key={item.id} onClick={()=>setActive(item.id)} className={`nav-btn${active===item.id?" active":""}`} title={collapsed?item.label:""}>
                {active===item.id && <span className="nav-btn-indicator" style={{background:item.color}}/>}
                <div className="nav-icon" style={{background:active===item.id?item.color:"transparent"}}>
                  <Ic name={item.icon} size={15} style={{color:active===item.id?"#fff":undefined}}/>
                </div>
                {!collapsed && <span className="nav-label">{item.label}</span>}
              </button>
            ))}
          </nav>
          <button className="collapse-btn" onClick={()=>setCollapsed(!collapsed)}>
            <Ic name={collapsed?"expand":"collapse"} size={16}/>
          </button>
        </div>

        {/* Main */}
        <div className="main" style={{marginLeft:collapsed?72:240}}>
          <header className="header">
            <div>
              <div className="header-title" style={{color:config.color}}>{config.title}</div>
              <div className="header-sub">{config.subtitle}</div>
            </div>
            <div className="header-right">
              <div className="search-wrap" style={{display:"flex"}}>
                <Ic name="search" size={14} className="search-icon"/>
                <input placeholder="Search..." className="search-input" style={{width:180}}/>
              </div>
              <div style={{position:"relative"}}>
                <button className="hbtn" onClick={()=>setShowNotif(!showNotif)}>
                  <Ic name="bell" size={16}/>
                  <span className="notif-dot"/>
                </button>
                {showNotif && (
                  <div className="notif-panel">
                    <div className="notif-header">Notifications</div>
                    {[
                      { msg:"3 new purchase orders pending approval", time:"2m ago", dot:"#3B82F6" },
                      { msg:"Low stock alert: Product SKU-1042", time:"15m ago", dot:"#F97316" },
                      { msg:"New employee onboarding request", time:"1h ago", dot:"#22C55E" },
                      { msg:"Invoice #INV-2024-089 overdue", time:"3h ago", dot:"#EF4444" },
                    ].map((n,i)=>(
                      <div key={i} className="notif-item">
                        <span className="notif-dot2" style={{background:n.dot}}/>
                        <div><p className="tiny" style={{color:"#374151"}}>{n.msg}</p><p className="tiny muted">{n.time}</p></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button className="hbtn"><Ic name="settings" size={16}/></button>
              <div className="user-block">
                <div className="user-avatar"><Ic name="user" size={16}/></div>
                <div>
                  <div className="user-name">Admin User</div>
                  <div className="user-role">Administrator</div>
                </div>
              </div>
            </div>
          </header>
          <main className="content">
            <ModuleView id={active}/>
          </main>
        </div>
      </div>
    </>
  );
}
