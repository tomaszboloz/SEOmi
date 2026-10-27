import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { handlePickerKeyboardNav } from '@/components/DataForSEO/pickers/pickerKeyboardNav';

describe('handlePickerKeyboardNav direct assertions', () => {
  const createKeyboardEvent = (key: string) => {
    const event = {
      key,
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent<HTMLInputElement>;
    return event;
  };

  it('ArrowDown opens menu and increments activeIndex capped at optionsCount - 1', () => {
    const event = createKeyboardEvent('ArrowDown');
    const setOpen = vi.fn();
    let index = 0;
    const setActiveIndex = vi.fn((updater: (i: number) => number) => {
      index = updater(index);
    });
    const onChoose = vi.fn();

    handlePickerKeyboardNav(event, setOpen, setActiveIndex as any, 3, onChoose);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(setOpen).toHaveBeenCalledWith(true);
    expect(index).toBe(1);

    // Call again to reach limit
    handlePickerKeyboardNav(event, setOpen, setActiveIndex as any, 3, onChoose);
    expect(index).toBe(2);

    // Call again, cannot exceed 2
    handlePickerKeyboardNav(event, setOpen, setActiveIndex as any, 3, onChoose);
    expect(index).toBe(2);
  });

  it('ArrowUp opens menu and decrements activeIndex with floor at 0', () => {
    const event = createKeyboardEvent('ArrowUp');
    const setOpen = vi.fn();
    let index = 2;
    const setActiveIndex = vi.fn((updater: (i: number) => number) => {
      index = updater(index);
    });
    const onChoose = vi.fn();

    handlePickerKeyboardNav(event, setOpen, setActiveIndex as any, 3, onChoose);
    expect(index).toBe(1);

    handlePickerKeyboardNav(event, setOpen, setActiveIndex as any, 3, onChoose);
    expect(index).toBe(0);

    handlePickerKeyboardNav(event, setOpen, setActiveIndex as any, 3, onChoose);
    expect(index).toBe(0);
  });

  it('Home and End jump to start and end index', () => {
    const homeEvent = createKeyboardEvent('Home');
    const setOpen = vi.fn();
    const setActiveIndex = vi.fn();
    const onChoose = vi.fn();

    handlePickerKeyboardNav(homeEvent, setOpen, setActiveIndex, 5, onChoose);
    expect(setActiveIndex).toHaveBeenCalledWith(0);

    const endEvent = createKeyboardEvent('End');
    handlePickerKeyboardNav(endEvent, setOpen, setActiveIndex, 5, onChoose);
    expect(setActiveIndex).toHaveBeenCalledWith(4);
  });

  it('Enter triggers onChooseCurrent', () => {
    const event = createKeyboardEvent('Enter');
    const setOpen = vi.fn();
    const setActiveIndex = vi.fn();
    const onChoose = vi.fn();

    handlePickerKeyboardNav(event, setOpen, setActiveIndex, 5, onChoose);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(onChoose).toHaveBeenCalledOnce();
  });
});
