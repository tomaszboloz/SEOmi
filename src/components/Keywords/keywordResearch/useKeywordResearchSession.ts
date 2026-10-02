import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToolsStore } from '@/stores/toolsStore';
import { useProjectStore } from '@/stores/projectStore';
import type { KeywordIdea } from '@/types';

export const useKeywordResearchSession = () => {
  const { t } = useTranslation();
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const keywordQuery = useToolsStore((s) => s.keywordQuery);
  const keywordCountry = useToolsStore((s) => s.keywordCountry);
  const keywordLanguage = useToolsStore((s) => s.keywordLanguage);
  const keywordResults = useToolsStore((s) => s.keywordResults);
  const isLoading = useToolsStore((s) => s.isKeywordLoading);
  const error = useToolsStore((s) => s.keywordError);
  const setKeywordQuery = useToolsStore((s) => s.setKeywordQuery);
  const setKeywordCountry = useToolsStore((s) => s.setKeywordCountry);
  const setKeywordLanguage = useToolsStore((s) => s.setKeywordLanguage);
  const searchKeywords = useToolsStore((s) => s.searchKeywords);
  const addSavedKeyword = useToolsStore((s) => s.addSavedKeyword);
  const savedKeywords = useToolsStore((s) => s.savedKeywords);

  const [inputQuery, setInputQuery] = useState(keywordQuery);
  const [selectedCountry, setSelectedCountry] = useState(keywordCountry);
  const [selectedLanguage, setSelectedLanguage] = useState(keywordLanguage);
  const [intentFilter, setIntentFilter] = useState<string>('all');
  const [savedIds, setSavedIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setInputQuery(keywordQuery);
    setSelectedCountry(keywordCountry);
    setSelectedLanguage(keywordLanguage);
    setIntentFilter('all');
    setSavedIds({});
  }, [activeProjectId, keywordCountry, keywordLanguage, keywordQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuery.trim()) return;
    setKeywordQuery(inputQuery.trim());
    setKeywordCountry(selectedCountry);
    setKeywordLanguage(selectedLanguage);
    searchKeywords(inputQuery.trim(), selectedCountry, selectedLanguage);
  };

  const handleSave = (item: KeywordIdea) => {
    addSavedKeyword({
      keyword: item.keyword,
      search_volume: item.search_volume,
      difficulty: item.difficulty,
      cpc: item.cpc,
      intent: item.intent,
      tags: [t('keywordResearchUi.researchTag')],
    });
    setSavedIds((prev) => ({ ...prev, [item.keyword]: true }));
  };

  const filteredResults = keywordResults.filter((item) => {
    if (intentFilter === 'all') return true;
    return item.intent.toLowerCase() === intentFilter.toLowerCase();
  });

  const primaryItem = keywordResults[0];

  return {
    t,
    inputQuery,
    setInputQuery,
    selectedCountry,
    setSelectedCountry,
    selectedLanguage,
    setSelectedLanguage,
    intentFilter,
    setIntentFilter,
    savedIds,
    handleSearch,
    handleSave,
    filteredResults,
    primaryItem,
    savedKeywords,
    isLoading,
    error,
  };
};
