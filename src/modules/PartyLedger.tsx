import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, TrendingUp, TrendingDown, IndianRupee, Plus, X, Loader, Edit2, Trash2, Download, ChevronLeft } from 'lucide-react';
import StatCard from '../components/StatCard';
import { supabase } from '../lib/supabase';
import { formatDate } from '../utils/cn';

type Party = { id?: string; name: string; phone: string; email: string; address: string; party_type: string; gstin?: string; };
type Txn = { id?: string; party_id?: string; party_name: string; transaction_date: string; type: string; amount: number; description: string; reference: string; };

// Customer-direction types: Sale increases what they owe YOU (Dr).
// Vendor-direction types: Purchase Bill increases what YOU owe THEM (Cr) —
// the reverse of Sale. Vendor Payment reduces it (Dr), opposite of Payment.
const customerTxnTypes = ['Sale','Payment','Return','Adjustment','Credit Note'];
const vendorTxnTypes = ['Purchase Bill','Vendor Payment','Vendor Credit Note'];
const txnTypes = [...customerTxnTypes, ...vendorTxnTypes];
const txnStyle: Record<string,{bg:string;color:string;sign:string}> = {
  Sale:          { bg:'#DBEAFE', color:'#2563EB', sign:'+' },
  Payment:       { bg:'#DCFCE7', color:'#16A34A', sign:'-' },
  Return:        { bg:'#FEE2E2', color:'#DC2626', sign:'-' },
  Adjustment:    { bg:'#FEF3C7', color:'#D97706', sign:'±' },
  'Credit Note': { bg:'#EDE9FE', color:'#7C3AED', sign:'-' },
  'Purchase Bill':      { bg:'#FFEDD5', color:'#EA580C', sign:'+' },
  'Vendor Payment':     { bg:'#CFFAFE', color:'#0891B2', sign:'-' },
  'Vendor Credit Note': { bg:'#FCE7F3', color:'#DB2777', sign:'-' },
};

const emptyParty: Party = { name:'', phone:'', email:'', address:'', party_type:'Customer' };
const emptyTxn: Txn = { party_name:'', transaction_date:new Date().toISOString().split('T')[0], type:'Sale', amount:0, description:'', reference:'' };

const PartyLedger: React.FC = () => {
  const [parties, setParties] = useState<Party[]>([]);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedParty, setSelectedParty] = useState<Party|null>(null);
  const [showPartyModal, setShowPartyModal] = useState(false);
  const [showTxnModal, setShowTxnModal] = useState(false);
  const [partyForm, setPartyForm] = useState<Party>(emptyParty);
  const [txnForm, setTxnForm] = useState<Txn>(emptyTxn);
  const [editingParty, setEditingParty] = useState<Party|null>(null);
  const [editingTxn, setEditingTxn] = useState<Txn|null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string|null>(null);
  const [toast, setToast] = useState<{msg:string;type:'success'|'error'}|null>(null);
  const [search, setSearch] = useState('');

  const showToast = (msg:string,type:'success'|'error') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  const fetchData = async () => {
    setLoading(true);
    const [{data:p},{data:t}] = await Promise.all([
      supabase.from('parties').select('*').order('name'),
      supabase.from('party_transactions').select('*').order('transaction_date',{ascending:false}),
    ]);
    setParties(p||[]); setTxns(t||[]);
    setLoading(false);
  };
  useEffect(()=>{ fetchData(); },[]);

  // ── Balance helpers ────────────────────────────────────────────────────
  // Positive balance = Dr = they owe YOU (customer) — increased by Sale, reduced by Payment/Return/Credit Note.
  // Negative balance = Cr = YOU owe them (vendor) — increased by Purchase Bill, reduced by Vendor Payment.
  const getBalance = (partyName: string) => {
    const pTxns = txns.filter(t=>t.party_name===partyName);
    return pTxns.reduce((s,t) => {
      if(t.type==='Sale') return s + t.amount;
      if(t.type==='Payment'||t.type==='Return'||t.type==='Credit Note') return s - t.amount;
      if(t.type==='Purchase Bill') return s - t.amount;
      if(t.type==='Vendor Payment'||t.type==='Vendor Credit Note') return s + t.amount;
      // Manual entries
      if(t.type==='Manual Given') return s - t.amount;   // you gave money → reduces balance
      if(t.type==='Manual Received') return s + t.amount; // you received money → increases balance
      return s;
    }, 0);
  };

  const totalReceivable = parties.reduce((s,p) => { const b=getBalance(p.name); return s+(b>0?b:0); },0);
  const totalAdvance = parties.reduce((s,p) => { const b=getBalance(p.name); return s+(b<0?Math.abs(b):0); },0);
  const overdueParties = parties.filter(p=>getBalance(p.name)>0).length;

  // ── Party CRUD ─────────────────────────────────────────────────────────
  const saveParty = async () => {
    if(!partyForm.name) { showToast('Name required.','error'); return; }
    setSaving(true);
    if(editingParty?.id) await supabase.from('parties').update(partyForm).eq('id',editingParty.id);
    else await supabase.from('parties').insert([partyForm]);
    showToast('Saved!','success'); setShowPartyModal(false); setEditingParty(null); setPartyForm(emptyParty);
    fetchData(); setSaving(false);
  };
  const deleteParty = async (id:string) => {
    setDeleting(id);
    await supabase.from('parties').delete().eq('id',id);
    showToast('Deleted.','success'); if(selectedParty?.id===id) setSelectedParty(null);
    fetchData(); setDeleting(null);
  };

  // ── Transaction CRUD ───────────────────────────────────────────────────
  const saveTxn = async () => {
    if(!txnForm.amount||txnForm.amount<=0) { showToast('Enter valid amount.','error'); return; }
    setSaving(true);
    const payload = { ...txnForm, party_name: selectedParty?.name||txnForm.party_name };
    if(editingTxn?.id) await supabase.from('party_transactions').update(payload).eq('id',editingTxn.id);
    else await supabase.from('party_transactions').insert([payload]);
    showToast('Transaction saved!','success'); setShowTxnModal(false); setEditingTxn(null); setTxnForm(emptyTxn);
    fetchData(); setSaving(false);
  };
  const deleteTxn = async (id:string) => {
    setDeleting(id);
    await supabase.from('party_transactions').delete().eq('id',id);
    showToast('Deleted.','success'); fetchData(); setDeleting(null);
  };

  // ── PDF Export ─────────────────────────────────────────────────────────
  const exportPDF = (party: Party) => {
    const pTxns = txns.filter(t=>t.party_name===party.name).sort((a,b)=>new Date(a.transaction_date).getTime()-new Date(b.transaction_date).getTime());
    const balance = getBalance(party.name);
    let running = 0;
    const win = window.open('','_blank');
    if(!win) return;
    win.document.write(`<html><head><title>Ledger - ${party.name}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:30px;color:#1F2937}
      .header{border-bottom:3px solid #7C3AED;padding-bottom:16px;margin-bottom:20px}
      .title{font-size:20px;font-weight:bold;color:#7C3AED}
      .info{display:flex;gap:40px;background:#F9FAFB;padding:14px;border-radius:8px;margin-bottom:20px}
      .info-item{display:flex;flex-direction:column}
      .lbl{font-size:11px;color:#9CA3AF;text-transform:uppercase}
      .val{font-size:14px;font-weight:bold;color:#1F2937;margin-top:2px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{background:#7C3AED;color:white;padding:8px 10px;text-align:left}
      td{padding:7px 10px;border-bottom:1px solid #F3F4F6}
      tr:nth-child(even) td{background:#FAFAFA}
      .debit{color:#2563EB;font-weight:bold}
      .credit{color:#16A34A;font-weight:bold}
      .balance-box{margin-top:20px;padding:16px;border-radius:10px;background:${balance>0?'#FEF2F2':'#F0FDF4'}}
      .bal-label{font-size:13px;color:#6B7280}
      .bal-val{font-size:24px;font-weight:bold;color:${balance>0?'#DC2626':'#16A34A'}}
      .footer{text-align:center;color:#9CA3AF;font-size:10px;margin-top:30px;padding-top:16px;border-top:1px solid #E5E7EB}
    </style></head><body>
    <div class="header"><div class="title">OdooERP — Party Ledger</div><div style="color:#6B7280;font-size:13px">Account Statement</div></div>
    <div class="info">
      <div class="info-item"><span class="lbl">Party Name</span><span class="val">${party.name}</span></div>
      <div class="info-item"><span class="lbl">Phone</span><span class="val">${party.phone||'-'}</span></div>
      <div class="info-item"><span class="lbl">Address</span><span class="val">${party.address||'-'}</span></div>
      <div class="info-item"><span class="lbl">Generated</span><span class="val">${new Date().toLocaleDateString('en-IN')}</span></div>
    </div>
    <table>
      <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Ref</th><th>Debit (Dr)</th><th>Credit (Cr)</th><th>Balance</th></tr></thead>
      <tbody>
        ${pTxns.map(t=>{
          const isDebit = t.type==='Sale' || t.type==='Vendor Payment' || t.type==='Vendor Credit Note';
          if(t.type==='Sale') running+=t.amount;
          else if(t.type==='Purchase Bill') running-=t.amount;
          else if(t.type==='Vendor Payment'||t.type==='Vendor Credit Note') running+=t.amount;
          else if(t.type==='Manual Given') running-=t.amount;
          else if(t.type==='Manual Received') running+=t.amount;
          else running-=t.amount;
          return `<tr>
            <td>${formatDate(t.transaction_date)}</td>
            <td>${t.type}</td>
            <td>${t.description||'-'}</td>
            <td>${t.reference||'-'}</td>
            <td class="debit">${isDebit?'Rs. '+t.amount.toLocaleString('en-IN'):'-'}</td>
            <td class="credit">${!isDebit?'Rs. '+t.amount.toLocaleString('en-IN'):'-'}</td>
            <td style="font-weight:bold;color:${running>0?'#DC2626':'#16A34A'}">Rs. ${Math.abs(running).toLocaleString('en-IN')} ${running>0?'Dr':'Cr'}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <div class="balance-box">
      <div class="bal-label">${balance>0?'Amount Receivable (Party owes you)':'Advance / Overpaid'}</div>
      <div class="bal-val">Rs. ${Math.abs(balance).toLocaleString('en-IN')} ${balance>0?'Dr':'Cr'}</div>
    </div>
    <div class="footer">Generated by OdooERP • ${new Date().toLocaleString('en-IN')} • Computer generated statement</div>
    </body></html>`);
    win.document.close(); setTimeout(()=>win.print(),500);
  };

  const filteredParties = parties.filter(p=>p.name.toLowerCase().includes(search.toLowerCase())||p.phone?.includes(search));
  const partyTxns = selectedParty ? txns.filter(t=>t.party_name===selectedParty.name).sort((a,b)=>new Date(a.transaction_date).getTime()-new Date(b.transaction_date).getTime()) : [];

  // Running balance for ledger view.
  // Sale/Purchase Bill increase what's owed; Payment/Vendor Payment/Return/
  // Adjustment/Credit Note reduce it — but the SIGN of "owed" flips direction
  // depending on whether it's customer-side or vendor-side activity.
  let runBal = 0;
  const txnsWithBalance = partyTxns.map(t => {
    if(t.type==='Sale') runBal+=t.amount;
    else if(t.type==='Purchase Bill') runBal-=t.amount;
    else if(t.type==='Vendor Payment'||t.type==='Vendor Credit Note') runBal+=t.amount;
    else if(t.type==='Manual Given') runBal-=t.amount;
    else if(t.type==='Manual Received') runBal+=t.amount;
    else runBal-=t.amount; // Payment, Return, Adjustment, Credit Note
    return { ...t, runningBalance: runBal };
  });

  return (
    <div className="space-y-6">
      <AnimatePresence>{toast&&<motion.div initial={{opacity:0,y:-20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-20}} className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${toast.type==='success'?'bg-green-600':'bg-red-500'}`}>{toast.msg}</motion.div>}</AnimatePresence>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Parties" value={loading?'...':String(parties.length)} change="+2" positive icon={<Users size={20}/>} color="#7C3AED" bg="#EDE9FE" delay={0.05}/>
        <StatCard title="Total Receivable" value={loading?'...':'₹'+totalReceivable.toLocaleString('en-IN')} change="" positive icon={<TrendingUp size={20}/>} color="#DC2626" bg="#FEE2E2" delay={0.1}/>
        <StatCard title="Advance Received" value={loading?'...':'₹'+totalAdvance.toLocaleString('en-IN')} change="" positive icon={<IndianRupee size={20}/>} color="#16A34A" bg="#DCFCE7" delay={0.15}/>
        <StatCard title="Parties with Due" value={loading?'...':String(overdueParties)} change="" positive={false} icon={<TrendingDown size={20}/>} color="#D97706" bg="#FEF3C7" delay={0.2}/>
      </div>

      {!selectedParty ? (
        /* ── PARTY LIST ── */
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h3 className="font-bold text-gray-800">All Parties <span className="text-violet-500">({filteredParties.length})</span></h3>
            <div className="flex gap-2">
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search party..." className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 w-36"/>
              <button onClick={()=>{ setEditingParty(null); setPartyForm(emptyParty); setShowPartyModal(true); }}
                className="flex items-center gap-1 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700"><Plus size={13}/> Add Party</button>
            </div>
          </div>
          {loading?<div className="flex items-center justify-center py-12 text-gray-400"><Loader size={20} className="animate-spin mr-2"/>Loading...</div>
          :filteredParties.length===0?<div className="text-center py-12 text-gray-400"><Users size={36} className="mx-auto mb-2 opacity-30"/><p>No parties yet</p></div>
          :(
            <div className="space-y-2">
              {filteredParties.map(p=>{
                const bal = getBalance(p.name);
                const pTxnCount = txns.filter(t=>t.party_name===p.name).length;
                return (
                  <div key={p.id} onClick={()=>setSelectedParty(p)}
                    className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:bg-violet-50 hover:border-violet-200 cursor-pointer transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600 font-bold text-sm">{p.name[0]}</div>
                      <div>
                        <p className="font-semibold text-gray-800 group-hover:text-violet-700">{p.name} <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full ${p.party_type==='Vendor'?'bg-orange-100 text-orange-600':'bg-blue-100 text-blue-600'}`}>{p.party_type==='Vendor'?'Vendor':'Customer'}</span></p>
                        <p className="text-xs text-gray-400">{p.phone} · {pTxnCount} transactions</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className={`font-bold text-sm ${bal>0?'text-red-500':bal<0?'text-green-600':'text-gray-400'}`}>
                          {bal>0?`₹${bal.toLocaleString('en-IN')} Dr`:bal<0?`₹${Math.abs(bal).toLocaleString('en-IN')} Cr`:'✓ Clear'}
                        </p>
                        <p className="text-xs text-gray-400">{p.party_type==='Vendor' ? (bal>0?'Advance Paid':bal<0?'Payable':'Settled') : (bal>0?'Receivable':bal<0?'Advance':'Settled')}</p>
                      </div>
                      <div className="flex gap-1" onClick={e=>e.stopPropagation()}>
                        <button onClick={()=>{ setEditingParty(p); setPartyForm({...p}); setShowPartyModal(true); }} className="w-7 h-7 bg-blue-50 rounded flex items-center justify-center text-blue-500"><Edit2 size={11}/></button>
                        <button onClick={()=>deleteParty(p.id!)} disabled={deleting===p.id} className="w-7 h-7 bg-red-50 rounded flex items-center justify-center text-red-400">{deleting===p.id?<Loader size={11} className="animate-spin"/>:<Trash2 size={11}/>}</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ── PARTY LEDGER DETAIL ── */
        <div className="space-y-4">
          {/* Header */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <button onClick={()=>setSelectedParty(null)} className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center hover:bg-gray-200"><ChevronLeft size={16}/></button>
                <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600 font-bold">{selectedParty.name[0]}</div>
                <div>
                  <p className="font-bold text-gray-800">{selectedParty.name}</p>
                  <p className="text-xs text-gray-400">{selectedParty.phone} · {selectedParty.address}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={()=>{ setTxnForm({...emptyTxn,party_name:selectedParty.name,type:selectedParty.party_type==='Vendor'?'Purchase Bill':'Sale'}); setEditingTxn(null); setShowTxnModal(true); }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700"><Plus size={13}/> Add Entry</button>
                <button onClick={()=>{ setTxnForm({...emptyTxn,party_name:selectedParty.name,type:'Manual Given'}); setEditingTxn(null); setShowTxnModal(true); }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600">✏️ Manual Entry</button>
                <button onClick={()=>exportPDF(selectedParty)} className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"><Download size={13}/> PDF</button>
              </div>
            </div>

            {/* Balance summary */}
            {(() => {
              const bal = getBalance(selectedParty.name);
              const isVendor = selectedParty.party_type === 'Vendor';
              const totalDebit = partyTxns.filter(t=> isVendor ? (t.type==='Vendor Payment'||t.type==='Vendor Credit Note') : t.type==='Sale').reduce((s,t)=>s+t.amount,0);
              const totalCredit = partyTxns.filter(t=> isVendor ? t.type==='Purchase Bill' : (t.type==='Payment'||t.type==='Credit Note'||t.type==='Return')).reduce((s,t)=>s+t.amount,0);
              return (
                <div className="grid grid-cols-3 gap-3 mt-4">
                  <div className="bg-blue-50 rounded-xl p-3 text-center"><p className="text-xs text-gray-500">{isVendor?'Total Paid (Dr)':'Total Sales (Dr)'}</p><p className="font-bold text-blue-600">₹{totalDebit.toLocaleString('en-IN')}</p></div>
                  <div className="bg-orange-50 rounded-xl p-3 text-center"><p className="text-xs text-gray-500">{isVendor?'Total Purchases (Cr)':'Total Received (Cr)'}</p><p className="font-bold text-orange-600">₹{totalCredit.toLocaleString('en-IN')}</p></div>
                  <div className={`rounded-xl p-3 text-center ${bal>0?'bg-red-50':'bg-green-50'}`}>
                    <p className="text-xs text-gray-500">{bal>0?(isVendor?'Advance Paid':'Balance Due'):(isVendor?'Amount Payable':'Advance')}</p>
                    <p className={`font-bold text-lg ${bal>0?'text-red-500':'text-green-600'}`}>₹{Math.abs(bal).toLocaleString('en-IN')} {bal>0?'Dr':'Cr'}</p>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Transactions ledger table */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-800 mb-4">Account Ledger</h3>
            {txnsWithBalance.length===0
              ? <div className="text-center py-8 text-gray-400"><p>No transactions yet. Click "+ Add Entry" to start.</p></div>
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
                      <th className="pb-2 text-left">Date</th>
                      <th className="pb-2 text-left">Type</th>
                      <th className="pb-2 text-left">Description</th>
                      <th className="pb-2 text-left">Ref</th>
                      <th className="pb-2 text-right">Debit (Dr)</th>
                      <th className="pb-2 text-right">Credit (Cr)</th>
                      <th className="pb-2 text-right">Balance</th>
                      <th className="pb-2 text-left">Actions</th>
                    </tr></thead>
                    <tbody>
                      {txnsWithBalance.map(t=>{
                        const isDebit = t.type==='Sale' || t.type==='Vendor Payment' || t.type==='Vendor Credit Note';
                        const style = txnStyle[t.type]||{bg:'#F3F4F6',color:'#6B7280'};
                        return (
                          <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2.5 text-gray-500 text-xs">{formatDate(t.transaction_date)}</td>
                            <td className="py-2.5"><span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{background:style.bg,color:style.color}}>{t.type}</span></td>
                            <td className="py-2.5 text-gray-600 text-xs">{t.description||'-'}</td>
                            <td className="py-2.5 text-gray-400 text-xs font-mono">{t.reference||'-'}</td>
                            <td className="py-2.5 text-right font-semibold text-blue-600">{isDebit?`₹${t.amount.toLocaleString('en-IN')}`:'-'}</td>
                            <td className="py-2.5 text-right font-semibold text-green-600">{!isDebit?`₹${t.amount.toLocaleString('en-IN')}`:'-'}</td>
                            <td className={`py-2.5 text-right font-bold text-sm ${(t as any).runningBalance>0?'text-red-500':'text-green-600'}`}>
                              ₹{Math.abs((t as any).runningBalance).toLocaleString('en-IN')} {(t as any).runningBalance>0?'Dr':'Cr'}
                            </td>
                            <td className="py-2.5">
                              <div className="flex gap-1">
                                <button onClick={()=>{ setEditingTxn(t); setTxnForm({...t}); setShowTxnModal(true); }} className="w-6 h-6 bg-blue-50 rounded flex items-center justify-center text-blue-500"><Edit2 size={10}/></button>
                                <button onClick={()=>deleteTxn(t.id!)} disabled={deleting===t.id} className="w-6 h-6 bg-red-50 rounded flex items-center justify-center text-red-400">{deleting===t.id?<Loader size={10} className="animate-spin"/>:<Trash2 size={10}/>}</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 bg-violet-50">
                        <td colSpan={4} className="py-2.5 font-bold text-gray-700 px-2">Closing Balance</td>
                        <td className="py-2.5 text-right font-bold text-blue-600">₹{partyTxns.filter(t=>t.type==='Sale'||t.type==='Vendor Payment'||t.type==='Vendor Credit Note').reduce((s,t)=>s+t.amount,0).toLocaleString('en-IN')}</td>
                        <td className="py-2.5 text-right font-bold text-green-600">₹{partyTxns.filter(t=>t.type!=='Sale'&&t.type!=='Vendor Payment'&&t.type!=='Vendor Credit Note').reduce((s,t)=>s+t.amount,0).toLocaleString('en-IN')}</td>
                        <td className={`py-2.5 text-right font-bold text-lg ${getBalance(selectedParty.name)>0?'text-red-500':'text-green-600'}`}>
                          ₹{Math.abs(getBalance(selectedParty.name)).toLocaleString('en-IN')} {getBalance(selectedParty.name)>0?'Dr':'Cr'}
                        </td>
                        <td/>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )
            }
          </div>
        </div>
      )}

      {/* PARTY MODAL */}
      <AnimatePresence>{showPartyModal&&(
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={e=>{if(e.target===e.currentTarget){setShowPartyModal(false);setEditingParty(null);}}}>
          <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.9,opacity:0}} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">{editingParty?'Edit Party':'Add Party'}</h2>
              <button onClick={()=>{setShowPartyModal(false);setEditingParty(null);}} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"><X size={14}/></button>
            </div>
            <div className="p-5 space-y-3">
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Party Type</label>
              <div className="grid grid-cols-2 gap-2">
                {['Customer','Vendor'].map(pt=>(
                  <button key={pt} onClick={()=>setPartyForm({...partyForm,party_type:pt})}
                    className={`py-2 rounded-lg text-sm font-medium transition-colors ${partyForm.party_type===pt?'bg-violet-600 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {pt==='Customer'?'🧑 Customer (they owe you)':'🏪 Vendor (you owe them)'}
                  </button>
                ))}
              </div></div>
              {[{label:'Name *',key:'name',ph:'e.g. Rahul Sharma'},{label:'Phone',key:'phone',ph:'+91-9876540000'},{label:'Email',key:'email',ph:'party@email.com'},{label:'GSTIN',key:'gstin',ph:'03ABCDE1234F1Z5'},{label:'Address',key:'address',ph:'City, State'}].map(f=>(
                <div key={f.key}><label className="block text-xs font-medium text-gray-700 mb-1">{f.label}</label>
                <input value={(partyForm as any)[f.key]||''} onChange={e=>setPartyForm({...partyForm,[f.key]:e.target.value})} placeholder={f.ph} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"/></div>
              ))}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-100">
              <button onClick={()=>{setShowPartyModal(false);setEditingParty(null);}} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600">Cancel</button>
              <button onClick={saveParty} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-60">{saving&&<Loader size={13} className="animate-spin"/>}{saving?'Saving...':'Save'}</button>
            </div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      {/* TRANSACTION MODAL */}
      <AnimatePresence>{showTxnModal&&(
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={e=>{if(e.target===e.currentTarget){setShowTxnModal(false);setEditingTxn(null);}}}>
          <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.9,opacity:0}} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">{editingTxn?'Edit Entry':'New Entry — '+(selectedParty?.name||'')}</h2>
              <button onClick={()=>{setShowTxnModal(false);setEditingTxn(null);}} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"><X size={14}/></button>
            </div>
            <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
              {/* Toggle: Bill Entry vs Manual Entry */}
              <div className="flex gap-2">
                <button onClick={()=>setTxnForm({...txnForm,type:selectedParty?.party_type==='Vendor'?'Purchase Bill':'Sale'})}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${!['Manual Given','Manual Received'].includes(txnForm.type)?'bg-violet-600 text-white border-violet-600':'bg-gray-50 text-gray-600 border-gray-200'}`}>
                  📋 Bill / Transaction
                </button>
                <button onClick={()=>setTxnForm({...txnForm,type:'Manual Given'})}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${['Manual Given','Manual Received'].includes(txnForm.type)?'bg-amber-500 text-white border-amber-500':'bg-gray-50 text-gray-600 border-gray-200'}`}>
                  ✏️ Manual Entry
                </button>
              </div>
              {/* Manual Entry options */}
              {['Manual Given','Manual Received'].includes(txnForm.type)&&(
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-semibold text-amber-700">✏️ Manual Cash / Loan Entry — no bill needed</p>
                  <div className="flex gap-2">
                    <button onClick={()=>setTxnForm({...txnForm,type:'Manual Given'})}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${txnForm.type==='Manual Given'?'bg-red-500 text-white border-red-500':'bg-gray-50 text-gray-600 border-gray-200'}`}>
                      💸 I Gave / Paid
                    </button>
                    <button onClick={()=>setTxnForm({...txnForm,type:'Manual Received'})}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${txnForm.type==='Manual Received'?'bg-green-500 text-white border-green-500':'bg-gray-50 text-gray-600 border-gray-200'}`}>
                      💰 I Received
                    </button>
                  </div>
                </div>
              )}
              {/* Regular type selector */}
              {!['Manual Given','Manual Received'].includes(txnForm.type)&&(
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                <div className="grid grid-cols-3 gap-1">
                  {(selectedParty?.party_type==='Vendor' ? vendorTxnTypes : customerTxnTypes).map(t=>(
                    <button key={t} onClick={()=>setTxnForm({...txnForm,type:t})}
                      className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${txnForm.type===t?'text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      style={txnForm.type===t?{background:txnStyle[t]?.color||'#7C3AED'}:{}}>
                      {t}
                    </button>
                  ))}
                </div></div>
              )}
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
              <input type="date" value={txnForm.transaction_date} onChange={e=>setTxnForm({...txnForm,transaction_date:e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"/></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Amount (₹)</label>
              <input type="number" value={txnForm.amount||''} onChange={e=>setTxnForm({...txnForm,amount:Number(e.target.value)})} placeholder="e.g. 181000" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"/>
              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                {[1000,5000,10000,50000,100000,200000].map(a=><button key={a} onClick={()=>setTxnForm({...txnForm,amount:a})} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-lg text-xs hover:bg-violet-100 hover:text-violet-700">₹{a.toLocaleString('en-IN')}</button>)}
              </div></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Description *</label>
              <input value={txnForm.description} onChange={e=>setTxnForm({...txnForm,description:e.target.value})} placeholder="e.g. Cash loan given, Labour payment, Advance for work..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"/></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Reference (optional)</label>
              <input value={txnForm.reference} onChange={e=>setTxnForm({...txnForm,reference:e.target.value})} placeholder="e.g. INV-005, PAY-003" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"/></div>
              {txnForm.amount>0 && selectedParty && (
                <div className="p-2.5 bg-violet-50 rounded-xl text-xs">
                  <span className="text-gray-500">Balance after this entry: </span>
                  <span className="font-bold text-violet-700">
                    {(() => {
                      const cur = getBalance(selectedParty.name);
                      const newBal = txnForm.type==='Sale' ? cur+txnForm.amount
                        : txnForm.type==='Purchase Bill' ? cur-txnForm.amount
                        : (txnForm.type==='Vendor Payment'||txnForm.type==='Vendor Credit Note') ? cur+txnForm.amount
                        : txnForm.type==='Manual Received' ? cur+txnForm.amount
                        : cur-txnForm.amount;
                      return `₹${Math.abs(newBal).toLocaleString('en-IN')} ${newBal>0?'Dr (receivable)':'Cr (payable)'}`;
                    })()}
                  </span>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-100">
              <button onClick={()=>{setShowTxnModal(false);setEditingTxn(null);}} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600">Cancel</button>
              <button onClick={saveTxn} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-60">{saving&&<Loader size={13} className="animate-spin"/>}{saving?'Saving...':editingTxn?'Update':'Save Entry'}</button>
            </div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>
    </div>
  );
};
export default PartyLedger;
