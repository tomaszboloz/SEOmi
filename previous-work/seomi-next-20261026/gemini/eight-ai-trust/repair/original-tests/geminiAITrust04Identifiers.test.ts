import { describe, expect, it } from 'vitest';
import {
  classifyProfile,
  classifyProfiles,
  declarationRecall,
  hostMatches,
  orcidChecksumValid,
} from '@/services/eeatTrust/identifiers';

describe('EETV identity syntax regressions (#65, #87, #109)', () => {
  describe('ORCID checksum boundaries and ISO 7064 mod 11-2', () => {
    it('validates minimal valid ORCID and terminal X check digits', () => {
      expect(orcidChecksumValid('0000-0000-0000-0001')).toBe(true);
      expect(orcidChecksumValid('0000-0002-9079-593X')).toBe(true);
    });

    it('rejects swapped check digits where digit expected vs X expected', () => {
      expect(orcidChecksumValid('0000-0000-0000-0000')).toBe(false);
      expect(orcidChecksumValid('0000-0000-0000-000X')).toBe(false);
      expect(orcidChecksumValid('0000-0002-9079-5930')).toBe(false);
    });

    it('rejects non-digit prefixes, incorrect length, and lowercase check characters', () => {
      expect(orcidChecksumValid('0000-0002-9079-593x')).toBe(false);
      expect(orcidChecksumValid('0000-0002-1825-009')).toBe(false);
      expect(orcidChecksumValid('0000-0002-1825-00971')).toBe(false);
      expect(orcidChecksumValid('0000-0002-1825-009A')).toBe(false);
    });
  });

  describe('Wikidata QID syntax boundaries', () => {
    it('accepts valid Q-identifiers across wiki and entity paths', () => {
      expect(classifyProfile('https://www.wikidata.org/wiki/Q1')).toMatchObject({ kind: 'wikidata', id: 'Q1', status: 'syntax-valid' });
      expect(classifyProfile('https://wikidata.org/entity/Q11578/')).toMatchObject({ kind: 'wikidata', id: 'Q11578', status: 'syntax-valid' });
    });

    it('rejects leading zeroes, non-entity pages, properties, and lowercase prefixes', () => {
      expect(classifyProfile('https://www.wikidata.org/wiki/Q0').status).toBe('invalid');
      expect(classifyProfile('https://www.wikidata.org/wiki/Q012').status).toBe('invalid');
      expect(classifyProfile('https://www.wikidata.org/wiki/Property:P31').status).toBe('invalid');
      expect(classifyProfile('https://www.wikidata.org/wiki/Special:EntityPage/Q42').status).toBe('invalid');
      expect(classifyProfile('https://www.wikidata.org/wiki/q42').status).toBe('invalid');
      expect(classifyProfile('https://www.wikidata.org/wiki/').status).toBe('invalid');
    });
  });

  describe('suffix-spoofed hosts vs authentic domains', () => {
    it('rejects deceptive suffix and prefix domains in hostMatches', () => {
      expect(hostMatches('wikidata.org.attacker.com', 'wikidata.org')).toBe(false);
      expect(hostMatches('evilorcid.org', 'orcid.org')).toBe(false);
      expect(hostMatches('orcid.org.spoof.net', 'orcid.org')).toBe(false);
      expect(hostMatches('linkedin.com.phish.test', 'linkedin.com')).toBe(false);
      expect(hostMatches('scholar.google.com.fakepages.org', 'scholar.google.com')).toBe(false);
    });

    it('classifies suffix-spoofed URLs as kind other without granting tier weights', () => {
      const spoofed = classifyProfile('https://orcid.org.spoof.net/0000-0002-1825-0097');
      expect(spoofed).toMatchObject({ kind: 'other', status: 'declared' });
      expect(spoofed.tier).toBeUndefined();
      expect(declarationRecall([spoofed])).toBe(0);
    });

    it('permits authentic subdomains on recognized hosts', () => {
      expect(hostMatches('m.wikidata.org', 'wikidata.org')).toBe(true);
      expect(classifyProfile('https://m.wikidata.org/wiki/Q42')).toMatchObject({ kind: 'wikidata', tier: 1, status: 'syntax-valid' });
    });
  });

  describe('homepages vs profile URLs', () => {
    it('separates root/company homepages from individual member profiles', () => {
      expect(classifyProfile('https://www.linkedin.com/').status).toBe('declared');
      expect(classifyProfile('https://www.linkedin.com/company/example').status).toBe('declared');
      expect(classifyProfile('https://www.linkedin.com/in/specialist').status).toBe('syntax-valid');
      expect(classifyProfile('https://x.com/').status).toBe('declared');
      expect(classifyProfile('https://x.com/specialist').status).toBe('syntax-valid');
      expect(classifyProfile('https://scholar.google.com/').status).toBe('declared');
      expect(classifyProfile('https://scholar.google.com/citations?user=xyz').status).toBe('syntax-valid');
    });
  });

  describe('syntax-valid is not verified person', () => {
    it('never assigns verified status to syntactically valid profiles', () => {
      const orcid = classifyProfile('https://orcid.org/0000-0002-1825-0097');
      const wikidata = classifyProfile('https://www.wikidata.org/wiki/Q42');
      const linkedin = classifyProfile('https://www.linkedin.com/in/specialist');
      expect(orcid.status).toBe('syntax-valid');
      expect(orcid.status).not.toBe('verified');
      expect(wikidata.status).toBe('syntax-valid');
      expect(wikidata.status).not.toBe('verified');
      expect(linkedin.status).toBe('syntax-valid');
      expect(linkedin.status).not.toBe('verified');
    });

    it('handles unknown credentials and non-http schemes without crashing', () => {
      expect(classifyProfile('mailto:author@hospital.test').status).toBe('invalid');
      expect(classifyProfile('ftp://files.example.org/cv.pdf').status).toBe('invalid');
      expect(classifyProfile('MD, PhD, Board Certified Endocrinologist').status).toBe('invalid');
    });

    it('deduplicates case variants and trailing slashes for identical profiles', () => {
      const set = classifyProfiles([
        'https://orcid.org/0000-0002-1825-0097',
        'https://ORCID.ORG/0000-0002-1825-0097/',
        'https://x.com/DoctorExpert/',
        'https://x.com/doctorexpert',
      ]);
      expect(set).toHaveLength(2);
      expect(set.map((p) => p.kind).sort()).toEqual(['orcid', 'social']);
    });
  });
});
