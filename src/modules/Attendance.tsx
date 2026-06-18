import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, Calendar, TrendingUp, FileText, Plus, X, Loader, Eye,
  Edit2, Trash2, Download, ChevronLeft, ChevronRight, CheckCircle,
  AlertCircle, User, Briefcase, IndianRupee
} from 'lucide-react';
import StatCard from '../components/StatCard';
import { supabase } from '../lib/supabase';

type AttendanceRecord = {
  id?: string;
  employee_id?: string;
  employee_name: string;
  date: string;
  clock_in: string;
  clock_out: string;
  total_hours: number;
  break_hours: number;
  net_hours: number;
  status: string;
  work_notes: string;
};

type WorkTask = {
  id?: string;
  employee_id?: string;
  employee_name: string;
  date: string;
  task_title: string;
  description: string;
  hours_spent: number;
  status: string;
};

type Employee = { id: string; name: string; salary?: number; };

type Payment = {
  id?: string;
  employee_name: string;
  payment_date: string;
  amount: number;
  month: string;
  year: number;
  note: string;
};

const statusStyle: Record<string, string> = {
  Present: 'bg-green-100 text-green-700',
  Absent: 'bg-red-100 text-red-700',
  'Half Day': 'bg-orange-100 text-orange-700',
  Holiday: 'bg-blue-100 text-blue-700',
  'Work From Home': 'bg-violet-100 text-violet-700',
};

const taskStatusStyle: Record<string, string> = {
  Done: 'bg-green-100 text-green-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  Pending: 'bg-yellow-100 text-yellow-700',
};

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const today = new Date();
const RATE_KEY = (emp: string) => `hourly_rate_${emp}`;

const emptyAtt: AttendanceRecord = {
  employee_name: 'RIHAN', date: today.toISOString().split('T')[0],
  clock_in: '09:00', clock_out: '18:00', total_hours: 9, break_hours: 1, net_hours: 8,
  status: 'Present', work_notes: ''
};
const emptyTask: WorkTask = {
  employee_name: 'RIHAN', date: today.toISOString().split('T')[0],
  task_title: '', description: '', hours_spent: 0, status: 'Done'
};

const Attendance: React.FC = () => {
  const [tab, setTab] = useState<'daily' | 'monthly' | 'tasks' | 'ledger'>('daily');
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payForm, setPayForm] = useState<Payment>({ employee_name: 'RIHAN', payment_date: new Date().toISOString().split('T')[0], amount: 0, month: 'June', year: 2026, note: '' });
  const [payType, setPayType] = useState<'payment' | 'return'>('payment');

  // Documents state
  const [docs, setDocs] = useState<any[]>([]);
  const [showDocModal, setShowDocModal] = useState(false);
  const [docForm, setDocForm] = useState({ doc_name: '', doc_type: 'Aadhar Card', notes: '' });
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedEmp, setSelectedEmp] = useState('RIHAN');
  const [showAttModal, setShowAttModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [attForm, setAttForm] = useState<AttendanceRecord>(emptyAtt);
  const [taskForm, setTaskForm] = useState<WorkTask>(emptyTask);
  const [editingAtt, setEditingAtt] = useState<AttendanceRecord | null>(null);
  const [editingTask, setEditingTask] = useState<WorkTask | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [hourlyRate, setHourlyRate] = useState<number>(150);
  const [rateInput, setRateInput] = useState<string>('150');
  const [showRateEditor, setShowRateEditor] = useState(false);
  const [rateMode, setRateMode] = useState<'per_hour' | 'per_8hr'>('per_hour');
  const printRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string, type: 'success' | 'error') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  // Load saved rate + mode for this employee
  useEffect(() => {
    const saved = localStorage.getItem(RATE_KEY(selectedEmp));
    const rate = saved ? Number(saved) : 150;
    setHourlyRate(rate);
    setRateInput(String(rate));
    const savedMode = localStorage.getItem(RATE_KEY(selectedEmp) + '_mode');
    setRateMode((savedMode as 'per_hour' | 'per_8hr') || 'per_hour');
  }, [selectedEmp]);

  const saveRate = () => {
    const val = Number(rateInput);
    if (!val || val <= 0) { showToast('Enter a valid rate.', 'error'); return; }
    localStorage.setItem(RATE_KEY(selectedEmp), String(val));
    localStorage.setItem(RATE_KEY(selectedEmp) + '_mode', rateMode);
    setHourlyRate(val);
    setShowRateEditor(false);
    const label = rateMode === 'per_8hr' ? `₹${val} per 8hrs` : `₹${val}/hr`;
    showToast(`Rate updated: ${label} for ${selectedEmp}!`, 'success');
  };

  const fetchData = async () => {
    setLoading(true);
    const [{ data: att }, { data: tsk }, { data: emp }] = await Promise.all([
      supabase.from('attendance').select('*').eq('employee_name', selectedEmp).order('date', { ascending: false }),
      supabase.from('work_tasks').select('*').eq('employee_name', selectedEmp).order('date', { ascending: false }),
      supabase.from('employees').select('id,name,salary'),
      supabase.from('salary_payments').select('*').eq('employee_name', selectedEmp).order('payment_date', { ascending: false }),
    ]);
    setAttendance(att || []);
    setTasks(tsk || []);
    setEmployees(emp || []);
    setPayments((await supabase.from('salary_payments').select('*').eq('employee_name', selectedEmp).order('payment_date')).data || []);
    setDocs((await supabase.from('employee_documents').select('*').eq('employee_name', selectedEmp).order('created_at', { ascending: false })).data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [selectedEmp]);

  // ── Filter by month ────────────────────────────────────────────────────
  const monthAtt = attendance.filter(a => {
    const d = new Date(a.date);
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  });
  const monthTasks = tasks.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  });

  // ── Monthly stats ──────────────────────────────────────────────────────
  const presentDays = monthAtt.filter(a => a.status === 'Present' || a.status === 'Work From Home').length;
  const totalNetHours = monthAtt.reduce((s, a) => s + (a.net_hours || 0), 0);
  const totalTaskHours = monthTasks.reduce((s, t) => s + (t.hours_spent || 0), 0);
  // Salary: per_hour = hours × rate | per_8hr = (hours / 8) × rate
  const calcSalary = (hours: number, rate: number, mode: string) =>
    mode === 'per_8hr' ? Math.round((hours / 8) * rate) : Math.round(hours * rate);
  const monthSalary = calcSalary(totalNetHours, hourlyRate, rateMode);
  const rateLabel = rateMode === 'per_8hr' ? `₹${hourlyRate}/8hr day` : `₹${hourlyRate}/hr`;
  const avgHoursDay = presentDays > 0 ? (totalNetHours / presentDays).toFixed(1) : '0';

  // ── Attendance CRUD ────────────────────────────────────────────────────
  const calcHours = (form: AttendanceRecord) => {
    if (!form.clock_in || !form.clock_out) return form;
    const [ih, im] = form.clock_in.split(':').map(Number);
    const [oh, om] = form.clock_out.split(':').map(Number);
    const total = ((oh * 60 + om) - (ih * 60 + im)) / 60;
    const net = Math.max(0, total - form.break_hours);
    return { ...form, total_hours: Math.round(total * 10) / 10, net_hours: Math.round(net * 10) / 10 };
  };

  const saveAtt = async () => {
    if (!attForm.date) { showToast('Date required.', 'error'); return; }
    const payload = calcHours(attForm);
    setSaving(true);
    if (editingAtt?.id) {
      const { error } = await supabase.from('attendance').update(payload).eq('id', editingAtt.id);
      if (error) showToast('Failed: ' + error.message, 'error');
      else { showToast('Updated!', 'success'); setShowAttModal(false); fetchData(); }
    } else {
      const { error } = await supabase.from('attendance').insert([{ ...payload, employee_name: selectedEmp }]);
      if (error) showToast('Failed: ' + error.message, 'error');
      else { showToast('Attendance marked!', 'success'); setShowAttModal(false); fetchData(); }
    }
    setSaving(false);
  };

  const deleteAtt = async (id: string) => {
    setDeleting(id);
    await supabase.from('attendance').delete().eq('id', id);
    showToast('Deleted.', 'success'); fetchData(); setDeleting(null);
  };

  // ── Task CRUD ──────────────────────────────────────────────────────────
  const saveTask = async () => {
    if (!taskForm.task_title) { showToast('Task title required.', 'error'); return; }
    setSaving(true);
    if (editingTask?.id) {
      const { error } = await supabase.from('work_tasks').update(taskForm).eq('id', editingTask.id);
      if (error) showToast('Failed: ' + error.message, 'error');
      else { showToast('Updated!', 'success'); setShowTaskModal(false); fetchData(); }
    } else {
      const { error } = await supabase.from('work_tasks').insert([{ ...taskForm, employee_name: selectedEmp }]);
      if (error) showToast('Failed: ' + error.message, 'error');
      else { showToast('Task added!', 'success'); setShowTaskModal(false); fetchData(); }
    }
    setSaving(false);
  };

  const savePayment = async () => {
    if (!payForm.amount || payForm.amount <= 0) { showToast('Enter a valid amount.', 'error'); return; }
    setSaving(true);
    const finalAmount = payType === 'return' ? -Math.abs(payForm.amount) : Math.abs(payForm.amount);
    const payload = { ...payForm, amount: finalAmount, employee_name: selectedEmp };
    const { error } = await supabase.from('salary_payments').insert([payload]);
    if (error) showToast('Failed: ' + error.message, 'error');
    else {
      const msg = payType === 'return'
        ? `₹${payForm.amount.toLocaleString('en-IN')} return recorded!`
        : `₹${payForm.amount.toLocaleString('en-IN')} payment recorded!`;
      showToast(msg, 'success'); setShowPaymentModal(false); fetchData();
    }
    setSaving(false);
  };

  // ── Upload Document ───────────────────────────────────────────────────
  const uploadDoc = async () => {
    if (!docFile || !docForm.doc_name) { showToast('File and name required.', 'error'); return; }
    setUploadingDoc(true);
    try {
      const fileExt = docFile.name.split('.').pop();
      const fileName = `${selectedEmp}_${Date.now()}.${fileExt}`;
      const { error: upErr } = await supabase.storage.from('employee-docs').upload(fileName, docFile);
      if (upErr) { showToast('Upload failed: ' + upErr.message, 'error'); setUploadingDoc(false); return; }
      const { data: urlData } = supabase.storage.from('employee-docs').getPublicUrl(fileName);
      await supabase.from('employee_documents').insert([{
        employee_name: selectedEmp,
        doc_name: docForm.doc_name,
        doc_type: docForm.doc_type,
        file_name: docFile.name,
        file_url: urlData.publicUrl,
        file_size: (docFile.size / 1024).toFixed(0) + ' KB',
        notes: docForm.notes,
      }]);
      showToast('Document uploaded!', 'success');
      setShowDocModal(false);
      setDocForm({ doc_name: '', doc_type: 'Aadhar Card', notes: '' });
      setDocFile(null);
      fetchData();
    } catch(e) { showToast('Failed to upload.', 'error'); }
    setUploadingDoc(false);
  };

  const deleteDoc = async (id: string, fileUrl: string) => {
    const fileName = fileUrl.split('/').pop();
    if (fileName) await supabase.storage.from('employee-docs').remove([fileName]);
    await supabase.from('employee_documents').delete().eq('id', id);
    showToast('Document deleted.', 'success'); fetchData();
  };

  const docTypes = ['Aadhar Card', 'PAN Card', 'Passport', 'Driving License', 'Offer Letter', 'Contract', 'Certificate', 'Marksheet', 'Photo', 'Bank Details', 'Other'];

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return '📄';
    if (['jpg','jpeg','png','gif','webp'].includes(ext||'')) return '🖼️';
    return '📎';
  };

  const deletePayment = async (id: string) => {
    setDeleting(id);
    await supabase.from('salary_payments').delete().eq('id', id);
    showToast('Payment deleted.', 'success'); fetchData(); setDeleting(null);
  };

  const deleteTask = async (id: string) => {
    setDeleting(id);
    await supabase.from('work_tasks').delete().eq('id', id);
    showToast('Deleted.', 'success'); fetchData(); setDeleting(null);
  };

  // ── PDF Export ─────────────────────────────────────────────────────────
  const exportPDF = () => {
    const monthName = MONTHS[selectedMonth];
    const printContent = `
      <html><head><title>Attendance Report - ${selectedEmp} - ${monthName} ${selectedYear}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 30px; color: #1F2937; }
        .header { border-bottom: 3px solid #7C3AED; padding-bottom: 16px; margin-bottom: 24px; }
        .company { font-size: 22px; font-weight: bold; color: #7C3AED; }
        .title { font-size: 16px; color: #6B7280; margin-top: 4px; }
        .emp-info { display: flex; gap: 40px; background: #F9FAFB; padding: 16px; border-radius: 8px; margin-bottom: 20px; }
        .info-item { display: flex; flex-direction: column; }
        .info-label { font-size: 11px; color: #9CA3AF; text-transform: uppercase; }
        .info-value { font-size: 15px; font-weight: bold; color: #1F2937; margin-top: 2px; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
        .stat-box { background: #F3F4F6; border-radius: 8px; padding: 14px; text-align: center; }
        .stat-val { font-size: 22px; font-weight: bold; color: #7C3AED; }
        .stat-lbl { font-size: 11px; color: #6B7280; margin-top: 2px; }
        h3 { font-size: 14px; font-weight: bold; color: #374151; margin: 20px 0 10px; border-bottom: 1px solid #E5E7EB; padding-bottom: 6px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; }
        th { background: #7C3AED; color: white; padding: 8px 10px; text-align: left; font-size: 11px; }
        td { padding: 7px 10px; border-bottom: 1px solid #F3F4F6; }
        tr:nth-child(even) td { background: #FAFAFA; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: bold; }
        .present { background: #DCFCE7; color: #16A34A; }
        .absent { background: #FEE2E2; color: #DC2626; }
        .salary-box { background: #EDE9FE; border-radius: 10px; padding: 20px; margin-top: 20px; }
        .salary-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #DDD6FE; }
        .salary-total { display: flex; justify-content: space-between; padding: 10px 0; font-size: 16px; font-weight: bold; color: #7C3AED; }
        .footer { text-align: center; color: #9CA3AF; font-size: 10px; margin-top: 30px; padding-top: 16px; border-top: 1px solid #E5E7EB; }
      </style></head><body>
      <div class="header">
        <div class="company">OdooERP System</div>
        <div class="title">Attendance & Salary Report — ${monthName} ${selectedYear}</div>
      </div>
      <div class="emp-info">
        <div class="info-item"><span class="info-label">Employee Name</span><span class="info-value">${selectedEmp}</span></div>
        <div class="info-item"><span class="info-label">Month</span><span class="info-value">${monthName} ${selectedYear}</span></div>
        <div class="info-item"><span class="info-label">Hourly Rate</span><span class="info-value">Rs. ${hourlyRate}/hr</span></div>
        <div class="info-item"><span class="info-label">Generated On</span><span class="info-value">${new Date().toLocaleDateString('en-IN')}</span></div>
      </div>
      <div class="stats-grid">
        <div class="stat-box"><div class="stat-val">${presentDays}</div><div class="stat-lbl">Days Present</div></div>
        <div class="stat-box"><div class="stat-val">${totalNetHours}h</div><div class="stat-lbl">Total Hours</div></div>
        <div class="stat-box"><div class="stat-val">${avgHoursDay}h</div><div class="stat-lbl">Avg Hours/Day</div></div>
        <div class="stat-box"><div class="stat-val">Rs. ${monthSalary.toLocaleString('en-IN')}</div><div class="stat-lbl">Gross Salary</div></div>
      </div>
      <h3>Daily Attendance Log</h3>
      <table>
        <thead><tr><th>Date</th><th>Day</th><th>Clock In</th><th>Clock Out</th><th>Break</th><th>Net Hours</th><th>Status</th><th>Notes</th></tr></thead>
        <tbody>
          ${monthAtt.map(a => {
            const d = new Date(a.date);
            const day = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
            const cls = a.status === 'Present' || a.status === 'Work From Home' ? 'present' : 'absent';
            return `<tr>
              <td>${a.date}</td><td>${day}</td>
              <td>${a.clock_in || '-'}</td><td>${a.clock_out || '-'}</td>
              <td>${a.break_hours}h</td><td><strong>${a.net_hours}h</strong></td>
              <td><span class="badge ${cls}">${a.status}</span></td>
              <td>${a.work_notes || '-'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      <h3>Work Tasks Log</h3>
      <table>
        <thead><tr><th>Date</th><th>Task</th><th>Description</th><th>Hours</th><th>Status</th></tr></thead>
        <tbody>
          ${monthTasks.map(t => `<tr>
            <td>${t.date}</td><td><strong>${t.task_title}</strong></td>
            <td>${t.description || '-'}</td><td>${t.hours_spent}h</td>
            <td><span class="badge present">${t.status}</span></td>
          </tr>`).join('')}
        </tbody>
      </table>
      <h3>Payment History</h3>
      ${(() => {
        const mPayments = payments.filter(p => p.month === monthName && p.year === selectedYear);
        const totalPaid = mPayments.reduce((s,p) => s+p.amount, 0);
        const balance = monthSalary - totalPaid;
        if (mPayments.length === 0) return '<p style="color:#9CA3AF;font-size:12px">No payments recorded for this month.</p>';
        return `<table>
          <thead><tr><th>#</th><th>Date</th><th>Amount</th><th>Note</th></tr></thead>
          <tbody>
            ${mPayments.map((p,i) => `<tr><td>${i+1}</td><td>${p.payment_date}</td><td><strong>Rs. ${p.amount.toLocaleString('en-IN')}</strong></td><td>${p.note||'-'}</td></tr>`).join('')}
          </tbody>
          <tfoot><tr style="background:#F3F4F6"><td colspan="2"><strong>Total Paid</strong></td><td><strong>Rs. ${totalPaid.toLocaleString('en-IN')}</strong></td><td></td></tr></tfoot>
        </table>`;
      })()}
      <div class="salary-box">
        <h3 style="margin-top:0;border:none;color:#7C3AED">Salary Statement</h3>
        <div class="salary-row"><span>Total Working Hours</span><span>${totalNetHours} hours</span></div>
        <div class="salary-row"><span>Rate (${rateMode === 'per_8hr' ? 'Per 8-hr Day' : 'Per Hour'})</span><span>Rs. ${hourlyRate}</span></div>
        <div class="salary-row"><span>Gross Earned (${rateMode === 'per_8hr' ? `${totalNetHours}h ÷ 8 × ${hourlyRate}` : `${totalNetHours}h × ${hourlyRate}`})</span><span>Rs. ${monthSalary.toLocaleString('en-IN')}</span></div>
        <div class="salary-row"><span>Total Paid This Month</span><span style="color:#16A34A">Rs. ${payments.filter(p=>p.month===monthName&&p.year===selectedYear).reduce((s,p)=>s+p.amount,0).toLocaleString('en-IN')}</span></div>
        <div class="salary-row"><span>Deductions</span><span>Rs. 0</span></div>
        ${(() => {
          const paid = payments.filter(p=>p.month===monthName&&p.year===selectedYear).reduce((s,p)=>s+p.amount,0);
          const bal = monthSalary - paid;
          return `<div class="salary-total" style="color:${bal>0?'#DC2626':'#16A34A'}">
            <span>${bal>0?'BALANCE DUE':'ADVANCE PAID'}</span>
            <span>Rs. ${Math.abs(bal).toLocaleString('en-IN')}</span>
          </div>`;
        })()}
      </div>
      <div class="footer">Generated by OdooERP System &bull; ${new Date().toLocaleString('en-IN')} &bull; This is a computer-generated report</div>
      </body></html>
    `;
    const win = window.open('', '_blank');
    if (win) { win.document.write(printContent); win.document.close(); setTimeout(() => win.print(), 500); }
  };

  // ── Calendar view helpers ──────────────────────────────────────────────
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const firstDay = new Date(selectedYear, selectedMonth, 1).getDay();
  const attByDate: Record<string, AttendanceRecord> = {};
  monthAtt.forEach(a => { attByDate[a.date] = a; });

  return (
    <div className="space-y-6">
      <AnimatePresence>{toast && <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-500'}`}>{toast.msg}</motion.div>}</AnimatePresence>

      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <select value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-violet-200 bg-white">
            {employees.length > 0 ? employees.map(e => <option key={e.id}>{e.name}</option>) : <option>RIHAN</option>}
          </select>
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-2 py-1">
            <button onClick={() => { if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(y => y - 1); } else setSelectedMonth(m => m - 1); }} className="p-1 hover:bg-gray-100 rounded-lg"><ChevronLeft size={14} /></button>
            <span className="text-sm font-semibold px-2">{MONTHS[selectedMonth]} {selectedYear}</span>
            <button onClick={() => { if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(y => y + 1); } else setSelectedMonth(m => m + 1); }} className="p-1 hover:bg-gray-100 rounded-lg"><ChevronRight size={14} /></button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Rate Editor */}
          <div className="relative">
            <button onClick={() => setShowRateEditor(!showRateEditor)}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">
              <IndianRupee size={13} className="text-violet-600" />
              <span>&#8377;{hourlyRate} {rateMode === "per_8hr" ? "/8hr" : "/hr"}</span>
              <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">Edit Rate</span>
            </button>
            {showRateEditor && (
              <div className="absolute right-0 top-12 bg-white border border-gray-200 rounded-2xl shadow-2xl z-30 p-4 w-72">
                <p className="font-bold text-gray-800 mb-1 text-sm">Set Rate for {selectedEmp}</p>
                {/* Mode Toggle */}
                <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-3">
                  <button onClick={() => setRateMode("per_hour")}
                    className={"flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors " + (rateMode === "per_hour" ? "bg-white text-violet-700 shadow-sm" : "text-gray-500 hover:text-gray-700")}>
                    ⏱ Per Hour
                  </button>
                  <button onClick={() => setRateMode("per_8hr")}
                    className={"flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors " + (rateMode === "per_8hr" ? "bg-white text-violet-700 shadow-sm" : "text-gray-500 hover:text-gray-700")}>
                    📅 Per 8-hr Day
                  </button>
                </div>
                <p className="text-xs text-gray-400 mb-2">
                  {rateMode === "per_hour" ? "Salary = Total Hours × Rate" : "Salary = (Total Hours ÷ 8) × Daily Rate"}
                </p>
                <div className="flex gap-2 mb-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">&#8377;</span>
                    <input type="number" value={rateInput} onChange={e => setRateInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && saveRate()}
                      className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" placeholder="e.g. 150" />
                  </div>
                  <button onClick={saveRate} className="px-3 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700">Save</button>
                </div>
                <p className="text-xs text-gray-400 mb-2">Quick presets:</p>
                <div className="flex flex-wrap gap-1.5">
                  {[500, 600, 700, 800, 1000, 1200, 1500, 2000].map(r => (
                    <button key={r} onClick={() => setRateInput(String(r))}
                      className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${Number(rateInput) === r ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-violet-100 hover:text-violet-700"}`}>
                      &#8377;{r}
                    </button>
                  ))}
                </div>
                <div className="mt-3 p-2.5 bg-violet-50 rounded-xl text-xs space-y-1">
                  <div><span className="text-gray-500">This month hours: </span><span className="font-bold">{totalNetHours}h</span></div>
                  {rateMode === "per_hour" ? (
                    <div><span className="text-gray-500">Formula: </span><span className="font-bold text-violet-700">{totalNetHours} × &#8377;{rateInput || hourlyRate} = &#8377;{(totalNetHours * (Number(rateInput) || hourlyRate)).toLocaleString("en-IN")}</span></div>
                  ) : (
                    <div><span className="text-gray-500">Formula: </span><span className="font-bold text-violet-700">({totalNetHours} ÷ 8) × &#8377;{rateInput || hourlyRate} = &#8377;{Math.round((totalNetHours / 8) * (Number(rateInput) || hourlyRate)).toLocaleString("en-IN")}</span></div>
                  )}
                </div>
              </div>
            )}
          </div>
          <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700">
            <Download size={14} /> Export PDF
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Days Present" value={loading ? '...' : String(presentDays)} change="+2" positive icon={<CheckCircle size={20} />} color="#16A34A" bg="#DCFCE7" delay={0.05} />
        <StatCard title="Total Hours" value={loading ? '...' : `${totalNetHours}h`} change="+8h" positive icon={<Clock size={20} />} color="#2563EB" bg="#DBEAFE" delay={0.1} />
        <StatCard title="Avg Hours/Day" value={loading ? '...' : `${avgHoursDay}h`} change="+0.2" positive icon={<TrendingUp size={20} />} color="#D97706" bg="#FEF3C7" delay={0.15} />
        <StatCard title="Month Salary" value={loading ? '...' : `₹${monthSalary.toLocaleString('en-IN')}`} change="+5%" positive icon={<IndianRupee size={20} />} color="#7C3AED" bg="#EDE9FE" delay={0.2} />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {([['daily','📅 Daily Log'],['monthly','📆 Calendar'],['tasks','✅ Work Tasks'],['ledger','💰 Salary Ledger'],['documents','📁 Documents']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === id ? 'bg-violet-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>{label}</button>
        ))}
      </div>

      {/* DAILY LOG */}
      {tab === 'daily' && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h3 className="font-bold text-gray-800">Daily Attendance — {MONTHS[selectedMonth]} {selectedYear}</h3>
            <button onClick={() => { setEditingAtt(null); setAttForm({ ...emptyAtt, employee_name: selectedEmp }); setShowAttModal(true); }} className="flex items-center gap-1 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700"><Plus size={13} /> Mark Attendance</button>
          </div>
          {loading ? <div className="flex items-center justify-center py-12 text-gray-400"><Loader size={20} className="animate-spin mr-2" />Loading...</div>
          : monthAtt.length === 0 ? <div className="text-center py-12 text-gray-400"><Calendar size={36} className="mx-auto mb-2 opacity-30" /><p>No attendance records for this month</p></div>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
                  <th className="pb-2 text-left">Date</th><th className="pb-2 text-left">Day</th>
                  <th className="pb-2 text-left">Clock In</th><th className="pb-2 text-left">Clock Out</th>
                  <th className="pb-2 text-left">Break</th><th className="pb-2 text-left">Net Hours</th>
                  <th className="pb-2 text-left">Status</th><th className="pb-2 text-left">Notes</th><th className="pb-2 text-left">Actions</th>
                </tr></thead>
                <tbody>
                  {monthAtt.map(a => {
                    const d = new Date(a.date);
                    const day = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <tr key={a.id} className={`border-b border-gray-50 hover:bg-gray-50 ${isWeekend ? 'opacity-60' : ''}`}>
                        <td className="py-2.5 font-medium">{a.date}</td>
                        <td className="py-2.5 text-gray-400 text-xs">{day}</td>
                        <td className="py-2.5 font-mono text-xs text-green-600">{a.clock_in || '-'}</td>
                        <td className="py-2.5 font-mono text-xs text-red-500">{a.clock_out || '-'}</td>
                        <td className="py-2.5 text-gray-400">{a.break_hours}h</td>
                        <td className="py-2.5"><span className="font-bold text-violet-600">{a.net_hours}h</span></td>
                        <td className="py-2.5"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle[a.status] || 'bg-gray-100 text-gray-600'}`}>{a.status}</span></td>
                        <td className="py-2.5 text-gray-400 text-xs max-w-32 truncate">{a.work_notes || '-'}</td>
                        <td className="py-2.5">
                          <div className="flex gap-1">
                            <button onClick={() => { setEditingAtt(a); setAttForm({ ...a }); setShowAttModal(true); }} className="w-6 h-6 bg-blue-50 rounded flex items-center justify-center text-blue-500"><Edit2 size={10} /></button>
                            <button onClick={() => deleteAtt(a.id!)} disabled={deleting === a.id} className="w-6 h-6 bg-red-50 rounded flex items-center justify-center text-red-400">{deleting === a.id ? <Loader size={10} className="animate-spin" /> : <Trash2 size={10} />}</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot><tr className="border-t-2 border-gray-200 bg-violet-50">
                  <td colSpan={5} className="py-2.5 px-2 font-bold text-gray-700 text-sm">Monthly Total</td>
                  <td className="py-2.5 font-bold text-violet-700 text-sm">{totalNetHours}h</td>
                  <td className="py-2.5 font-bold text-green-600 text-sm">{presentDays} days</td>
                  <td colSpan={2} className="py-2.5 font-bold text-violet-700 text-sm">₹{monthSalary.toLocaleString('en-IN')}</td>
                </tr></tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CALENDAR VIEW */}
      {tab === 'monthly' && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4">Calendar — {MONTHS[selectedMonth]} {selectedYear}</h3>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d} className="text-center text-xs font-bold text-gray-400 py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const rec = attByDate[dateStr];
              const dow = new Date(dateStr).getDay();
              const isWeekend = dow === 0 || dow === 6;
              const isToday = dateStr === today.toISOString().split('T')[0];
              return (
                <div key={day} className={`rounded-xl p-2 min-h-16 border transition-all cursor-pointer hover:shadow-md ${isToday ? 'border-violet-400 bg-violet-50' : 'border-gray-100'} ${isWeekend ? 'bg-gray-50' : 'bg-white'}`}
                  onClick={() => { if (!isWeekend) { setEditingAtt(rec || null); setAttForm(rec ? { ...rec } : { ...emptyAtt, date: dateStr, employee_name: selectedEmp }); setShowAttModal(true); } }}>
                  <p className={`text-xs font-bold mb-1 ${isToday ? 'text-violet-600' : isWeekend ? 'text-gray-300' : 'text-gray-600'}`}>{day}</p>
                  {rec ? (
                    <div>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${statusStyle[rec.status] || 'bg-gray-100 text-gray-600'}`}>{rec.status}</span>
                      <p className="text-[10px] font-bold text-violet-600 mt-0.5">{rec.net_hours}h</p>
                    </div>
                  ) : isWeekend ? <p className="text-[9px] text-gray-300">Off</p>
                  : <p className="text-[9px] text-gray-300">Click to add</p>}
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex gap-4 mt-4 flex-wrap">
            {Object.entries(statusStyle).map(([s, cls]) => <div key={s} className="flex items-center gap-1.5"><span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cls}`}>{s}</span></div>)}
            <div className="flex items-center gap-1.5 text-xs text-gray-400">Click any day to add/edit</div>
          </div>
        </div>
      )}

      {/* WORK TASKS */}
      {tab === 'tasks' && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h3 className="font-bold text-gray-800">Work Tasks — {MONTHS[selectedMonth]} {selectedYear} <span className="text-violet-500">({monthTasks.length})</span></h3>
            <button onClick={() => { setEditingTask(null); setTaskForm({ ...emptyTask, employee_name: selectedEmp }); setShowTaskModal(true); }} className="flex items-center gap-1 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700"><Plus size={13} /> Add Task</button>
          </div>
          {monthTasks.length === 0 ? <div className="text-center py-12 text-gray-400"><Briefcase size={36} className="mx-auto mb-2 opacity-30" /><p>No tasks for this month</p></div>
          : (
            <div className="space-y-3">
              {monthTasks.map(t => (
                <div key={t.id} className="flex items-start justify-between p-4 border border-gray-100 rounded-xl hover:bg-gray-50 gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600 flex-shrink-0"><Briefcase size={14} /></div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{t.task_title}</p>
                      <p className="text-xs text-gray-400">{t.date} · {t.hours_spent}h spent</p>
                      {t.description && <p className="text-xs text-gray-500 mt-1">{t.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${taskStatusStyle[t.status] || 'bg-gray-100 text-gray-600'}`}>{t.status}</span>
                    <button onClick={() => { setEditingTask(t); setTaskForm({ ...t }); setShowTaskModal(true); }} className="w-6 h-6 bg-blue-50 rounded flex items-center justify-center text-blue-500"><Edit2 size={10} /></button>
                    <button onClick={() => deleteTask(t.id!)} disabled={deleting === t.id} className="w-6 h-6 bg-red-50 rounded flex items-center justify-center text-red-400">{deleting === t.id ? <Loader size={10} className="animate-spin" /> : <Trash2 size={10} />}</button>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between p-3 bg-violet-50 rounded-xl">
                <span className="text-sm font-bold text-gray-700">Total Task Hours</span>
                <span className="font-bold text-violet-600">{totalTaskHours}h</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SALARY LEDGER */}
      {tab === 'ledger' && (
        <div className="space-y-4">

          {/* Month-by-month ledger with payments */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h3 className="font-bold text-gray-800">Salary & Payment Ledger — {selectedEmp}</h3>
              <button onClick={() => setShowPaymentModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700">
                <Plus size={13} /> Record Payment
              </button>
            </div>

            {/* Running balance table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
                    <th className="pb-2 text-left">Month</th>
                    <th className="pb-2 text-right">Net Hours</th>
                    <th className="pb-2 text-right">Earned</th>
                    <th className="pb-2 text-right">Paid</th>
                    <th className="pb-2 text-right">Balance</th>
                    <th className="pb-2 text-right">Cumulative Due</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let cumBalance = 0;
                    return MONTHS.map((month, mi) => {
                      const mAtt = attendance.filter(a => {
                        const d = new Date(a.date);
                        return d.getMonth() === mi && d.getFullYear() === selectedYear;
                      });
                      const mHours = mAtt.reduce((s, a) => s + (a.net_hours || 0), 0);
                      const mEarned = calcSalary(mHours, hourlyRate, rateMode);
                      const mPaid = payments
                        .filter(p => p.month === month && p.year === selectedYear)
                        .reduce((s, p) => s + p.amount, 0);
                      if (mHours === 0 && mPaid === 0) return null;
                      const mBalance = mEarned - mPaid;
                      cumBalance += mBalance;
                      const isCurrent = mi === selectedMonth;
                      return (
                        <tr key={month} className={`border-b border-gray-50 hover:bg-gray-50 ${isCurrent ? 'bg-violet-50' : ''}`}>
                          <td className="py-2.5 font-medium">
                            <button onClick={() => { setSelectedMonth(mi); }}
                              className="hover:text-violet-600 hover:underline text-left">
                              {month} {selectedYear}
                            </button>
                          </td>
                          <td className="py-2.5 text-right text-gray-600">{mHours}h</td>
                          <td className="py-2.5 text-right font-semibold">₹{mEarned.toLocaleString('en-IN')}</td>
                          <td className="py-2.5 text-right text-green-600 font-semibold">₹{mPaid.toLocaleString('en-IN')}</td>
                          <td className={`py-2.5 text-right font-bold ${mBalance > 0 ? 'text-red-500' : mBalance < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                            {mBalance > 0 ? `₹${mBalance.toLocaleString('en-IN')} due` : mBalance < 0 ? `₹${Math.abs(mBalance).toLocaleString('en-IN')} advance` : '✓ Settled'}
                          </td>
                          <td className={`py-2.5 text-right font-bold ${cumBalance > 0 ? 'text-red-500' : 'text-green-600'}`}>
                            {cumBalance > 0 ? `₹${cumBalance.toLocaleString('en-IN')}` : cumBalance < 0 ? `+₹${Math.abs(cumBalance).toLocaleString('en-IN')}` : '₹0'}
                          </td>
                        </tr>
                      );
                    }).filter(Boolean);
                  })()}
                </tbody>
                <tfoot>
                  {(() => {
                    const totalEarned = MONTHS.reduce((s, month, mi) => {
                      const mAtt = attendance.filter(a => new Date(a.date).getMonth() === mi && new Date(a.date).getFullYear() === selectedYear);
                      return s + calcSalary(mAtt.reduce((s2,a) => s2+(a.net_hours||0),0), hourlyRate, rateMode);
                    }, 0);
                    const totalPaid = payments.filter(p => p.year === selectedYear).reduce((s,p)=>s+p.amount,0);
                    const totalDue = totalEarned - totalPaid;
                    return (
                      <tr className="border-t-2 border-gray-300 bg-gray-50">
                        <td className="py-3 font-bold text-gray-800">Annual Total</td>
                        <td className="py-3 text-right font-bold">{attendance.filter(a=>new Date(a.date).getFullYear()===selectedYear).reduce((s,a)=>s+(a.net_hours||0),0)}h</td>
                        <td className="py-3 text-right font-bold">₹{totalEarned.toLocaleString('en-IN')}</td>
                        <td className="py-3 text-right font-bold text-green-600">₹{totalPaid.toLocaleString('en-IN')}</td>
                        <td className={`py-3 text-right font-bold text-lg ${totalDue > 0 ? 'text-red-500' : 'text-green-600'}`}>
                          {totalDue > 0 ? `₹${totalDue.toLocaleString('en-IN')} DUE` : `₹${Math.abs(totalDue).toLocaleString('en-IN')} ADVANCE`}
                        </td>
                        <td />
                      </tr>
                    );
                  })()}
                </tfoot>
              </table>
            </div>
          </div>

          {/* Payment history for selected month */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h3 className="font-bold text-gray-800">Payment History — {MONTHS[selectedMonth]} {selectedYear}</h3>
              <span className="text-xs text-gray-400">Click month name above to switch</span>
            </div>
            {payments.filter(p => p.month === MONTHS[selectedMonth] && p.year === selectedYear).length === 0 ? (
              <p className="text-center text-gray-400 py-6 text-sm">No payments recorded for {MONTHS[selectedMonth]}</p>
            ) : (
              <div className="space-y-2">
                {payments.filter(p => p.month === MONTHS[selectedMonth] && p.year === selectedYear)
                  .sort((a,b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime())
                  .map((p, i) => (
                  <div key={p.id} className={`flex items-center justify-between p-3 rounded-xl ${p.amount < 0 ? 'bg-orange-50' : 'bg-green-50'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${p.amount < 0 ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>{p.amount < 0 ? '↩' : i+1}</div>
                      <div>
                        <p className={`text-sm font-semibold ${p.amount < 0 ? 'text-orange-600' : 'text-gray-800'}`}>{p.amount < 0 ? `↩ ₹${Math.abs(p.amount).toLocaleString('en-IN')} returned` : `₹${p.amount.toLocaleString('en-IN')}`}</p>
                        <p className="text-xs text-gray-400">{p.payment_date} {p.note ? `· ${p.note}` : ''}</p>
                      </div>
                    </div>
                    <button onClick={() => deletePayment(p.id!)} disabled={deleting === p.id}
                      className="w-7 h-7 bg-red-50 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-100">
                      {deleting === p.id ? <Loader size={11} className="animate-spin" /> : <Trash2 size={11} />}
                    </button>
                  </div>
                ))}
                {/* Month summary */}
                {(() => {
                  const mAtt = attendance.filter(a => { const d = new Date(a.date); return d.getMonth()===selectedMonth && d.getFullYear()===selectedYear; });
                  const mEarned = calcSalary(mAtt.reduce((s,a)=>s+(a.net_hours||0),0), hourlyRate, rateMode);
                  const mPaid = payments.filter(p=>p.month===MONTHS[selectedMonth]&&p.year===selectedYear).reduce((s,p)=>s+p.amount,0);
                  const mBal = mEarned - mPaid;
                  return (
                    <div className="mt-3 p-3 bg-violet-50 rounded-xl grid grid-cols-3 gap-3 text-center">
                      <div><p className="text-xs text-gray-400">Earned</p><p className="font-bold text-gray-800">₹{mEarned.toLocaleString('en-IN')}</p></div>
                      <div><p className="text-xs text-gray-400">Paid</p><p className="font-bold text-green-600">₹{mPaid.toLocaleString('en-IN')}</p></div>
                      <div><p className="text-xs text-gray-400">{mBal >= 0 ? 'Balance Due' : 'Advance'}</p><p className={`font-bold ${mBal > 0 ? 'text-red-500' : 'text-green-600'}`}>₹{Math.abs(mBal).toLocaleString('en-IN')}</p></div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Salary card */}
          <div className="bg-gradient-to-br from-violet-600 to-indigo-600 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-violet-200 text-sm">Current Month Salary</p>
                <p className="text-white font-bold text-lg">{MONTHS[selectedMonth]} {selectedYear}</p>
              </div>
              <IndianRupee size={32} className="text-violet-300" />
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div><p className="text-violet-300 text-xs">Days Present</p><p className="text-white font-bold text-xl">{presentDays}</p></div>
              <div><p className="text-violet-300 text-xs">Total Hours</p><p className="text-white font-bold text-xl">{totalNetHours}h</p></div>
              <div><p className="text-violet-300 text-xs">{rateMode === 'per_8hr' ? 'Daily Rate' : 'Rate/Hour'}</p><p className="text-white font-bold text-xl">₹{hourlyRate}</p></div>
            </div>
            <div className="bg-white/20 rounded-xl p-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-violet-200">
                  {rateMode === "per_8hr" ? `Gross (${totalNetHours}h ÷ 8 × ₹${hourlyRate})` : `Gross (${totalNetHours}h × ₹${hourlyRate})`}
                </span>
                <span className="font-bold">₹{monthSalary.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-violet-200">Paid This Month</span>
                <span className="font-bold text-green-300">₹{payments.filter(p=>p.month===MONTHS[selectedMonth]&&p.year===selectedYear).reduce((s,p)=>s+p.amount,0).toLocaleString('en-IN')}</span>
              </div>
              <div className="border-t border-white/30 pt-2 flex justify-between font-bold text-lg">
                <span>Balance Due</span>
                <span>₹{(monthSalary - payments.filter(p=>p.month===MONTHS[selectedMonth]&&p.year===selectedYear).reduce((s,p)=>s+p.amount,0)).toLocaleString('en-IN')}</span>
              </div>
            </div>
            <button onClick={exportPDF} className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 bg-white text-violet-700 rounded-xl text-sm font-bold hover:bg-violet-50">
              <Download size={15} /> Download Salary Slip PDF
            </button>
          </div>
        </div>
      )}

            {/* DOCUMENTS TAB */}
      {tab === 'documents' && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h3 className="font-bold text-gray-800">Documents — {selectedEmp} <span className="text-violet-500">({docs.length})</span></h3>
            <button onClick={() => setShowDocModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700">
              <Plus size={13} /> Upload Document
            </button>
          </div>
          {docs.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-5xl mb-3">📁</div>
              <p className="font-medium">No documents uploaded yet</p>
              <p className="text-sm mt-1">Upload Aadhar, PAN, contracts, certificates etc.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {docs.map((doc: any) => (
                <div key={doc.id} className="flex items-start gap-3 p-4 border border-gray-100 rounded-xl hover:shadow-md transition-shadow">
                  <div className="text-3xl flex-shrink-0">{getFileIcon(doc.file_name)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{doc.doc_name}</p>
                    <p className="text-xs text-gray-400">{doc.doc_type} · {doc.file_size}</p>
                    <p className="text-xs text-gray-400">{doc.file_name}</p>
                    {doc.notes && <p className="text-xs text-gray-500 italic mt-1">"{doc.notes}"</p>}
                    <p className="text-xs text-gray-400">{new Date(doc.created_at).toLocaleDateString('en-IN')}</p>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <a href={doc.file_url} target="_blank" rel="noreferrer"
                      className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center text-blue-500 hover:bg-blue-100" title="View">
                      <Eye size={13}/>
                    </a>
                    <a href={doc.file_url} download={doc.file_name}
                      className="w-7 h-7 bg-green-50 rounded-lg flex items-center justify-center text-green-500 hover:bg-green-100" title="Download">
                      <Download size={13}/>
                    </a>
                    <button onClick={() => deleteDoc(doc.id, doc.file_url)}
                      className="w-7 h-7 bg-red-50 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-100">
                      <Trash2 size={11}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DOCUMENT UPLOAD MODAL */}
      <AnimatePresence>{showDocModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowDocModal(false); }}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">📁 Upload Document — {selectedEmp}</h2>
              <button onClick={() => setShowDocModal(false)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"><X size={14}/></button>
            </div>
            <div className="p-5 space-y-3">
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Document Name *</label>
              <input value={docForm.doc_name} onChange={e => setDocForm({ ...docForm, doc_name: e.target.value })}
                placeholder="e.g. Aadhar Card - Front" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"/></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Document Type</label>
              <select value={docForm.doc_type} onChange={e => setDocForm({ ...docForm, doc_type: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200">
                {docTypes.map(t => <option key={t}>{t}</option>)}
              </select></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Upload File * (PDF, JPG, PNG)</label>
              <div className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${docFile ? 'border-violet-400 bg-violet-50' : 'border-gray-200 hover:border-violet-300'}`}
                onClick={() => document.getElementById('doc-file-input')?.click()}>
                <input id="doc-file-input" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden"
                  onChange={e => setDocFile(e.target.files?.[0] || null)}/>
                {docFile ? (
                  <div>
                    <p className="text-2xl mb-1">{getFileIcon(docFile.name)}</p>
                    <p className="text-sm font-medium text-violet-700">{docFile.name}</p>
                    <p className="text-xs text-gray-400">{(docFile.size/1024).toFixed(0)} KB</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-3xl mb-1">📎</p>
                    <p className="text-sm text-gray-500">Click to select file</p>
                    <p className="text-xs text-gray-400">PDF, JPG, PNG supported</p>
                  </div>
                )}
              </div></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Notes (optional)</label>
              <input value={docForm.notes} onChange={e => setDocForm({ ...docForm, notes: e.target.value })}
                placeholder="e.g. Original verified" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"/></div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-100">
              <button onClick={() => setShowDocModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600">Cancel</button>
              <button onClick={uploadDoc} disabled={uploadingDoc || !docFile || !docForm.doc_name}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-60">
                {uploadingDoc && <Loader size={13} className="animate-spin"/>}
                {uploadingDoc ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      {/* ATTENDANCE MODAL */}
      <AnimatePresence>{showAttModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowAttModal(false); }}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">{editingAtt ? 'Edit Attendance' : 'Mark Attendance'}</h2>
              <button onClick={() => setShowAttModal(false)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"><X size={14} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
              <input type="date" value={attForm.date} onChange={e => setAttForm({ ...attForm, date: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Clock In</label>
                <input type="time" value={attForm.clock_in} onChange={e => setAttForm(calcHours({ ...attForm, clock_in: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" /></div>
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Clock Out</label>
                <input type="time" value={attForm.clock_out} onChange={e => setAttForm(calcHours({ ...attForm, clock_out: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Break (hrs)</label>
                <input type="number" step="0.5" value={attForm.break_hours} onChange={e => setAttForm(calcHours({ ...attForm, break_hours: Number(e.target.value) }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" /></div>
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Total hrs</label>
                <input type="number" step="0.5" value={attForm.total_hours} readOnly className="w-full border border-gray-100 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-400" /></div>
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Net hrs</label>
                <input type="number" step="0.5" value={attForm.net_hours} readOnly className="w-full border border-gray-100 bg-violet-50 rounded-lg px-3 py-2 text-sm font-bold text-violet-600" /></div>
              </div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select value={attForm.status} onChange={e => setAttForm({ ...attForm, status: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                {['Present','Absent','Half Day','Holiday','Work From Home'].map(s => <option key={s}>{s}</option>)}
              </select></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Work Notes</label>
              <input value={attForm.work_notes} onChange={e => setAttForm({ ...attForm, work_notes: e.target.value })} placeholder="e.g. Worked on project X..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" /></div>
              {attForm.net_hours > 0 && <div className="p-3 bg-violet-50 rounded-xl text-sm"><span className="text-gray-500">Estimated earnings: </span><span className="font-bold text-violet-600">₹{Math.round(attForm.net_hours * hourlyRate).toLocaleString('en-IN')}</span></div>}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-100">
              <button onClick={() => setShowAttModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={saveAtt} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-60">{saving && <Loader size={13} className="animate-spin" />}{saving ? 'Saving...' : editingAtt ? 'Update' : 'Save'}</button>
            </div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      {/* TASK MODAL */}
      <AnimatePresence>{showTaskModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowTaskModal(false); }}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">{editingTask ? 'Edit Task' : 'Add Work Task'}</h2>
              <button onClick={() => setShowTaskModal(false)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"><X size={14} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
              <input type="date" value={taskForm.date} onChange={e => setTaskForm({ ...taskForm, date: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" /></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Task Title *</label>
              <input value={taskForm.task_title} onChange={e => setTaskForm({ ...taskForm, task_title: e.target.value })} placeholder="e.g. Client meeting, Report preparation" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" /></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
              <input value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} placeholder="Task details..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Hours Spent</label>
                <input type="number" step="0.5" value={taskForm.hours_spent} onChange={e => setTaskForm({ ...taskForm, hours_spent: Number(e.target.value) })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" /></div>
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                <select value={taskForm.status} onChange={e => setTaskForm({ ...taskForm, status: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                  {['Done','In Progress','Pending'].map(s => <option key={s}>{s}</option>)}
                </select></div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-100">
              <button onClick={() => setShowTaskModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={saveTask} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-60">{saving && <Loader size={13} className="animate-spin" />}{saving ? 'Saving...' : editingTask ? 'Update' : 'Add Task'}</button>
            </div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      {/* PAYMENT MODAL */}
      <AnimatePresence>{showPaymentModal && (
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={e=>{if(e.target===e.currentTarget)setShowPaymentModal(false);}}>
          <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.9,opacity:0}} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">{payType === 'return' ? '↩ Record Return' : '💰 Record Payment'} — {selectedEmp}</h2>
              <button onClick={()=>setShowPaymentModal(false)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"><X size={14}/></button>
            </div>
            <div className="p-5 space-y-3">
              {/* Type Toggle */}
              <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
                <button onClick={()=>setPayType('payment')} className={"flex-1 py-2 rounded-lg text-xs font-semibold transition-colors " + (payType==='payment'?"bg-violet-600 text-white shadow":"text-gray-500 hover:text-gray-700")}>
                  💰 Payment Given
                </button>
                <button onClick={()=>setPayType('return')} className={"flex-1 py-2 rounded-lg text-xs font-semibold transition-colors " + (payType==='return'?"bg-orange-500 text-white shadow":"text-gray-500 hover:text-gray-700")}>
                  ↩ Advance Returned
                </button>
              </div>
              {payType === 'return' && (
                <div className="p-2.5 bg-orange-50 border border-orange-200 rounded-xl text-xs text-orange-700">
                  Employee returned money to you. This will <strong>reduce</strong> the total paid amount.
                </div>
              )}
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Payment Date</label>
              <input type="date" value={payForm.payment_date} onChange={e=>setPayForm({...payForm,payment_date:e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"/></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Amount (₹)</label>
              <input type="number" value={payForm.amount||''} onChange={e=>setPayForm({...payForm,amount:Number(e.target.value)})} placeholder="e.g. 5000" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-700 mb-1">For Month</label>
                <select value={payForm.month} onChange={e=>setPayForm({...payForm,month:e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                  {MONTHS.map(m=><option key={m}>{m}</option>)}
                </select></div>
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Year</label>
                <input type="number" value={payForm.year} onChange={e=>setPayForm({...payForm,year:Number(e.target.value)})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"/></div>
              </div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Note (optional)</label>
              <input value={payForm.note} onChange={e=>setPayForm({...payForm,note:e.target.value})} placeholder="e.g. Advance, Part payment..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"/></div>
              {/* Quick amount presets */}
              <div><p className="text-xs text-gray-400 mb-1.5">Quick amounts:</p>
              <div className="flex flex-wrap gap-1.5">
                {[500,1000,2000,3000,5000,7000,10000].map(a=>(
                  <button key={a} onClick={()=>setPayForm({...payForm,amount:a})} className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${payForm.amount===a?'bg-violet-600 text-white':'bg-gray-100 text-gray-600 hover:bg-violet-100 hover:text-violet-700'}`}>₹{a.toLocaleString('en-IN')}</button>
                ))}
              </div></div>
              {/* Summary preview */}
              {payForm.amount > 0 && (() => {
                const mAtt = attendance.filter(a=>{const d=new Date(a.date);return d.getMonth()===MONTHS.indexOf(payForm.month)&&d.getFullYear()===payForm.year;});
                const mEarned = calcSalary(mAtt.reduce((s,a)=>s+(a.net_hours||0),0),hourlyRate,rateMode);
                const mPaid = payments.filter(p=>p.month===payForm.month&&p.year===payForm.year).reduce((s,p)=>s+p.amount,0);
                const afterPay = mEarned - mPaid - payForm.amount;
                return (
                  <div className="p-3 bg-violet-50 rounded-xl text-xs space-y-1">
                    <div className="flex justify-between"><span className="text-gray-500">Earned {payForm.month}:</span><span className="font-bold">₹{mEarned.toLocaleString('en-IN')}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Already paid:</span><span className="font-bold text-green-600">₹{mPaid.toLocaleString('en-IN')}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">This payment:</span><span className="font-bold text-violet-600">₹{payForm.amount.toLocaleString('en-IN')}</span></div>
                    <div className="border-t border-violet-200 pt-1 flex justify-between"><span className="font-bold text-gray-700">Balance after:</span><span className={`font-bold ${afterPay>0?'text-red-500':'text-green-600'}`}>₹{Math.abs(afterPay).toLocaleString('en-IN')} {afterPay>0?'due':'advance'}</span></div>
                  </div>
                );
              })()}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-100">
              <button onClick={()=>setShowPaymentModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={savePayment} disabled={saving} className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-60 ${payType==='return'?'bg-orange-500 hover:bg-orange-600':'bg-violet-600 hover:bg-violet-700'}`}>{saving&&<Loader size={13} className="animate-spin"/>}{saving?'Saving...':payType==='return'?'Record Return':'Record Payment'}</button>
            </div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>
    </div>
  );
};

export default Attendance;
