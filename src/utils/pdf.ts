import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/* ------------------------------------------------------------------ *
 * Shared document furniture for every PDF the portal produces:
 * bills, bill batches and reports all use the same header, type
 * scale and table styling. Each document carries a colour theme —
 * reports stay neutral, bills use a light yellow paper theme.
 * ------------------------------------------------------------------ */

export const BRAND_NAME = 'Sunrise Apartments AMS';
export const BRAND_TAGLINE = 'Accommodation Management System';

type Rgb = readonly [number, number, number];

export interface PdfTheme {
  /** Page background; null leaves the paper white. */
  page: Rgb | null;
  accent: Rgb;
  line: Rgb;
  /** Table header and total band fill. */
  tint: Rgb;
  /** Alternate table row fill. */
  alternate: Rgb;
}

export const DEFAULT_THEME: PdfTheme = {
  page: null,
  accent: [21, 113, 99],
  line: [225, 230, 233],
  tint: [244, 246, 248],
  alternate: [250, 251, 252]
};

/** Light yellow paper used for every tenant bill — download, preview and print. */
export const BILL_THEME: PdfTheme = {
  page: [255, 252, 238],
  accent: [138, 92, 4],
  line: [236, 222, 176],
  tint: [253, 242, 196],
  alternate: [255, 248, 222]
};

const INK = [24, 34, 39] as const;
const INK_MUTED = [92, 107, 115] as const;
const INK_SOFT = [128, 138, 144] as const;
const WHITE = [255, 255, 255] as const;

export const MARGIN = 44;

const themes = new WeakMap<jsPDF, PdfTheme>();
const paintedPages = new WeakMap<jsPDF, Set<number>>();

function themeOf(doc: jsPDF): PdfTheme {
  return themes.get(doc) ?? DEFAULT_THEME;
}

function rgb(color: Rgb): [number, number, number] {
  return [color[0], color[1], color[2]];
}

/** Fills the current page with the theme's paper colour, once per page. */
function paintCurrentPage(doc: jsPDF): void {
  const theme = themeOf(doc);
  if (!theme.page) return;
  const pageNumber = doc.getCurrentPageInfo().pageNumber;
  const painted = paintedPages.get(doc) ?? new Set<number>();
  if (painted.has(pageNumber)) return;
  painted.add(pageNumber);
  paintedPages.set(doc, painted);
  doc.setFillColor(...theme.page);
  doc.rect(0, 0, pageWidth(doc), pageHeight(doc), 'F');
}

export function createDocument(orientation: 'portrait' | 'landscape' = 'portrait', theme: PdfTheme = DEFAULT_THEME): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation });
  themes.set(doc, theme);
  doc.setFont('helvetica', 'normal');
  paintCurrentPage(doc);
  return doc;
}

export function addPage(doc: jsPDF): void {
  doc.addPage();
  paintCurrentPage(doc);
}

export function pageWidth(doc: jsPDF): number {
  return doc.internal.pageSize.getWidth();
}

export function pageHeight(doc: jsPDF): number {
  return doc.internal.pageSize.getHeight();
}

export function contentWidth(doc: jsPDF): number {
  return pageWidth(doc) - MARGIN * 2;
}

function fitText(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && doc.getTextWidth(`${result}...`) > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result.trim()}...`;
}

interface BrandHeaderOptions {
  documentTitle: string;
  reference: string;
  referenceNote?: string;
}

/** Brand mark + document type. Returns the y to continue drawing from. */
export function drawBrandHeader(doc: jsPDF, { documentTitle, reference, referenceNote }: BrandHeaderOptions): number {
  const theme = themeOf(doc);
  const top = MARGIN;
  const right = pageWidth(doc) - MARGIN;

  doc.setFillColor(...theme.accent);
  doc.roundedRect(MARGIN, top, 26, 26, 6, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...WHITE);
  doc.text('S', MARGIN + 13, top + 18.5, { align: 'center' });

  doc.setFontSize(12.5);
  doc.setTextColor(...INK);
  doc.text(BRAND_NAME, MARGIN + 34, top + 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(...INK_SOFT);
  doc.text(BRAND_TAGLINE, MARGIN + 34, top + 22);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(...theme.accent);
  doc.setCharSpace(0.7);
  doc.text(documentTitle.toUpperCase(), right, top + 9, { align: 'right' });
  doc.setCharSpace(0);
  doc.setFontSize(11.5);
  doc.setTextColor(...INK);
  doc.text(reference, right, top + 23, { align: 'right' });
  if (referenceNote) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    doc.setTextColor(...INK_SOFT);
    doc.text(referenceNote, right, top + 33, { align: 'right' });
  }

  const lineY = top + (referenceNote ? 44 : 40);
  doc.setDrawColor(...theme.line);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, lineY, right, lineY);
  return lineY + 26;
}

export interface PdfField {
  label: string;
  value: string;
  note?: string;
}

/** Small labelled facts laid out in columns — the "billed to / month / due" block. */
export function drawFieldGrid(doc: jsPDF, startY: number, fields: PdfField[], columns = 4): number {
  const colWidth = contentWidth(doc) / columns;
  const rowHeight = 40;
  let y = startY;

  fields.forEach((field, index) => {
    const col = index % columns;
    if (col === 0 && index > 0) y += rowHeight;
    const x = MARGIN + col * colWidth;
    const available = colWidth - 12;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(...INK_SOFT);
    doc.setCharSpace(0.5);
    doc.text(field.label.toUpperCase(), x, y);
    doc.setCharSpace(0);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.8);
    doc.setTextColor(...INK);
    doc.text(fitText(doc, field.value || '—', available), x, y + 13);

    if (field.note) {
      doc.setFontSize(7.6);
      doc.setTextColor(...INK_MUTED);
      doc.text(fitText(doc, field.note, available), x, y + 24);
    }
  });

  return y + rowHeight;
}

export function drawSectionTitle(doc: jsPDF, y: number, title: string, hint?: string): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text(title, MARGIN, y);
  if (hint) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(...INK_SOFT);
    doc.text(hint, pageWidth(doc) - MARGIN, y, { align: 'right' });
  }
  return y + 10;
}

/** The one number the reader is looking for. Deliberately the largest thing on the page. */
export function drawTotalBand(doc: jsPDF, y: number, label: string, value: string, note?: string): number {
  const theme = themeOf(doc);
  const height = note ? 52 : 44;
  const width = contentWidth(doc);
  doc.setFillColor(...theme.tint);
  doc.setDrawColor(...theme.line);
  doc.setLineWidth(0.7);
  doc.roundedRect(MARGIN, y, width, height, 7, 7, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.6);
  doc.setTextColor(...INK);
  doc.text(label, MARGIN + 14, y + (note ? 22 : 27));
  if (note) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.6);
    doc.setTextColor(...INK_MUTED);
    doc.text(note, MARGIN + 14, y + 35);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...theme.accent);
  doc.text(value, pageWidth(doc) - MARGIN - 14, y + (note ? 32 : 29), { align: 'right' });

  return y + height;
}

export function drawParagraph(doc: jsPDF, y: number, text: string, size = 7.8): number {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(size);
  doc.setTextColor(...INK_MUTED);
  const lines = doc.splitTextToSize(text, contentWidth(doc)) as string[];
  doc.text(lines, MARGIN, y);
  return y + lines.length * (size + 2.6);
}

export interface PdfTableOptions {
  startY: number;
  head: string[];
  body: (string | number | null | undefined)[][];
  rightAlign?: number[];
  columnWidths?: Record<number, number>;
  emphasiseLastRow?: boolean;
  fontSize?: number;
}

function lastTableY(doc: jsPDF): number {
  return (doc as unknown as {lastAutoTable?: {finalY: number;};}).lastAutoTable?.finalY ?? 0;
}

export function drawTable(doc: jsPDF, options: PdfTableOptions): number {
  const { startY, head, body, rightAlign = [], columnWidths = {}, emphasiseLastRow = false, fontSize = 9 } = options;
  const theme = themeOf(doc);

  const columnStyles: Record<number, {halign?: 'right';cellWidth?: number;}> = {};
  head.forEach((_column, index) => {
    const style: {halign?: 'right';cellWidth?: number;} = {};
    if (rightAlign.includes(index)) style.halign = 'right';
    if (columnWidths[index]) style.cellWidth = columnWidths[index];
    if (Object.keys(style).length) columnStyles[index] = style;
  });

  autoTable(doc, {
    startY,
    head: [head],
    body: body.map((row) => row.map((cell) => cell === null || cell === undefined || cell === '' ? '—' : String(cell))),
    margin: { left: MARGIN, right: MARGIN, top: MARGIN, bottom: MARGIN + 24 },
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize,
      textColor: rgb(INK),
      cellPadding: { top: 6, bottom: 6, left: 8, right: 8 },
      overflow: 'linebreak',
      valign: 'middle'
    },
    headStyles: {
      font: 'helvetica',
      fontStyle: 'bold',
      fontSize: Math.max(6.8, fontSize - 1.6),
      textColor: rgb(theme.page ? theme.accent : INK_SOFT),
      fillColor: rgb(theme.tint),
      cellPadding: { top: 5, bottom: 5, left: 8, right: 8 }
    },
    alternateRowStyles: { fillColor: rgb(theme.alternate) },
    columnStyles,
    willDrawPage: () => paintCurrentPage(doc),
    didParseCell: (data) => {
      if (emphasiseLastRow && data.section === 'body' && data.row.index === body.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = rgb(INK);
      }
    }
  });

  return lastTableY(doc);
}

/** Footer note + page numbers, applied to every page once the content is done. */
export function stampFooters(doc: jsPDF, note: string): void {
  const theme = themeOf(doc);
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    const baseline = pageHeight(doc) - 28;
    doc.setDrawColor(...theme.line);
    doc.setLineWidth(0.6);
    doc.line(MARGIN, baseline - 13, pageWidth(doc) - MARGIN, baseline - 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(...INK_SOFT);
    doc.text(note, MARGIN, baseline);
    doc.text(`Page ${page} of ${pages}`, pageWidth(doc) - MARGIN, baseline, { align: 'right' });
  }
}

export function slugify(value: string): string {
  return (
    value.
    normalize('NFKD').
    replace(/[^a-zA-Z0-9]+/g, '-').
    replace(/^-+|-+$/g, '').
    slice(0, 60) || 'document');

}

export function savePdf(doc: jsPDF, filename: string): void {
  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

/** Opens the PDF in a new browser tab for previewing. */
export function previewPdf(doc: jsPDF, title: string): void {
  doc.setProperties({ title });
  const url = doc.output('bloburl') as unknown as string;
  window.open(url, '_blank', 'noopener');
}

/** Sends the PDF straight to the browser's print dialog. */
export function printPdf(doc: jsPDF, title: string): void {
  doc.setProperties({ title });
  doc.autoPrint();
  const url = doc.output('bloburl') as unknown as string;
  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.setAttribute('aria-hidden', 'true');
  frame.src = url;
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      window.open(url, '_blank', 'noopener');
    }
    window.setTimeout(() => frame.remove(), 60_000);
  };
  document.body.appendChild(frame);
}

export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]): void {
  const csv = rows.
  map((row) =>
  row.
  map((cell) => {
    const text = cell === null || cell === undefined ? '' : String(cell);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }).
  join(',')
  ).
  join('\r\n');

  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}