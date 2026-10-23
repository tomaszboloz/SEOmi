import type { CmsKind, CmsRequest, CmsResponse, CmsTarget } from '@/services/cmsPatch/types';

export const BASE = 'https://cms.example.com';
export const target = (kind: CmsKind): CmsTarget => ({ kind, baseUrl: BASE, contentId: '7', credential: 'cms-key' });

/** In-memory CMS: strict If-Match, optional concurrent edit; records every request. Holds no secrets. */
export const mockCms = (kind: CmsKind, initial = '<h2>Pricing</h2>\n<p>old</p>\n<h2>FAQ</h2>\n<p>faq</p>') => {
  const state = { content: initial, rev: 1, requests: [] as CmsRequest[], editBeforeWrite: false, status: 0 };
  const doc = () => ({ content: state.content, title: 'T', revision: String(state.rev) });
  const view = (): Record<string, unknown> => {
    if (kind === 'wordpress') return { content: { raw: state.content }, title: { raw: 'T' }, modified_gmt: String(state.rev) };
    if (kind === 'strapi') return { data: { id: 7, attributes: { content: state.content, title: 'T', updatedAt: String(state.rev) } } };
    return doc();
  };
  const send = async (request: CmsRequest): Promise<CmsResponse> => {
    state.requests.push(request);
    if (state.status) return { status: state.status, headers: {}, body: '' };
    if (request.method === 'GET') return { status: 200, headers: {}, body: JSON.stringify(view()) };
    if (state.editBeforeWrite) { state.rev += 1; state.editBeforeWrite = false; }
    if (request.headers['If-Match'] !== String(state.rev)) return { status: 412, headers: {}, body: '' };
    const body = JSON.parse(request.body ?? '{}') as { content?: string; data?: { content: string } };
    state.content = body.content ?? body.data?.content ?? state.content;
    state.rev += 1;
    return { status: 200, headers: {}, body: JSON.stringify(view()) };
  };
  return { state, send };
};

export const memoryStore = () => {
  const data = new Map<string, string>();
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
};
