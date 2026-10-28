import { describe, expect, it } from 'vitest';
import { rulesFor } from '@/services/aioReadiness';
import { selfContainmentOf } from '@/services/aioReadiness/selfContainment';
import { extractTriples } from '@/services/aioReadiness/spo';
import { startsWithAny } from '@/services/aioReadiness/text';

interface Sample {
  lang: string;
  heading: string;
  /** First sentence opens with a pronoun and does not mention the heading entity. */
  dangling: string;
  /** Same idea, but the sentence names the entity up front. */
  anchored: string;
  filler: string;
  deictic: string;
  fact: string;
}

// Char-based scripts (ja/zh/ko) match deictic markers only at sentence start.
// Synthetic sentences written for rule coverage only; not native-speaker reviewed.
const SAMPLES: Sample[] = [
  { lang: 'de', heading: 'Blutzucker', dangling: 'Dieser Wert schwankt stark.', anchored: 'Blutzucker schwankt stark.', filler: 'Wie bereits erwähnt, schwankt es.', deictic: 'Die Tabelle steht unten.', fact: 'Nüchternglukose beträgt 70 mg/dl im Normalfall.' },
  { lang: 'es', heading: 'Glucosa', dangling: 'Esto varía mucho.', anchored: 'Glucosa varía mucho.', filler: 'Como ya se dijo, varía.', deictic: 'La tabla está abajo.', fact: 'La glucosa en ayunas mide 70 mg/dl normalmente.' },
  { lang: 'fr', heading: 'Glycémie', dangling: "C'est très variable.", anchored: 'Glycémie très variable.', filler: 'Comme mentionné, elle varie.', deictic: 'Le tableau est ci-dessous.', fact: 'La glycémie à jeun mesure 70 mg/dl normalement.' },
  { lang: 'it', heading: 'Glicemia', dangling: 'Questo varia molto.', anchored: 'Glicemia varia molto.', filler: 'Come già detto, varia.', deictic: 'La tabella è sotto.', fact: 'La glicemia a digiuno misura 70 mg/dl normalmente.' },
  { lang: 'pt', heading: 'Glicose', dangling: 'Isso varia muito.', anchored: 'Glicose varia muito.', filler: 'Como já dito, varia.', deictic: 'A tabela está abaixo.', fact: 'A glicose em jejum mede 70 mg/dl normalmente.' },
  { lang: 'ru', heading: 'Глюкоза', dangling: 'Этот показатель сильно меняется.', anchored: 'Глюкоза сильно меняется.', filler: 'Как уже сказано, он меняется.', deictic: 'Таблица находится ниже.', fact: 'Глюкоза натощак составляет 70 мг/дл обычно.' },
  { lang: 'ja', heading: '血糖値', dangling: 'これは大きく変動します。', anchored: '血糖値は大きく変動します。', filler: '前述の通り、変動します。', deictic: '以下の表を参照してください。', fact: '空腹時血糖は70から99である。' },
  { lang: 'zh', heading: '血糖', dangling: '该指标波动很大。', anchored: '血糖波动很大。', filler: '如前所述，会波动。', deictic: '如下表所示。', fact: '空腹血糖等于70到99。' },
  { lang: 'ko', heading: '혈당', dangling: '이것은 크게 변합니다.', anchored: '혈당은 크게 변합니다.', filler: '앞서 말한 대로 변합니다.', deictic: '아래 표를 보세요.', fact: '공복 혈당은 70에서 99입니다.' },
  { lang: 'ar', heading: 'السكر', dangling: 'هذا يتغير كثيرا.', anchored: 'السكر يتغير كثيرا.', filler: 'كما سبق، يتغير.', deictic: 'الجدول أدناه.', fact: 'سكر الدم يبلغ 70 ملغ عادة.' },
];

describe('AIO rules for 10 further languages (#108)', () => {
  it.each(SAMPLES)('$lang: stays basic coverage and uncertain status', ({ lang }) => {
    const { rules, status } = rulesFor(lang);
    expect(rules.coverage).toBe('basic');
    expect(status).toBe('uncertain');
    expect(rules.deictic?.length).toBeGreaterThan(3);
    expect(new Set(rules.dangling).size).toBe(rules.dangling.length);
    expect(new Set(rules.filler).size).toBe(rules.filler.length);
    rules.dangling.forEach((word) => expect(word).toBe(word.toLowerCase()));
  });

  it.each(SAMPLES)('$lang: flags a dangling opener and spares an anchored one', ({ lang, heading, dangling, anchored }) => {
    const { rules } = rulesFor(lang);
    expect(selfContainmentOf({ text: dangling, heading }, rules).dangling).toBe(1);
    expect(selfContainmentOf({ text: anchored, heading }, rules).dangling).toBe(0);
  });

  it.each(SAMPLES)('$lang: detects native filler openers', ({ lang, filler }) => {
    const { rules } = rulesFor(lang);
    expect(startsWithAny(filler, rules.filler, rules.charBased)).toBe(true);
  });

  it.each(SAMPLES)('$lang: detects native deictic markers', ({ lang, heading, deictic }) => {
    const { rules } = rulesFor(lang);
    expect(selfContainmentOf({ text: deictic, heading }, rules).deictic).toBeGreaterThan(0);
  });

  it.each(SAMPLES)('$lang: extracts a subject-relation-value fact', ({ lang, fact }) => {
    expect(extractTriples(fact, rulesFor(lang).rules).length).toBeGreaterThan(0);
  });

  it('matches French apostrophes and hyphenated demonstratives', () => {
    const fr = rulesFor('fr').rules;
    expect(startsWithAny('C’est simple.', fr.dangling)).toBe(true);
    expect(startsWithAny('Celui-ci mesure 5 mm.', fr.dangling)).toBe(true);
    expect(startsWithAny('Cela dépend.', fr.dangling)).toBe(true);
  });

  it('does not flag content-word openers in word-based languages', () => {
    expect(startsWithAny('Insulin senkt den Blutzucker.', rulesFor('de').rules.dangling)).toBe(false);
    expect(startsWithAny('La insulina reduce la glucosa.', rulesFor('es').rules.dangling)).toBe(false);
    expect(startsWithAny('Инсулин снижает глюкозу.', rulesFor('ru').rules.dangling)).toBe(false);
  });
});
