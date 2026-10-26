import path from 'node:path';

export const isPathWithin = (root, candidate, pathApi = path) => {
  if (!pathApi.isAbsolute(root) || !pathApi.isAbsolute(candidate)) return false;
  const relative = pathApi.relative(root, candidate);
  return relative === '' || (
    !pathApi.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${pathApi.sep}`)
  );
};
