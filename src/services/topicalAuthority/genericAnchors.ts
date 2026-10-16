/** Non-descriptive anchor texts in the 12 interface languages. They carry almost no topical signal (weight 0.1). */
const GENERIC = [
  'click here', 'read more', 'here', 'more', 'learn more', 'see more', 'details', 'link', 'this page', 'continue',
  'kliknij tutaj', 'czytaj więcej', 'więcej', 'tutaj', 'zobacz więcej', 'szczegóły', 'dowiedz się więcej', 'czytaj dalej',
  'haz clic aquí', 'leer más', 'más', 'aquí', 'ver más', 'más información', 'saber más',
  'hier klicken', 'mehr lesen', 'mehr', 'hier', 'weiterlesen', 'mehr erfahren', 'details ansehen',
  'cliquez ici', 'lire la suite', 'en savoir plus', 'plus', 'ici', 'voir plus', 'voir la suite',
  'clicca qui', 'leggi tutto', 'scopri di più', 'altro', 'qui', 'leggi di più', 'maggiori informazioni',
  'clique aqui', 'leia mais', 'saiba mais', 'mais', 'aqui', 'ver mais', 'continue lendo',
  'нажмите здесь', 'читать далее', 'подробнее', 'здесь', 'далее', 'еще', 'читать дальше',
  'こちら', '詳細', 'もっと見る', '続きを読む', 'ここをクリック', '詳しくはこちら',
  '点击这里', '阅读更多', '了解更多', '更多', '详情', '查看更多', '点击查看',
  '여기를 클릭', '더 보기', '자세히 보기', '더보기', '자세히', '여기',
  'اضغط هنا', 'اقرأ المزيد', 'المزيد', 'هنا', 'تفاصيل', 'اعرف المزيد',
];

const clean = (text: string): string => text.toLowerCase().replace(/\s+/g, ' ').replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, '').trim();

const SET = new Set(GENERIC.map(clean));

export const isGenericAnchor = (anchor: string): boolean => {
  const text = clean(anchor);
  return !text || SET.has(text);
};
