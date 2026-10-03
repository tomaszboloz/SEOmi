import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { useCommandPaletteItems } from './commandPalette/useCommandPaletteItems';
import { useCommandPaletteSession } from './commandPalette/useCommandPaletteSession';
import { CommandPaletteHeader } from './commandPalette/CommandPaletteHeader';
import { CommandPaletteList } from './commandPalette/CommandPaletteList';
import { CommandPaletteFooter } from './commandPalette/CommandPaletteFooter';

export const CommandPalette: React.FC = () => {
  const { t } = useTranslation();
  const open = useUIStore((state) => state.commandPaletteOpen);
  const close = useUIStore((state) => state.closeCommandPalette);
  const openModal = useUIStore((state) => state.openModal);
  const projects = useProjectStore((state) => state.projects);
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const selectProject = useProjectStore((state) => state.selectProject);
  const setActiveTab = useAuditStore((state) => state.setActiveTab);

  // We define a placeholder session first to pass run, then wire filteredItems
  const [queryState, setQueryState] = React.useState('');
  const closeAndReset = () => {
    close();
    setQueryState('');
  };

  const { filteredItems } = useCommandPaletteItems({
    query: queryState,
    activeProjectId,
    projects,
    selectProject,
    setActiveTab,
    openModal,
    run: (action) => {
      closeAndReset();
      action();
    },
    t,
  });

  const {
    query,
    setQuery,
    activeIndex,
    setActiveIndex,
    inputRef,
    activeOptionRef,
  } = useCommandPaletteSession({
    open,
    close: closeAndReset,
    filteredItems,
  });

  // Sync session query with items hook
  React.useEffect(() => {
    setQueryState(query);
  }, [query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-slate-950/70 px-4 pt-[12vh] backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeAndReset();
      }}
    >
      <section
        id="command-palette-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-palette-title"
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/50"
      >
        <CommandPaletteHeader
          inputRef={inputRef}
          query={query}
          onQueryChange={(q) => {
            setQuery(q);
            setActiveIndex(0);
          }}
          onClose={closeAndReset}
          t={t}
        />
        <CommandPaletteList
          filteredItems={filteredItems}
          activeIndex={activeIndex}
          activeOptionRef={activeOptionRef}
          activeProjectId={activeProjectId}
          onSelectIndex={setActiveIndex}
          t={t}
        />
        <CommandPaletteFooter count={filteredItems.length} t={t} />
      </section>
    </div>
  );
};
