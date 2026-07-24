// Shared logic for printing directly onto a blank bank cheque leaf.
//
// Field positions are still entered/stored as "mm from the LEFT and BOTTOM
// edge of the cheque leaf" (that's what the Calibrate screen shows, and what
// the user physically measured with a ruler). Internally we convert the
// bottom-measurement into a top-measurement before printing — see the note
// below on why.

export type ChequeTemplate = {
  pageWidth: number;  // mm, full cheque leaf width
  pageHeight: number; // mm, full cheque leaf height
  payeeX: number; payeeY: number;
  dateBoxesX: number[]; dateY: number; // 8 boxes: D D M M Y Y Y Y
  words1X: number; words1XEnd: number; words1Y: number;
  words2X: number; words2XEnd: number; words2Y: number;
  figuresX: number; figuresXEnd: number; figuresY: number;
  fontSize: number;
};

// Defaults built from the user's ruler measurements of their Axis Bank cheque
// leaf. Left/X positions are exact (measured directly). Y positions are a
// best estimate from a standard Axis Bank CTS-2010 layout and should be
// confirmed with a test print on plain paper before printing on a real
// cheque leaf — see the Calibrate screen.
export const DEFAULT_CHEQUE_TEMPLATE: ChequeTemplate = {
  pageWidth: 203, pageHeight: 93,
  payeeX: 20, payeeY: 68,
  dateBoxesX: [155, 160, 165, 170, 175, 180, 185, 190], dateY: 80,
  words1X: 35, words1XEnd: 180, words1Y: 58,
  words2X: 15, words2XEnd: 120, words2Y: 50,
  figuresX: 160, figuresXEnd: 190, figuresY: 58,
  fontSize: 11,
};

// The physical page we actually print on. Most printers (including a Canon
// MF3010) don't have a 203x93mm "cheque" paper size registered, so telling
// the browser to use a custom page that small gets silently ignored — the
// printer falls back to its default (A4) and CENTERS the small page inside
// it. That centering is exactly what shifted everything on the plain-paper
// test. Fix: always print on a real, standard page size the printer
// definitely supports, and calculate every field's position from that
// page's own top-left corner — which a printer always honours, regardless
// of which paper size it's using.
//
// The cheque leaf is wider than it is tall (203x93mm) — a landscape shape.
// A cheque naturally gets hand-fed into a printer's manual tray long-edge
// first, so the page must be set up as A4 LANDSCAPE (297x210mm), not
// portrait — using portrait here is exactly what caused the printed text
// to come out rotated 90° relative to the cheque leaf.
const PRINT_PAGE_WIDTH_MM = 297;  // A4 landscape width
const PRINT_PAGE_HEIGHT_MM = 210; // A4 landscape height

const ONES = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN',
  'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
const TENS = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];

function threeDigits(n: number): string {
  let s = '';
  if (n >= 100) { s += ONES[Math.floor(n / 100)] + ' HUNDRED '; n %= 100; }
  if (n >= 20) { s += TENS[Math.floor(n / 10)] + ' '; n %= 10; }
  if (n > 0) s += ONES[n] + ' ';
  return s;
}

// Indian numbering system: crore, lakh, thousand, hundred.
export function numberToWords(amount: number): { rupeesWords: string; paise: number } {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  if (rupees === 0) return { rupeesWords: 'ZERO', paise };
  let n = rupees;
  let words = '';
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  const hundred = n;
  if (crore) words += threeDigits(crore) + 'CRORE ';
  if (lakh) words += threeDigits(lakh) + 'LAKH ';
  if (thousand) words += threeDigits(thousand) + 'THOUSAND ';
  if (hundred) words += threeDigits(hundred);
  return { rupeesWords: words.trim().replace(/\s+/g, ' '), paise };
}

// Splits "X" into two lines that fit within maxLen1 / (implicit) chars, breaking on a word boundary.
export function splitWordsToTwoLines(text: string, maxLen1: number): [string, string] {
  if (text.length <= maxLen1) return [text, ''];
  let cut = text.lastIndexOf(' ', maxLen1);
  if (cut === -1) cut = maxLen1;
  return [text.slice(0, cut).trim(), text.slice(cut).trim()];
}

// Converts a "mm from the bottom of the cheque leaf" measurement into
// "mm from the top of the printed page" — the coordinate system that
// actually stays consistent between a full A4 test sheet and the real
// cheque leaf, as long as both are fed into the printer top-edge-first,
// left-aligned against the same guide.
function toTop(fromBottom: number, chequeHeight: number): number {
  return chequeHeight - fromBottom;
}

export function buildChequeHTML(t: ChequeTemplate, data: { payee: string; amount: number; date: string }): string {
  const { rupeesWords, paise } = numberToWords(data.amount);
  const fullWords = `${rupeesWords} RUPEES${paise ? ' AND ' + threeDigits(paise).trim() + ' PAISE' : ''} ONLY`;
  const maxLine1Chars = Math.round((t.words1XEnd - t.words1X) / 1.8); // ~1.8mm per capital letter at this font size
  const [line1, line2] = splitWordsToTwoLines(fullWords, maxLine1Chars);

  const ddmmyyyy = data.date ? (() => { const [y, m, d] = data.date.split('-'); return (d + m + y).split(''); })() : [];

  const dateTop = toTop(t.dateY, t.pageHeight);
  const dateBoxesHtml = t.dateBoxesX.map((x, i) =>
    `<div style="position:absolute;left:${x}mm;top:${dateTop}mm;font-size:${t.fontSize}pt;font-weight:bold">${ddmmyyyy[i] || ''}</div>`
  ).join('');

  const payeeTop = toTop(t.payeeY, t.pageHeight);
  const words1Top = toTop(t.words1Y, t.pageHeight);
  const words2Top = toTop(t.words2Y, t.pageHeight);
  const figuresTop = toTop(t.figuresY, t.pageHeight);

  return `<!DOCTYPE html><html><head><title>Print Cheque</title>
  <style>
    * { margin:0;padding:0;box-sizing:border-box; }
    body { font-family:Arial,sans-serif; }
    @media print { @page { size:A4 landscape; margin:0; } }
    @media screen { body{background:#eee;padding:20px} .page{box-shadow:0 0 8px rgba(0,0,0,.3)} }
    .page { position:relative; width:${PRINT_PAGE_WIDTH_MM}mm; height:${PRINT_PAGE_HEIGHT_MM}mm; background:#fff; overflow:hidden; }
  </style></head><body>
  <div class="page">
    <div style="position:absolute;left:${t.payeeX}mm;top:${payeeTop}mm;font-size:${t.fontSize}pt;font-weight:bold;white-space:nowrap">${data.payee.toUpperCase()}</div>
    ${dateBoxesHtml}
    <div style="position:absolute;left:${t.words1X}mm;top:${words1Top}mm;font-size:${t.fontSize}pt;font-weight:bold;white-space:nowrap">${line1}</div>
    ${line2 ? `<div style="position:absolute;left:${t.words2X}mm;top:${words2Top}mm;font-size:${t.fontSize}pt;font-weight:bold;white-space:nowrap">${line2}</div>` : ''}
    <div style="position:absolute;left:${t.figuresX}mm;top:${figuresTop}mm;font-size:${t.fontSize}pt;font-weight:bold;white-space:nowrap">${data.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
  </div>
  <script>window.onload=()=>{setTimeout(()=>window.print(),200)}</script>
  </body></html>`;
}

// A ruler/grid overlay used only for the calibration test print — helps line
// up the real cheque leaf against the printed sheet under a light. The grid
// only covers the cheque-leaf-sized area (top-left of the page), since
// that's the only part that matters once the leaf is fed top-left-aligned.
export function buildCalibrationTestHTML(t: ChequeTemplate): string {
  let grid = `<div style="position:absolute;left:0;top:0;width:${t.pageWidth}mm;height:${t.pageHeight}mm;border:1px dashed #3b82f6"></div>`;
  for (let x = 0; x <= t.pageWidth; x += 10) grid += `<div style="position:absolute;left:${x}mm;top:0;height:${t.pageHeight}mm;width:1px;background:#ccc"></div><div style="position:absolute;left:${x + 1}mm;top:1mm;font-size:6pt;color:#999">${x}</div>`;
  for (let y = 0; y <= t.pageHeight; y += 10) grid += `<div style="position:absolute;top:${y}mm;left:0;width:${t.pageWidth}mm;height:1px;background:#ccc"></div><div style="position:absolute;top:${y + 1}mm;left:1mm;font-size:6pt;color:#999">${t.pageHeight - y}</div>`;
  return buildChequeHTML(t, { payee: 'TEST PAYEE NAME', amount: 12345.5, date: new Date().toISOString().split('T')[0] })
    .replace('<div class="page">', `<div class="page">${grid}`);
}
