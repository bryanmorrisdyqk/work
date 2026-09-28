const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, PageBreak,
  LevelFormat, Footer, PageNumber, VerticalAlign,
  Tab, TabStopType, LeaderType,
} = require('docx');

const DIR = path.join(__dirname, 'img');
const OUT = process.argv[2] || path.join(__dirname, 'Проект_Богатства_отданные_людям.docx');
const FONT = 'Times New Roman';
const ACCENT = '1F5C99';

const p = (text, opts = {}) => new Paragraph({
  alignment: opts.align || AlignmentType.JUSTIFIED,
  indent: opts.noIndent ? undefined : { firstLine: 709 },
  spacing: { after: opts.after ?? 120, line: 300 },
  children: (Array.isArray(text) ? text : [text]).map(t =>
    typeof t === 'string' ? new TextRun({ text: t }) : new TextRun(t)),
});
const center = (text, run = {}, after = 120) => new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { after },
  children: [new TextRun({ text, ...run })],
});
const blank = (n = 1) => Array.from({ length: n }, () => new Paragraph({ children: [] }));
const h1 = t => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] });
const h2 = t => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const bullet = (t, ref = 'bul') => new Paragraph({
  numbering: { reference: ref, level: 0 }, spacing: { after: 60, line: 300 },
  alignment: AlignmentType.JUSTIFIED,
  children: (Array.isArray(t) ? t : [t]).map(x => typeof x === 'string' ? new TextRun(x) : new TextRun(x)),
});
const num = (t, ref) => bullet(t, ref);
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });
const line = () => new Paragraph({
  spacing: { before: 200, after: 0 },
  tabStops: [{ type: TabStopType.RIGHT, position: 9355, leader: LeaderType.UNDERSCORE }],
  children: [new TextRun({ color: '999999', children: [new Tab()] })],
});

const border = { style: BorderStyle.SINGLE, size: 4, color: 'A0A0A0' };
const borders = { top: border, bottom: border, left: border, right: border };
const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: none, bottom: none, left: none, right: none };

function cell(text, width, { head = false, fill } = {}) {
  return new TableCell({
    borders, width: { size: width, type: WidthType.DXA },
    shading: head ? { fill: 'D9E6F2', type: ShadingType.CLEAR, color: 'auto' }
      : fill ? { fill, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: head ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text, bold: head, size: 24 })],
    })],
  });
}
function table(widths, rows) {
  const total = widths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: total, type: WidthType.DXA }, columnWidths: widths,
    rows: rows.map((r, i) => new TableRow({
      tableHeader: i === 0,
      children: r.map((t, j) => cell(t, widths[j], { head: i === 0 })),
    })),
  });
}

// Portrait card: photo on the left, key facts on the right.
function portrait(img, name, years, who, facts) {
  const buf = fs.readFileSync(path.join(DIR, img + '.jpg'));
  const { w, h } = { vavilov: [169, 266], plisetskaya: [235, 283], obraztsov: [224, 279],
    chukovsky: [179, 280], leontyeva: [248, 283], ushinsky: [191, 273] }[img]
    .reduce((o, v, i) => (i ? { ...o, h: v } : { w: v }), {});
  const height = 190;
  const width = Math.round(w * height / h);
  return new Table({
    width: { size: 9355, type: WidthType.DXA }, columnWidths: [2800, 6555],
    rows: [new TableRow({ children: [
      new TableCell({
        borders: noBorders, width: { size: 2800, type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
          new ImageRun({ type: 'jpg', data: buf, transformation: { width, height },
            altText: { title: name, description: 'Портрет: ' + name, name } }),
        ] })],
      }),
      new TableCell({
        borders: noBorders, width: { size: 6555, type: WidthType.DXA },
        shading: { fill: 'EEF4FA', type: ShadingType.CLEAR, color: 'auto' },
        margins: { top: 120, bottom: 120, left: 200, right: 160 },
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: name, bold: true, size: 30, color: ACCENT })] }),
          new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: years, italics: true, size: 24 })] }),
          new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: who, size: 24 })] }),
          ...facts.map(f => new Paragraph({ numbering: { reference: 'fact', level: 0 }, spacing: { after: 40 },
            children: [new TextRun({ text: f, size: 24 })] })),
        ],
      }),
    ] })],
  });
}

const people = [
  {
    img: 'vavilov', name: 'Николай Иванович Вавилов', years: '1887–1943',
    who: 'Учёный-биолог, путешественник',
    facts: ['Побывал более чем в 60 странах', 'Собрал крупнейшую в мире коллекцию семян', 'Доказал, что у каждого растения есть родина'],
    title: 'Учёный, который накормил мир знаниями',
    text: [
      'Николай Иванович Вавилов родился в Москве. С детства он любил природу, собирал гербарии и наблюдал за растениями. Когда он вырос, то поставил перед собой большую цель: сделать так, чтобы на Земле не было голода. Для этого нужно было вывести новые сорта растений — урожайные, выносливые, не боящиеся болезней.',
      'Чтобы найти такие растения, Вавилов отправился в путешествия. Он побывал более чем в 60 странах: в Алжире, Греции, Италии, Мексике, Бразилии, Афганистане, Эфиопии и многих других. Он поднимался высоко в горы, уходил в пустыни, болел, попадал в опасные переделки, но не сдавался. Друзья удивлялись его смелости, силе и выносливости.',
      'Изучая культурные растения всего мира, учёный установил, что у каждого растения есть своя родина. Например, родина картофеля — Южная Америка, а огурцов — Индия. Оттуда они и были расселены по разным странам.',
      'Николай Иванович собрал крупнейшую в мире коллекцию семян культурных растений. Она хранится в Санкт-Петербурге, во Всероссийском институте растениеводства, который носит его имя. Во время блокады Ленинграда сотрудники института, голодая, сберегли эту коллекцию и не съели ни одного зёрнышка — они понимали, что эти семена нужны людям будущего.',
      'Судьба самого учёного оказалась трагической: в 1940 году его несправедливо арестовали, и в 1943 году он погиб. Позже его полностью оправдали. Но дело Вавилова живёт: семена из его коллекции до сих пор помогают учёным выводить новые сорта.',
    ],
    gift: 'Своё богатство — знания и огромную коллекцию семян — Вавилов отдал людям, чтобы на Земле было больше хлеба.',
  },
  {
    img: 'plisetskaya', name: 'Майя Михайловна Плисецкая', years: '1925–2015',
    who: 'Великая балерина, народная артистка СССР',
    facts: ['Прима-балерина Большого театра', 'Танцевала на сцене более 50 лет', 'Прославила русский балет во всём мире'],
    title: 'Балерина, подарившая миру красоту танца',
    text: [
      'Майя Михайловна Плисецкая родилась в Москве. Уже в детстве она поступила в хореографическое училище при Большом театре. Учиться балету очень трудно: нужно каждый день по многу часов заниматься у балетного станка, терпеть боль и усталость.',
      'Трудолюбие и талант сделали Майю Плисецкую одной из самых известных балерин мира. Она стала примой-балериной Большого театра. Зрители восхищались её танцем в балетах «Лебединое озеро», «Спящая красавица», «Кармен-сюита». Особенно знаменит её номер «Умирающий лебедь», который она исполняла даже в очень почтенном возрасте.',
      'Плисецкая выступала во многих странах, и везде её называли гордостью русского балета. Она танцевала на сцене больше полувека, а ещё сама ставила балеты и помогала молодым артистам.',
    ],
    gift: 'Своё богатство — талант и огромный труд — Майя Плисецкая отдала зрителям, подарив им радость и красоту.',
  },
  {
    img: 'obraztsov', name: 'Сергей Владимирович Образцов', years: '1901–1992',
    who: 'Артист-кукольник, режиссёр, создатель театра кукол',
    facts: ['В 1931 году создал театр кукол в Москве', 'Театр носит его имя', 'Поставил знаменитый «Необыкновенный концерт»'],
    title: 'Волшебник, оживлявший кукол',
    text: [
      'Сергей Владимирович Образцов родился в Москве. Сначала он учился на художника, потом стал актёром. Однажды он придумал выступать с маленькими куклами, которых надевал на руки. Зрителям так понравились эти номера, что Образцов решил посвятить свою жизнь театру кукол.',
      'В 1931 году он создал в Москве Государственный центральный театр кукол и руководил им 60 лет. Сейчас этот театр носит его имя. На здании театра висят знаменитые часы: каждый час в них открываются окошки и появляются сказочные персонажи.',
      'Образцов доказал, что кукольный театр — это настоящее искусство и для детей, и для взрослых. Его спектакли, например «Необыкновенный концерт», смотрели зрители во многих странах мира. При театре был создан музей кукол.',
    ],
    gift: 'Своё богатство — фантазию и доброту — Сергей Образцов отдал детям и взрослым, подарив им волшебный мир кукольного театра.',
  },
  {
    img: 'chukovsky', name: 'Корней Иванович Чуковский', years: '1882–1969',
    who: 'Детский писатель, поэт, переводчик',
    facts: ['Автор «Мойдодыра», «Айболита», «Мухи-Цокотухи»', 'Написал книгу «От двух до пяти»', 'Построил детскую библиотеку в Переделкине'],
    title: 'Любимый писатель всех детей',
    text: [
      'Корней Иванович Чуковский родился в Санкт-Петербурге. Его настоящее имя — Николай Корнейчуков. Детство у него было трудным, семья жила бедно, но мальчик очень много читал и сам выучил английский язык.',
      'Чуковский стал писателем и переводчиком, но больше всего его любят за стихи и сказки для детей. «Мойдодыр», «Тараканище», «Муха-Цокотуха», «Телефон», «Айболит», «Федорино горе» знает, наверное, каждый ребёнок в нашей стране. Эти сказки учат быть добрыми, смелыми, аккуратными и приходить на помощь.',
      'Корней Иванович внимательно слушал, как говорят маленькие дети, и написал об этом книгу «От двух до пяти». А в посёлке Переделкино под Москвой он на свои деньги построил библиотеку для детей и устраивал для них весёлые праздники у костра — «Здравствуй, лето!» и «Прощай, лето!». Входным билетом на праздник служили шишки, собранные детьми.',
    ],
    gift: 'Своё богатство — доброту, юмор и любовь к детям — Корней Чуковский отдал в своих книгах, которые читают уже много поколений.',
  },
  {
    img: 'leontyeva', name: 'Валентина Михайловна Леонтьева', years: '1923–2007',
    who: 'Телеведущая, народная артистка СССР',
    facts: ['Много лет вела передачу «Спокойной ночи, малыши!»', 'Дети называли её «тётя Валя»', 'Вела добрую передачу «От всей души»'],
    title: '«Тётя Валя» из телевизора',
    text: [
      'Валентина Михайловна Леонтьева родилась в Петрограде (так тогда назывался Санкт-Петербург). Во время Великой Отечественной войны она пережила блокаду Ленинграда. После войны окончила театральную студию и стала работать на телевидении.',
      'Миллионы детей нашей страны каждый вечер ждали встречи с «тётей Валей» в передаче «Спокойной ночи, малыши!». Вместе с Хрюшей, Степашкой, Филей и Каркушей она рассказывала сказки, учила дружить и быть вежливыми. Её тёплый голос и добрая улыбка помогали малышам спокойно засыпать.',
      'Ещё она вела передачу «От всей души», в которой рассказывала о простых людях, совершивших добрые дела, и помогала находить друг друга родным и друзьям, потерявшимся много лет назад.',
    ],
    gift: 'Своё богатство — доброе сердце и умение дарить радость — Валентина Леонтьева отдала детям и взрослым всей страны.',
  },
  {
    img: 'ushinsky', name: 'Константин Дмитриевич Ушинский', years: '1823–1871',
    who: 'Великий педагог, учитель учителей',
    facts: ['Основатель научной педагогики в России', 'Создал учебники «Родное слово» и «Детский мир»', 'Писал рассказы и сказки для детей'],
    title: 'Учитель русских учителей',
    text: [
      'Константин Дмитриевич Ушинский родился в Туле. Он окончил Московский университет и всю свою жизнь посвятил тому, чтобы дети учились с интересом и радостью.',
      'Ушинский считал, что обучать детей нужно на родном языке, а учебники должны быть понятными и интересными. Он создал книги для первого чтения «Родное слово» и «Детский мир». По ним учились читать многие поколения детей в России.',
      'Константин Дмитриевич написал много коротких рассказов и сказок для детей: «Четыре желания», «Утренние лучи», «Слепая лошадь», «Как рубашка в поле выросла». Его идеи о воспитании и обучении и сегодня используют учителя. Его называют «учителем русских учителей».',
    ],
    gift: 'Своё богатство — мудрость и любовь к детям — Константин Ушинский отдал школе, учителям и ученикам.',
  },
];

const titlePage = [
  center('Муниципальное бюджетное общеобразовательное учреждение', { size: 26 }, 0),
  center('«Средняя общеобразовательная школа № ____»', { size: 26 }, 0),
  ...blank(7),
  center('ПРОЕКТ', { bold: true, size: 32, color: ACCENT }, 60),
  center('по предмету «Окружающий мир»', { size: 28 }, 240),
  center('«БОГАТСТВА, ОТДАННЫЕ ЛЮДЯМ»', { bold: true, size: 44, color: ACCENT }, 120),
  center('Рассказы-портреты о людях, отдавших свои таланты другим', { italics: true, size: 28 }, 0),
  ...blank(7),
  new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 60 }, children: [new TextRun({ text: 'Выполнил(а): ученик(ца) 4 «___» класса', size: 26 })] }),
  new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 240 }, children: [new TextRun({ text: '________________________________', size: 26 })] }),
  new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 60 }, children: [new TextRun({ text: 'Руководитель: учитель начальных классов', size: 26 })] }),
  new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 60 }, children: [new TextRun({ text: '________________________________', size: 26 })] }),
  ...blank(5),
  center('20___ г.', { size: 26 }, 0),
];

const contents = [
  h1('Содержание'),
  ...['Введение', 'Глава 1. Николай Иванович Вавилов', 'Глава 2. Майя Михайловна Плисецкая',
    'Глава 3. Сергей Владимирович Образцов', 'Глава 4. Корней Иванович Чуковский',
    'Глава 5. Валентина Михайловна Леонтьева', 'Глава 6. Константин Дмитриевич Ушинский',
    'Глава 7. Такие люди рядом с нами', 'Заключение', 'Источники информации']
    .map(t => new Paragraph({ numbering: { reference: 'toc', level: 0 }, spacing: { after: 100, line: 300 }, children: [new TextRun(t)] })),
];

const intro = [
  h1('Введение'),
  p('Многие люди, наделённые богатым внутренним миром, щедро отдают свои богатства другим людям. Это проявляется в их поступках в семье, в общении с друзьями, в профессиональной работе, в благородном служении Отечеству, в великих подвигах, которые они совершают.'),
  p('Под «богатствами» в нашем проекте мы понимаем не деньги и не вещи, а знания, талант, трудолюбие, доброту и любовь к людям. Такие богатства не становятся меньше, когда ими делятся, — наоборот, от этого богаче становятся все.'),
  h2('Цель проекта'),
  p('Узнать о людях, которые своим трудом и талантом послужили на благо других людей, и рассказать о них одноклассникам.'),
  h2('Задачи проекта'),
  num('Найти информацию о людях, чьи портреты даны в учебнике, в книгах и в Интернете.', 'task'),
  num('Составить рассказы-портреты и подобрать к ним иллюстрации.', 'task'),
  num('Узнать, есть ли такие люди среди наших близких и земляков.', 'task'),
  num('Оформить результаты работы и провести презентацию в классе.', 'task'),
  h2('Форма работы и продукт проекта'),
  p('Форма работы: индивидуальная (при желании — в паре или в группе). Продукт проекта: альбом «Богатства, отданные людям» с рассказами-портретами и иллюстрациями.'),
  h2('Этапы работы'),
  table([700, 4655, 4000], [
    ['№', 'Что делаем', 'Сроки'],
    ['1', 'Определяем цель и задачи, выбираем героев проекта', '1-я неделя'],
    ['2', 'Ищем информацию в книгах, энциклопедиях, Интернете', '1-я неделя'],
    ['3', 'Составляем рассказы-портреты, подбираем фотографии', '2-я неделя'],
    ['4', 'Беседуем с родными, узнаём о близких и земляках', '2-я неделя'],
    ['5', 'Оформляем альбом', '3-я неделя'],
    ['6', 'Проводим презентацию в классе и оцениваем работу', '3-я неделя'],
  ]),
];

const chapters = people.flatMap((m, i) => [
  pageBreak(),
  h1(`Глава ${i + 1}. ${m.name}`),
  new Paragraph({ spacing: { after: 160 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: m.title, italics: true, size: 28, color: '555555' })] }),
  portrait(m.img, m.name, m.years, m.who, m.facts),
  ...blank(1),
  ...m.text.map(t => p(t)),
  new Paragraph({
    spacing: { before: 120, after: 120, line: 300 }, alignment: AlignmentType.JUSTIFIED,
    indent: { left: 284, right: 284 },
    border: { left: { style: BorderStyle.SINGLE, size: 24, color: ACCENT, space: 8 } },
    children: [new TextRun({ text: 'Вывод. ', bold: true }), new TextRun({ text: m.gift, italics: true })],
  }),
]);

const nearby = [
  pageBreak(),
  h1('Глава 7. Такие люди рядом с нами'),
  p('Примеры благородного служения людям можно найти не только среди знаменитостей. Они есть в нашем родном крае, в нашем городе и даже в нашей семье. Это врачи, которые лечат людей, учителя, которые учат детей, ветераны, защищавшие Родину, мастера своего дела, волонтёры, бабушки и дедушки, которые передают нам свой опыт.'),
  p('Я поговорил(а) со своими родными и узнал(а) о человеке, которым гордится наша семья (наш город).'),
  h2('Рассказ-портрет о близком человеке (земляке)'),
  new Table({
    width: { size: 9355, type: WidthType.DXA }, columnWidths: [2800, 6555],
    rows: [new TableRow({ children: [
      new TableCell({ borders, width: { size: 2800, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
        children: [...blank(3), center('Место для', { color: '888888', size: 22 }, 0), center('фотографии', { color: '888888', size: 22 }, 0), ...blank(3)] }),
      new TableCell({ borders, width: { size: 6555, type: WidthType.DXA }, margins: { top: 120, bottom: 120, left: 200, right: 160 },
        children: [
          new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: 'Фамилия, имя, отчество: ______________________', size: 24 })] }),
          new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: 'Кем мне приходится: ________________________', size: 24 })] }),
          new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: 'Профессия, занятие: ________________________', size: 24 })] }),
          new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: 'Годы жизни: _______________________________', size: 24 })] }),
        ] }),
    ] })],
  }),
  ...blank(1),
  new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: 'Какие замечательные дела он (она) совершил(а) на благо других людей:', bold: true })] }),
  line(), line(), line(), line(),
  new Paragraph({ spacing: { before: 360, after: 120 }, children: [new TextRun({ text: 'Чему я научился (научилась) у этого человека:', bold: true })] }),
  line(), line(), line(),
];

const conclusion = [
  pageBreak(),
  h1('Заключение'),
  p('Работая над проектом, я узнал(а) о замечательных людях нашей страны. Все они жили в разное время и занимались разными делами: учёный Николай Вавилов, балерина Майя Плисецкая, кукольник Сергей Образцов, писатель Корней Чуковский, телеведущая Валентина Леонтьева, педагог Константин Ушинский. Но всех их объединяет одно — они щедро отдавали свои богатства людям.'),
  h2('Какие богатства эти люди отдали людям'),
  table([3300, 2400, 3655], [
    ['Человек', 'Дело жизни', 'Богатство, отданное людям'],
    ['Н. И. Вавилов', 'Наука о растениях', 'Знания, коллекция семян'],
    ['М. М. Плисецкая', 'Балет', 'Талант, красота танца'],
    ['С. В. Образцов', 'Театр кукол', 'Фантазия, радость'],
    ['К. И. Чуковский', 'Детская литература', 'Добрые сказки и стихи'],
    ['В. М. Леонтьева', 'Телевидение', 'Доброта, забота о детях'],
    ['К. Д. Ушинский', 'Педагогика', 'Мудрость, учебники'],
  ]),
  ...blank(1),
  p('Я понял(а), что настоящее богатство человека — это его знания, таланты и доброе сердце. Такими богатствами можно и нужно делиться. Каждый из нас тоже может отдавать свои богатства людям: помогать родным, заботиться о младших, хорошо учиться, трудиться честно и делать добрые дела.'),
  p('Цель проекта достигнута: я собрал(а) информацию о людях, послуживших на благо других, составил(а) рассказы-портреты и оформил(а) альбом, который представлю одноклассникам.'),
  h2('Самооценка работы'),
  table([6355, 3000], [
    ['Что оцениваю', 'Моя оценка (✓)'],
    ['Мне было интересно работать над проектом', '☐ да   ☐ нет'],
    ['Я нашёл(ла) нужную информацию', '☐ да   ☐ частично'],
    ['Я справился(ась) с оформлением', '☐ да   ☐ частично'],
    ['Я смогу рассказать о проекте в классе', '☐ да   ☐ частично'],
  ]),
];

const sources = [
  pageBreak(),
  h1('Источники информации'),
  ...[
    'Плешаков А. А., Крючкова Е. А. Окружающий мир. 4 класс. Учебник. Часть 1. — М.: Просвещение.',
    'Детская энциклопедия «Я познаю мир». Великие люди России.',
    'Чуковский К. И. Сказки. — М.: Детская литература.',
    'Ушинский К. Д. Рассказы и сказки для детей. — М.: Детская литература.',
    'Всероссийский институт генетических ресурсов растений имени Н. И. Вавилова: vir.nw.ru',
    'Государственный академический центральный театр кукол имени С. В. Образцова: puppet.ru',
    'Государственный академический Большой театр России: bolshoi.ru',
    'Энциклопедия «Большая российская энциклопедия»: bigenc.ru',
  ].map(t => num(t, 'src')),
];

const numbering = {
  config: [
    { reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    { reference: 'fact', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 360, hanging: 240 } } } }] },
    ...['task', 'src', 'toc'].map(ref => ({ reference: ref, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.',
      alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] })),
  ],
};

const doc = new Document({
  creator: 'Ученик 4 класса',
  title: 'Проект «Богатства, отданные людям»',
  styles: {
    default: { document: { run: { font: FONT, size: 28 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: FONT, size: 34, bold: true, color: ACCENT },
        paragraph: { spacing: { before: 120, after: 240 }, alignment: AlignmentType.CENTER, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: FONT, size: 30, bold: true, color: ACCENT },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
    ],
  },
  numbering,
  sections: [
    {
      properties: { page: { margin: { top: 1134, bottom: 1134, left: 1701, right: 850 } } },
      children: titlePage,
    },
    {
      properties: { page: { margin: { top: 1134, bottom: 1134, left: 1701, right: 850 }, pageNumbers: { start: 2 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
        children: [new TextRun({ children: [PageNumber.CURRENT], size: 24 })] })] }) },
      children: [...contents, pageBreak(), ...intro, ...chapters, ...nearby, ...conclusion, ...sources],
    },
  ],
});

Packer.toBuffer(doc).then(b => { fs.writeFileSync(OUT, b); console.log('written', OUT); });
