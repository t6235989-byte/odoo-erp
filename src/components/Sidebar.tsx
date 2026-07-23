import React from 'react';
import { motion } from 'framer-motion';
import {
  Clock as ClockIcon,
  ShoppingCart as PurchaseIcon,
  BookOpen as LedgerIcon,
  HardDrive as BackupIcon,
  FileText as QuotationIcon,
  BookUser,
  LayoutDashboard, Package, DollarSign, ShoppingCart,
  Factory, Store, Users, FolderKanban,
  Megaphone, Wrench, MessageCircle, ChevronLeft, ChevronRight,
  UserPlus, CalendarOff, Star, ClipboardList, Mail
} from 'lucide-react';
import type { ModuleId } from '../types';

interface SidebarProps {
  activeModule: ModuleId;
  onModuleChange: (id: ModuleId) => void;
  collapsed: boolean;
  onToggle: () => void;
}

const navGroups = [
  {
    label: 'Main',
    items: [
      { id: 'dashboard' as ModuleId, label: 'Dashboard', icon: LayoutDashboard, color: '#7C3AED', bg: '#EDE9FE' },
    ]
  },
  {
    label: 'Operations',
    items: [
      { id: 'inventory' as ModuleId, label: 'Inventory', icon: Package, color: '#EA580C', bg: '#FFEDD5' },
      { id: 'purchase' as ModuleId, label: 'Purchase', icon: PurchaseIcon, color: '#2563EB', bg: '#DBEAFE' },
      { id: 'partyledger' as ModuleId, label: 'Party Ledger', icon: LedgerIcon, color: '#7C3AED', bg: '#EDE9FE' },
      { id: 'backup' as ModuleId, label: 'Backup & Export', icon: BackupIcon, color: '#7C3AED', bg: '#EDE9FE' },
      { id: 'quotation' as ModuleId, label: 'Quotations', icon: QuotationIcon, color: '#0891B2', bg: '#CFFAFE' },
      { id: 'orderform' as ModuleId, label: 'Order Form', icon: ClipboardList, color: '#6D28D9', bg: '#EDE9FE' },
      { id: 'letterhead' as ModuleId, label: 'Letterhead', icon: Mail, color: '#1D4ED8', bg: '#DBEAFE' },
      { id: 'contacts' as ModuleId, label: 'Number Diary', icon: BookUser, color: '#0891B2', bg: '#CFFAFE' },
      { id: 'accounting' as ModuleId, label: 'Accounting', icon: DollarSign, color: '#16A34A', bg: '#DCFCE7' },
      { id: 'sales' as ModuleId, label: 'Sales & CRM', icon: ShoppingCart, color: '#2563EB', bg: '#DBEAFE' },
      { id: 'manufacturing' as ModuleId, label: 'Manufacturing', icon: Factory, color: '#DC2626', bg: '#FEE2E2' },
      { id: 'ecommerce' as ModuleId, label: 'eCommerce', icon: Store, color: '#D97706', bg: '#FEF3C7' },
    ]
  },
  {
    label: 'Human Resources',
    items: [
      { id: 'hr' as ModuleId, label: 'Employees', icon: Users, color: '#0891B2', bg: '#CFFAFE' },
      { id: 'recruitment' as ModuleId, label: 'Recruitment', icon: UserPlus, color: '#7C3AED', bg: '#EDE9FE' },
      { id: 'timeoff' as ModuleId, label: 'Time Off', icon: CalendarOff, color: '#2563EB', bg: '#DBEAFE' },
      { id: 'appraisals' as ModuleId, label: 'Appraisals', icon: Star, color: '#D97706', bg: '#FEF3C7' },
      { id: 'attendance' as ModuleId, label: 'Attendance', icon: ClockIcon, color: '#059669', bg: '#D1FAE5' },
    ]
  },
  {
    label: 'Services',
    items: [
      { id: 'project' as ModuleId, label: 'Project', icon: FolderKanban, color: '#7C3AED', bg: '#EDE9FE' },
      { id: 'fieldservice' as ModuleId, label: 'Field Service', icon: Wrench, color: '#059669', bg: '#D1FAE5' },
    ]
  },
  {
    label: 'Marketing & Support',
    items: [
      { id: 'marketing' as ModuleId, label: 'Marketing', icon: Megaphone, color: '#DB2777', bg: '#FCE7F3' },
      { id: 'livechat' as ModuleId, label: 'Live Chat', icon: MessageCircle, color: '#6366F1', bg: '#E0E7FF' },
    ]
  },
];

const Sidebar: React.FC<SidebarProps> = ({ activeModule, onModuleChange, collapsed, onToggle }) => {
  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="h-screen bg-[#1e1e2e] flex flex-col fixed left-0 top-0 z-50 shadow-2xl"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg">
          <span className="text-white font-black text-sm">O</span>
        </div>
        {!collapsed && (
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-white font-bold text-lg tracking-wide">
            Odoo<span className="text-purple-400">ERP</span>
          </motion.span>
        )}
      </div>

      {/* Nav Groups */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 scrollbar-hide">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-2">
            {!collapsed && (
              <p className="text-[10px] text-gray-500 uppercase tracking-widest px-3 py-1 font-semibold">{group.label}</p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeModule === item.id;
                return (
                  <motion.button
                    key={item.id}
                    onClick={() => onModuleChange(item.id)}
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.97 }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative ${isActive ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                    title={collapsed ? item.label : ''}
                  >
                    {isActive && (
                      <motion.div layoutId="activeIndicator" className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full" style={{ backgroundColor: item.color }} />
                    )}
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: isActive ? item.color : 'transparent' }}>
                      <Icon size={16} className={isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'} />
                    </div>
                    {!collapsed && <span className="text-sm font-medium truncate">{item.label}</span>}
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse Toggle */}
      <button onClick={onToggle} className="flex items-center justify-center p-3 m-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all">
        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>
    </motion.aside>
  );
};

export default Sidebar;
