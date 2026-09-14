const d = require('docx');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, HeadingLevel, BorderStyle, ShadingType, VerticalAlign,
} = d;

const W = 10100; // ширина текстового блока, dxa
const FONT = 'Times New Roman';

const GREY = 'D9D9D9';
const LIGHT = 'F2F2F2';
const ACCENT = 'BFC9D9';

function p(text, opts = {}) {
  return new Paragraph({
    alignment: opts.align || AlignmentType.LEFT,
    spacing: { before: opts.before ?? 0, after: opts.after ?? 100 },
    indent: opts.indent,
    children: [new TextRun({
      text: text,
      font: FONT,
      size: opts.size || 22,
      bold: !!opts.bold,
      italics: !!opts.italics,
      color: opts.color,
    })],
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 160 },
    children: [new TextRun({ text, font: FONT, size: 28, bold: true, color: '1F3864' })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 120 },
    children: [new TextRun({ text, font: FONT, size: 24, bold: true, color: '2E4A7D' })],
  });
}

function title(text, sub) {
  const out = [new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: '1F3864', space: 6 } },
    children: [new TextRun({ text, font: FONT, size: 32, bold: true, color: '1F3864' })],
  })];
  if (sub) out.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 240 },
    children: [new TextRun({ text: sub, font: FONT, size: 20, italics: true, color: '555555' })],
  }));
  return out;
}

function cellPar(text, opts = {}) {
  const lines = String(text).split('\n');
  return lines.map((ln, i) => new Paragraph({
    alignment: opts.align || AlignmentType.LEFT,
    spacing: { before: i === 0 ? 40 : 0, after: i === lines.length - 1 ? 40 : 0 },
    children: [new TextRun({
      text: ln,
      font: FONT,
      size: opts.size || 19,
      bold: !!opts.bold,
      italics: !!opts.italics,
      color: opts.color,
    })],
  }));
}

// rows: array of arrays; opts: {widths, header:true, aligns:[], boldRows:[idx], shadeRows:{idx:color}}
function table(rows, opts = {}) {
  const widths = opts.widths;
  const aligns = opts.aligns || [];
  const size = opts.size || 19;
  const trs = rows.map((row, ri) => {
    const isHeader = opts.header !== false && ri === 0;
    const shade = isHeader ? (opts.headerColor || ACCENT)
      : (opts.shadeRows && opts.shadeRows[ri]) ? opts.shadeRows[ri]
      : (opts.zebra && ri % 2 === 0) ? LIGHT : undefined;
    const bold = isHeader || (opts.boldRows || []).includes(ri);
    return new TableRow({
      tableHeader: isHeader,
      children: row.map((cell, ci) => new TableCell({
        width: { size: widths[ci], type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        shading: shade ? { type: ShadingType.CLEAR, fill: shade, color: 'auto' } : undefined,
        margins: { top: 40, bottom: 40, left: 90, right: 90 },
        children: cellPar(cell, {
          align: isHeader ? AlignmentType.CENTER : (aligns[ci] || AlignmentType.LEFT),
          bold, size,
        }),
      })),
    });
  });
  return new Table({
    columnWidths: widths,
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 6, color: '7F7F7F' },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: '7F7F7F' },
      left: { style: BorderStyle.SINGLE, size: 6, color: '7F7F7F' },
      right: { style: BorderStyle.SINGLE, size: 6, color: '7F7F7F' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'AAAAAA' },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'AAAAAA' },
    },
    rows: trs,
  });
}

function bullets(items) {
  return items.map((t) => new Paragraph({
    numbering: { reference: 'bul', level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text: t, font: FONT, size: 21 })],
  }));
}

const numbering = {
  config: [{
    reference: 'bul',
    levels: [{
      level: 0, format: d.LevelFormat.BULLET, text: '•',
      alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 360, hanging: 220 } } },
    }],
  }],
};

function doc(children, footerText) {
  return new Document({
    numbering,
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    sections: [{
      properties: { page: { margin: { top: 1000, bottom: 1000, left: 900, right: 900 } } },
      footers: footerText ? {
        default: new d.Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: footerText, font: FONT, size: 16, color: '808080' })],
          })],
        }),
      } : undefined,
      children,
    }],
  });
}

const A = { L: AlignmentType.LEFT, C: AlignmentType.CENTER, R: AlignmentType.RIGHT };

module.exports = { d, Packer, Paragraph, TextRun, p, h1, h2, title, table, bullets, doc, W, A, GREY, LIGHT, ACCENT };
