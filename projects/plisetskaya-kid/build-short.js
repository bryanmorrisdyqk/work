const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, ImageRun, AlignmentType } = require('docx');

// Короткий вариант: рассказ из пяти предложений от лица девочки 9 лет.
const OUT = process.argv[2] || path.join(__dirname, 'Рассказ_Майя_Плисецкая_короткий.docx');
const PHOTO = path.join(__dirname, '..', 'bogatstva-otdannye-lyudyam', 'img', 'plisetskaya.jpg');
const ACCENT = 'B03A7A';

const story = [
  'Майя Плисецкая — великая русская балерина, она родилась в Москве в 1925 году.',
  'Когда ей было восемь лет, она начала учиться балету и не бросила его даже в трудные годы, когда в её семье случилась беда.',
  'Почти пятьдесят лет она танцевала в Большом театре и выступала во многих странах мира.',
  'Больше всего мне понравилось, как она танцует «Умирающего лебедя»: её руки похожи на настоящие крылья.',
  'Своё богатство — талант и любовь к танцу — Майя Плисецкая подарила людям, и я поняла, что если много трудиться и не сдаваться, то мечта обязательно сбудется.',
];

const doc = new Document({
  creator: 'Ученица 4 класса',
  title: 'Моя любимая балерина — Майя Плисецкая',
  styles: { default: { document: { run: { font: 'Times New Roman', size: 28 } } } },
  sections: [{
    properties: { page: { margin: { top: 1134, bottom: 1134, left: 1701, right: 850 } } },
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
        children: [new TextRun({ text: 'Богатства, отданные людям', italics: true })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 },
        children: [new TextRun({ text: 'Моя любимая балерина — Майя Плисецкая', bold: true, size: 36, color: ACCENT })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [new ImageRun({
        type: 'jpg', data: fs.readFileSync(PHOTO), transformation: { width: Math.round(235 * 230 / 283), height: 230 },
        altText: { title: 'Майя Плисецкая', description: 'Портрет Майи Михайловны Плисецкой', name: 'Плисецкая' } })] }),
      new Paragraph({ alignment: AlignmentType.JUSTIFIED, indent: { firstLine: 709 }, spacing: { line: 360 },
        children: [new TextRun(story.join(' '))] }),
      new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 480 },
        children: [new TextRun({ text: 'Ученица 4 «___» класса ____________________', size: 26 })] }),
    ],
  }],
});

Packer.toBuffer(doc).then(b => { fs.writeFileSync(OUT, b); console.log('written', OUT); });
