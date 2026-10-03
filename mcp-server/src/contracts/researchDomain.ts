/** Pure browser/Node contract. Never include the supplied URL in error text. */
export class ResearchDomainError extends Error {
  constructor(readonly code: 'domainRequired' | 'domainCredentials' | 'domainInvalid' | 'competitorRequired' | 'competitorLimit') {
    const messages = {
      domainRequired: 'Enter a domain.',
      domainCredentials: 'Use an HTTP(S) domain without credentials.',
      domainInvalid: 'Enter a valid domain.',
      competitorRequired: 'Add at least one competitor domain different from the target.',
      competitorLimit: 'Add at most 19 competitors.',
    };
    super(messages[code]);
    this.name = 'ResearchDomainError';
  }
}

export const normalizeResearchDomain = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) throw new ResearchDomainError('domainRequired');
  let url: URL;
  try { url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`); }
  catch { throw new ResearchDomainError('domainInvalid'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new ResearchDomainError('domainCredentials');
  const hostname = url.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  if (!hostname || hostname === 'localhost' || !hostname.includes('.')) throw new ResearchDomainError('domainInvalid');
  return hostname;
};

export const prepareBacklinkGapDomains = (target: string, competitors: string[]): { target: string; competitors: string[] } => {
  const domain = normalizeResearchDomain(target);
  const domains = [...new Set(competitors.map(normalizeResearchDomain).filter((item) => item !== domain))];
  if (!domains.length) throw new ResearchDomainError('competitorRequired');
  if (domains.length > 19) throw new ResearchDomainError('competitorLimit');
  return { target: domain, competitors: domains };
};
