import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, CheckSquare, Clock, Users, Plus, X, Loader, Edit2, Trash2, List, Layout } from 'lucide-react';
import StatCard from '../components/StatCard';
import { supabase } from '../lib/supabase';
import { handleEnterAsTab } from '../lib/formNav';

type Project = {
  id?: string;
  name: string;
  progress: number;
  team_size: number;
  due_date: string;
  color: string;
  created_at?: string;
};

type Task = {
  id?: string;
  project_id?: string;
  title: string;
  stage: string;
  priority: string;
  assignee: string;
  hours_logged: number;
  created_at?: string;
};

const stages = ['Todo', 'In Progress', 'Review', 'Done'];
const priorities = ['Low', 'Medium', 'High'];
const projectColors = ['#7C3AED', '#2563EB', '#16A34A', '#D97706', '#DC2626', '#0891B2'];

const stageStyle: Record<string, { bg: string; dot: string; header: string }> = {
  'Todo':        { bg: '#F9FAFB', dot: '#9CA3AF', header: '#6B7280' },
  'In Progress': { bg: '#EFF6FF', dot: '#3B82F6', header: '#2563EB' },
  'Review':      { bg: '#FEFCE8', dot: '#EAB308', header: '#D97706' },
  'Done':        { bg: '#F0FDF4', dot: '#22C55E', header: '#16A34A' },
};
const prioStyle: Record<string, string> = {
  High: 'bg-red-100 text-red-700',
  Medium: 'bg-yellow-100 text-yellow-700',
  Low: 'bg-green-100 text-green-700',
};

const emptyTask: Task = { title: '', stage: 'Todo', priority: 'Medium', assignee: '', hours_logged: 0 };
const emptyProject: Project = { name: '', progress: 0, team_size: 1, due_date: new Date().toISOString().split('T')[0], color: '#7C3AED' };

const Project: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [taskForm, setTaskForm] = useState<Task>(emptyTask);
  const [projectForm, setProjectForm] = useState<Project>(emptyProject);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [dragTask, setDragTask] = useState<Task | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    setLoading(true);
    const [{ data: p }, { data: t }] = await Promise.all([
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('tasks').select('*').order('created_at', { ascending: false }),
    ]);
    setProjects(p || []);
    setTasks(t || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // ── Stats ──────────────────────────────────────────────────────────────
  const doneTasks = tasks.filter(t => t.stage === 'Done').length;
  const totalHours = tasks.reduce((s, t) => s + (t.hours_logged || 0), 0);
  const teamSize = projects.reduce((s, p) => s + p.team_size, 0);

  // ── Task CRUD ──────────────────────────────────────────────────────────
  const openAddTask = (stage = 'Todo') => { setEditingTask(null); setTaskForm({ ...emptyTask, stage }); setShowTaskModal(true); };
  const openEditTask = (t: Task) => { setEditingTask(t); setTaskForm({ ...t }); setShowTaskModal(true); };
  const closeTaskModal = () => { setShowTaskModal(false); setEditingTask(null); };

  const handleSaveTask = async () => {
    if (!taskForm.title) { showToast('Task title is required.', 'error'); return; }
    setSaving(true);
    if (editingTask?.id) {
      const { error } = await supabase.from('tasks').update({ ...taskForm }).eq('id', editingTask.id);
      if (error) showToast('Update failed: ' + error.message, 'error');
      else { showToast('Task updated!', 'success'); closeTaskModal(); fetchData(); }
    } else {
      const { error } = await supabase.from('tasks').insert([taskForm]);
      if (error) showToast('Failed: ' + error.message, 'error');
      else { showToast('Task added!', 'success'); closeTaskModal(); fetchData(); }
    }
    setSaving(false);
  };

  const handleDeleteTask = async (id: string) => {
    setDeleting(id);
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) showToast('Delete failed: ' + error.message, 'error');
    else { showToast('Task deleted.', 'success'); fetchData(); }
    setDeleting(null);
  };

  // ── Project CRUD ───────────────────────────────────────────────────────
  const openAddProject = () => { setEditingProject(null); setProjectForm(emptyProject); setShowProjectModal(true); };
  const openEditProject = (p: Project) => { setEditingProject(p); setProjectForm({ ...p }); setShowProjectModal(true); };
  const closeProjectModal = () => { setShowProjectModal(false); setEditingProject(null); };

  const handleSaveProject = async () => {
    if (!projectForm.name) { showToast('Project name is required.', 'error'); return; }
    setSaving(true);
    if (editingProject?.id) {
      const { error } = await supabase.from('projects').update({ ...projectForm }).eq('id', editingProject.id);
      if (error) showToast('Update failed: ' + error.message, 'error');
      else { showToast('Project updated!', 'success'); closeProjectModal(); fetchData(); }
    } else {
      const { error } = await supabase.from('projects').insert([projectForm]);
      if (error) showToast('Failed: ' + error.message, 'error');
      else { showToast('Project added!', 'success'); closeProjectModal(); fetchData(); }
    }
    setSaving(false);
  };

  const handleDeleteProject = async (id: string) => {
    setDeleting(id);
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) showToast('Delete failed: ' + error.message, 'error');
    else { showToast('Project deleted.', 'success'); fetchData(); }
    setDeleting(null);
  };

  // ── Drag & Drop ────────────────────────────────────────────────────────
  const handleDrop = async (stage: string) => {
    if (!dragTask || dragTask.stage === stage) { setDragTask(null); return; }
    const { error } = await supabase.from('tasks').update({ stage }).eq('id', dragTask.id!);
    if (!error) { showToast(`Moved to ${stage}!`, 'success'); fetchData(); }
    setDragTask(null);
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
        <StatCard title="Active Projects" value={loading ? '...' : String(projects.length)} change="+2" positive icon={<FolderOpen size={20} />} color="#7C3AED" bg="#EDE9FE" delay={0.05} />
        <StatCard title="Tasks Done" value={loading ? '...' : String(doneTasks)} change="+42" positive icon={<CheckSquare size={20} />} color="#16A34A" bg="#DCFCE7" delay={0.1} />
        <StatCard title="Hours Logged" value={loading ? '...' : String(totalHours)} change="+8.2%" positive icon={<Clock size={20} />} color="#2563EB" bg="#DBEAFE" delay={0.15} />
        <StatCard title="Team Members" value={loading ? '...' : String(teamSize)} change="+4" positive icon={<Users size={20} />} color="#D97706" bg="#FEF3C7" delay={0.2} />
      </div>

      {/* Projects Grid */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
        className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800">Active Projects</h3>
          <button onClick={openAddProject} className="flex items-center gap-1 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700">
            <Plus size={14} /> New Project
          </button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-gray-400"><Loader size={20} className="animate-spin mr-2" /> Loading...</div>
        ) : projects.length === 0 ? (
          <p className="text-center text-gray-400 py-8">No projects yet. Click "New Project" to start!</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {projects.map((p, i) => (
              <div key={p.id} className="p-4 border border-gray-100 rounded-xl hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-3 h-3 rounded-full" style={{ background: p.color }} />
                  <div className="flex gap-1">
                    <button onClick={() => openEditProject(p)} className="w-6 h-6 bg-gray-50 rounded flex items-center justify-center text-gray-400 hover:text-blue-500"><Edit2 size={11} /></button>
                    <button onClick={() => handleDeleteProject(p.id!)} disabled={deleting === p.id} className="w-6 h-6 bg-gray-50 rounded flex items-center justify-center text-gray-400 hover:text-red-500">
                      {deleting === p.id ? <Loader size={11} className="animate-spin" /> : <Trash2 size={11} />}
                    </button>
                  </div>
                </div>
                <h4 className="font-semibold text-gray-800 text-sm mb-1">{p.name}</h4>
                <p className="text-xs text-gray-400 mb-3">Due: {p.due_date} · {p.team_size} members</p>
                <div className="w-full bg-gray-100 rounded-full h-2 mb-1">
                  <div className="h-2 rounded-full transition-all" style={{ width: `${p.progress}%`, background: p.color }} />
                </div>
                <p className="text-xs font-bold" style={{ color: p.color }}>{p.progress}% complete</p>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Kanban / List */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="font-bold text-gray-800">Task Board</h3>
          <div className="flex gap-2">
            <button onClick={() => setView('kanban')} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${view === 'kanban' ? 'bg-violet-100 text-violet-600' : 'bg-gray-100 text-gray-500'}`}><Layout size={15} /></button>
            <button onClick={() => setView('list')} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${view === 'list' ? 'bg-violet-100 text-violet-600' : 'bg-gray-100 text-gray-500'}`}><List size={15} /></button>
            <button onClick={() => openAddTask()} className="flex items-center gap-1 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700">
              <Plus size={14} /> Add Task
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400"><Loader size={20} className="animate-spin mr-2" /> Loading tasks...</div>
        ) : view === 'kanban' ? (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {stages.map(stage => {
              const st = stageStyle[stage];
              const stageTasks = tasks.filter(t => t.stage === stage);
              return (
                <div key={stage}
                  className="rounded-xl p-3 min-h-48"
                  style={{ background: st.bg }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => handleDrop(stage)}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2 h-2 rounded-full" style={{ background: st.dot }} />
                    <span className="text-xs font-bold" style={{ color: st.header }}>{stage}</span>
                    <span className="ml-auto text-xs bg-white px-2 py-0.5 rounded-full text-gray-500">{stageTasks.length}</span>
                  </div>
                  {stageTasks.map(t => (
                    <div key={t.id} draggable
                      onDragStart={() => setDragTask(t)}
                      className="bg-white rounded-lg p-3 mb-2 shadow-sm border border-gray-100 cursor-grab active:cursor-grabbing">
                      <p className="text-xs font-semibold text-gray-800 mb-1">{t.title}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${prioStyle[t.priority]}`}>{t.priority}</span>
                        <div className="flex items-center gap-1">
                          {t.hours_logged > 0 && <span className="text-[10px] text-gray-400">{t.hours_logged}h</span>}
                          <div className="w-5 h-5 rounded-full bg-violet-100 flex items-center justify-center text-[9px] font-bold text-violet-600">{t.assignee?.[0] || '?'}</div>
                          <button onClick={() => openEditTask(t)} className="w-5 h-5 rounded flex items-center justify-center text-gray-300 hover:text-blue-400"><Edit2 size={10} /></button>
                          <button onClick={() => handleDeleteTask(t.id!)} className="w-5 h-5 rounded flex items-center justify-center text-gray-300 hover:text-red-400"><Trash2 size={10} /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => openAddTask(stage)} className="w-full mt-1 py-1.5 text-xs text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1 rounded-lg hover:bg-white transition-colors">
                    <Plus size={11} /> Add task
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
                  <th className="pb-2 text-left font-medium">Task</th>
                  <th className="pb-2 text-left font-medium">Stage</th>
                  <th className="pb-2 text-left font-medium">Priority</th>
                  <th className="pb-2 text-left font-medium">Assignee</th>
                  <th className="pb-2 text-left font-medium">Hours</th>
                  <th className="pb-2 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(t => (
                  <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 font-medium text-gray-800">{t.title}</td>
                    <td className="py-2.5">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: stageStyle[t.stage]?.bg, color: stageStyle[t.stage]?.header }}>{t.stage}</span>
                    </td>
                    <td className="py-2.5"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${prioStyle[t.priority]}`}>{t.priority}</span></td>
                    <td className="py-2.5 text-gray-600">{t.assignee}</td>
                    <td className="py-2.5 text-gray-600">{t.hours_logged}h</td>
                    <td className="py-2.5">
                      <div className="flex gap-1">
                        <button onClick={() => openEditTask(t)} className="w-6 h-6 bg-blue-50 rounded flex items-center justify-center text-blue-500 hover:bg-blue-100"><Edit2 size={11} /></button>
                        <button onClick={() => handleDeleteTask(t.id!)} disabled={deleting === t.id} className="w-6 h-6 bg-red-50 rounded flex items-center justify-center text-red-400 hover:bg-red-100">
                          {deleting === t.id ? <Loader size={11} className="animate-spin" /> : <Trash2 size={11} />}
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

      {/* Task Modal */}
      <AnimatePresence>
        {showTaskModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onKeyDown={handleEnterAsTab}
            onClick={e => { if (e.target === e.currentTarget) closeTaskModal(); }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800">{editingTask ? 'Edit Task' : 'Add New Task'}</h2>
                <button onClick={closeTaskModal} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"><X size={16} /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Task Title *</label>
                  <input value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })}
                    placeholder="e.g. Design homepage" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assignee</label>
                  <input value={taskForm.assignee} onChange={e => setTaskForm({ ...taskForm, assignee: e.target.value })}
                    placeholder="e.g. Alice" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hours Logged</label>
                  <input type="number" value={taskForm.hours_logged} onChange={e => setTaskForm({ ...taskForm, hours_logged: Number(e.target.value) })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
                    <select value={taskForm.stage} onChange={e => setTaskForm({ ...taskForm, stage: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200">
                      {stages.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <select value={taskForm.priority} onChange={e => setTaskForm({ ...taskForm, priority: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200">
                      {priorities.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
                <button onClick={closeTaskModal} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={handleSaveTask} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-60">
                  {saving && <Loader size={14} className="animate-spin" />}
                  {saving ? 'Saving...' : editingTask ? 'Update Task' : 'Add Task'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Project Modal */}
      <AnimatePresence>
        {showProjectModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onKeyDown={handleEnterAsTab}
            onClick={e => { if (e.target === e.currentTarget) closeProjectModal(); }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800">{editingProject ? 'Edit Project' : 'New Project'}</h2>
                <button onClick={closeProjectModal} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"><X size={16} /></button>
              </div>
              <div className="p-6 space-y-4">
                {[
                  { label: 'Project Name *', key: 'name', type: 'text', placeholder: 'e.g. Website Redesign' },
                  { label: 'Progress (%)', key: 'progress', type: 'number', placeholder: '0' },
                  { label: 'Team Size', key: 'team_size', type: 'number', placeholder: '3' },
                  { label: 'Due Date', key: 'due_date', type: 'date', placeholder: '' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                    <input type={f.type} placeholder={f.placeholder} value={(projectForm as any)[f.key]}
                      onChange={e => setProjectForm({ ...projectForm, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" />
                  </div>
                ))}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                  <div className="flex gap-2">
                    {projectColors.map(c => (
                      <button key={c} onClick={() => setProjectForm({ ...projectForm, color: c })}
                        className={`w-7 h-7 rounded-full transition-transform ${projectForm.color === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : ''}`}
                        style={{ background: c }} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
                <button onClick={closeProjectModal} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={handleSaveProject} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-60">
                  {saving && <Loader size={14} className="animate-spin" />}
                  {saving ? 'Saving...' : editingProject ? 'Update' : 'Create Project'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Project;
