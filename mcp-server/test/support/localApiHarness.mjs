import { startLocalApi } from '../../dist/localApi.js';

export const token = 'local-api-test-token-1234';
const state = { api: undefined };

export const startApi = async (options) => (state.api = await startLocalApi(options));
export const closeApi = async () => {
  if (!state.api) return;
  await state.api.close();
  state.api = undefined;
};
export const endpoint = (path) => `http://${state.api.host}:${state.api.port}${path}`;
export const post = (path, body) => fetch(endpoint(path), { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
