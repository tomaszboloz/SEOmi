import type React from 'react';

export type PaletteItem = {
  id: string;
  label: string;
  group: string;
  keywords: string;
  icon: React.ElementType;
  action: () => void;
};

export const normalize = (value: string): string => value.trim().toLocaleLowerCase();
