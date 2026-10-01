import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { SemanticTopicalWorkspace } from '@/components/Charts/SemanticTopicalWorkspace';
import { buildSemanticMap } from '@/services/semanticMap';
import { useToolsStore } from '@/stores/toolsStore';
import { shiftTopicalCalendarMonth } from '@/services/topicalMap';

import i18n from '@/i18n';
import { pages } from "./fixtures/semanticTopicalWorkspaceContracts";

describe('SemanticTopicalWorkspace', () => {
beforeEach(async () => {
    await i18n.changeLanguage('pl');
    localStorage.clear();
    useToolsStore.setState({ keywordResults: [], keywordResultsSource: null, gscData: null, gscDataFetchedAt: null, gscProperty: '' });
  });

it('persists calendar view and filters per project and creates a topical node on a chosen date', () => {
    const props = { projectId: 'project-calendar', pages, graph: buildSemanticMap(pages, pages[0].url), runId: 'run-calendar' };
    const mounted = render(<SemanticTopicalWorkspace {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Kalendarz' }));
    const preferencesKey = 'seomi_project_project-calendar_topical_workspace_preferences_v1';
    const originalMonth = JSON.parse(localStorage.getItem(preferencesKey) || '{}').month as string;
    const nextMonth = shiftTopicalCalendarMonth(originalMonth, 1);
    fireEvent.click(screen.getByRole('button', { name: 'Następny miesiąc' }));
    fireEvent.change(screen.getByLabelText('Filtruj etap kalendarza'), { target: { value: 'published' } });
    expect(JSON.parse(localStorage.getItem(preferencesKey) || '{}')).toMatchObject({ view: 'calendar', month: nextMonth, filters: { lifecycle: 'published' } });

    mounted.unmount();
    render(<SemanticTopicalWorkspace {...props} />);
    expect(screen.getByRole('region', { name: 'Kalendarz topical planu' })).toBeTruthy();
    expect((screen.getByLabelText('Filtruj etap kalendarza') as HTMLSelectElement).value).toBe('published');
    fireEvent.click(screen.getByRole('button', { name: `Dodaj temat na ${nextMonth}-15` }));
    const saved = JSON.parse(localStorage.getItem('seomi_project_project-calendar_topical_map_v1') || '{}');
    expect(saved.nodes[0]).toMatchObject({ scheduledDate: `${nextMonth}-15`, lifecycle: 'planned' });
  });
});
