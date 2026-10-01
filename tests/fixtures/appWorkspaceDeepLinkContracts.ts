import { screen } from '@testing-library/react';
import { expect } from 'vitest';

export const projects = [
  {
    id: 'project-a',
    name: 'Pierwszy projekt',
    rootUrl: 'https://first.example',
    createdAt: '2026-09-24T00:00:00.000Z',
    lastOpenedAt: '2026-09-24T00:00:00.000Z',
  },
  {
    id: 'project-b',
    name: 'Drugi projekt',
    rootUrl: 'https://second.example',
    createdAt: '2026-09-24T00:00:00.000Z',
    lastOpenedAt: '2026-09-24T00:00:00.000Z',
  },
] as const;

export const expectRenderedRoute = (route: string) => {
  const text = screen.getByRole('main').textContent?.trim() ?? '';
  expect(text, `route ${route} remained on the lazy loading fallback`).not.toMatch(
    /^(?:Loading view…|Ładowanie widoku…|Loading view\.\.\.|Ładowanie widoku\.\.\.)$/,
  );
  expect(text.length).toBeGreaterThan(30);
};
