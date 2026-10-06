export const rssEntry = (keyword = 'rower', traffic = '20K+', date = 'Tue, 6 Oct 2026 01:00:00 -0700') =>
  `<item><title>${keyword}</title><ht:approx_traffic>${traffic}</ht:approx_traffic><pubDate>${date}</pubDate></item>`;
export const rssFeed = (items = rssEntry()) =>
  `<rss version="2.0" xmlns:ht="https://trends.google.com/trending/rss"><channel>${items}</channel></rss>`;
export const importedEntry = { keyword: 'rower', trafficLabel: '20K+', startedAt: null };
