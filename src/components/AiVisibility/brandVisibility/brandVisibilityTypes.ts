export const getSentimentBadge = (sentiment: string): string => {
  switch (sentiment) {
    case 'positive':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    case 'neutral':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    case 'negative':
      return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
    default:
      return 'bg-slate-800 text-slate-400 border-slate-700';
  }
};
