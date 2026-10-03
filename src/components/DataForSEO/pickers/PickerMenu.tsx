import React from 'react';
import { menuClasses } from './pickerPrimitives';

interface PickerMenuProps {
  listId: string;
  ariaLabel: string;
  isEmpty: boolean;
  children: React.ReactNode;
}

export const PickerMenu: React.FC<PickerMenuProps> = ({
  listId,
  ariaLabel,
  isEmpty,
  children,
}) => {
  return (
    <div id={listId} role="listbox" aria-label={ariaLabel} className={menuClasses}>
      {children}
      {isEmpty && <div className="px-3 py-2 text-xs text-slate-500">—</div>}
    </div>
  );
};
