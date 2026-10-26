export const fetchCheckRuns = async ({ apiUrl, repository, sha, token, fetchImpl }) => {
  let page = 1;
  const allRuns = [];
  const seenIds = new Set();
  while (true) {
    const pageSuffix = page > 1 ? `&page=${page}` : '';
    const url = `${apiUrl}/repos/${repository}/commits/${sha}/check-runs?per_page=100${pageSuffix}`;
    const response = await fetchImpl(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!response.ok) throw new Error(`GitHub check-runs request failed: HTTP ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload?.check_runs) || typeof payload?.total_count !== 'number') {
      throw new Error('GitHub check-runs response is invalid.');
    }
    for (const run of payload.check_runs) {
      if (run.id != null) {
        if (seenIds.has(run.id)) throw new Error('GitHub returned duplicate check-runs page.');
        seenIds.add(run.id);
      }
      allRuns.push(run);
    }
    const isShortPage = payload.check_runs.length < 100;
    if (allRuns.length >= payload.total_count || payload.check_runs.length === 0 || isShortPage) {
      if (seenIds.size < payload.total_count || allRuns.length < payload.total_count) {
        throw new Error('GitHub returned incomplete check-runs data.');
      }
      break;
    }
    page += 1;
  }
  return allRuns.filter((run) => run.head_sha === sha);
};
