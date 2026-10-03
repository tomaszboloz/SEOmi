import React from 'react';

export const handlePickerKeyboardNav = (
  event: React.KeyboardEvent<HTMLInputElement>,
  setOpen: (open: boolean) => void,
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>,
  optionsCount: number,
  onChooseCurrent: () => void,
) => {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    setOpen(true);
    setActiveIndex((index) => Math.min(index + 1, Math.max(0, optionsCount - 1)));
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    setOpen(true);
    setActiveIndex((index) => Math.max(0, index - 1));
  } else if (event.key === 'Home') {
    event.preventDefault();
    setOpen(true);
    setActiveIndex(0);
  } else if (event.key === 'End') {
    event.preventDefault();
    setOpen(true);
    setActiveIndex(Math.max(0, optionsCount - 1));
  } else if (event.key === 'Enter') {
    event.preventDefault();
    onChooseCurrent();
  }
};
