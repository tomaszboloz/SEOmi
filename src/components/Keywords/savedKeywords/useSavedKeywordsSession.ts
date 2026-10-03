import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToolsStore } from '@/stores/toolsStore';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';

export const useSavedKeywordsSession = () => {
  const { t } = useTranslation();
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const savedKeywords = useToolsStore((s) => s.savedKeywords);
  const removeSavedKeyword = useToolsStore((s) => s.removeSavedKeyword);
  const updateKeywordTags = useToolsStore((s) => s.updateKeywordTags);
  const setActiveTab = useAuditStore((s) => s.setActiveTab);

  const [searchFilter, setSearchFilter] = useState('');
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [newTagInput, setNewTagInput] = useState<{ id: string; tag: string } | null>(null);

  useEffect(() => {
    setSearchFilter('');
    setActiveTagFilter(null);
    setNewTagInput(null);
  }, [activeProjectId]);

  const allTags = Array.from(new Set(savedKeywords.flatMap((k) => k.tags || [])));

  const totalKeywords = savedKeywords.length;
  const totalVolume = savedKeywords.reduce((acc, k) => acc + k.search_volume, 0);
  const avgDifficulty =
    totalKeywords > 0
      ? Math.round(savedKeywords.reduce((acc, k) => acc + k.difficulty, 0) / totalKeywords)
      : 0;
  const estMonthlyValue = savedKeywords.reduce(
    (acc, k) => acc + k.search_volume * k.cpc * 0.05,
    0,
  );

  const filteredList = savedKeywords.filter((item) => {
    const matchesQuery =
      item.keyword.toLowerCase().includes(searchFilter.toLowerCase()) ||
      item.tags.some((tag) => tag.toLowerCase().includes(searchFilter.toLowerCase()));
    const matchesTag = !activeTagFilter || item.tags.includes(activeTagFilter);
    return matchesQuery && matchesTag;
  });

  const exportCSV = () => {
    if (savedKeywords.length === 0) return;
    const headers = [
      t('savedKeywordsUi.keyword'),
      t('savedKeywordsUi.searchVolume'),
      t('savedKeywordsUi.difficulty'),
      t('savedKeywordsUi.cpc'),
      t('savedKeywordsUi.intent'),
      t('savedKeywordsUi.tags'),
      t('savedKeywordsUi.addedAt'),
    ];
    const rows = savedKeywords.map((k) => [
      `"${k.keyword}"`,
      k.search_volume,
      k.difficulty,
      k.cpc,
      k.intent,
      `"${k.tags.join(', ')}"`,
      k.addedAt,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `seomi_saved_keywords_${new Date().toISOString().split('T')[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddTag = (id: string) => {
    if (!newTagInput || !newTagInput.tag.trim()) return;
    const target = savedKeywords.find((k) => k.id === id);
    if (!target) return;
    const tagClean = newTagInput.tag.trim();
    if (!target.tags.includes(tagClean)) {
      updateKeywordTags(id, [...target.tags, tagClean]);
    }
    setNewTagInput(null);
  };

  const handleRemoveTag = (id: string, tagToRemove: string) => {
    const target = savedKeywords.find((k) => k.id === id);
    if (!target) return;
    updateKeywordTags(
      id,
      target.tags.filter((tVal) => tVal !== tagToRemove),
    );
  };

  return {
    t,
    savedKeywords,
    searchFilter,
    setSearchFilter,
    activeTagFilter,
    setActiveTagFilter,
    newTagInput,
    setNewTagInput,
    allTags,
    totalKeywords,
    totalVolume,
    avgDifficulty,
    estMonthlyValue,
    filteredList,
    exportCSV,
    handleAddTag,
    handleRemoveTag,
    removeSavedKeyword,
    setActiveTab,
  };
};
