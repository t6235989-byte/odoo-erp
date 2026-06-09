import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ModuleId } from './types';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './modules/Dashboard';
import Inventory from './modules/Inventory';
import Accounting from './modules/Accounting';
import Sales from './modules/Sales';
import Manufacturing from './modules/Manufacturing';
import Ecommerce from './modules/Ecommerce';
import HR from './modules/HR';
import Project from './modules/Project';
import Marketing from './modules/Marketing';
import FieldService from './modules/FieldService';
import LiveChat from './modules/LiveChat';
import Recruitment from './modules/Recruitment';
import TimeOffModule from './modules/TimeOff';
import Appraisals from './modules/Appraisals';
import Attendance from './modules/Attendance';

const moduleConfig: Record<ModuleId, { title: string; subtitle: string; color: string }> = {
  dashboard:    { title: '📊 Main Dashboard',      subtitle: 'Overview of all business operations',     color: '#7C3AED' },
  inventory:    { title: '📦 Inventory',            subtitle: 'Stock management, warehousing & logistics', color: '#EA580C' },
  accounting:   { title: '💰 Accounting',           subtitle: 'Invoicing, payments & financial reports',  color: '#16A34A' },
  sales:        { title: '🛒 Sales & CRM',          subtitle: 'Quotations, sales orders & lead management', color: '#2563EB' },
  manufacturing:{ title: '🏭 Manufacturing',        subtitle: 'Production planning, BOMs & work orders',  color: '#DC2626' },
  ecommerce:    { title: '🛍️ eCommerce',           subtitle: 'Online store, products & order tracking',  color: '#D97706' },
  hr:           { title: '👥 Human Resources',      subtitle: 'Employees, payroll & management',         color: '#0891B2' },
  project:      { title: '📅 Project Management',  subtitle: 'Tasks, timesheets & kanban boards',       color: '#7C3AED' },
  marketing:    { title: '📣 Marketing',            subtitle: 'Email campaigns, social media & analytics', color: '#DB2777' },
  fieldservice: { title: '🔧 Field Service',        subtitle: 'On-site jobs, technicians & scheduling',  color: '#059669' },
  livechat:     { title: '💬 Live Chat',            subtitle: 'Customer support & real-time messaging',  color: '#6366F1' },
  recruitment:  { title: '🧑‍💼 Recruitment',       subtitle: 'Job applications, interviews & hiring pipeline', color: '#7C3AED' },
  timeoff:      { title: '🌴 Time Off',             subtitle: 'Leave requests, approvals & attendance',  color: '#2563EB' },
  attendance:   { title: '🕐 Attendance & Payroll', subtitle: 'Daily attendance, work tracking & salary ledger', color: '#059669' },
  appraisals:   { title: '⭐ Appraisals',           subtitle: 'Employee performance reviews & feedback',  color: '#D97706' },
};

const ModuleRenderer: React.FC<{ module: ModuleId }> = ({ module }) => {
  switch (module) {
    case 'dashboard':     return <Dashboard />;
    case 'inventory':     return <Inventory />;
    case 'accounting':    return <Accounting />;
    case 'sales':         return <Sales />;
    case 'manufacturing': return <Manufacturing />;
    case 'ecommerce':     return <Ecommerce />;
    case 'hr':            return <HR />;
    case 'project':       return <Project />;
    case 'marketing':     return <Marketing />;
    case 'fieldservice':  return <FieldService />;
    case 'livechat':      return <LiveChat />;
    case 'recruitment':   return <Recruitment />;
    case 'timeoff':       return <TimeOffModule />;
    case 'appraisals':    return <Appraisals />;
    case 'attendance':    return <Attendance />;
    default:              return <Dashboard />;
  }
};

function App() {
  const [activeModule, setActiveModule] = useState<ModuleId>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const config = moduleConfig[activeModule];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar activeModule={activeModule} onModuleChange={setActiveModule} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <div className="flex-1 flex flex-col overflow-hidden transition-all duration-300" style={{ marginLeft: sidebarCollapsed ? 72 : 240 }}>
        <Header title={config.title} subtitle={config.subtitle} color={config.color} />
        <main className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div key={activeModule} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25, ease: 'easeInOut' }}>
              <ModuleRenderer module={activeModule} />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export default App;
