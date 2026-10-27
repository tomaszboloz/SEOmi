import type { AioRuleCoverage } from './types';

export interface LanguageRules {
  coverage: AioRuleCoverage;
  /** Lowercase sentence openers that refer back to an earlier mention. */
  dangling: string[];
  /** Openers that delay the answer ("as mentioned above", ...). */
  filler: string[];
  /** Copula / measurement verbs linking subject and object in a fact. */
  relations: string[];
  /** CJK-like scripts split into characters instead of words. */
  charBased?: boolean;
  deictic?: string[];
}

const en: LanguageRules = {
  coverage: 'full',
  dangling: ['it', 'this', 'that', 'these', 'those', 'they', 'he', 'she', 'such', 'the latter', 'the former', 'the above', 'this method', 'this process', 'this approach', 'this value', 'the aforementioned', 'its', 'their'],
  filler: ['as mentioned', 'as we said', 'as already', 'as noted', 'as discussed', 'as previously', 'many people', 'there are many', 'it is well known', 'in today', 'when it comes to', 'let us', "let's", 'before we', 'in this article', 'you may wonder', 'this question'],
  relations: ['is', 'are', 'was', 'were', 'means', 'equals', 'contains', 'requires', 'causes', 'reduces', 'increases', 'measure', 'measures', 'lasts', 'costs', 'should', 'must', 'ranges', 'operates'],
  deictic: ['here', 'there', 'now', 'today', 'above', 'below', 'as follows'],
};

const pl: LanguageRules = {
  coverage: 'full',
  dangling: ['to', 'ten', 'ta', 'te', 'tego', 'tej', 'tym', 'tych', 'ona', 'on', 'oni', 'one', 'ono', 'powyższy', 'powyższa', 'powyższe', 'wspomniany', 'wspomniana', 'wspomniane', 'taki', 'taka', 'takie', 'jego', 'jej', 'ich', 'wartość ta', 'kwestia ta', 'metoda ta', 'proces ten'],
  filler: ['jak już', 'jak wspomniano', 'jak wcześniej', 'jak pisaliśmy', 'jak wiadomo', 'wiele osób', 'istnieje wiele', 'kwestia ta', 'w dzisiejszych czasach', 'jeśli chodzi o', 'zacznijmy', 'w tym artykule', 'przed przejściem'],
  relations: ['jest', 'są', 'był', 'była', 'było', 'wynosi', 'oznacza', 'powoduje', 'zawiera', 'wymaga', 'zmniejsza', 'zwiększa', 'mierzy', 'trwa', 'kosztuje', 'powinien', 'powinna', 'powinno', 'należy', 'stanowi', 'służy'],
  deictic: ['tutaj', 'tam', 'teraz', 'dziś', 'powyżej', 'poniżej', 'jak następuje'],
};

const basic = (dangling: string[], filler: string[], relations: string[], charBased = false, deictic: string[] = ['here', 'there', 'now', 'above', 'below']): LanguageRules => ({ coverage: 'basic', dangling, filler, relations, charBased, deictic });

const RULES: Record<string, LanguageRules> = {
  en,
  pl,
  de: basic(['es', 'dies', 'diese', 'dieser', 'dieses', 'das', 'sie', 'er', 'jene'], ['wie bereits', 'wie oben', 'viele menschen', 'heutzutage'], ['ist', 'sind', 'war', 'beträgt', 'bedeutet', 'enthält', 'erfordert', 'verursacht', 'misst', 'kostet']),
  es: basic(['esto', 'eso', 'este', 'esta', 'estos', 'estas', 'ello', 'él', 'ella', 'ellos'], ['como ya', 'como se mencionó', 'mucha gente', 'hoy en día'], ['es', 'son', 'fue', 'significa', 'contiene', 'requiere', 'causa', 'mide', 'cuesta', 'equivale']),
  fr: basic(['il', 'elle', 'ils', 'elles', 'ce', 'cela', 'ceci', 'ça', 'cette', 'ces'], ['comme mentionné', 'comme déjà', 'beaucoup de gens', 'de nos jours'], ['est', 'sont', 'était', 'signifie', 'contient', 'nécessite', 'cause', 'mesure', 'coûte']),
  it: basic(['esso', 'essa', 'questo', 'questa', 'questi', 'queste', 'ciò', 'lui', 'lei', 'loro'], ['come già', 'come detto', 'molte persone', 'al giorno d’oggi'], ['è', 'sono', 'era', 'significa', 'contiene', 'richiede', 'causa', 'misura', 'costa']),
  pt: basic(['isso', 'isto', 'esse', 'essa', 'este', 'esta', 'eles', 'elas', 'ele', 'ela'], ['como já', 'como mencionado', 'muitas pessoas', 'hoje em dia'], ['é', 'são', 'foi', 'significa', 'contém', 'requer', 'causa', 'mede', 'custa']),
  ru: basic(['это', 'этот', 'эта', 'эти', 'он', 'она', 'они', 'оно', 'такой', 'данный', 'данная'], ['как уже', 'как было сказано', 'многие люди', 'в наше время'], ['это', 'является', 'составляет', 'означает', 'содержит', 'требует', 'вызывает', 'измеряет', 'стоит', 'равно']),
  ja: basic(['これ', 'それ', 'あれ', 'この', 'その', '彼', '彼女', '上記'], ['前述', '先に述べ', '多くの人'], ['は', 'とは', 'である', 'です', '含む', '必要'], true),
  zh: basic(['这', '这个', '这些', '那', '那个', '它', '他', '她', '上述'], ['如前所述', '如上所述', '很多人', '众所周知'], ['是', '为', '等于', '包含', '需要', '导致', '测量'], true),
  ko: basic(['이것', '그것', '저것', '이', '그', '위', '그는', '그녀는'], ['앞서', '이미 언급', '많은 사람'], ['입니다', '이다', '는', '은', '포함', '필요'], true),
  ar: basic(['هذا', 'هذه', 'ذلك', 'تلك', 'هو', 'هي', 'هم', 'هؤلاء'], ['كما ذكرنا', 'كما سبق', 'يتساءل كثيرون'], ['هو', 'هي', 'يبلغ', 'يعني', 'يحتوي', 'يتطلب', 'يسبب', 'يقيس', 'تكلفة']),
};

export const AIO_LANGUAGES = Object.keys(RULES);

/** Rules for the language's primary subtag; English rules when the language is unknown or unsupported. */
export const rulesFor = (language: string): { language: string; rules: LanguageRules; status: 'supported' | 'uncertain' | 'unsupported' } => {
  const code = language.split(/[-_]/)[0].toLowerCase();
  if (code === 'en' || code === 'pl') return { language: code, rules: RULES[code], status: 'supported' };
  if (code in RULES) return { language: code, rules: RULES[code], status: 'uncertain' };
  return { language: code || 'en', rules: { ...en, coverage: 'basic' }, status: 'unsupported' };
};
