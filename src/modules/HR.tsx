import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, UserPlus, DollarSign, Calendar, Mail, Phone, MoreHorizontal, Search, Plus, X, Edit2, Trash2, Loader } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import StatCard from '../components/StatCard';
import { supabase, Employee } from '../lib/supabase';

const avatarColors = ['#7C3AED', '#2563EB', '#16A34A', '#D97706', '#DC2626', '#0891B2'];
const departments = ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance', 'Operations'];
const statusOptions = ['Active', 'On Leave', 'Inactive'];

const emptyForm: Employee = {
  name: '', department: 'Engineering', role: '', salary: 0,
  status: 'Active', joined: new Date().toISOString().split('T')[0],
  email: '', phone: '',
};

const HR: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState<Employee>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [showActions, setShowActions] = useState<string | null>(null);

  // ── Fetch employees from Supabase ──────────────────────────────────────
  const fetchEmployees = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) showToast('Failed to load employees: ' + error.message, 'error');
    else setEmployees(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchEmployees(); }, []);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Add or update employee ─────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name || !form.role || !form.email) {
      showToast('Please fill in Name, Role and Email.', 'error');
      return;
    }
    setSaving(true);
    if (editingEmployee?.id) {
      const { error } = await supabase
        .from('employees')
        .update({ ...form })
        .eq('id', editingEmployee.id);
      if (error) showToast('Update failed: ' + error.message, 'error');
      else { showToast('Employee updated successfully!', 'success'); closeModal(); fetchEmployees(); }
    } else {
      const { error } = await supabase.from('employees').insert([form]);
      if (error) showToast('Failed to add employee: ' + error.message, 'error');
      else { showToast('Employee added successfully!', 'success'); closeModal(); fetchEmployees(); }
    }
    setSaving(false);
  };

  // ── Delete employee ────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    setDeleting(id);
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (error) showToast('Delete failed: ' + error.message, 'error');
    else { showToast('Employee deleted.', 'success'); fetchEmployees(); }
    setDeleting(null);
    setShowActions(null);
  };

  const openAdd = () => { setEditingEmployee(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (emp: Employee) => { setEditingEmployee(emp); setForm({ ...emp }); setShowModal(true); setShowActions(null); };
  const closeModal = () => { setShowModal(false); setEditingEmployee(null); setForm(emptyForm); };

  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.department.toLowerCase().includes(search.toLowerCase()) ||
    e.role.toLowerCase().includes(search.toLowerCase())
  );

  // ── Department chart data from real employees ──────────────────────────
  const deptData = departments.map(dept => ({
    dept, count: employees.filter(e => e.department === dept).length
  })).filter(d => d.count > 0);

  const totalPayroll = employees.reduce((sum, e) => sum + (e.salary || 0), 0);
  const onLeave = employees.filter(e => e.status === 'On Leave').length;

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
        <StatCard title="Total Employees" value={loading ? '...' : String(employees.length)} change="+12" positive icon={<Users size={20} />} color="#0891B2" bg="#CFFAFE" delay={0.05} />
        <StatCard title="New Hires (MTD)" value="18" change="+5" positive icon={<UserPlus size={20} />} color="#7C3AED" bg="#EDE9FE" delay={0.1} />
        <StatCard title="Monthly Payroll" value={loading ? '...' : `₹${(totalPayroll / 12).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} change="+3.1%" positive icon={<DollarSign size={20} />} color="#16A34A" bg="#DCFCE7" delay={0.15} />
        <StatCard title="On Leave Today" value={loading ? '...' : String(onLeave)} change="+3" positive={false} icon={<Calendar size={20} />} color="#D97706" bg="#FEF3C7" delay={0.2} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Employee Table */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="xl:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h3 className="font-bold text-gray-800">Employee Directory <span className="text-cyan-600 ml-1">({filtered.length})</span></h3>
            <div className="flex gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search..." className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200 w-40" />
              </div>
              <button onClick={openAdd} className="flex items-center gap-1 px-3 py-1.5 bg-cyan-600 text-white rounded-lg text-sm hover:bg-cyan-700 transition-colors">
                <Plus size={14} /> Add Employee
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Loader size={24} className="animate-spin mr-2" /> Loading employees...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Users size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No employees found</p>
              <p className="text-sm mt-1">Click "Add Employee" to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
                    <th className="pb-2 text-left font-medium">Employee</th>
                    <th className="pb-2 text-left font-medium">Department</th>
                    <th className="pb-2 text-left font-medium">Role</th>
                    <th className="pb-2 text-left font-medium">Salary</th>
                    <th className="pb-2 text-left font-medium">Status</th>
                    <th className="pb-2 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e, i) => (
                    <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{ backgroundColor: avatarColors[i % avatarColors.length] }}>
                            {e.name?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800 text-sm">{e.name}</p>
                            <p className="text-[10px] text-gray-400">{e.joined}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-gray-600">{e.department}</td>
                      <td className="py-3 text-gray-600">{e.role}</td>
                      <td className="py-3 font-semibold text-gray-800">{`₹${(e.salary || 0).toLocaleString('en-IN')}`}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${e.status === 'Active' ? 'bg-green-100 text-green-700' : e.status === 'On Leave' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                          {e.status}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex gap-1 relative">
                          <button onClick={() => window.open(`mailto:${e.email}`)} className="w-6 h-6 bg-blue-50 rounded flex items-center justify-center text-blue-500 hover:bg-blue-100"><Mail size={11} /></button>
                          <button onClick={() => window.open(`tel:${e.phone}`)} className="w-6 h-6 bg-green-50 rounded flex items-center justify-center text-green-500 hover:bg-green-100"><Phone size={11} /></button>
                          <button onClick={() => setShowActions(showActions === e.id ? null : e.id!)} className="w-6 h-6 bg-gray-50 rounded flex items-center justify-center text-gray-500 hover:bg-gray-100"><MoreHorizontal size={11} /></button>
                          {showActions === e.id && (
                            <div className="absolute right-0 top-7 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden w-32">
                              <button onClick={() => openEdit(e)} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"><Edit2 size={12} /> Edit</button>
                              <button onClick={() => handleDelete(e.id!)} disabled={deleting === e.id}
                                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-600 hover:bg-red-50">
                                {deleting === e.id ? <Loader size={12} className="animate-spin" /> : <Trash2 size={12} />} Delete
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
          )}
        </motion.div>

        {/* Sidebar: Chart + Leave */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4">Headcount by Department</h3>
          {deptData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={deptData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis dataKey="dept" type="category" tick={{ fontSize: 10 }} width={75} />
                <Tooltip />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {deptData.map((_, i) => <Cell key={i} fill={avatarColors[i % avatarColors.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-300 text-sm">No data yet</div>
          )}
          <div className="mt-4 space-y-2">
            <h4 className="text-sm font-semibold text-gray-700">Leave Requests</h4>
            {employees.filter(e => e.status === 'On Leave').slice(0, 3).map((e, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-xs">
                <div>
                  <p className="font-medium text-gray-700">{e.name}</p>
                  <p className="text-gray-400">{e.department}</p>
                </div>
                <span className="px-2 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700">On Leave</span>
              </div>
            ))}
            {employees.filter(e => e.status === 'On Leave').length === 0 && (
              <p className="text-xs text-gray-400 text-center py-3">No leave requests</p>
            )}
          </div>
        </motion.div>
      </div>

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800">{editingEmployee ? 'Edit Employee' : 'Add New Employee'}</h2>
                <button onClick={closeModal} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"><X size={16} /></button>
              </div>
              <div className="p-6 space-y-4">
                {/* Form fields */}
                {[
                  { label: 'Full Name *', key: 'name', type: 'text', placeholder: 'e.g. Alice Walker' },
                  { label: 'Email *', key: 'email', type: 'email', placeholder: 'alice@company.com' },
                  { label: 'Phone', key: 'phone', type: 'text', placeholder: '+91-9876543210' },
                  { label: 'Role / Job Title *', key: 'role', type: 'text', placeholder: 'e.g. Senior Developer' },
                  { label: 'Salary (Annual)', key: 'salary', type: 'number', placeholder: '75000' },
                  { label: 'Joining Date', key: 'joined', type: 'date', placeholder: '' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                    <input type={field.type} placeholder={field.placeholder}
                      value={(form as any)[field.key]}
                      onChange={e => setForm({ ...form, [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200" />
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                    <select value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200">
                      {departments.map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200">
                      {statusOptions.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
                <button onClick={closeModal} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-700 disabled:opacity-60">
                  {saving && <Loader size={14} className="animate-spin" />}
                  {saving ? 'Saving...' : editingEmployee ? 'Update Employee' : 'Add Employee'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HR;
