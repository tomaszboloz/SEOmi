export const keyphraseStorageKey = (projectId: string, target: string): string =>
  `seomi_project_${projectId}_headings_keyphrase_${encodeURIComponent(target)}_v1`;

export const getLevelBadgeClass = (level: number): string => {
  switch (level) {
    case 1:
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    case 2:
      return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    case 3:
      return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    case 4:
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    default:
      return 'bg-slate-800 text-slate-400 border-slate-700';
  }
};
