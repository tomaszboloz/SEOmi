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

/*
 * Word lists for de/es/fr/it/pt/ru/ja/zh/ko/ar (issue #108).
 *
 * Provenance: hand-written from general grammar knowledge of each language. They are NOT derived
 * from a labelled corpus and NOT reviewed per language by a native speaker, so coverage stays
 * 'basic' and rulesFor() reports status 'uncertain'. Entries marked "uncertain" in the comments are
 * known to be ambiguous (a pronoun that is also a determiner, a possessive, or an everyday word)
 * and can produce false positives; a native-speaker review should confirm or drop them.
 *
 * Matching: whole words at sentence start, lowercase, for word-based scripts. Char-based scripts
 * (ja/zh/ko) match by sentence PREFIX, so a short entry also matches every longer word that
 * starts with it. Deictic markers are matched anywhere in the first two sentences.
 */
const RULES: Record<string, LanguageRules> = {
  en,
  pl,
  de: basic(
    // uncertain: 'das' / 'sie' / 'es' double as article, polite "you" and expletive; 'sein' is also the verb "to be".
    ['es', 'dies', 'diese', 'dieser', 'dieses', 'diesem', 'diesen', 'das', 'sie', 'er', 'jene', 'jener', 'jenes', 'solche', 'solcher', 'ihr', 'ihre', 'sein', 'seine', 'obige', 'obiger', 'obiges', 'genannte', 'genannter', 'besagte', 'besagter', 'letztere', 'letzterer', 'erstere', 'ersterer'],
    ['wie bereits', 'wie oben', 'wie erwähnt', 'wie gesagt', 'wie bekannt', 'bekanntlich', 'viele menschen', 'es gibt viele', 'heutzutage', 'in diesem artikel', 'wenn es um', 'lassen sie uns', 'beginnen wir', 'bevor wir'],
    ['ist', 'sind', 'war', 'waren', 'beträgt', 'bedeutet', 'enthält', 'erfordert', 'verursacht', 'misst', 'kostet', 'dauert', 'senkt', 'erhöht', 'reduziert', 'sollte', 'muss', 'dient'],
    false,
    ['hier', 'dort', 'jetzt', 'heute', 'oben', 'unten', 'wie folgt', 'siehe oben'],
  ),
  es: basic(
    // uncertain: 'su' / 'sus' are possessives (dangling only when the owner is unnamed); 'tal' also occurs in "tal vez".
    ['esto', 'eso', 'este', 'esta', 'estos', 'estas', 'ello', 'él', 'ella', 'ellos', 'ellas', 'ese', 'esa', 'esos', 'esas', 'aquel', 'aquella', 'aquellos', 'aquellas', 'aquello', 'éste', 'ésta', 'dicho', 'dicha', 'dichos', 'dichas', 'tal', 'su', 'sus', 'lo anterior', 'lo mencionado', 'el mencionado', 'la mencionada', 'el citado', 'la citada', 'el último', 'la última'],
    ['como ya', 'como se mencionó', 'como se ha mencionado', 'como dijimos', 'como es sabido', 'como se sabe', 'mucha gente', 'muchas personas', 'existen muchos', 'hoy en día', 'en este artículo', 'cuando se trata de', 'empecemos', 'antes de empezar'],
    ['es', 'son', 'fue', 'eran', 'significa', 'contiene', 'requiere', 'causa', 'mide', 'cuesta', 'equivale', 'dura', 'reduce', 'aumenta', 'debe', 'debería', 'sirve'],
    false,
    ['aquí', 'allí', 'ahora', 'hoy', 'arriba', 'abajo', 'como sigue'],
  ),
  fr: basic(
    // uncertain: 'ce' is also the determiner in "ce guide"; "c'est" opens many sentences and is nearly always anaphoric;
    // 'son' / 'sa' / 'ses' / 'leur' are possessives. Both straight and curly apostrophes are listed.
    ['il', 'elle', 'ils', 'elles', 'ce', 'cela', 'ceci', 'ça', 'cette', 'ces', "c'est", 'c’est', 'celui-ci', 'celle-ci', 'ceux-ci', 'celles-ci', 'celui-là', 'celle-là', 'ceux-là', 'celles-là', 'son', 'sa', 'ses', 'leur', 'leurs', 'ledit', 'ladite', 'lesdits', 'lesdites', 'ce dernier', 'cette dernière', 'le susmentionné', 'la susmentionnée', 'le précédent', 'la précédente'],
    ['comme mentionné', 'comme déjà', 'comme indiqué', 'comme on le sait', 'comme chacun sait', 'beaucoup de gens', 'de nos jours', 'il existe de nombreux', 'dans cet article', 'commençons', 'avant de commencer'],
    ['est', 'sont', 'était', 'étaient', 'signifie', 'contient', 'nécessite', 'cause', 'mesure', 'coûte', 'dure', 'réduit', 'augmente', 'doit', 'devrait', 'sert', 'représente'],
    false,
    ['ici', 'là', 'maintenant', 'aujourd’hui', "aujourd'hui", 'ci-dessus', 'ci-dessous', 'comme suit'],
  ),
  it: basic(
    // uncertain: 'tale' / 'tali' act as determiners ("tale metodo"); 'suo' family is possessive; 'detto' also a participle.
    ['esso', 'essa', 'questo', 'questa', 'questi', 'queste', 'ciò', 'lui', 'lei', 'loro', 'essi', 'esse', 'egli', 'quello', 'quella', 'quelli', 'quelle', 'codesto', 'codesta', 'tale', 'tali', 'suo', 'sua', 'suoi', 'sue', 'detto', 'detta', 'detti', 'dette', 'il suddetto', 'la suddetta', 'i suddetti', 'le suddette', 'il predetto', 'la predetta', 'quanto sopra'],
    ['come già', 'come detto', 'come accennato', 'come abbiamo visto', 'come noto', 'come è noto', 'molte persone', 'molta gente', 'esistono molti', 'al giorno d’oggi', 'in questo articolo', 'cominciamo', 'prima di iniziare'],
    ['è', 'sono', 'era', 'erano', 'significa', 'contiene', 'richiede', 'causa', 'misura', 'costa', 'dura', 'riduce', 'aumenta', 'deve', 'dovrebbe', 'serve'],
    false,
    ['qui', 'qua', 'lì', 'là', 'ora', 'oggi', 'sopra', 'sotto', 'come segue', 'di seguito'],
  ),
  pt: basic(
    // uncertain: 'seu' / 'sua' are possessives (dangling only with an unnamed owner); 'tal' also in fixed phrases.
    ['isso', 'isto', 'esse', 'essa', 'este', 'esta', 'estes', 'estas', 'esses', 'essas', 'eles', 'elas', 'ele', 'ela', 'aquilo', 'aquele', 'aquela', 'aqueles', 'aquelas', 'tal', 'seu', 'sua', 'seus', 'suas', 'dito', 'dita', 'ditos', 'ditas', 'o referido', 'a referida', 'os referidos', 'as referidas', 'o mencionado', 'a mencionada', 'o supracitado', 'a supracitada', 'o último', 'a última', 'o anterior', 'a anterior'],
    ['como já', 'como mencionado', 'como dito', 'como vimos', 'como se sabe', 'como é sabido', 'muitas pessoas', 'muita gente', 'existem muitos', 'hoje em dia', 'neste artigo', 'vamos começar', 'antes de começar'],
    ['é', 'são', 'foi', 'eram', 'era', 'significa', 'contém', 'requer', 'causa', 'mede', 'custa', 'dura', 'reduz', 'aumenta', 'deve', 'deveria', 'serve'],
    false,
    ['aqui', 'ali', 'agora', 'hoje', 'acima', 'abaixo', 'como segue'],
  ),
  ru: basic(
    // uncertain: 'это' doubles as a copula particle ("Это — ...") and is also in relations; 'такой' / 'данный' are determiners.
    ['это', 'этот', 'эта', 'эти', 'этого', 'этой', 'этом', 'этих', 'этому', 'этим', 'он', 'она', 'они', 'оно', 'его', 'её', 'ее', 'их', 'такой', 'такая', 'такое', 'такие', 'данный', 'данная', 'данное', 'тот', 'указанный', 'указанная', 'указанное', 'упомянутый', 'упомянутая', 'упомянутое', 'вышеуказанный', 'вышеупомянутый', 'вышеупомянутая', 'последний', 'последняя'],
    ['как уже', 'как было сказано', 'как сказано', 'как известно', 'как упоминалось', 'многие люди', 'существует много', 'в наше время', 'в этой статье', 'когда речь идёт', 'когда речь идет', 'давайте', 'прежде чем'],
    ['это', 'является', 'составляет', 'означает', 'содержит', 'требует', 'вызывает', 'измеряет', 'стоит', 'равно', 'длится', 'снижает', 'повышает', 'увеличивает', 'уменьшает', 'должен', 'должна', 'должно', 'служит', 'представляет'],
    false,
    ['здесь', 'там', 'сейчас', 'сегодня', 'выше', 'ниже', 'следующим образом'],
  ),
  ja: basic(
    // uncertain: prefix match, so 'それ' also hits 'それぞれ' ("each") and '彼' hits '彼女'/'彼ら' (intended).
    ['これ', 'それ', 'あれ', 'この', 'その', 'あの', 'こちら', 'そちら', 'これら', 'それら', '彼', '彼女', '彼ら', '上記', '前記', '前述', '当該', '同上', '前者', '後者'],
    ['前述', '先に述べ', '多くの人', '上述', '前記の通り', 'ご存じの通り', 'ご存知の通り', '周知の通り', '近年では', '今日では', '本記事では'],
    ['は', 'とは', 'である', 'です', '含む', '必要', '含まれる', '意味する', 'かかる', '要する', '異なる'],
    true,
    ['ここ', 'そこ', '現在', '以下', '上記', '下記'],
  ),
  zh: basic(
    // uncertain: '这' / '那' prefixes also hit "这里" / "那里" (locative) and "这样"; '其' is formal and rare in web copy.
    ['这', '这个', '这些', '那', '那个', '它', '他', '她', '上述', '该', '其', '前者', '后者', '上文', '以上', '前述', '本文'],
    ['如前所述', '如上所述', '很多人', '众所周知', '正如前文', '正如上文', '正如前面', '在当今', '让我们', '在本文'],
    ['是', '为', '等于', '包含', '需要', '导致', '测量', '约为', '持续', '花费', '意味着', '属于', '包括', '减少', '增加'],
    true,
    ['这里', '此处', '那里', '现在', '如下', '上文', '下文', '以上', '以下'],
  ),
  ko: basic(
    // uncertain: prefix match makes '이' and '그' very broad (they also hit 이미, 그리고, 그러나, ...). They come from the
    // original list; a native-speaker review should narrow them (e.g. 이것 / 이는 / 그것 / 그는 / 이러한 / 그러한).
    ['이것', '그것', '저것', '이', '그', '위', '그는', '그녀는', '이러한', '그러한', '이들', '그들', '상기', '해당', '전술한'],
    ['앞서', '이미 언급', '많은 사람', '앞에서 말한', '알려진 바와 같이', '잘 알려진', '오늘날', '이 글에서'],
    ['입니다', '이다', '는', '은', '포함', '필요', '의미한다', '의미합니다', '포함한다', '포함합니다', '필요하다', '필요합니다', '소요된다', '걸린다'],
    true,
    ['여기', '거기', '지금', '아래', '위의', '다음과'],
  ),
  ar: basic(
    // uncertain: Arabic proclitics (و، ف، ب، ل) attach to the word, so sentences opening with "وهذا" / "فهذا" are NOT
    // matched, and diacritics are not normalised. 'هو' / 'هي' are also copulas.
    ['هذا', 'هذه', 'ذلك', 'تلك', 'هو', 'هي', 'هم', 'هؤلاء', 'هذان', 'هاتان', 'أولئك', 'هما', 'هن', 'ذلكم', 'تلكم', 'المذكور', 'المذكورة', 'المشار إليه', 'المشار إليها', 'السابق', 'السابقة', 'الأخير', 'الأخيرة'],
    ['كما ذكرنا', 'كما سبق', 'يتساءل كثيرون', 'كما أشرنا', 'كما هو معروف', 'كثير من الناس', 'في عصرنا', 'في هذا المقال', 'دعونا'],
    ['هو', 'هي', 'يبلغ', 'يعني', 'يحتوي', 'يتطلب', 'يسبب', 'يقيس', 'تكلفة', 'يساوي', 'يستغرق', 'يكلف', 'يقلل', 'يزيد', 'تبلغ', 'تعني', 'تحتوي', 'تتطلب', 'تسبب', 'تستغرق', 'تساوي', 'يمثل', 'تمثل'],
    false,
    ['هنا', 'هناك', 'الآن', 'اليوم', 'أعلاه', 'أدناه', 'كما يلي'],
  ),
};

export const AIO_LANGUAGES = Object.keys(RULES);

/** Rules for the language's primary subtag; English rules when the language is unknown or unsupported. */
export const rulesFor = (language: string): { language: string; rules: LanguageRules; status: 'supported' | 'uncertain' | 'unsupported' } => {
  const code = language.split(/[-_]/)[0].toLowerCase();
  if (code === 'en' || code === 'pl') return { language: code, rules: RULES[code], status: 'supported' };
  if (code in RULES) return { language: code, rules: RULES[code], status: 'uncertain' };
  return { language: code || 'en', rules: { ...en, coverage: 'basic' }, status: 'unsupported' };
};
