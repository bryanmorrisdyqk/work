const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, PageBreak,
  LevelFormat, Footer, PageNumber, VerticalAlign, Tab, TabStopType, LeaderType,
} = require('docx');

// Детский вариант проекта: текст написан от лица девочки 9 лет.
const OUT = process.argv[2] || path.join(__dirname, 'Проект_Майя_Плисецкая_детский.docx');
const PHOTO = path.join(__dirname, '..', 'bogatstva-otdannye-lyudyam', 'img', 'plisetskaya.jpg');
const FONT = 'Times New Roman';
const ACCENT = 'B03A7A';
const LIGHT = 'FCEFF6';
const TEXT_W = 9355;

const runs = t => (Array.isArray(t) ? t : [t]).map(x => typeof x === 'string' ? new TextRun(x) : new TextRun(x));
const p = (text, after = 140) => new Paragraph({
  alignment: AlignmentType.LEFT, indent: { firstLine: 709 },
  spacing: { after, line: 320 }, children: runs(text),
});
const center = (text, run = {}, after = 120) => new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { after },
  children: [new TextRun({ text, ...run })],
});
const right = (text, after = 60) => new Paragraph({
  alignment: AlignmentType.RIGHT, spacing: { after }, children: [new TextRun({ text, size: 26 })],
});
const blank = (n = 1) => Array.from({ length: n }, () => new Paragraph({ children: [] }));
const h1 = t => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] });
const item = (t, ref = 'heart') => new Paragraph({
  numbering: { reference: ref, level: 0 }, spacing: { after: 80, line: 320 }, children: runs(t),
});
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });
const writeLine = () => new Paragraph({
  spacing: { before: 240, after: 0 },
  tabStops: [{ type: TabStopType.RIGHT, position: TEXT_W, leader: LeaderType.UNDERSCORE }],
  children: [new TextRun({ color: '999999', children: [new Tab()] })],
});
const note = (label, text) => new Paragraph({
  spacing: { before: 160, after: 200, line: 320 },
  indent: { left: 284, right: 284 },
  shading: { fill: LIGHT, type: ShadingType.CLEAR, color: 'auto' },
  border: { left: { style: BorderStyle.SINGLE, size: 24, color: ACCENT, space: 8 } },
  children: [new TextRun({ text: label + ' ', bold: true, color: ACCENT }), new TextRun({ text, italics: true })],
});

const border = { style: BorderStyle.SINGLE, size: 6, color: 'D9A5C2' };
const borders = { top: border, bottom: border, left: border, right: border };
const dashed = { style: BorderStyle.DASHED, size: 8, color: 'C77BA5' };
const dashedBorders = { top: dashed, bottom: dashed, left: dashed, right: dashed };

function table(widths, rows) {
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: widths,
    rows: rows.map((r, i) => new TableRow({
      tableHeader: i === 0,
      children: r.map((t, j) => new TableCell({
        borders, width: { size: widths[j], type: WidthType.DXA },
        shading: i === 0 ? { fill: 'F6D5E6', type: ShadingType.CLEAR, color: 'auto' } : undefined,
        margins: { top: 80, bottom: 80, left: 120, right: 120 }, verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({
          alignment: i === 0 ? AlignmentType.CENTER : AlignmentType.LEFT,
          children: [new TextRun({ text: t, bold: i === 0, size: 26 })],
        })],
      })),
    })),
  });
}

// Пустая рамка для рисунка или вклеенной картинки.
const frame = (caption, height = 3600) => new Table({
  width: { size: TEXT_W, type: WidthType.DXA }, columnWidths: [TEXT_W],
  rows: [new TableRow({ height: { value: height, rule: 'atLeast' }, children: [new TableCell({
    borders: dashedBorders, width: { size: TEXT_W, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
    children: [center(caption, { color: 'A0A0A0', italics: true, size: 24 }, 0)],
  })] })],
});

const photo = height => new ImageRun({
  type: 'jpg', data: fs.readFileSync(PHOTO),
  transformation: { width: Math.round(235 * height / 283), height },
  altText: { title: 'Майя Плисецкая', description: 'Портрет Майи Михайловны Плисецкой', name: 'Плисецкая' },
});

const titlePage = [
  center('Муниципальное бюджетное общеобразовательное учреждение', { size: 26 }, 0),
  center('«Средняя общеобразовательная школа № ____»', { size: 26 }, 0),
  ...blank(5),
  center('Проект по окружающему миру', { size: 30 }, 60),
  center('«Богатства, отданные людям»', { size: 28, italics: true }, 280),
  center('Моя любимая балерина —', { size: 34, color: ACCENT }, 60),
  center('Майя Плисецкая', { bold: true, size: 52, color: ACCENT }, 280),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [photo(210)] }),
  ...blank(3),
  right('Работу выполнила: ученица 4 «___» класса'),
  right('________________________________', 240),
  right('Руководитель: ______________________'),
  ...blank(6),
  center('20___ г.', { size: 26 }, 0),
];

const body = [
  h1('Почему я выбрала эту тему'),
  p('Я очень люблю танцевать. Я хожу на танцы уже два года, и мне это очень нравится. Когда мы в классе проходили тему «Богатства, отданные людям», я увидела в учебнике фотографию красивой женщины с длинными волосами. Под фотографией было написано: «Майя Михайловна Плисецкая».'),
  p('Мама сказала мне, что это великая балерина, самая знаменитая в мире. Мне стало очень интересно, и я решила узнать про неё побольше.'),
  note('Моя цель:', 'узнать, кто такая Майя Плисецкая и какие богатства она отдала людям.'),
  new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: 'Что я для этого делала:', bold: true })] }),
  item('читала про неё в книгах и в интернете (вместе с мамой);', 'num'),
  item('смотрела видео, где она танцует;', 'num'),
  item('расспрашивала бабушку, потому что бабушка видела её по телевизору;', 'num'),
  item('записывала самое интересное и рисовала.', 'num'),

  pageBreak(),
  h1('Как Майя стала балериной'),
  p('Майя Плисецкая родилась 20 ноября 1925 года в Москве. Это было почти сто лет назад! В её семье было много артистов. Её мама снималась в кино, а тётя и дядя танцевали в Большом театре.'),
  p('Маленькая Майя танцевала везде, где слышала музыку: дома, во дворе и даже на улице. Когда ей было 8 лет, её приняли в балетное училище. Мне сейчас 9 лет, значит, она начала учиться балету, когда была даже младше меня!'),
  note('Я узнала:', 'в балетной школе очень трудно учиться. Ученики каждый день по много часов делают упражнения у специальной палки. Она называется «балетный станок». У нас на танцах тоже есть станок, и я знаю, как это тяжело.'),
  p('Детство у Майи было грустное. Когда ей было 12 лет, её папу несправедливо арестовали, и он погиб. Маму с маленьким братиком отправили далеко-далеко, в Казахстан. Майю забрала к себе тётя, которая тоже была балериной. Потом началась война. Но Майя всё равно не бросила балет! Мне было очень жалко Майю, когда я про это читала. Но я поняла, что она была очень сильной и смелой девочкой.'),

  h1('Майя в Большом театре'),
  p('Когда Майе было 17 лет, она окончила училище и стала танцевать в Большом театре. Это самый главный театр в нашей стране. Очень скоро она стала прима-балериной. Так называют самую главную балерину, которая танцует главные роли.'),
  p('Майя Плисецкая танцевала в Большом театре почти 50 лет. Это как пять раз по десять лет! Она ездила на гастроли в разные страны: в Америку, Японию, Францию, Англию и Италию. Везде люди хлопали ей очень долго и дарили цветы.'),

  pageBreak(),
  h1('Её самые знаменитые танцы'),
  p('Я узнала, что Майя Плисецкая станцевала очень много ролей. Вот те, которые мне понравились больше всего:'),
  table([4200, 5155], [
    ['Балет', 'Кого она танцевала'],
    ['«Лебединое озеро»', 'Белого лебедя Одетту и Чёрного лебедя Одиллию'],
    ['«Умирающий лебедь»', 'Лебедя'],
    ['«Дон Кихот»', 'Весёлую девушку Китри'],
    ['«Кармен-сюита»', 'Смелую и гордую Кармен'],
    ['«Конёк-Горбунок»', 'Царь-девицу'],
  ]),
  ...blank(1),
  p('Мы с мамой смотрели видео, где Майя танцует «Умирающего лебедя». Мне очень-очень понравилось! У неё были такие руки, как будто это настоящие крылья. Она так красиво ими махала, что я даже забыла, что это человек, а не птица. Потом я пробовала повторить эти движения дома перед зеркалом, но у меня так не получилось. Наверное, надо очень много тренироваться.'),
  p('А ещё Майя сама придумывала балеты. Её муж, Родион Щедрин, был композитором и писал для неё музыку.'),

  h1('Какая она была'),
  p('Когда я читала про Майю Плисецкую, я поняла, что она была:'),
  item([{ text: 'трудолюбивая', bold: true }, ' — она занималась каждый день, всю свою жизнь;']),
  item([{ text: 'сильная', bold: true }, ' — у неё было трудное детство, но она не сдалась;']),
  item([{ text: 'смелая', bold: true }, ' — она не боялась танцевать по-новому;']),
  item([{ text: 'красивая', bold: true }, ' — у неё были рыжие волосы и очень гибкие руки;']),
  item([{ text: 'весёлая и упорная', bold: true }, ' — даже когда ей исполнилось 70 лет, она вышла на сцену и танцевала!']),
  note('Мне понравились её слова:', '«Характер — это и есть судьба». Я думаю, это значит, что если ты упорный и не сдаёшься, то у тебя всё получится.'),

  pageBreak(),
  h1('Какие богатства Майя отдала людям'),
  p('Сначала я не поняла, какие богатства могут быть у балерины. Я думала, что богатства — это деньги или золото. Но учительница объяснила, что бывают другие богатства: талант, доброта, знания.'),
  p('Вот какие богатства отдала людям Майя Плисецкая:'),
  item('она подарила людям красоту своих танцев, и люди радовались;', 'star'),
  item('она учила молодых балерин и балетных артистов в других странах;', 'star'),
  item('в её честь проводили конкурс для молодых артистов балета «Майя»;', 'star'),
  item('она прославила наш русский балет на весь мир.', 'star'),
  p('Майи Плисецкой не стало в 2015 году. Но люди её помнят. В Москве, рядом с Большим театром, ей поставили красивый памятник. Когда я поеду в Москву, я обязательно попрошу маму сходить туда.'),

  h1('Самое интересное, что я узнала'),
  item('Майя начала учиться балету в 8 лет.', 'star'),
  item('Она танцевала сразу двух лебедей в одном балете: доброго белого и злого чёрного.', 'star'),
  item('Она написала книгу про свою жизнь. Книга называется «Я, Майя Плисецкая».', 'star'),
  item('Балетные туфли, в которых танцуют на кончиках пальцев, называются пуанты.', 'star'),

  pageBreak(),
  h1('Мой рисунок'),
  p('Я нарисовала Майю Плисецкую в балете «Лебединое озеро».'),
  frame('Здесь мой рисунок', 5200),

  h1('Мой вывод'),
  p('Мне очень понравилось делать этот проект. Я узнала, что Майя Плисецкая была великой балериной. У неё было трудное детство, но она очень много трудилась и стала самой знаменитой балериной в мире. Она отдала людям своё главное богатство — свой талант.'),
  p('Я поняла, что если очень сильно чего-то хотеть, много трудиться и не сдаваться, то мечта обязательно сбудется. Я тоже буду стараться на своих танцах. Может быть, когда-нибудь я тоже выступлю на большой сцене!'),

  pageBreak(),
  h1('Где я искала информацию'),
  item('Учебник «Окружающий мир», 4 класс, А. А. Плешаков.', 'num2'),
  item('Книга М. Плисецкой «Я, Майя Плисецкая».', 'num2'),
  item('Сайт Большого театра: bolshoi.ru', 'num2'),
  item('Видеозаписи балетов «Лебединое озеро» и «Умирающий лебедь».', 'num2'),
  item('Рассказы моей мамы и бабушки.', 'num2'),
];

const bulleted = (ref, text) => ({ reference: ref, levels: [{ level: 0, format: LevelFormat.BULLET, text,
  alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] });
const numbered = ref => ({ reference: ref, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.',
  alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] });

const margins = { top: 1134, bottom: 1134, left: 1701, right: 850 };
const doc = new Document({
  creator: 'Ученица 4 класса',
  title: 'Проект «Моя любимая балерина — Майя Плисецкая»',
  styles: {
    default: { document: { run: { font: FONT, size: 28 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: FONT, size: 34, bold: true, color: ACCENT },
        paragraph: { spacing: { before: 240, after: 200 }, alignment: AlignmentType.CENTER, outlineLevel: 0 } },
    ],
  },
  numbering: { config: [bulleted('heart', '♥'), bulleted('star', '★'), numbered('num'), numbered('num2')] },
  sections: [
    { properties: { page: { margin: margins } }, children: titlePage },
    {
      properties: { page: { margin: margins, pageNumbers: { start: 2 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
        children: [new TextRun({ children: [PageNumber.CURRENT], size: 24 })] })] }) },
      children: body,
    },
  ],
});

Packer.toBuffer(doc).then(b => { fs.writeFileSync(OUT, b); console.log('written', OUT); });
