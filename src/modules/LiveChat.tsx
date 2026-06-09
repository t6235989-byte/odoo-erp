import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, CheckCircle, Clock, Star, Plus, X, Loader, Send, Phone, Video, MoreHorizontal, Search } from 'lucide-react';
import StatCard from '../components/StatCard';
import { supabase } from '../lib/supabase';

type Conversation = {
  id?: string;
  name: string;
  issue: string;
  status: string;
  unread: number;
  color: string;
  last_time: string;
  created_at?: string;
};

type Message = {
  id?: string;
  conversation_id: string;
  from_role: string;
  text: string;
  created_at?: string;
};

const statusDot: Record<string, string> = {
  active: '#22C55E',
  waiting: '#FBBF24',
  resolved: '#9CA3AF',
};

const emptyConv: Conversation = { name: '', issue: '', status: 'active', unread: 0, color: '#6366F1', last_time: 'now' };

const LiveChat: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [showNewConv, setShowNewConv] = useState(false);
  const [convForm, setConvForm] = useState<Conversation>(emptyConv);
  const [savingConv, setSavingConv] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Fetch conversations ────────────────────────────────────────────────
  const fetchConversations = async () => {
    setLoading(true);
    const { data } = await supabase.from('conversations').select('*').order('created_at', { ascending: false });
    setConversations(data || []);
    if (!selected && data && data.length > 0) setSelected(data[0]);
    setLoading(false);
  };

  // ── Fetch messages for selected conversation ───────────────────────────
  const fetchMessages = async (convId: string) => {
    const { data } = await supabase.from('messages').select('*').eq('conversation_id', convId).order('created_at', { ascending: true });
    setMessages(data || []);
  };

  useEffect(() => { fetchConversations(); }, []);

  useEffect(() => {
    if (selected?.id) {
      fetchMessages(selected.id);
      // Mark as read
      supabase.from('conversations').update({ unread: 0 }).eq('id', selected.id).then(() => fetchConversations());
    }
  }, [selected]);

  // ── Realtime subscription ──────────────────────────────────────────────
  useEffect(() => {
    if (!selected?.id) return;
    const channel = supabase
      .channel('messages-channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selected.id}` },
        (payload) => { setMessages(prev => [...prev, payload.new as Message]); }
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selected?.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // ── Send message ───────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!input.trim() || !selected?.id) return;
    setSending(true);
    const msg = { conversation_id: selected.id, from_role: 'agent', text: input.trim() };
    const { error } = await supabase.from('messages').insert([msg]);
    if (error) showToast('Failed to send: ' + error.message, 'error');
    else {
      setInput('');
      fetchMessages(selected.id);
      // Simulate customer reply after 2 seconds
      setTimeout(async () => {
        const replies = [
          'Thank you so much! That really helps.',
          'Got it, I appreciate your quick response!',
          'That makes sense. I will wait for the update.',
          'Perfect, thanks for clarifying!',
          'Great, I will check that now.',
        ];
        const reply = replies[Math.floor(Math.random() * replies.length)];
        await supabase.from('messages').insert([{ conversation_id: selected.id, from_role: 'user', text: reply }]);
        if (selected?.id) fetchMessages(selected.id);
      }, 2000);
    }
    setSending(false);
  };

  // ── New conversation ───────────────────────────────────────────────────
  const handleNewConv = async () => {
    if (!convForm.name) { showToast('Name is required.', 'error'); return; }
    setSavingConv(true);
    const { data, error } = await supabase.from('conversations').insert([convForm]).select().single();
    if (error) showToast('Failed: ' + error.message, 'error');
    else {
      showToast('Conversation started!', 'success');
      setShowNewConv(false);
      setConvForm(emptyConv);
      await fetchConversations();
      setSelected(data);
    }
    setSavingConv(false);
  };

  const activeCount = conversations.filter(c => c.status === 'active').length;
  const resolvedCount = conversations.filter(c => c.status === 'resolved').length;
  const waitingCount = conversations.filter(c => c.status === 'waiting').length;
  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0);

  const filteredConvs = conversations.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.issue.toLowerCase().includes(search.toLowerCase())
  );

  const colors = ['#7C3AED', '#2563EB', '#DB2777', '#16A34A', '#D97706', '#6366F1'];

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
        <StatCard title="Active Chats" value={loading ? '...' : String(activeCount)} change="+3" positive icon={<MessageCircle size={20} />} color="#6366F1" bg="#E0E7FF" delay={0.05} />
        <StatCard title="Resolved Today" value={loading ? '...' : String(resolvedCount)} change="+12" positive icon={<CheckCircle size={20} />} color="#16A34A" bg="#DCFCE7" delay={0.1} />
        <StatCard title="Waiting" value={loading ? '...' : String(waitingCount)} change="-2" positive={false} icon={<Clock size={20} />} color="#D97706" bg="#FEF3C7" delay={0.15} />
        <StatCard title="Unread Messages" value={loading ? '...' : String(totalUnread)} change="+5" positive={false} icon={<Star size={20} />} color="#DB2777" bg="#FCE7F3" delay={0.2} />
      </div>

      {/* Chat UI */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
        style={{ height: 560 }}>
        <div className="grid h-full" style={{ gridTemplateColumns: '280px 1fr' }}>

          {/* Sidebar */}
          <div className="border-r border-gray-100 flex flex-col">
            <div className="p-3 border-b border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-gray-800 text-sm">Conversations</h3>
                <button onClick={() => setShowNewConv(true)} className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 hover:bg-indigo-200"><Plus size={13} /></button>
              </div>
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-7 pr-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-32 text-gray-400"><Loader size={18} className="animate-spin" /></div>
              ) : filteredConvs.map((c) => (
                <div key={c.id} onClick={() => setSelected(c)}
                  className={`p-3 cursor-pointer border-b border-gray-50 transition-colors ${selected?.id === c.id ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
                  <div className="flex items-start gap-2">
                    <div className="relative flex-shrink-0">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: c.color }}>{c.name[0]}</div>
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white" style={{ background: statusDot[c.status] }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-800 truncate">{c.name}</span>
                        <span className="text-[10px] text-gray-400 flex-shrink-0">{c.last_time}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 truncate">{c.issue}</p>
                    </div>
                    {c.unread > 0 && (
                      <span className="w-4 h-4 bg-indigo-500 text-white rounded-full text-[9px] flex items-center justify-center flex-shrink-0">{c.unread}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chat Area */}
          {selected ? (
            <div className="flex flex-col">
              {/* Chat Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: selected.color }}>{selected.name[0]}</div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{selected.name}</p>
                    <p className="text-[10px] text-gray-400">{selected.issue}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-200"><Phone size={13} /></button>
                  <button className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-200"><Video size={13} /></button>
                  <button onClick={async () => {
                    await supabase.from('conversations').update({ status: 'resolved' }).eq('id', selected.id!);
                    showToast('Conversation resolved!', 'success');
                    fetchConversations();
                    setSelected({ ...selected, status: 'resolved' });
                  }} className="px-2 py-1 bg-green-50 text-green-600 rounded-lg text-[10px] font-medium hover:bg-green-100">✓ Resolve</button>
                  <button className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-200"><MoreHorizontal size={13} /></button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-400 text-sm">No messages yet. Start the conversation!</div>
                ) : messages.map((m, i) => (
                  <div key={m.id || i} className={`flex ${m.from_role === 'agent' ? 'justify-end' : 'justify-start'}`}>
                    <div style={{ maxWidth: '70%' }}>
                      <div className={`px-3 py-2 rounded-xl text-xs leading-relaxed ${m.from_role === 'agent' ? 'bg-indigo-500 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
                        {m.text}
                      </div>
                      <p className={`text-[9px] text-gray-400 mt-0.5 ${m.from_role === 'agent' ? 'text-right' : 'text-left'}`}>
                        {m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'now'}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t border-gray-100 flex gap-2">
                <input value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder="Type a message... (Enter to send)"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                <button onClick={sendMessage} disabled={sending || !input.trim()}
                  className="flex items-center gap-1 px-3 py-2 bg-indigo-500 text-white rounded-xl text-xs font-medium hover:bg-indigo-600 disabled:opacity-50">
                  {sending ? <Loader size={12} className="animate-spin" /> : <Send size={12} />}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center text-gray-400">
              <div className="text-center">
                <MessageCircle size={40} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Select a conversation to start chatting</p>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* New Conversation Modal */}
      <AnimatePresence>
        {showNewConv && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowNewConv(false); }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <h2 className="font-bold text-gray-800">New Conversation</h2>
                <button onClick={() => setShowNewConv(false)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"><X size={14} /></button>
              </div>
              <div className="p-5 space-y-3">
                {[
                  { label: 'Customer Name *', key: 'name', placeholder: 'e.g. John Doe' },
                  { label: 'Issue / Topic', key: 'issue', placeholder: 'e.g. Order enquiry' },
                  { label: 'Time', key: 'last_time', placeholder: 'e.g. just now' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{f.label}</label>
                    <input placeholder={f.placeholder} value={(convForm as any)[f.key]}
                      onChange={e => setConvForm({ ...convForm, [f.key]: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Color</label>
                  <div className="flex gap-2">
                    {colors.map(c => (
                      <button key={c} onClick={() => setConvForm({ ...convForm, color: c })}
                        className={`w-6 h-6 rounded-full transition-transform ${convForm.color === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : ''}`}
                        style={{ background: c }} />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                  <select value={convForm.status} onChange={e => setConvForm({ ...convForm, status: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200">
                    {['active', 'waiting', 'resolved'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 p-5 border-t border-gray-100">
                <button onClick={() => setShowNewConv(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={handleNewConv} disabled={savingConv}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-600 disabled:opacity-60">
                  {savingConv && <Loader size={13} className="animate-spin" />}
                  {savingConv ? 'Starting...' : 'Start Chat'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LiveChat;
