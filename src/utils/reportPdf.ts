import { formatCurrency, formatDate, titleCase } from './format';
import {
  BRAND_NAME,
  createDocument,
  downloadCsv,
  drawBrandHeader,
  drawFieldGrid,
  drawSectionTitle,
  drawTable,
  drawTotalBand,
  savePdf,
  slugify,
  stampFooters } from
'./pdf';
import { reportCellRaw, reportCellText, reportColumnKeys, isCurrencyKey } from './reportFormat';

export interface ReportExport {
  label: string;
  description?: string;
  period?: {start?: string;end?: string;} | null;
  totals: {key: string;value: number;}[];
  breakdown?: {label: string;data: Record<string, number>;} | null;
  rows: Record<string, unknown>[];
  scopeLabel?: string;
}

function baseFilename(input: ReportExport): string {
  const start = input.period?.start ?? '';
  const end = input.period?.end ?? '';
  const range = start && end ? `-${start}-to-${end}` : '';
  return `${slugify(`${BRAND_NAME} ${input.label} report`)}${range}`;
}

export function downloadReportPdf(input: ReportExport): void {
  const keys = reportColumnKeys(input.rows);
  const doc = createDocument(keys.length > 6 ? 'landscape' : 'portrait');

  let y = drawBrandHeader(doc, {
    documentTitle: 'Report',
    reference: input.label,
    referenceNote: `Generated ${formatDate(new Date().toISOString())}`
  });

  y = drawFieldGrid(
    doc,
    y,
    [
    { label: 'Report', value: input.label, note: input.description },
    {
      label: 'Period',
      value:
      input.period?.start || input.period?.end ?
      `${formatDate(input.period?.start)} - ${formatDate(input.period?.end)}` :
      'All time'
    },
    { label: 'Rows', value: String(input.rows.length) },
    { label: 'Scope', value: input.scopeLabel ?? 'Whole building' }],

    4
  );

  const [headline, ...rest] = input.totals;
  if (headline) {
    y = drawTotalBand(doc, y + 8, titleCase(headline.key), formatCurrency(headline.value));
    if (rest.length) {
      y = drawTable(doc, {
        startY: y + 12,
        head: ['Summary', 'Amount'],
        body: rest.map((total) => [titleCase(total.key), formatCurrency(total.value)]),
        rightAlign: [1],
        columnWidths: { 1: 130 },
        fontSize: 8.6
      });
    }
  }

  if (input.breakdown) {
    y = drawSectionTitle(doc, y + 22, input.breakdown.label);
    y = drawTable(doc, {
      startY: y + 4,
      head: ['Room', 'Amount'],
      body: Object.entries(input.breakdown.data).map(([room, value]) => [`Room ${room}`, formatCurrency(value)]),
      rightAlign: [1],
      columnWidths: { 1: 130 },
      fontSize: 8.6
    });
  }

  if (keys.length) {
    y = drawSectionTitle(doc, y + 22, 'Detail', `${input.rows.length} ${input.rows.length === 1 ? 'row' : 'rows'}`);
    drawTable(doc, {
      startY: y + 4,
      head: keys.map((key) => titleCase(key)),
      body: input.rows.map((row) => keys.map((key) => reportCellText(key, row[key]))),
      rightAlign: keys.map((key, index) => isCurrencyKey(key) ? index : -1).filter((index) => index >= 0),
      fontSize: keys.length > 8 ? 7.2 : 8.4
    });
  }

  stampFooters(doc, `${BRAND_NAME} — ${input.label} report`);
  savePdf(doc, `${baseFilename(input)}.pdf`);
}

export function downloadReportCsv(input: ReportExport): void {
  const keys = reportColumnKeys(input.rows);
  const rows: (string | number)[][] = [
  [`${BRAND_NAME} — ${input.label} report`],
  [
  'Period',
  input.period?.start || input.period?.end ? `${input.period?.start ?? ''} to ${input.period?.end ?? ''}` : 'All time'],

  ['Scope', input.scopeLabel ?? 'Whole building'],
  ['Generated', new Date().toISOString().slice(0, 10)],
  []];


  if (input.totals.length) {
    rows.push(['Summary', 'Amount']);
    input.totals.forEach((total) => rows.push([titleCase(total.key), total.value]));
    rows.push([]);
  }

  if (input.breakdown) {
    rows.push([input.breakdown.label, 'Amount']);
    Object.entries(input.breakdown.data).forEach(([room, value]) => rows.push([`Room ${room}`, value]));
    rows.push([]);
  }

  if (keys.length) {
    rows.push(keys.map((key) => titleCase(key)));
    input.rows.forEach((row) => rows.push(keys.map((key) => reportCellRaw(key, row[key]))));
  }

  downloadCsv(`${baseFilename(input)}.csv`, rows);
}