import { asString, call, json, record } from './http';
import { cmsUrl } from './ssrf';
import { CmsError, type CmsAdapter, type CmsDocument, type CmsKind } from './types';

const need = (value: string | undefined, what: string): string => {
  if (value === undefined) throw new CmsError('bad-response', `CMS response lacks ${what}`);
  return value;
};

/** WordPress REST: edit context returns raw (unrendered) content; `modified_gmt` is the revision. */
const wordpress: CmsAdapter = {
  async read(target, send) {
    const url = cmsUrl(target.baseUrl, `/wp-json/wp/v2/posts/${encodeURIComponent(target.contentId)}`, { context: 'edit' });
    const body = json(await call(send, target, 'GET', url));
    return { content: need(asString(record(body.content).raw), 'content.raw'), title: asString(record(body.title).raw), revision: need(asString(body.modified_gmt), 'modified_gmt') };
  },
  async write(target, content, baseRevision, send) {
    const url = cmsUrl(target.baseUrl, `/wp-json/wp/v2/posts/${encodeURIComponent(target.contentId)}`);
    const body = json(await call(send, target, 'POST', url, { body: { content }, ifMatch: baseRevision }));
    return { revision: need(asString(body.modified_gmt), 'modified_gmt') };
  },
};

/** Strapi v4 (`data.attributes`) and v5 (flat `data`); `updatedAt` is the revision. Only `content` is sent. */
const strapi: CmsAdapter = {
  async read(target, send) {
    const url = cmsUrl(target.baseUrl, `/api/${encodeURIComponent(target.collection ?? 'articles')}/${encodeURIComponent(target.contentId)}`);
    const data = record(json(await call(send, target, 'GET', url)).data);
    const fields = 'attributes' in data ? record(data.attributes) : data;
    return { content: need(asString(fields.content), 'content'), title: asString(fields.title), revision: need(asString(fields.updatedAt), 'updatedAt') };
  },
  async write(target, content, baseRevision, send) {
    const url = cmsUrl(target.baseUrl, `/api/${encodeURIComponent(target.collection ?? 'articles')}/${encodeURIComponent(target.contentId)}`);
    const data = record(json(await call(send, target, 'PUT', url, { body: { data: { content } }, ifMatch: baseRevision })).data);
    const fields = 'attributes' in data ? record(data.attributes) : data;
    return { revision: need(asString(fields.updatedAt), 'updatedAt') };
  },
};

/** Generic webhook: GET `{content, revision, title?}` for the id, POST `{contentId, content, baseRevision}`; answers `{revision}`. */
const webhook: CmsAdapter = {
  async read(target, send) {
    const url = cmsUrl(target.baseUrl, '', { id: target.contentId });
    const body = json(await call(send, target, 'GET', url));
    return { content: need(asString(body.content), 'content'), title: asString(body.title), revision: need(asString(body.revision), 'revision') };
  },
  async write(target, content, baseRevision, send) {
    const url = cmsUrl(target.baseUrl, '');
    const body = json(await call(send, target, 'POST', url, { body: { contentId: target.contentId, content, baseRevision }, ifMatch: baseRevision }));
    return { revision: need(asString(body.revision), 'revision') };
  },
};

export const ADAPTERS: Readonly<Record<CmsKind, CmsAdapter>> = { wordpress, strapi, webhook };
export type { CmsDocument };
