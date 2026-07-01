import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, TrendingDown, AlertCircle, Plus, X, Loader, Edit2, Trash2, IndianRupee, ChevronDown, ChevronUp, Download, FileText } from 'lucide-react';
import StatCard from '../components/StatCard';
import { supabase } from '../lib/supabase';
import { formatDate } from '../utils/cn';

type Vendor = { id?: string; name: string; phone: string; email: string; address: string; gstin?: string; };
type Bill = {
  id?: string; bill_number: string; invoice_no?: string; vendor_name: string;
  vendor_gstin?: string; buyer_gstin?: string; bill_date: string; due_date: string;
  transport?: string; vehicle_no?: string; place_of_supply?: string; eway_bill?: string;
  total_amount: number; paid_amount: number; status: string; notes: string;
};
type BillItem = {
  id?: string; bill_id?: string; product_name: string; description?: string; hsn_code?: string;
  quantity: number; unit: string; unit_price: number; discount_percent: number;
  amount_before_tax: number; tax_percent: number; tax_amount: number;
  total_price: number; add_to_inventory: boolean;
};
type Payment = { id?: string; bill_id: string; vendor_name: string; payment_date: string; amount: number; note: string; payment_mode: string; cheque_no: string; cheque_date: string; clearance_date: string; cheque_status: string; };
type CreditNote = {
  id?: string; bill_id?: string; credit_note_number: string; vendor_name: string;
  vendor_gstin?: string; credit_note_date: string; reason?: string; total_amount: number;
};
type CreditNoteItem = {
  id?: string; credit_note_id?: string; product_name: string; description?: string; hsn_code?: string;
  quantity: number; unit: string; unit_price: number; discount_percent: number;
  amount_before_tax: number; tax_percent: number; tax_amount: number; total_price: number;
};

const statusStyle: Record<string,string> = { Paid:'bg-green-100 text-green-700', Unpaid:'bg-red-100 text-red-700', Partial:'bg-orange-100 text-orange-700' };
const UNITS = ['Pcs','Kg','Gram','Tonne','Metre','Cm','Feet','Inch','Litre','Ml','Box','Set','Pair','Sqft','Sqm','Bundle','Dozen','Roll','Coil','Drum','Tin','Can','Bag','Bottle','Tube','Sheet','Bar','Unit'];
const TAX_RATES = [0,5,12,18,28];

const emptyBill: Bill = { bill_number:'', invoice_no:'', vendor_name:'', vendor_gstin:'', buyer_gstin:'', bill_date:new Date().toISOString().split('T')[0], due_date:'', transport:'', vehicle_no:'', place_of_supply:'', eway_bill:'', total_amount:0, paid_amount:0, status:'Unpaid', notes:'' };
const emptyVendor: Vendor = { name:'', phone:'', email:'', address:'', gstin:'' };
const emptyItem = (): BillItem => ({ product_name:'', description:'', hsn_code:'', quantity:1, unit:'Pcs', unit_price:0, discount_percent:0, amount_before_tax:0, tax_percent:18, tax_amount:0, total_price:0, add_to_inventory:true });
const emptyCreditNote: CreditNote = { credit_note_number:'', vendor_name:'', vendor_gstin:'', credit_note_date:new Date().toISOString().split('T')[0], reason:'', total_amount:0 };
const emptyCNItem = (): CreditNoteItem => ({ product_name:'', description:'', hsn_code:'', quantity:1, unit:'Pcs', unit_price:0, discount_percent:0, amount_before_tax:0, tax_percent:18, tax_amount:0, total_price:0 });

// ── Calculate item totals (kept as exact decimals — NOT rounded per row) ──
// Matches how a real GST invoice works: each line is exact, and only the
// final Grand Total gets a single "Rounded Off" adjustment at the end.
const round2 = (n: number) => Math.round(n * 100) / 100;
const calcItem = <T extends { quantity: number; unit_price: number; discount_percent: number; tax_percent: number; amount_before_tax: number; tax_amount: number; total_price: number }>(item: T): T => {
  const base = item.quantity * item.unit_price;
  const discAmt = base * (item.discount_percent / 100);
  const afterDisc = base - discAmt;
  const taxAmt = afterDisc * (item.tax_percent / 100);
  return { ...item, amount_before_tax: round2(afterDisc), tax_amount: round2(taxAmt), total_price: round2(afterDisc + taxAmt) };
};
const fmtMoney = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// GST rule: first 2 digits of a GSTIN are the state code. Same state on both
// sides → CGST+SGST (split equally). Different states → single IGST line.
const isIntraState = (vendorGstin?: string, buyerGstin?: string): boolean => {
  const vState = vendorGstin?.trim().slice(0,2);
  const bState = buyerGstin?.trim().slice(0,2);
  if (!vState || !bState) return true; // default to CGST+SGST when unknown (most common case for this business)
  return vState === bState;
};
// Groups items by tax rate (e.g. 18%, 12%, 5%) — matches the rate-wise tax
// breakdown table found on real GST invoices.
type TaxRateGroup = { rate: number; taxable: number; tax: number };
const groupByTaxRate = (lineItems: BillItem[]): TaxRateGroup[] => {
  const map: Record<number, TaxRateGroup> = {};
  for (const item of lineItems.filter(i=>i.product_name)) {
    const rate = item.tax_percent;
    if (!map[rate]) map[rate] = { rate, taxable: 0, tax: 0 };
    map[rate].taxable += item.amount_before_tax;
    map[rate].tax += item.tax_amount;
  }
  return Object.values(map).sort((a,b)=>b.rate-a.rate);
};

const Purchase: React.FC = () => {
  const [tab, setTab] = useState<'bills'|'vendors'|'compare'|'creditnotes'>('bills');
  const [bills, setBills] = useState<Bill[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [creditNoteItems, setCreditNoteItems] = useState<CreditNoteItem[]>([]);
  const [showCNModal, setShowCNModal] = useState(false);
  const [cnForm, setCnForm] = useState<CreditNote>(emptyCreditNote);
  const [cnItems, setCnItems] = useState<CreditNoteItem[]>([emptyCNItem()]);
  const [editingCN, setEditingCN] = useState<CreditNote|null>(null);
  const [loading, setLoading] = useState(true);
  const [showBillModal, setShowBillModal] = useState(false);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment|null>(null);
  const [showItemsFor, setShowItemsFor] = useState<string|null>(null);
  const [billForm, setBillForm] = useState<Bill>(emptyBill);
  const [vendorForm, setVendorForm] = useState<Vendor>(emptyVendor);
  const [payForm, setPayForm] = useState<Payment>({ bill_id:'', vendor_name:'', payment_date:new Date().toISOString().split('T')[0], amount:0, note:'', payment_mode:'Cash', cheque_no:'', cheque_date:'', clearance_date:'', cheque_status:'N/A' });
  const [items, setItems] = useState<BillItem[]>([emptyItem()]);
  const [editingBill, setEditingBill] = useState<Bill|null>(null);
  const [editingVendor, setEditingVendor] = useState<Vendor|null>(null);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [deleting, setDeleting] = useState<string|null>(null);
  const [toast, setToast] = useState<{msg:string;type:'success'|'error'}|null>(null);
  const [compareProduct, setCompareProduct] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest'|'oldest'>('newest');
  const [searchText, setSearchText] = useState('');
  const [filterVendor, setFilterVendor] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMinAmt, setFilterMinAmt] = useState('');
  const [filterMaxAmt, setFilterMaxAmt] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Filter + sort bills — computed early so the stat cards above can reflect
  // whatever filter is currently active (e.g. filtering to one vendor shows
  // that vendor's totals, not the whole company's).
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const availableYears = [...new Set(bills.map(b=>new Date(b.bill_date).getFullYear()))].sort((a,b)=>b-a);
  const availableVendors = [...new Set(bills.map(b=>b.vendor_name))].sort();
  const filteredBills = bills
    .filter(b => {
      const d = new Date(b.bill_date);
      if(filterMonth && d.getMonth() !== Number(filterMonth)) return false;
      if(filterYear && d.getFullYear() !== Number(filterYear)) return false;
      if(filterDateFrom && b.bill_date < filterDateFrom) return false;
      if(filterDateTo && b.bill_date > filterDateTo) return false;
      if(filterVendor && b.vendor_name !== filterVendor) return false;
      if(filterStatus) {
        const isOverdue = b.status!=='Paid' && b.due_date && new Date(b.due_date) < new Date();
        if (filterStatus === 'Overdue' && !isOverdue) return false;
        if (filterStatus !== 'Overdue' && b.status !== filterStatus) return false;
      }
      if(filterMinAmt && b.total_amount < Number(filterMinAmt)) return false;
      if(filterMaxAmt && b.total_amount > Number(filterMaxAmt)) return false;
      if(searchText.trim()) {
        const q = searchText.trim().toLowerCase();
        // Pull in this bill's payment notes/cheque numbers too, so searching
        // "167825" or "cheque" finds the bill via its payment record.
        const billPayments = payments.filter(p=>p.bill_id===b.id);
        const paymentNotes = billPayments.map(p=>p.note).filter(Boolean).join(' ');
        const billItemsText = billItems.filter((i:any)=>i.bill_id===b.id).map((i:any)=>[i.product_name,i.description,i.hsn_code].filter(Boolean).join(' ')).join(' ');
        const haystack = [
          b.bill_number, b.invoice_no, b.vendor_name, b.vendor_gstin, b.notes,
          String(b.total_amount), String(Math.round(b.total_amount)),
          paymentNotes, billItemsText,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    })
    .sort((a,b) => sortOrder==='newest'
      ? new Date(b.bill_date).getTime() - new Date(a.bill_date).getTime()
      : new Date(a.bill_date).getTime() - new Date(b.bill_date).getTime()
    );
  const activeFilterCount = [filterMonth,filterYear,filterVendor,filterStatus,filterMinAmt,filterMaxAmt,filterDateFrom,filterDateTo,searchText].filter(Boolean).length;
  const clearAllFilters = () => { setFilterMonth(''); setFilterYear(''); setFilterVendor(''); setFilterStatus(''); setFilterMinAmt(''); setFilterMaxAmt(''); setFilterDateFrom(''); setFilterDateTo(''); setSearchText(''); };

  const showToast = (msg:string,type:'success'|'error') => { setToast({msg,type}); setTimeout(()=>setToast(null), type==='error'?7000:3000); };

  const fetchData = async () => {
    setLoading(true);
    const [{data:b},{data:v},{data:p},{data:bi},{data:cn},{data:cni}] = await Promise.all([
      supabase.from('purchase_bills').select('*').order('created_at',{ascending:false}),
      supabase.from('vendors').select('*').order('name'),
      supabase.from('purchase_payments').select('*').order('payment_date',{ascending:false}),
      supabase.from('purchase_items').select('*').order('created_at',{ascending:false}),
      supabase.from('purchase_credit_notes').select('*').order('created_at',{ascending:false}),
      supabase.from('purchase_credit_note_items').select('*').order('created_at',{ascending:false}),
    ]);
    setBills(b||[]); setVendors(v||[]); setPayments(p||[]); setBillItems(bi||[]);
    setCreditNotes(cn||[]); setCreditNoteItems(cni||[]);
    setLoading(false);
  };
  useEffect(()=>{ fetchData(); },[]);

  const totalBills = filteredBills.reduce((s,b)=>s+b.total_amount,0);
  const totalPaid = filteredBills.reduce((s,b)=>s+b.paid_amount,0);
  // Credit notes reduce what's actually owed, just like payments do — but they
  // don't touch bill.paid_amount, so they must be subtracted separately here.
  const creditNoteTotalFor = (billId?: string) => billId ? creditNotes.filter(cn=>cn.bill_id===billId).reduce((s,cn)=>s+cn.total_amount,0) : 0;
  const totalCreditNotes = filteredBills.reduce((s,b)=>s+creditNoteTotalFor(b.id),0);
  const totalDue = totalBills - totalPaid - totalCreditNotes;
  const overdueBills = filteredBills.filter(b=>{
    const dueAmt = b.total_amount - b.paid_amount - creditNoteTotalFor(b.id);
    return dueAmt > 0 && b.due_date && new Date(b.due_date) < new Date();
  }).length;

  // ── Keyboard navigation for the items table ─────────────────────────────
  // Lets the user press Enter to jump field-to-field (Name→HSN→Qty→Unit→
  // Rate→Disc%→Tax%) instead of reaching for the mouse. Pressing Enter on the
  // last field of the last row adds a new row and focuses its first field.
  const FIELD_ORDER = ['name','desc','hsn','qty','unit','rate','disc','tax'];
  const fieldRefs = React.useRef<Record<string, HTMLInputElement|HTMLSelectElement|null>>({});
  const setFieldRef = (rowIndex:number, field:string) => (el: HTMLInputElement|HTMLSelectElement|null) => {
    fieldRefs.current[`${rowIndex}-${field}`] = el;
  };
  const handleRowKeyDown = (e: React.KeyboardEvent, rowIndex: number, field: string) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const colIdx = FIELD_ORDER.indexOf(field);
    const isLastField = colIdx === FIELD_ORDER.length - 1;
    const isLastRow = rowIndex === items.length - 1;
    if (isLastField && isLastRow) {
      setItems([...items, emptyItem()]);
      // Focus the new row's first field once it's rendered
      setTimeout(() => fieldRefs.current[`${rowIndex+1}-name`]?.focus(), 0);
    } else if (isLastField) {
      fieldRefs.current[`${rowIndex+1}-name`]?.focus();
    } else {
      fieldRefs.current[`${rowIndex}-${FIELD_ORDER[colIdx+1]}`]?.focus();
    }
  };

  // ── Keyboard navigation for the header section (Invoice + Vendor Details) ─
  // Same Enter-to-advance behavior as the items table. The last header field
  // (Notes) hands off into the items table's first field (Product Name).
  const HEADER_FIELD_ORDER = ['bill_number','invoice_no','bill_date','due_date','vendor_name','vendor_gstin','buyer_gstin','place_of_supply','transport','vehicle_no','eway_bill','notes'];
  const headerFieldRefs = React.useRef<Record<string, HTMLInputElement|null>>({});
  const setHeaderFieldRef = (key:string) => (el: HTMLInputElement|null) => { headerFieldRefs.current[key] = el; };
  const handleHeaderKeyDown = (e: React.KeyboardEvent, key: string) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const idx = HEADER_FIELD_ORDER.indexOf(key);
    if (idx === HEADER_FIELD_ORDER.length - 1) {
      fieldRefs.current['0-name']?.focus();
    } else {
      headerFieldRefs.current[HEADER_FIELD_ORDER[idx+1]]?.focus();
    }
  };

  // ── Item row helpers ───────────────────────────────────────────────────
  // Build a lookup of each product's most recently used HSN/unit/rate/tax,
  // newest bill first, so picking a familiar item pre-fills its usual details.
  const productHistory = (() => {
    const sorted = [...bills].sort((a,b)=> new Date(b.bill_date).getTime() - new Date(a.bill_date).getTime());
    const map: Record<string, BillItem> = {};
    for (const bill of sorted) {
      for (const it of billItems.filter(i=>i.bill_id===bill.id)) {
        const key = it.product_name.trim().toLowerCase();
        if (key && !map[key]) map[key] = it;
      }
    }
    return map;
  })();
  const knownProductNames = Object.values(productHistory).map(i=>i.product_name);

  const updateItem = (i:number, field:string, val:any) => {
    const updated = [...items];
    (updated[i] as any)[field] = val;
    if (field === 'product_name') {
      const hist = productHistory[String(val).trim().toLowerCase()];
      if (hist) {
        updated[i].hsn_code = hist.hsn_code;
        updated[i].unit = hist.unit;
        updated[i].unit_price = hist.unit_price;
        updated[i].tax_percent = hist.tax_percent;
        updated[i].discount_percent = hist.discount_percent;
      }
    }
    updated[i] = calcItem(updated[i]);
    setItems(updated);
  };

  const updateCNItem = (i:number, field:string, val:any) => {
    const updated = [...cnItems];
    (updated[i] as any)[field] = val;
    if (field === 'product_name') {
      const hist = productHistory[String(val).trim().toLowerCase()];
      if (hist) {
        updated[i].hsn_code = hist.hsn_code;
        updated[i].unit = hist.unit;
        updated[i].unit_price = hist.unit_price;
        updated[i].tax_percent = hist.tax_percent;
        updated[i].discount_percent = hist.discount_percent;
      }
    }
    updated[i] = calcItem(updated[i]);
    setCnItems(updated);
  };

  // Fuzzy vendor name match: matches if either name contains the other
  // (e.g. typing "Shiva Paints" should find "Shiva Paints & Hardware Store").
  // Requires at least 3 characters to avoid accidental short-string matches.
  const vendorNameMatches = (a: string, b: string) => {
    const x = a.trim().toLowerCase(), y = b.trim().toLowerCase();
    if (!x || !y || x.length < 3 || y.length < 3) return x === y;
    return x === y || x.includes(y) || y.includes(x);
  };
  // Look up a vendor's saved phone number by (fuzzy) name match, for display
  const getVendorPhone = (vendorName: string): string => {
    const match = vendors.find(v => vendorNameMatches(v.name, vendorName));
    return match?.phone || '';
  };
  // Detect if this Bill/Invoice No already exists for ANY vendor — fires the
  // moment a matching number is typed, even before Vendor Name is filled in
  // (excluding the bill currently being edited, if any).
  const findDuplicateBill = (): Bill | undefined => {
    const num = billForm.bill_number.trim().toLowerCase();
    if (!num) return undefined;
    return bills.find(b =>
      b.id !== editingBill?.id &&
      b.bill_number.trim().toLowerCase() === num
    );
  };

  // ── Party Ledger sync ────────────────────────────────────────────────────
  // Keeps Party Ledger automatically up to date with Purchase activity.
  // Every bill becomes a "Purchase Bill" entry (increases what you owe);
  // every payment becomes a "Vendor Payment" entry (reduces what you owe).
  // Manually-added parties/transactions in Party Ledger are never touched —
  // this only creates/updates rows tagged with a matching `reference` id,
  // so re-saving a bill updates its existing ledger entry instead of
  // duplicating it.
  const findOrCreateVendorParty = async (vendorName: string, gstin?: string): Promise<string|null> => {
    if (!vendorName.trim()) return null;
    const { data: existingParties } = await supabase.from('parties').select('id,name').eq('party_type','Vendor');
    const match = (existingParties||[]).find((p:any) => vendorNameMatches(p.name, vendorName));
    if (match) return match.id;
    const { data, error } = await supabase.from('parties').insert([{
      name: vendorName, party_type: 'Vendor', gstin: gstin||null, phone:'', email:'', address:'',
    }]).select().single();
    if (error) { console.error('Party Ledger sync (create party) failed:', error.message); return null; }
    return data?.id || null;
  };

  const syncBillToLedger = async (bill: Bill) => {
    try {
      const partyId = await findOrCreateVendorParty(bill.vendor_name, bill.vendor_gstin);
      if (!partyId) return;
      const partyRow = (await supabase.from('parties').select('name').eq('id',partyId).single()).data;
      const ref = `purchase-bill:${bill.id}`;
      const payload = {
        party_id: partyId, party_name: partyRow?.name || bill.vendor_name,
        transaction_date: bill.bill_date, type: 'Purchase Bill', amount: bill.total_amount,
        description: `Bill ${bill.bill_number}`, reference: ref,
      };
      const { data: existing } = await supabase.from('party_transactions').select('id').eq('reference',ref).maybeSingle();
      if (existing) await supabase.from('party_transactions').update(payload).eq('id',existing.id);
      else await supabase.from('party_transactions').insert([payload]);
    } catch (e) { console.error('Party Ledger sync (bill) failed:', e); }
  };

  const syncPaymentToLedger = async (payment: Payment) => {
    try {
      const partyId = await findOrCreateVendorParty(payment.vendor_name);
      if (!partyId) return;
      const partyRow = (await supabase.from('parties').select('name').eq('id',partyId).single()).data;
      const ref = `purchase-payment:${payment.id}`;
      const payload = {
        party_id: partyId, party_name: partyRow?.name || payment.vendor_name,
        transaction_date: payment.payment_date, type: 'Vendor Payment', amount: payment.amount,
        description: payment.note || 'Payment', reference: ref,
      };
      const { data: existing } = await supabase.from('party_transactions').select('id').eq('reference',ref).maybeSingle();
      if (existing) await supabase.from('party_transactions').update(payload).eq('id',existing.id);
      else await supabase.from('party_transactions').insert([payload]);
    } catch (e) { console.error('Party Ledger sync (payment) failed:', e); }
  };

  const syncCreditNoteToLedger = async (cn: CreditNote) => {
    try {
      const partyId = await findOrCreateVendorParty(cn.vendor_name, cn.vendor_gstin);
      if (!partyId) return;
      const partyRow = (await supabase.from('parties').select('name').eq('id',partyId).single()).data;
      const ref = `purchase-creditnote:${cn.id}`;
      const payload = {
        party_id: partyId, party_name: partyRow?.name || cn.vendor_name,
        transaction_date: cn.credit_note_date, type: 'Vendor Credit Note', amount: cn.total_amount,
        description: `CN ${cn.credit_note_number}${cn.reason?' — '+cn.reason:''}`, reference: ref,
      };
      const { data: existing } = await supabase.from('party_transactions').select('id').eq('reference',ref).maybeSingle();
      if (existing) await supabase.from('party_transactions').update(payload).eq('id',existing.id);
      else await supabase.from('party_transactions').insert([payload]);
    } catch (e) { console.error('Party Ledger sync (credit note) failed:', e); }
  };
  const removeCreditNoteFromLedger = async (cnId: string) => {
    try { await supabase.from('party_transactions').delete().eq('reference', `purchase-creditnote:${cnId}`); }
    catch (e) { console.error('Party Ledger sync (delete credit note) failed:', e); }
  };

  const removeBillFromLedger = async (billId: string) => {
    try { await supabase.from('party_transactions').delete().eq('reference', `purchase-bill:${billId}`); }
    catch (e) { console.error('Party Ledger sync (delete bill) failed:', e); }
  };
  const removePaymentFromLedger = async (paymentId: string) => {
    try { await supabase.from('party_transactions').delete().eq('reference', `purchase-payment:${paymentId}`); }
    catch (e) { console.error('Party Ledger sync (delete payment) failed:', e); }
  };

  // Auto-fill vendor GSTIN + last-used transport details when a known vendor is picked
  const handleVendorPick = (name: string) => {
    const match = vendors.find(v => vendorNameMatches(v.name, name));
    const lastBill = bills.filter(b => vendorNameMatches(b.vendor_name, name))
      .sort((a,b)=> new Date(b.bill_date).getTime() - new Date(a.bill_date).getTime())[0];
    setBillForm(prev => ({
      ...prev, vendor_name: name,
      vendor_gstin: match?.gstin || lastBill?.vendor_gstin || prev.vendor_gstin,
      transport: lastBill?.transport ?? prev.transport,
      place_of_supply: lastBill?.place_of_supply ?? prev.place_of_supply,
      buyer_gstin: lastBill?.buyer_gstin || prev.buyer_gstin,
    }));
  };
  // When leaving the vendor field, if what was typed uniquely matches one
  // known vendor name, snap the textbox to that vendor's full saved name.
  const completeVendorName = () => {
    const typed = billForm.vendor_name.trim();
    if (!typed || typed.length < 3) return;
    const allNames = Array.from(new Set([...vendors.map(v=>v.name), ...bills.map(b=>b.vendor_name)]));
    const matches = Array.from(new Set(allNames.filter(n => vendorNameMatches(n, typed))));
    if (matches.length === 1 && matches[0] !== typed) {
      handleVendorPick(matches[0]);
    }
  };
  // Load the vendor's most recent bill's items as a starting point for a new bill
  const loadLastItemsFor = (name: string) => {
    if (!name.trim()) { showToast('Type or pick a vendor name first.','error'); return; }
    const vendorBills = bills.filter(b => vendorNameMatches(b.vendor_name, name))
      .sort((a,b)=> new Date(b.bill_date).getTime() - new Date(a.bill_date).getTime());
    if (vendorBills.length === 0) { showToast('No previous bill found for this vendor.','error'); return; }
    const lastBillId = vendorBills[0].id;
    const lastItems = billItems.filter(i => i.bill_id === lastBillId);
    if (lastItems.length === 0) { showToast("That vendor's last bill had no items saved.",'error'); return; }
    setItems(lastItems.map(i => { const { id, bill_id, ...rest } = i; return calcItem(rest as BillItem); }));
    showToast(`Loaded ${lastItems.length} item(s) from last bill — adjust qty/rate as needed.`,'success');
  };

  // ── Save Bill ──────────────────────────────────────────────────────────
  const saveBill = async () => {
    if(!billForm.bill_number||!billForm.vendor_name) { showToast('Bill number and vendor required.','error'); return; }
    const enteredRows = items.filter(i => i.quantity || i.unit_price || i.hsn_code || i.product_name);
    const validItems0 = items.filter(i=>i.product_name?.trim());
    if (enteredRows.length > 0 && validItems0.length === 0) {
      showToast('⚠️ No item has a Product Name filled in — nothing was saved. Add a product name to each row before saving.','error');
      return;
    }
    if (enteredRows.length > validItems0.length) {
      const proceed = window.confirm(
        `${enteredRows.length - validItems0.length} item row(s) are missing a Product Name and will be DROPPED if you continue (their Qty/Rate/HSN will be lost).\n\nContinue saving anyway?`
      );
      if (!proceed) return;
    }
    const dup = findDuplicateBill();
    if (dup) {
      const proceed = window.confirm(
        `A bill numbered "${billForm.bill_number}" already exists for ${dup.vendor_name} (₹${dup.total_amount.toLocaleString('en-IN')}, ${dup.status}).\n\nSave this as a separate bill anyway?`
      );
      if (!proceed) return;
    }
    setSaving(true);
    const total = items.filter(i=>i.product_name).reduce((s,i)=>s+i.total_price,0);
    const payload = { ...billForm, total_amount: Math.round(total) };
    let billId = editingBill?.id;
    if(editingBill?.id) {
      const { error: updateErr } = await supabase.from('purchase_bills').update(payload).eq('id',editingBill.id);
      if (updateErr) { showToast('Failed to update bill: '+updateErr.message,'error'); setSaving(false); return; }
      // Replace this bill's line items with the edited set (inventory stock is NOT auto-adjusted on edit)
      const { error: delErr } = await supabase.from('purchase_items').delete().eq('bill_id',editingBill.id);
      if (delErr) { showToast('Bill saved, but failed to clear old items: '+delErr.message,'error'); setSaving(false); fetchData(); return; }
      const validItems = items.filter(i=>i.product_name);
      if(validItems.length>0) {
        const itemPayload = validItems.map(i=>{ const { id, ...rest } = i; return {...rest, bill_id:editingBill.id}; });
        const { error: itemErr } = await supabase.from('purchase_items').insert(itemPayload);
        if (itemErr) { showToast('Bill header saved, but items FAILED to save: '+itemErr.message,'error'); setSaving(false); fetchData(); return; }
      }
    } else {
      const {data,error}=await supabase.from('purchase_bills').insert([payload]).select().single();
      if(error) { showToast('Failed: '+error.message,'error'); setSaving(false); return; }
      billId = data.id;
      const validItems = items.filter(i=>i.product_name);
      if(billId && validItems.length>0) {
        const itemPayload = validItems.map(i=>({...i,bill_id:billId}));
        const { error: itemErr } = await supabase.from('purchase_items').insert(itemPayload);
        if (itemErr) {
          showToast('⚠️ Bill saved but ITEMS FAILED to save: '+itemErr.message+' — please Edit this bill and re-enter items.','error');
          setShowBillModal(false); setEditingBill(null); setBillForm(emptyBill); setItems([emptyItem()]);
          fetchData(); setSaving(false); return;
        }
        for(const item of itemPayload.filter(i=>i.add_to_inventory)) {
          const {data:ex}=await supabase.from('products').select('id,stock').eq('name',item.product_name).single();
          if(ex) await supabase.from('products').update({stock:ex.stock+item.quantity}).eq('id',ex.id);
          else await supabase.from('products').insert([{name:item.product_name,sku:`SKU-${Date.now()}`,category:'Purchased',stock:item.quantity,reorder_level:5,price:item.unit_price,status:'In Stock'}]);
        }
      }
    }
    if (billId) await syncBillToLedger({ ...payload, id: billId } as Bill);
    showToast(editingBill?'Bill updated!':'Bill created & inventory updated!','success');
    setShowBillModal(false); setEditingBill(null); setBillForm(emptyBill); setItems([emptyItem()]);
    fetchData(); setSaving(false);
  };

  // ── Credit Notes ──────────────────────────────────────────────────────
  const saveCreditNote = async () => {
    if(!cnForm.credit_note_number||!cnForm.vendor_name) { showToast('Credit note number and vendor required.','error'); return; }
    const enteredRows = cnItems.filter(i => i.quantity || i.unit_price || i.hsn_code || i.product_name);
    const validItems0 = cnItems.filter(i=>i.product_name?.trim());
    if (enteredRows.length > 0 && validItems0.length === 0) {
      showToast('⚠️ No item has a Product Name filled in — nothing was saved.','error');
      return;
    }
    if (enteredRows.length > validItems0.length) {
      const proceed = window.confirm(`${enteredRows.length - validItems0.length} item row(s) are missing a Product Name and will be DROPPED.\n\nContinue saving anyway?`);
      if (!proceed) return;
    }
    setSaving(true);
    const total = cnItems.filter(i=>i.product_name).reduce((s,i)=>s+i.total_price,0);
    const payload = { ...cnForm, total_amount: Math.round(total) };
    let cnId = editingCN?.id;
    if (editingCN?.id) {
      const { error: updateErr } = await supabase.from('purchase_credit_notes').update(payload).eq('id',editingCN.id);
      if (updateErr) { showToast('Failed to update credit note: '+updateErr.message,'error'); setSaving(false); return; }
      const { error: delErr } = await supabase.from('purchase_credit_note_items').delete().eq('credit_note_id',editingCN.id);
      if (delErr) { showToast('Credit note saved, but failed to clear old items: '+delErr.message,'error'); setSaving(false); fetchData(); return; }
      const validItems = cnItems.filter(i=>i.product_name);
      if (validItems.length>0) {
        const itemPayload = validItems.map(i=>{ const { id, ...rest } = i; return {...rest, credit_note_id:editingCN.id}; });
        const { error: itemErr } = await supabase.from('purchase_credit_note_items').insert(itemPayload);
        if (itemErr) { showToast('Credit note header saved, but items FAILED to save: '+itemErr.message,'error'); setSaving(false); fetchData(); return; }
      }
    } else {
      const { data, error } = await supabase.from('purchase_credit_notes').insert([payload]).select().single();
      if (error) { showToast('Failed: '+error.message,'error'); setSaving(false); return; }
      cnId = data.id;
      const validItems = cnItems.filter(i=>i.product_name);
      if (cnId && validItems.length>0) {
        const itemPayload = validItems.map(i=>({...i,credit_note_id:cnId}));
        const { error: itemErr } = await supabase.from('purchase_credit_note_items').insert(itemPayload);
        if (itemErr) {
          showToast('⚠️ Credit note saved but ITEMS FAILED to save: '+itemErr.message+' — please Edit and re-enter items.','error');
          setShowCNModal(false); setEditingCN(null); setCnForm(emptyCreditNote); setCnItems([emptyCNItem()]);
          fetchData(); setSaving(false); return;
        }
      }
    }
    if (cnId) await syncCreditNoteToLedger({ ...payload, id: cnId } as CreditNote);
    showToast(editingCN?'Credit note updated!':'Credit note created!','success');
    setShowCNModal(false); setEditingCN(null); setCnForm(emptyCreditNote); setCnItems([emptyCNItem()]);
    fetchData(); setSaving(false);
  };

  const deleteCreditNote = async (id:string) => {
    setDeleting(id);
    const { error } = await supabase.from('purchase_credit_notes').delete().eq('id',id);
    if (error) { showToast('Failed to delete: '+error.message,'error'); setDeleting(null); return; }
    await removeCreditNoteFromLedger(id);
    showToast('Credit note deleted.','success'); fetchData(); setDeleting(null);
  };

  // ── Scan bill photo with AI ───────────────────────────────────────────
  const fileToBase64 = (file: File): Promise<{data:string;mediaType:string}> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve({ data: base64, mediaType: file.type });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const scanBillPhoto = async (file: File) => {
    setScanning(true);
    setScanError('');
    try {
      const { data: base64, mediaType } = await fileToBase64(file);
      const prompt = `You are reading a GST purchase invoice/bill photo. Extract ALL details and respond with ONLY valid JSON, no markdown, no explanation, no backticks. Use this exact structure:
{
  "bill_number": "vendor's invoice number (e.g. ST/2603/2025-26)",
  "vendor_name": "vendor company name",
  "vendor_gstin": "vendor GSTIN if visible",
  "buyer_gstin": "buyer/our GSTIN if visible",
  "bill_date": "YYYY-MM-DD format",
  "due_date": "",
  "transport": "transport mode if mentioned e.g. CAR, TRUCK",
  "vehicle_no": "vehicle number if mentioned",
  "place_of_supply": "place of supply with state code if mentioned",
  "eway_bill": "e-way bill number if mentioned",
  "notes": "",
  "items": [
    {
      "product_name": "description of goods",
      "hsn_code": "HSN/SAC code",
      "quantity": 0,
      "unit": "Pcs",
      "unit_price": 0,
      "discount_percent": 0,
      "tax_percent": 18
    }
  ]
}
If a field is not visible on the invoice, use empty string "" for text fields or 0 for numbers. For unit, map to one of: Pcs, Kg, Metre, Litre, Box, Set, Pair, Sqft, Bundle, Dozen. Extract every single line item from the items table. Be precise with numbers.`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 4000,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
              { type: "text", text: prompt }
            ]
          }]
        })
      });
      const result = await response.json();
      if(result.error) throw new Error(result.error.message || JSON.stringify(result.error));
      if(!response.ok) throw new Error(`API error ${response.status}: ${JSON.stringify(result)}`);
      const textBlock = result.content?.find((c:any)=>c.type==='text');
      if(!textBlock) throw new Error('No response from AI');
      let cleaned = textBlock.text.trim().replace(/^```json\s*/,'').replace(/^```\s*/,'').replace(/```\s*$/,'');
      const extracted = JSON.parse(cleaned);

      // Fill bill form
      setBillForm(prev => ({
        ...prev,
        bill_number: extracted.bill_number || prev.bill_number,
        vendor_name: extracted.vendor_name || prev.vendor_name,
        vendor_gstin: extracted.vendor_gstin || prev.vendor_gstin,
        buyer_gstin: extracted.buyer_gstin || prev.buyer_gstin,
        bill_date: extracted.bill_date || prev.bill_date,
        transport: extracted.transport || prev.transport,
        vehicle_no: extracted.vehicle_no || prev.vehicle_no,
        place_of_supply: extracted.place_of_supply || prev.place_of_supply,
        eway_bill: extracted.eway_bill || prev.eway_bill,
      }));

      // Fill items
      if(extracted.items && extracted.items.length > 0) {
        const newItems = extracted.items.map((it:any) => calcItem({
          product_name: it.product_name || '',
          hsn_code: it.hsn_code || '',
          quantity: Number(it.quantity) || 1,
          unit: it.unit || 'Pcs',
          unit_price: Number(it.unit_price) || 0,
          discount_percent: Number(it.discount_percent) || 0,
          amount_before_tax: 0,
          tax_percent: Number(it.tax_percent) || 18,
          tax_amount: 0,
          total_price: 0,
          add_to_inventory: true,
        }));
        setItems(newItems);
      }
      showToast('Bill scanned! Review details below.','success');
    } catch(e:any) {
      console.error('Scan error:', e);
      setScanError('Could not read bill: ' + (e?.message || 'Unknown error') + '. Please fill manually or try a clearer photo.');
      showToast('Scan failed — fill manually.','error');
    }
    setScanning(false);
  };

  const saveVendor = async () => {
    if(!vendorForm.name) { showToast('Name required.','error'); return; }
    setSaving(true);
    if(editingVendor?.id) await supabase.from('vendors').update(vendorForm).eq('id',editingVendor.id);
    else await supabase.from('vendors').insert([vendorForm]);
    showToast('Saved!','success'); setShowVendorModal(false); setEditingVendor(null); setVendorForm(emptyVendor);
    fetchData(); setSaving(false);
  };

  // Recompute a bill's paid_amount/status from the actual sum of its payments
  // (safer than incrementing/decrementing, which can drift after edits).
  const recalcBillPaidStatus = async (billId: string, allPayments: Payment[]) => {
    const bill = bills.find(b=>b.id===billId);
    if (!bill) return;
    const newPaid = allPayments.filter(p=>p.bill_id===billId).reduce((s,p)=>s+p.amount,0);
    const newStatus = newPaid>=bill.total_amount && bill.total_amount>0 ? 'Paid' : newPaid>0 ? 'Partial' : 'Unpaid';
    const { error } = await supabase.from('purchase_bills').update({paid_amount:newPaid,status:newStatus}).eq('id',billId);
    if (error) showToast('Payment saved, but failed to update bill totals: '+error.message,'error');
  };

  const savePayment = async () => {
    if(!payForm.amount||payForm.amount<=0) { showToast('Enter valid amount.','error'); return; }
    setSaving(true);
    if (editingPayment?.id) {
      const { error } = await supabase.from('purchase_payments').update({
        payment_date: payForm.payment_date, amount: payForm.amount, note: payForm.note,
        payment_mode: payForm.payment_mode, cheque_no: payForm.cheque_no||null,
        cheque_date: payForm.cheque_date||null, clearance_date: payForm.clearance_date||null,
        cheque_status: payForm.cheque_status,
      }).eq('id', editingPayment.id);
      if (error) { showToast('Failed to update payment: '+error.message,'error'); setSaving(false); return; }
      const updatedPayments = payments.map(p => p.id===editingPayment.id ? {...p, ...payForm} : p);
      await recalcBillPaidStatus(payForm.bill_id, updatedPayments);
      await syncPaymentToLedger({ ...payForm, id: editingPayment.id });
      showToast('Payment updated!','success');
    } else {
      const { data, error } = await supabase.from('purchase_payments').insert([payForm]).select().single();
      if (error) { showToast('Failed to record payment: '+error.message,'error'); setSaving(false); return; }
      const updatedPayments = [...payments, data];
      await recalcBillPaidStatus(payForm.bill_id, updatedPayments);
      if (data?.id) await syncPaymentToLedger(data);
      showToast('Payment recorded!','success');
    }
    setShowPayModal(false); setEditingPayment(null); fetchData(); setSaving(false);
  };

  const deletePayment = async (payment: Payment) => {
    if (!payment.id) return;
    setDeleting(payment.id);
    const { error } = await supabase.from('purchase_payments').delete().eq('id',payment.id);
    if (error) { showToast('Failed to delete payment: '+error.message,'error'); setDeleting(null); return; }
    const updatedPayments = payments.filter(p=>p.id!==payment.id);
    await recalcBillPaidStatus(payment.bill_id, updatedPayments);
    await removePaymentFromLedger(payment.id);
    showToast('Payment deleted.','success'); fetchData(); setDeleting(null);
  };

  const deleteBill = async (id:string) => { setDeleting(id); await supabase.from('purchase_bills').delete().eq('id',id); await removeBillFromLedger(id); showToast('Deleted.','success'); fetchData(); setDeleting(null); };
  const deleteVendor = async (id:string) => { setDeleting(id); await supabase.from('vendors').delete().eq('id',id); showToast('Deleted.','success'); fetchData(); setDeleting(null); };

  // ── PDF GST Invoice ────────────────────────────────────────────────────
  const printBill = (bill: Bill) => {
    const bItems = billItems.filter(i=>i.bill_id===bill.id);
    const subTotal = bItems.reduce((s,i)=>s+i.amount_before_tax,0);
    const totalTax = bItems.reduce((s,i)=>s+i.tax_amount,0);
    const exactGrandTotal = bItems.reduce((s,i)=>s+i.total_price,0)||bill.total_amount;
    const grandTotal = Math.round(exactGrandTotal);
    const roundOff = round2(grandTotal - exactGrandTotal);
    const win = window.open('','_blank');
    if(!win) return;
    win.document.write(`<html><head><title>GST Invoice - ${bill.bill_number}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Arial,sans-serif;padding:20px;color:#111;font-size:12px}
      .header{text-align:center;border-bottom:2px solid #333;padding-bottom:10px;margin-bottom:10px}
      .company{font-size:20px;font-weight:bold;color:#7C3AED}
      .subtitle{font-size:11px;color:#555}
      .title-box{background:#7C3AED;color:white;text-align:center;padding:6px;font-weight:bold;margin:8px 0;letter-spacing:1px}
      .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}
      .info-box{border:1px solid #ddd;padding:8px;border-radius:4px}
      .info-label{font-size:10px;color:#777;margin-bottom:2px}
      .info-row{display:flex;justify-content:space-between;margin-bottom:2px}
      table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:8px}
      th{background:#7C3AED;color:white;padding:6px 4px;text-align:center;font-size:10px}
      td{padding:5px 4px;border:1px solid #ddd;text-align:center}
      td:first-child{text-align:left}
      .totals{margin-left:auto;width:280px;border:1px solid #ddd}
      .totals td{padding:5px 8px}
      .total-row td{background:#F3F4F6}
      .tax-breakdown{margin-left:auto;width:420px;font-size:10px}
      .tax-breakdown th{font-size:9px;padding:5px 4px}
      .tax-breakdown td{padding:4px}
      .grand-total td{background:#7C3AED;color:white;font-weight:bold;font-size:14px}
      .footer{text-align:center;margin-top:20px;font-size:10px;color:#777;border-top:1px solid #ddd;padding-top:8px}
      .sign-box{display:flex;justify-content:space-between;margin-top:30px}
      .sign{border-top:1px solid #333;width:150px;text-align:center;padding-top:4px;font-size:10px}
    </style></head><body>
    <div class="header">
      <div class="company">OdooERP — TAX INVOICE</div>
      <div class="subtitle">Original Copy</div>
    </div>
    <div class="title-box">PURCHASE INVOICE</div>
    <div class="info-grid">
      <div class="info-box">
        <div class="info-label">VENDOR DETAILS</div>
        <strong>${bill.vendor_name}</strong><br>
        GSTIN: ${bill.vendor_gstin||'N/A'}<br>
      </div>
      <div class="info-box">
        <div class="info-label">INVOICE DETAILS</div>
        <div class="info-row"><span>Invoice No:</span><strong>${bill.bill_number}</strong></div>
        <div class="info-row"><span>Date:</span><span>${formatDate(bill.bill_date)}</span></div>
        <div class="info-row"><span>Due Date:</span><span>${bill.due_date?formatDate(bill.due_date):'N/A'}</span></div>
        <div class="info-row"><span>Our GSTIN:</span><span>${bill.buyer_gstin||'N/A'}</span></div>
        <div class="info-row"><span>Place of Supply:</span><span>${bill.place_of_supply||'N/A'}</span></div>
      </div>
    </div>
    ${bill.transport||bill.vehicle_no?`<div class="info-box" style="margin-bottom:8px"><div class="info-label">TRANSPORT DETAILS</div>
      <div class="info-row"><span>Transport:</span><span>${bill.transport||'-'}</span></div>
      <div class="info-row"><span>Vehicle No:</span><span>${bill.vehicle_no||'-'}</span></div>
      <div class="info-row"><span>E-Way Bill:</span><span>${bill.eway_bill||'-'}</span></div>
    </div>`:''}
    <table>
      <thead><tr>
        <th style="width:30px">#</th>
        <th style="text-align:left">Description</th>
        <th>HSN/SAC</th>
        <th>Qty</th>
        <th>Unit</th>
        <th>Rate (₹)</th>
        <th>Disc%</th>
        <th>Taxable Amt</th>
        <th>Tax%</th>
        <th>Tax Amt</th>
        <th>Total (₹)</th>
      </tr></thead>
      <tbody>
        ${bItems.length>0 ? bItems.map((item,i)=>`<tr>
          <td>${i+1}</td>
          <td style="text-align:left">${item.product_name}${item.description?`<br><span style="font-size:10px;color:#6B7280;font-style:italic">${item.description}</span>`:''}</td>
          <td>${item.hsn_code||'-'}</td>
          <td>${item.quantity}</td>
          <td>${item.unit}</td>
          <td>${item.unit_price.toLocaleString('en-IN')}</td>
          <td>${item.discount_percent||0}%</td>
          <td>${fmtMoney(item.amount_before_tax)}</td>
          <td>${item.tax_percent}%</td>
          <td>${fmtMoney(item.tax_amount)}</td>
          <td><strong>${fmtMoney(item.total_price)}</strong></td>
        </tr>`).join('') : `<tr><td colspan="11" style="text-align:center;color:#999">No items recorded</td></tr>`}
      </tbody>
    </table>
    ${(() => {
      const rateGroups = groupByTaxRate(bItems);
      const intra = isIntraState(bill.vendor_gstin, bill.buyer_gstin);
      if (rateGroups.length === 0) return '';
      return `
      <table class="tax-breakdown">
        <thead><tr>
          <th style="text-align:left">Tax Rate</th>
          <th>Taxable Amt</th>
          ${intra ? '<th>CGST Amt</th><th>SGST Amt</th>' : '<th>IGST Amt</th>'}
          <th>Total Tax</th>
        </tr></thead>
        <tbody>
          ${rateGroups.map(g=>`<tr>
            <td style="text-align:left">${g.rate}%</td>
            <td>${fmtMoney(g.taxable)}</td>
            ${intra ? `<td>${fmtMoney(g.tax/2)}</td><td>${fmtMoney(g.tax/2)}</td>` : `<td>${fmtMoney(g.tax)}</td>`}
            <td><strong>${fmtMoney(g.tax)}</strong></td>
          </tr>`).join('')}
          <tr class="total-row">
            <td style="text-align:left"><strong>Total</strong></td>
            <td><strong>${fmtMoney(subTotal)}</strong></td>
            ${intra ? `<td><strong>${fmtMoney(totalTax/2)}</strong></td><td><strong>${fmtMoney(totalTax/2)}</strong></td>` : `<td><strong>${fmtMoney(totalTax)}</strong></td>`}
            <td><strong>${fmtMoney(totalTax)}</strong></td>
          </tr>
        </tbody>
      </table>`;
    })()}
    <table class="totals">
      <tr class="total-row"><td>Subtotal (before tax)</td><td style="text-align:right"><strong>₹${fmtMoney(subTotal)}</strong></td></tr>
      <tr class="total-row"><td>Total GST</td><td style="text-align:right"><strong>₹${fmtMoney(totalTax)}</strong></td></tr>
      <tr><td>Rounded Off</td><td style="text-align:right;color:#888">${roundOff>=0?'+':''}₹${fmtMoney(roundOff)}</td></tr>
      <tr><td>Amount Paid</td><td style="text-align:right;color:#16A34A"><strong>₹${bill.paid_amount.toLocaleString('en-IN')}</strong></td></tr>
      <tr><td>Balance Due</td><td style="text-align:right;color:#DC2626"><strong>₹${(grandTotal-bill.paid_amount).toLocaleString('en-IN')}</strong></td></tr>
      <tr class="grand-total"><td>GRAND TOTAL</td><td style="text-align:right">₹${grandTotal.toLocaleString('en-IN')}</td></tr>
    </table>
    ${bill.notes?`<p style="font-size:11px;color:#555;margin-top:8px">Notes: ${bill.notes}</p>`:''}
    <div class="sign-box">
      <div class="sign">Receiver's Signature</div>
      <div class="sign">Authorised Signatory</div>
    </div>
    <div class="footer">Generated by OdooERP • ${new Date().toLocaleString('en-IN')} • This is a computer-generated invoice</div>
    </body></html>`);
    win.document.close(); setTimeout(()=>win.print(),500);
  };

  // ── Price compare ──────────────────────────────────────────────────────
  // Grouped by product name + spec/description together, since e.g. "HR COIL"
  // at 12G4' and 14G4' are genuinely different products and shouldn't be
  // compared against each other as if they were the same item.
  const priceMap: Record<string,{vendor:string;price:number;date:string;productName:string;description?:string}[]> = {};
  billItems.forEach(item=>{
    const bill=bills.find(b=>b.id===item.bill_id); if(!bill) return;
    const spec = item.description?.trim();
    const groupKey = spec ? `${item.product_name} — ${spec}` : item.product_name;
    if(!priceMap[groupKey]) priceMap[groupKey]=[];
    priceMap[groupKey].push({vendor:bill.vendor_name,price:item.unit_price,date:bill.bill_date,productName:item.product_name,description:spec});
  });

  // Filter + sort bills (moved up — see right after filter state declarations)
  const grandItemTotal = items.filter(i=>i.product_name).reduce((s,i)=>s+i.total_price,0);
  const grandTaxTotal = items.filter(i=>i.product_name).reduce((s,i)=>s+i.tax_amount,0);
  const grandSubTotal = items.filter(i=>i.product_name).reduce((s,i)=>s+i.amount_before_tax,0);
  const grandTotalRounded = Math.round(grandItemTotal);
  const roundOffAmt = round2(grandTotalRounded - grandItemTotal);

  return (
    <div className="space-y-6">
      <AnimatePresence>{toast&&<motion.div initial={{opacity:0,y:-20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-20}} className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${toast.type==='success'?'bg-green-600':'bg-red-500'}`}>{toast.msg}</motion.div>}</AnimatePresence>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Bills" value={loading?'...':String(filteredBills.length)} change="+3" positive icon={<ShoppingCart size={20}/>} color="#2563EB" bg="#DBEAFE" delay={0.05}/>
        <StatCard title="Total Purchased" value={loading?'...':'₹'+totalBills.toLocaleString('en-IN')} change="+12%" positive icon={<IndianRupee size={20}/>} color="#7C3AED" bg="#EDE9FE" delay={0.1}/>
        <StatCard title="Amount Due" value={loading?'...':'₹'+totalDue.toLocaleString('en-IN')} change="" positive={false} icon={<AlertCircle size={20}/>} color="#DC2626" bg="#FEE2E2" delay={0.15}/>
        <StatCard title="Overdue" value={loading?'...':String(overdueBills)} change="" positive={false} icon={<TrendingDown size={20}/>} color="#D97706" bg="#FEF3C7" delay={0.2}/>
      </div>

      <div className="flex gap-2 flex-wrap">
        {([['bills','📋 Bills'],['creditnotes','↩️ Credit Notes'],['vendors','🏪 Vendors'],['compare','📊 Price Compare']] as const).map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab===id?'bg-blue-600 text-white':'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>{label}</button>
        ))}
      </div>

      {/* BILLS */}
      {tab==='bills' && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h3 className="font-bold text-gray-800">Purchase Bills <span className="text-blue-500">({bills.length})</span></h3>
            <button onClick={()=>{ setEditingBill(null); setBillForm(emptyBill); setItems([emptyItem()]); setShowBillModal(true); }}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"><Plus size={13}/> New Bill</button>
          </div>
          {/* Filters */}
          <div className="flex flex-col gap-3 mb-4 p-3 bg-gray-50 rounded-xl">
            <div className="flex gap-2 flex-wrap items-center">
              <input value={searchText} onChange={e=>setSearchText(e.target.value)} placeholder="🔍 Search anything: vendor, bill no, GST, amount, cheque no..." className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none bg-white w-72"/>
              <select value={filterVendor} onChange={e=>setFilterVendor(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none bg-white">
                <option value="">All Vendors</option>
                {availableVendors.map(v=><option key={v} value={v}>{v}</option>)}
              </select>
              <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none bg-white">
                <option value="">All Statuses</option>
                <option value="Paid">Paid</option>
                <option value="Unpaid">Unpaid</option>
                <option value="Partial">Partial</option>
                <option value="Overdue">Overdue</option>
              </select>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <span className="text-xs font-medium text-gray-500">Filter:</span>
              <select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none bg-white">
                <option value="">All Months</option>
                {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m,i)=><option key={i} value={i}>{m}</option>)}
              </select>
              <select value={filterYear} onChange={e=>setFilterYear(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none bg-white">
                <option value="">All Years</option>
                {availableYears.map(y=><option key={y} value={y}>{y}</option>)}
              </select>
              <input value={filterMinAmt} onChange={e=>setFilterMinAmt(e.target.value)} type="number" placeholder="Min ₹" className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none bg-white w-24"/>
              <span className="text-xs text-gray-400">to</span>
              <input value={filterMaxAmt} onChange={e=>setFilterMaxAmt(e.target.value)} type="number" placeholder="Max ₹" className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none bg-white w-24"/>
              <select value={sortOrder} onChange={e=>setSortOrder(e.target.value as any)} className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none bg-white">
                <option value="newest">↓ Newest First</option>
                <option value="oldest">↑ Oldest First</option>
              </select>
              {activeFilterCount>0 && <button onClick={clearAllFilters} className="text-xs text-red-500 hover:text-red-700 px-2 py-1 bg-red-50 rounded-lg">✕ Clear {activeFilterCount} filter{activeFilterCount!==1?'s':''}</button>}
              <span className="text-xs text-gray-400 ml-auto">{filteredBills.length} bill{filteredBills.length!==1?'s':''} shown</span>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <span className="text-xs font-medium text-gray-500">Custom Range:</span>
              <input value={filterDateFrom} onChange={e=>setFilterDateFrom(e.target.value)} type="date" className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none bg-white"/>
              <span className="text-xs text-gray-400">to</span>
              <input value={filterDateTo} onChange={e=>setFilterDateTo(e.target.value)} type="date" className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none bg-white"/>
              <button onClick={()=>{
                const now = new Date();
                const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear()-1; // FY starts April
                setFilterDateFrom(`${fyStartYear}-04-01`);
                setFilterDateTo(`${fyStartYear+1}-03-31`);
                setFilterMonth(''); setFilterYear('');
              }} className="text-xs text-purple-600 hover:text-purple-800 px-2 py-1 bg-purple-50 rounded-lg">📅 This Financial Year</button>
              {(filterDateFrom||filterDateTo) && <button onClick={()=>{setFilterDateFrom('');setFilterDateTo('');}} className="text-xs text-gray-400 hover:text-gray-600">✕ Clear range</button>}
            </div>
          </div>
          {loading?<div className="flex items-center justify-center py-12 text-gray-400"><Loader size={20} className="animate-spin mr-2"/>Loading...</div>
          :filteredBills.length===0?<div className="text-center py-12 text-gray-400"><ShoppingCart size={36} className="mx-auto mb-2 opacity-30"/><p>{bills.length>0?'No bills match filter':'No bills yet'}</p></div>
          :(
            <div className="space-y-3">
              {filteredBills.map(bill=>{
                const bPays=payments.filter(p=>p.bill_id===bill.id);
                const bItems=billItems.filter(i=>i.bill_id===bill.id);
                const linkedCNs = creditNotes.filter(cn=>cn.bill_id===bill.id);
                const cnTotal = linkedCNs.reduce((s,cn)=>s+cn.total_amount,0);
                const due=bill.total_amount-bill.paid_amount-cnTotal;
                const isOverdue=due>0&&bill.due_date&&new Date(bill.due_date)<new Date();
                return (
                  <div key={bill.id} className={`border rounded-xl overflow-hidden ${isOverdue?'border-red-200':'border-gray-100'}`}>
                    <div className={`p-4 ${isOverdue?'bg-red-50':'bg-white'}`}>
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-bold text-gray-800">{bill.bill_number}</span>
                            {bill.invoice_no&&<span className="text-xs text-gray-400">({bill.invoice_no})</span>}
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle[bill.status]}`}>{bill.status}</span>
                            {isOverdue&&<span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">⚠ Overdue</span>}
                            {linkedCNs.length>0&&<span className="px-2 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-600">↩️ Credit Note: ₹{linkedCNs.reduce((s,c)=>s+c.total_amount,0).toLocaleString('en-IN')}</span>}
                          </div>
                          <p className="text-sm text-gray-600">🏪 {bill.vendor_name} {bill.vendor_gstin&&`· GST: ${bill.vendor_gstin}`} {getVendorPhone(bill.vendor_name)&&`· 📞 ${getVendorPhone(bill.vendor_name)}`}</p>
                          <p className="text-xs text-gray-400">📅 {formatDate(bill.bill_date)} {bill.due_date&&`· Due: ${formatDate(bill.due_date)}`} {bill.place_of_supply&&`· ${bill.place_of_supply}`}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-800">₹{bill.total_amount.toLocaleString('en-IN')}</p>
                          <p className="text-xs text-green-600">Paid: ₹{bill.paid_amount.toLocaleString('en-IN')}</p>
                          {due>0&&<p className="text-xs text-red-500 font-bold">Due: ₹{due.toLocaleString('en-IN')}</p>}
                        </div>
                        <div className="flex gap-1 items-center flex-wrap">
                          {bill.status!=='Paid'&&<button onClick={()=>{ setEditingPayment(null); setPayForm({bill_id:bill.id!,vendor_name:bill.vendor_name,payment_date:new Date().toISOString().split('T')[0],amount:due,note:'',payment_mode:'Cash',cheque_no:'',cheque_date:'',clearance_date:'',cheque_status:'N/A'}); setShowPayModal(true); }} className="px-2 py-1 bg-green-50 text-green-600 rounded-lg text-xs hover:bg-green-100">💰 Pay</button>}
                          <button onClick={()=>printBill(bill)} className="px-2 py-1 bg-violet-50 text-violet-600 rounded-lg text-xs hover:bg-violet-100 flex items-center gap-1"><FileText size={11}/> PDF</button>
                          <button onClick={()=>setShowItemsFor(showItemsFor===bill.id?null:bill.id!)} className="w-7 h-7 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400">
                            {showItemsFor===bill.id?<ChevronUp size={13}/>:<ChevronDown size={13}/>}
                          </button>
                          <button onClick={()=>{ setEditingBill(bill); setBillForm({...bill}); const existing=billItems.filter(i=>i.bill_id===bill.id); setItems(existing.length>0?existing.map(calcItem):[emptyItem()]); setShowBillModal(true); }} className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center text-blue-500"><Edit2 size={11}/></button>
                          <button onClick={()=>deleteBill(bill.id!)} disabled={deleting===bill.id} className="w-7 h-7 bg-red-50 rounded-lg flex items-center justify-center text-red-400">{deleting===bill.id?<Loader size={11} className="animate-spin"/>:<Trash2 size={11}/>}</button>
                        </div>
                      </div>
                    </div>
                    {showItemsFor===bill.id&&(
                      <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-3">
                        {bItems.length>0&&(
                          <div>
                            <p className="text-xs font-bold text-gray-600 mb-2">📦 Items:</p>
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead><tr className="text-gray-400 border-b border-gray-200">
                                  <th className="text-left pb-1">#</th><th className="text-left pb-1">Product</th><th className="text-left pb-1">HSN</th>
                                  <th className="text-right pb-1">Qty</th><th className="text-left pb-1">Unit</th><th className="text-right pb-1">Rate</th>
                                  <th className="text-right pb-1">Disc%</th><th className="text-right pb-1">Taxable</th><th className="text-right pb-1">GST%</th>
                                  <th className="text-right pb-1">Tax</th><th className="text-right pb-1">Total</th>
                                </tr></thead>
                                <tbody>
                                  {bItems.map((item,i)=>(
                                    <tr key={i} className="border-b border-gray-100">
                                      <td className="py-1">{i+1}</td>
                                      <td className="py-1 font-medium">{item.product_name}{item.description&&<><br/><span className="text-[11px] italic text-gray-400">{item.description}</span></>}</td>
                                      <td className="py-1 font-mono text-gray-400">{item.hsn_code||'-'}</td>
                                      <td className="py-1 text-right">{item.quantity}</td>
                                      <td className="py-1">{item.unit}</td>
                                      <td className="py-1 text-right">₹{item.unit_price}</td>
                                      <td className="py-1 text-right">{item.discount_percent||0}%</td>
                                      <td className="py-1 text-right">₹{fmtMoney(item.amount_before_tax)}</td>
                                      <td className="py-1 text-right">{item.tax_percent}%</td>
                                      <td className="py-1 text-right text-orange-500">₹{fmtMoney(item.tax_amount)}</td>
                                      <td className="py-1 text-right font-bold">₹{fmtMoney(item.total_price)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                        {bPays.length>0&&(
                          <div>
                            <p className="text-xs font-bold text-gray-600 mb-1">💰 Payments:</p>
                            {bPays.map((p,i)=>(
                              <div key={i} className="flex justify-between items-center text-xs py-1 border-b border-gray-100">
                                <span className="text-gray-500">{formatDate(p.payment_date)} {p.payment_mode?`· ${p.payment_mode}`:''}{p.cheque_no?` #${p.cheque_no}`:''}{p.cheque_date?` (Chq: ${formatDate(p.cheque_date)})`:''}{p.clearance_date?` ✅ Cleared: ${formatDate(p.clearance_date)}`:''}</span>
                                {p.payment_mode==='Cheque'&&p.cheque_status&&p.cheque_status!=='N/A'&&(
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${p.cheque_status==='Cleared'?'bg-green-100 text-green-700':p.cheque_status==='Bounced'?'bg-red-100 text-red-700':p.cheque_status==='Cancelled'?'bg-gray-100 text-gray-600':'bg-yellow-100 text-yellow-700'}`}>{p.cheque_status}</span>
                                )}
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-green-600">₹{p.amount.toLocaleString('en-IN')}</span>
                                  <button onClick={()=>{ setEditingPayment(p); setPayForm({...p}); setShowPayModal(true); }} className="w-5 h-5 bg-blue-50 rounded flex items-center justify-center text-blue-500"><Edit2 size={9}/></button>
                                  <button onClick={()=>deletePayment(p)} disabled={deleting===p.id} className="w-5 h-5 bg-red-50 rounded flex items-center justify-center text-red-500 disabled:opacity-50"><Trash2 size={9}/></button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {bItems.length===0&&bPays.length===0&&<p className="text-xs text-gray-400 text-center">No items recorded. Click Edit to add items.</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CREDIT NOTES */}
      {tab==='creditnotes'&&(
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h3 className="font-bold text-gray-800">Credit Notes <span className="text-pink-500">({creditNotes.length})</span></h3>
            <button onClick={()=>{ setEditingCN(null); setCnForm(emptyCreditNote); setCnItems([emptyCNItem()]); setShowCNModal(true); }}
              className="flex items-center gap-1 px-3 py-1.5 bg-pink-600 text-white rounded-lg text-sm hover:bg-pink-700"><Plus size={13}/> New Credit Note</button>
          </div>
          {creditNotes.length===0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No credit notes yet. Create one when a vendor returns goods or issues a credit against a bill.</p>
          ) : (
            <div className="space-y-3">
              {creditNotes.map(cn=>{
                const linkedBill = bills.find(b=>b.id===cn.bill_id);
                const cnItemsForThis = creditNoteItems.filter(i=>i.credit_note_id===cn.id);
                return (
                  <div key={cn.id} className="border border-pink-100 rounded-xl p-4 bg-pink-50/30">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-bold text-gray-800">↩️ {cn.credit_note_number}</span>
                          {linkedBill && <span className="text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">against bill {linkedBill.bill_number}</span>}
                        </div>
                        <p className="text-sm text-gray-600">🏪 {cn.vendor_name} {cn.vendor_gstin&&`· GST: ${cn.vendor_gstin}`}</p>
                        <p className="text-xs text-gray-400">📅 {formatDate(cn.credit_note_date)} {cn.reason&&`· ${cn.reason}`}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-pink-600">₹{cn.total_amount.toLocaleString('en-IN')}</p>
                      </div>
                      <div className="flex gap-1 items-center">
                        <button onClick={()=>{ setEditingCN(cn); setCnForm({...cn}); const existing=cnItemsForThis; setCnItems(existing.length>0?existing.map(calcItem):[emptyCNItem()]); setShowCNModal(true); }} className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center text-blue-500"><Edit2 size={11}/></button>
                        <button onClick={()=>deleteCreditNote(cn.id!)} disabled={deleting===cn.id} className="w-7 h-7 bg-red-50 rounded-lg flex items-center justify-center text-red-500 disabled:opacity-50"><Trash2 size={11}/></button>
                      </div>
                    </div>
                    {cnItemsForThis.length>0 && (
                      <div className="mt-3 pt-3 border-t border-pink-100">
                        <p className="text-xs font-bold text-gray-500 mb-1">Returned Items:</p>
                        <table className="w-full text-xs">
                          <thead><tr className="text-gray-400"><th className="text-left">Product</th><th className="text-right">Qty</th><th className="text-right">Rate</th><th className="text-right">Total</th></tr></thead>
                          <tbody>
                            {cnItemsForThis.map((it,i)=>(
                              <tr key={i} className="border-t border-pink-50">
                                <td className="py-1">{it.product_name}{it.description&&<span className="text-gray-400 italic"> ({it.description})</span>}</td>
                                <td className="text-right py-1">{it.quantity} {it.unit}</td>
                                <td className="text-right py-1">₹{it.unit_price.toLocaleString('en-IN')}</td>
                                <td className="text-right py-1 font-bold">₹{fmtMoney(it.total_price)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VENDORS */}
      {tab==='vendors'&&(
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h3 className="font-bold text-gray-800">Vendors ({vendors.length})</h3>
            <button onClick={()=>{ setEditingVendor(null); setVendorForm(emptyVendor); setShowVendorModal(true); }} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"><Plus size={13}/> Add Vendor</button>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {vendors.map(v=>{
              const vBills=bills.filter(b=>b.vendor_name===v.name);
              const vTotal=vBills.reduce((s,b)=>s+b.total_amount,0);
              const vDue=vBills.reduce((s,b)=>s+(b.total_amount-b.paid_amount),0);
              return (
                <div key={v.id} className="p-4 border border-gray-100 rounded-xl hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 font-bold">{v.name[0]}</div>
                      <div>
                        <p className="font-bold text-gray-800">{v.name}</p>
                        <p className="text-xs text-gray-400">{v.phone}</p>
                        {v.gstin&&<p className="text-xs font-mono text-gray-400">GST: {v.gstin}</p>}
                        <p className="text-xs text-gray-400">{v.address}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={()=>{ setEditingVendor(v); setVendorForm({...v}); setShowVendorModal(true); }} className="w-7 h-7 bg-blue-50 rounded flex items-center justify-center text-blue-500"><Edit2 size={11}/></button>
                      <button onClick={()=>deleteVendor(v.id!)} disabled={deleting===v.id} className="w-7 h-7 bg-red-50 rounded flex items-center justify-center text-red-400">{deleting===v.id?<Loader size={11} className="animate-spin"/>:<Trash2 size={11}/>}</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <div className="bg-gray-50 rounded-lg p-2 text-center"><p className="text-xs text-gray-400">Bills</p><p className="font-bold text-gray-700">{vBills.length}</p></div>
                    <div className="bg-blue-50 rounded-lg p-2 text-center"><p className="text-xs text-gray-400">Total</p><p className="font-bold text-blue-600">₹{(vTotal/1000).toFixed(0)}K</p></div>
                    <div className={`rounded-lg p-2 text-center ${vDue>0?'bg-red-50':'bg-green-50'}`}><p className="text-xs text-gray-400">Due</p><p className={`font-bold ${vDue>0?'text-red-500':'text-green-600'}`}>{vDue>0?`₹${vDue.toLocaleString('en-IN')}`:'✓ Clear'}</p></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PRICE COMPARE */}
      {tab==='compare'&&(
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4">📊 Price Comparison by Product</h3>
          <input value={compareProduct} onChange={e=>setCompareProduct(e.target.value)} placeholder="Search product..." className="w-full max-w-xs border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 mb-4"/>
          {Object.keys(priceMap).filter(p=>!compareProduct||p.toLowerCase().includes(compareProduct.toLowerCase())).length===0
            ?<p className="text-center text-gray-400 py-8">Add bills with items to compare prices.</p>
            :Object.keys(priceMap).filter(p=>!compareProduct||p.toLowerCase().includes(compareProduct.toLowerCase())).map(product=>{
              const prices=priceMap[product].sort((a,b)=>a.price-b.price);
              const minP=prices[0].price, maxP=prices[prices.length-1].price;
              return (
                <div key={product} className="mb-5 p-4 border border-gray-100 rounded-xl">
                  <h4 className="font-bold text-gray-800 mb-3">
                    {product.includes(' — ') ? (
                      <>{product.split(' — ')[0]} <span className="italic text-gray-500 font-normal">— {product.split(' — ').slice(1).join(' — ')}</span></>
                    ) : product}
                    {' '}<span className="text-xs text-gray-400 font-normal">· {prices.length} vendor{prices.length>1?'s':''}</span>
                  </h4>
                  {prices.map((p,i)=>{
                    const isMin=p.price===minP, isMax=p.price===maxP&&prices.length>1;
                    const pct=maxP>minP?((p.price-minP)/(maxP-minP))*100:0;
                    return (
                      <div key={i} className={`flex items-center gap-3 p-2.5 rounded-lg mb-2 ${isMin?'bg-green-50 border border-green-200':isMax?'bg-red-50 border border-red-100':'bg-gray-50'}`}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{background:isMin?'#16A34A':isMax?'#DC2626':'#6B7280'}}>{p.vendor[0]}</div>
                        <div className="flex-1">
                          <div className="flex justify-between mb-1">
                            <span className="text-sm font-semibold">{p.vendor}</span>
                            <span className={`font-bold text-sm ${isMin?'text-green-600':isMax?'text-red-500':'text-gray-700'}`}>₹{p.price}/unit {isMin?'✓ Cheapest':isMax?'↑ Expensive':''}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full" style={{width:`${Math.max(pct,5)}%`,background:isMin?'#16A34A':isMax?'#DC2626':'#9CA3AF'}}/>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">Last: {formatDate(p.date)}</p>
                        </div>
                      </div>
                    );
                  })}
                  {prices.length>1&&<div className="mt-2 p-2 bg-blue-50 rounded-lg text-xs"><span className="text-gray-600">Savings from cheapest: </span><span className="font-bold text-blue-600">₹{(maxP-minP).toLocaleString('en-IN')}/unit</span></div>}
                </div>
              );
            })
          }
        </div>
      )}

      {/* BILL MODAL */}
      <AnimatePresence>{showBillModal&&(
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={e=>{if(e.target===e.currentTarget){setShowBillModal(false);setEditingBill(null);}}}>
          <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.9,opacity:0}} className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="font-bold text-gray-800">{editingBill?'Edit Bill':'New GST Purchase Bill'}</h2>
              <button onClick={()=>{setShowBillModal(false);setEditingBill(null);}} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"><X size={14}/></button>
            </div>
            <div className="p-5 space-y-5">

              {/* AI Photo Scan */}
              {!editingBill && (
                <div className={`rounded-xl p-4 border-2 border-dashed transition-colors ${scanning?'border-violet-300 bg-violet-50':'border-violet-200 bg-violet-50/50 hover:bg-violet-50'}`}>
                  <input id="bill-photo-input" type="file" accept="image/*,.pdf" className="hidden"
                    onChange={e=>{ const f=e.target.files?.[0]; if(f) scanBillPhoto(f); }}/>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center text-xl">📸</div>
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">Scan Bill Photo with AI</p>
                        <p className="text-xs text-gray-500">Upload a photo of the invoice — fields fill in automatically</p>
                      </div>
                    </div>
                    <button onClick={()=>document.getElementById('bill-photo-input')?.click()} disabled={scanning}
                      className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-60 whitespace-nowrap">
                      {scanning?<><Loader size={14} className="animate-spin"/> Reading bill...</>:<>📷 Upload Photo</>}
                    </button>
                  </div>
                  {scanError && <p className="text-xs text-red-500 mt-2">{scanError}</p>}
                </div>
              )}

              {/* Section 1: Bill Info */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase mb-2">📋 Invoice Details</p>
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                  {[{label:'Bill/Invoice No *',key:'bill_number',ph:'BILL-004'},{label:'Vendor Invoice No',key:'invoice_no',ph:'ST/2603/2025-26'},{label:'Bill Date',key:'bill_date',type:'date'},{label:'Due Date',key:'due_date',type:'date'}].map(f=>(
                    <div key={f.key}><label className="block text-xs font-medium text-gray-700 mb-1">{f.label}</label>
                    <input ref={setHeaderFieldRef(f.key)} onKeyDown={e=>handleHeaderKeyDown(e,f.key)} type={f.type||'text'} value={(billForm as any)[f.key]} onChange={e=>setBillForm({...billForm,[f.key]:e.target.value})} placeholder={(f as any).ph||''} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"/></div>
                  ))}
                </div>
                {findDuplicateBill() && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mt-2">
                    ⚠️ A bill numbered "{billForm.bill_number}" already exists for {findDuplicateBill()!.vendor_name} (₹{findDuplicateBill()!.total_amount.toLocaleString('en-IN')}, {findDuplicateBill()!.status}). You can still save, but check this isn't a duplicate entry.
                  </p>
                )}
              </div>

              {/* Section 2: Vendor */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase mb-2">🏪 Vendor Details</p>
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Vendor Name *</label>
                  <input ref={setHeaderFieldRef('vendor_name')} onKeyDown={e=>handleHeaderKeyDown(e,'vendor_name')} value={billForm.vendor_name} onChange={e=>handleVendorPick(e.target.value)} onBlur={completeVendorName} list="vendor-list" placeholder="e.g. Saini Traders" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"/>
                  <datalist id="vendor-list">{vendors.map(v=><option key={v.id} value={v.name}/>)}</datalist></div>
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Vendor GSTIN</label>
                  <input ref={setHeaderFieldRef('vendor_gstin')} onKeyDown={e=>handleHeaderKeyDown(e,'vendor_gstin')} value={billForm.vendor_gstin||''} onChange={e=>setBillForm({...billForm,vendor_gstin:e.target.value})} placeholder="03EPMP56722A1ZZ" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none font-mono"/></div>
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Our GSTIN (Buyer)</label>
                  <input ref={setHeaderFieldRef('buyer_gstin')} onKeyDown={e=>handleHeaderKeyDown(e,'buyer_gstin')} value={billForm.buyer_gstin||''} onChange={e=>setBillForm({...billForm,buyer_gstin:e.target.value})} placeholder="03AMDPT2761L1ZV" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none font-mono"/></div>
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Place of Supply</label>
                  <input ref={setHeaderFieldRef('place_of_supply')} onKeyDown={e=>handleHeaderKeyDown(e,'place_of_supply')} value={billForm.place_of_supply||''} onChange={e=>setBillForm({...billForm,place_of_supply:e.target.value})} placeholder="Punjab (03)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"/></div>
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Transport</label>
                  <input ref={setHeaderFieldRef('transport')} onKeyDown={e=>handleHeaderKeyDown(e,'transport')} value={billForm.transport||''} onChange={e=>setBillForm({...billForm,transport:e.target.value})} placeholder="CAR / Truck" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"/></div>
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Vehicle No</label>
                  <input ref={setHeaderFieldRef('vehicle_no')} onKeyDown={e=>handleHeaderKeyDown(e,'vehicle_no')} value={billForm.vehicle_no||''} onChange={e=>setBillForm({...billForm,vehicle_no:e.target.value})} placeholder="PB-XX-XXXX" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"/></div>
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">E-Way Bill No</label>
                  <input ref={setHeaderFieldRef('eway_bill')} onKeyDown={e=>handleHeaderKeyDown(e,'eway_bill')} value={billForm.eway_bill||''} onChange={e=>setBillForm({...billForm,eway_bill:e.target.value})} placeholder="E-Way bill number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"/></div>
                  <div className="xl:col-span-2"><label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                  <input ref={setHeaderFieldRef('notes')} onKeyDown={e=>handleHeaderKeyDown(e,'notes')} value={billForm.notes} onChange={e=>setBillForm({...billForm,notes:e.target.value})} placeholder="Optional notes..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"/></div>
                </div>
              </div>

              {/* Section 3: Items */}
              {(
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-gray-500 uppercase">📦 Items Purchased</p>
                    <div className="flex items-center gap-3">
                      {!editingBill && <button onClick={()=>loadLastItemsFor(billForm.vendor_name)} className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1"><Download size={11}/> Load Last Bill's Items</button>}
                      <button onClick={()=>setItems([...items,emptyItem()])} className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"><Plus size={11}/> Add Row</button>
                    </div>
                  </div>
                  <datalist id="product-name-list">{knownProductNames.map(n=><option key={n} value={n}/>)}</datalist>
                  {editingBill && <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 mb-2">⚠️ Editing items here updates the bill only — Inventory stock already added from this bill will NOT change automatically.</p>}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-gray-50 text-gray-500">
                        <th className="p-1.5 text-left font-medium">Product Name</th>
                        <th className="p-1.5 text-left font-medium">HSN Code</th>
                        <th className="p-1.5 font-medium">Qty</th>
                        <th className="p-1.5 font-medium">Unit</th>
                        <th className="p-1.5 font-medium">Rate (₹)</th>
                        <th className="p-1.5 font-medium">Disc%</th>
                        <th className="p-1.5 font-medium">Tax%</th>
                        <th className="p-1.5 font-medium">Taxable</th>
                        <th className="p-1.5 font-medium">Tax Amt</th>
                        <th className="p-1.5 font-medium">Total</th>
                        <th className="p-1.5 font-medium">Inv</th>
                        <th className="p-1.5"/>
                      </tr></thead>
                      <tbody>
                        {items.map((item,i)=>(
                          <tr key={i} className="border-b border-gray-100">
                            <td className="p-1">
                              <input ref={setFieldRef(i,'name')} onKeyDown={e=>handleRowKeyDown(e,i,'name')} value={item.product_name} onChange={e=>updateItem(i,'product_name',e.target.value)} list="product-name-list" placeholder="e.g. HR COIL 72083940" className={`w-36 border rounded px-2 py-1 text-xs focus:outline-none ${!item.product_name?.trim() && (item.quantity||item.unit_price||item.hsn_code) ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}/>
                              <input ref={setFieldRef(i,'desc')} onKeyDown={e=>handleRowKeyDown(e,i,'desc')} value={item.description||''} onChange={e=>updateItem(i,'description',e.target.value)} placeholder="spec e.g. 12G4'" className="w-36 border border-gray-100 rounded px-2 py-1 text-[11px] italic text-gray-500 focus:outline-none mt-1"/>
                            </td>
                            <td className="p-1"><input ref={setFieldRef(i,'hsn')} onKeyDown={e=>handleRowKeyDown(e,i,'hsn')} value={item.hsn_code||''} onChange={e=>updateItem(i,'hsn_code',e.target.value)} placeholder="84821020" className="w-20 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none font-mono"/></td>
                            <td className="p-1"><input ref={setFieldRef(i,'qty')} onKeyDown={e=>handleRowKeyDown(e,i,'qty')} type="number" value={item.quantity||''} onChange={e=>updateItem(i,'quantity',Number(e.target.value))} className="w-14 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none text-center"/></td>
                            <td className="p-1"><select ref={setFieldRef(i,'unit')} onKeyDown={e=>handleRowKeyDown(e,i,'unit')} value={item.unit} onChange={e=>updateItem(i,'unit',e.target.value)} className="w-16 border border-gray-200 rounded px-1 py-1 text-xs focus:outline-none">{UNITS.map(u=><option key={u}>{u}</option>)}</select></td>
                            <td className="p-1"><input ref={setFieldRef(i,'rate')} onKeyDown={e=>handleRowKeyDown(e,i,'rate')} type="number" value={item.unit_price||''} onChange={e=>updateItem(i,'unit_price',Number(e.target.value))} className="w-20 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none text-right"/></td>
                            <td className="p-1"><input ref={setFieldRef(i,'disc')} onKeyDown={e=>handleRowKeyDown(e,i,'disc')} type="number" value={item.discount_percent||''} onChange={e=>updateItem(i,'discount_percent',Number(e.target.value))} placeholder="0" className="w-12 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none text-center"/></td>
                            <td className="p-1"><select ref={setFieldRef(i,'tax')} onKeyDown={e=>handleRowKeyDown(e,i,'tax')} value={item.tax_percent} onChange={e=>updateItem(i,'tax_percent',Number(e.target.value))} className="w-14 border border-gray-200 rounded px-1 py-1 text-xs focus:outline-none">{TAX_RATES.map(r=><option key={r}>{r}</option>)}</select></td>
                            <td className="p-1 text-right font-mono text-blue-600">₹{fmtMoney(item.amount_before_tax)}</td>
                            <td className="p-1 text-right font-mono text-orange-500">₹{fmtMoney(item.tax_amount)}</td>
                            <td className="p-1 text-right font-bold text-green-600">₹{fmtMoney(item.total_price)}</td>
                            <td className="p-1 text-center"><input type="checkbox" checked={item.add_to_inventory} onChange={e=>updateItem(i,'add_to_inventory',e.target.checked)} title="Auto-add to inventory" className="w-3.5 h-3.5 accent-blue-600"/></td>
                            <td className="p-1"><button onClick={()=>setItems(items.filter((_,idx)=>idx!==i))} className="w-5 h-5 bg-red-50 rounded flex items-center justify-center text-red-400 hover:bg-red-100"><X size={9}/></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Tax breakdown by rate (matches real GST invoice format) */}
                  {(() => {
                    const rateGroups = groupByTaxRate(items);
                    const intra = isIntraState(billForm.vendor_gstin, billForm.buyer_gstin);
                    if (rateGroups.length === 0) return null;
                    return (
                      <div className="flex justify-end mt-3">
                        <table className="text-xs border border-gray-200 rounded-lg overflow-hidden min-w-[420px]">
                          <thead><tr className="bg-gray-100 text-gray-600">
                            <th className="text-left px-3 py-1.5">Tax Rate</th>
                            <th className="text-right px-3 py-1.5">Taxable Amt</th>
                            {intra ? <>
                              <th className="text-right px-3 py-1.5">CGST</th>
                              <th className="text-right px-3 py-1.5">SGST</th>
                            </> : <th className="text-right px-3 py-1.5">IGST</th>}
                            <th className="text-right px-3 py-1.5">Total Tax</th>
                          </tr></thead>
                          <tbody>
                            {rateGroups.map(g=>(
                              <tr key={g.rate} className="border-t border-gray-100">
                                <td className="px-3 py-1.5">{g.rate}%</td>
                                <td className="text-right px-3 py-1.5">₹{fmtMoney(g.taxable)}</td>
                                {intra ? <>
                                  <td className="text-right px-3 py-1.5 text-orange-500">₹{fmtMoney(g.tax/2)}</td>
                                  <td className="text-right px-3 py-1.5 text-orange-500">₹{fmtMoney(g.tax/2)}</td>
                                </> : <td className="text-right px-3 py-1.5 text-orange-500">₹{fmtMoney(g.tax)}</td>}
                                <td className="text-right px-3 py-1.5 font-bold">₹{fmtMoney(g.tax)}</td>
                              </tr>
                            ))}
                            <tr className="border-t border-gray-200 bg-gray-50 font-bold">
                              <td className="px-3 py-1.5">Total</td>
                              <td className="text-right px-3 py-1.5">₹{fmtMoney(grandSubTotal)}</td>
                              {intra ? <>
                                <td className="text-right px-3 py-1.5">₹{fmtMoney(grandTaxTotal/2)}</td>
                                <td className="text-right px-3 py-1.5">₹{fmtMoney(grandTaxTotal/2)}</td>
                              </> : <td className="text-right px-3 py-1.5">₹{fmtMoney(grandTaxTotal)}</td>}
                              <td className="text-right px-3 py-1.5">₹{fmtMoney(grandTaxTotal)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                  {/* Totals */}
                  <div className="flex justify-end mt-3">
                    <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1 min-w-48">
                      <div className="flex justify-between"><span className="text-gray-500">Subtotal (before tax):</span><span className="font-bold">₹{fmtMoney(grandSubTotal)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Total GST:</span><span className="font-bold text-orange-600">₹{fmtMoney(grandTaxTotal)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Rounded Off:</span><span className="font-bold text-gray-400">{roundOffAmt>=0?'+':''}₹{fmtMoney(roundOffAmt)}</span></div>
                      <div className="flex justify-between border-t border-gray-200 pt-1"><span className="font-bold">Grand Total:</span><span className="font-bold text-green-600">₹{grandTotalRounded.toLocaleString('en-IN')}</span></div>
                      <p className="text-gray-400 text-[10px]">☑ = auto-add to Inventory</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-100 sticky bottom-0 bg-white">
              <button onClick={()=>{setShowBillModal(false);setEditingBill(null);}} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600">Cancel</button>
              <button onClick={saveBill} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">{saving&&<Loader size={13} className="animate-spin"/>}{saving?'Saving...':editingBill?'Update':'Create Bill'}</button>
            </div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      {/* CREDIT NOTE MODAL */}
      <AnimatePresence>{showCNModal&&(
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={e=>{if(e.target===e.currentTarget){setShowCNModal(false);setEditingCN(null);}}}>
          <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.9,opacity:0}} className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100"><h2 className="font-bold text-gray-800">↩️ {editingCN?'Edit Credit Note':'New Credit Note'}</h2><button onClick={()=>{setShowCNModal(false);setEditingCN(null);}} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"><X size={14}/></button></div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Against Bill (optional)</label>
                <select value={cnForm.bill_id||''} onChange={e=>{
                  const bill = bills.find(b=>b.id===e.target.value);
                  setCnForm({...cnForm, bill_id:e.target.value||undefined, vendor_name:bill?.vendor_name||cnForm.vendor_name, vendor_gstin:bill?.vendor_gstin||cnForm.vendor_gstin});
                }} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-200">
                  <option value="">— Not linked to a specific bill —</option>
                  {bills.map(b=><option key={b.id} value={b.id}>{b.bill_number} — {b.vendor_name} — ₹{b.total_amount.toLocaleString('en-IN')}</option>)}
                </select></div>
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Credit Note No. *</label>
                <input value={cnForm.credit_note_number} onChange={e=>setCnForm({...cnForm,credit_note_number:e.target.value})} placeholder="e.g. CN-001" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-200"/></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Vendor Name *</label>
                <input value={cnForm.vendor_name} onChange={e=>setCnForm({...cnForm,vendor_name:e.target.value})} list="vendor-list" placeholder="e.g. Thukral Machinery Store" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-200"/></div>
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Vendor GSTIN</label>
                <input value={cnForm.vendor_gstin||''} onChange={e=>setCnForm({...cnForm,vendor_gstin:e.target.value})} placeholder="03AAAFT8517F1ZF" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none font-mono"/></div>
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Credit Note Date</label>
                <input type="date" value={cnForm.credit_note_date} onChange={e=>setCnForm({...cnForm,credit_note_date:e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"/></div>
              </div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Reason</label>
              <input value={cnForm.reason||''} onChange={e=>setCnForm({...cnForm,reason:e.target.value})} placeholder="e.g. Damaged goods returned" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"/></div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-gray-500 uppercase">📦 Returned Items</p>
                  <button onClick={()=>setCnItems([...cnItems,emptyCNItem()])} className="text-xs text-pink-500 hover:text-pink-700 flex items-center gap-1"><Plus size={11}/> Add Row</button>
                </div>
                <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50 text-gray-500">
                    <th className="p-1.5 text-left font-medium">Product Name</th>
                    <th className="p-1.5 text-left font-medium">HSN Code</th>
                    <th className="p-1.5 font-medium">Qty</th>
                    <th className="p-1.5 font-medium">Unit</th>
                    <th className="p-1.5 font-medium">Rate (₹)</th>
                    <th className="p-1.5 font-medium">Disc%</th>
                    <th className="p-1.5 font-medium">Tax%</th>
                    <th className="p-1.5 font-medium">Taxable</th>
                    <th className="p-1.5 font-medium">Tax Amt</th>
                    <th className="p-1.5 font-medium">Total</th>
                    <th></th>
                  </tr></thead>
                  <tbody>
                    {cnItems.map((item,i)=>(
                      <tr key={i} className="border-b border-gray-100">
                        <td className="p-1">
                          <input value={item.product_name} onChange={e=>updateCNItem(i,'product_name',e.target.value)} list="product-name-list" placeholder="e.g. HR COIL 72083940" className={`w-36 border rounded px-2 py-1 text-xs focus:outline-none ${!item.product_name?.trim() && (item.quantity||item.unit_price||item.hsn_code) ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}/>
                          <input value={item.description||''} onChange={e=>updateCNItem(i,'description',e.target.value)} placeholder="spec e.g. 12G4'" className="w-36 border border-gray-100 rounded px-2 py-1 text-[11px] italic text-gray-500 focus:outline-none mt-1"/>
                        </td>
                        <td className="p-1"><input value={item.hsn_code||''} onChange={e=>updateCNItem(i,'hsn_code',e.target.value)} placeholder="84821020" className="w-20 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none font-mono"/></td>
                        <td className="p-1"><input type="number" value={item.quantity||''} onChange={e=>updateCNItem(i,'quantity',Number(e.target.value))} className="w-14 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none text-center"/></td>
                        <td className="p-1"><select value={item.unit} onChange={e=>updateCNItem(i,'unit',e.target.value)} className="w-16 border border-gray-200 rounded px-1 py-1 text-xs focus:outline-none">{UNITS.map(u=><option key={u}>{u}</option>)}</select></td>
                        <td className="p-1"><input type="number" value={item.unit_price||''} onChange={e=>updateCNItem(i,'unit_price',Number(e.target.value))} className="w-20 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none text-right"/></td>
                        <td className="p-1"><input type="number" value={item.discount_percent||''} onChange={e=>updateCNItem(i,'discount_percent',Number(e.target.value))} placeholder="0" className="w-12 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none text-center"/></td>
                        <td className="p-1"><select value={item.tax_percent} onChange={e=>updateCNItem(i,'tax_percent',Number(e.target.value))} className="w-14 border border-gray-200 rounded px-1 py-1 text-xs focus:outline-none">{TAX_RATES.map(r=><option key={r}>{r}</option>)}</select></td>
                        <td className="p-1 text-right font-mono text-blue-600">₹{fmtMoney(item.amount_before_tax)}</td>
                        <td className="p-1 text-right font-mono text-orange-500">₹{fmtMoney(item.tax_amount)}</td>
                        <td className="p-1 text-right font-bold text-pink-600">₹{fmtMoney(item.total_price)}</td>
                        <td className="p-1"><button onClick={()=>setCnItems(cnItems.filter((_,idx)=>idx!==i))} className="text-gray-300 hover:text-red-500"><X size={13}/></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>

              <div className="flex justify-end">
                <div className="bg-pink-50 rounded-xl p-3 text-xs space-y-1 min-w-48">
                  <div className="flex justify-between"><span className="text-gray-500">Total Credit Amount:</span><span className="font-bold text-pink-600 text-base">₹{cnItems.filter(i=>i.product_name).reduce((s,i)=>s+i.total_price,0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-100 sticky bottom-0 bg-white">
              <button onClick={()=>{setShowCNModal(false);setEditingCN(null);}} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600">Cancel</button>
              <button onClick={saveCreditNote} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-pink-600 text-white rounded-lg text-sm font-medium hover:bg-pink-700 disabled:opacity-60">{saving&&<Loader size={13} className="animate-spin"/>}{saving?'Saving...':editingCN?'Update':'Create Credit Note'}</button>
            </div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      {/* VENDOR MODAL */}
      <AnimatePresence>{showVendorModal&&(
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={e=>{if(e.target===e.currentTarget){setShowVendorModal(false);setEditingVendor(null);}}}>
          <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.9,opacity:0}} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-gray-100"><h2 className="font-bold text-gray-800">{editingVendor?'Edit Vendor':'Add Vendor'}</h2><button onClick={()=>{setShowVendorModal(false);setEditingVendor(null);}} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"><X size={14}/></button></div>
            <div className="p-5 space-y-3">
              {[{label:'Vendor Name *',key:'name',ph:'e.g. Saini Traders'},{label:'Phone',key:'phone',ph:'+91-9478383509'},{label:'GSTIN',key:'gstin',ph:'03EPMP56722A1ZZ'},{label:'Email',key:'email',ph:'vendor@email.com'},{label:'Address',key:'address',ph:'Near Over Bridge, Rajpura...'}].map(f=>(
                <div key={f.key}><label className="block text-xs font-medium text-gray-700 mb-1">{f.label}</label>
                <input value={(vendorForm as any)[f.key]||''} onChange={e=>setVendorForm({...vendorForm,[f.key]:e.target.value})} placeholder={f.ph} className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 ${f.key==='gstin'?'font-mono':''}`}/></div>
              ))}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-100">
              <button onClick={()=>{setShowVendorModal(false);setEditingVendor(null);}} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600">Cancel</button>
              <button onClick={saveVendor} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">{saving&&<Loader size={13} className="animate-spin"/>}{saving?'Saving...':'Save'}</button>
            </div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      {/* PAY MODAL */}
      <AnimatePresence>{showPayModal&&(
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={e=>{if(e.target===e.currentTarget){setShowPayModal(false);setEditingPayment(null);}}}>
          <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.9,opacity:0}} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-gray-100"><h2 className="font-bold text-gray-800">💰 {editingPayment?'Edit Payment':'Pay Bill'} — {payForm.vendor_name}</h2><button onClick={()=>{setShowPayModal(false);setEditingPayment(null);}} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"><X size={14}/></button></div>
            <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
              {/* Payment Date & Amount */}
              <div className="grid grid-cols-2 gap-2">
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Payment Date</label><input type="date" value={payForm.payment_date} onChange={e=>setPayForm({...payForm,payment_date:e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"/></div>
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Amount (₹)</label><input type="number" value={payForm.amount||''} onChange={e=>setPayForm({...payForm,amount:Number(e.target.value)})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"/></div>
              </div>
              <div className="flex gap-1.5 flex-wrap">{[500,1000,2000,5000,10000].map(a=><button key={a} onClick={()=>setPayForm({...payForm,amount:a})} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-lg text-xs hover:bg-blue-100 hover:text-blue-700">₹{a.toLocaleString('en-IN')}</button>)}</div>
              {/* Payment Mode */}
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Payment Mode</label>
                <div className="flex gap-1.5 flex-wrap">
                  {['Cash','Cheque','UPI','NEFT','RTGS'].map(m=>(
                    <button key={m} onClick={()=>setPayForm({...payForm, payment_mode:m, cheque_status: m==='Cheque'?'Issued':'N/A', cheque_no:'', cheque_date:'', clearance_date:''})}
                      className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${payForm.payment_mode===m?'bg-blue-600 text-white border-blue-600':'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300'}`}>{m}</button>
                  ))}
                </div>
              </div>
              {/* CHEQUE FIELDS — only shown when mode is Cheque */}
              {payForm.payment_mode==='Cheque'&&(<>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2.5">
                  <p className="text-xs font-semibold text-amber-700">🏦 Cheque Details</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="block text-xs font-medium text-gray-700 mb-1">Cheque No.</label><input value={payForm.cheque_no} onChange={e=>setPayForm({...payForm,cheque_no:e.target.value})} placeholder="e.g. 167825" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"/></div>
                    <div><label className="block text-xs font-medium text-gray-700 mb-1">Cheque Date</label><input type="date" value={payForm.cheque_date} onChange={e=>setPayForm({...payForm,cheque_date:e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"/></div>
                  </div>
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Cheque Status</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {['Issued','Cleared','Bounced','Cancelled'].map(s=>(
                        <button key={s} onClick={()=>setPayForm({...payForm,cheque_status:s})}
                          className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${payForm.cheque_status===s?(s==='Cleared'?'bg-green-600 text-white border-green-600':s==='Bounced'?'bg-red-500 text-white border-red-500':s==='Cancelled'?'bg-gray-500 text-white border-gray-500':'bg-yellow-500 text-white border-yellow-500'):'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300'}`}>{s}</button>
                      ))}
                    </div>
                  </div>
                  {payForm.cheque_status==='Cleared'&&(
                    <div><label className="block text-xs font-medium text-gray-700 mb-1">Clearance Date (actual bank deduction)</label><input type="date" value={payForm.clearance_date} onChange={e=>setPayForm({...payForm,clearance_date:e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"/></div>
                  )}
                  {payForm.cheque_status==='Bounced'&&(
                    <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">⚠️ Bounced cheque — the bill will remain unpaid. Update status to Cleared once re-issued.</div>
                  )}
                  {payForm.cheque_status==='Cancelled'&&(
                    <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600">🚫 Cancelled — wrong fill or void cheque. Bill remains unpaid.</div>
                  )}
                </div>
              </>)}
              {/* Note */}
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Note (optional)</label><input value={payForm.note} onChange={e=>setPayForm({...payForm,note:e.target.value})} placeholder="Any extra note..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"/></div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-100">
              <button onClick={()=>{setShowPayModal(false);setEditingPayment(null);}} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600">Cancel</button>
              <button onClick={savePayment} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-60">{saving&&<Loader size={13} className="animate-spin"/>}{saving?'Saving...':editingPayment?'Update Payment':'Pay Now'}</button>
            </div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>
    </div>
  );
};
export default Purchase;
