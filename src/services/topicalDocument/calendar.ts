
export interface TopicalCalendarDay {
  date: string;
  inCurrentMonth: boolean;
}

export const formatLocalDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const shiftTopicalCalendarMonth = (month: string, delta: number): string => {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  const base = match ? new Date(Number(match[1]), Number(match[2]) - 1, 1) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  base.setMonth(base.getMonth() + Math.trunc(delta));
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`;
};

export const topicalCalendarDays = (month: string): TopicalCalendarDay[] => {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  const firstOfMonth = match ? new Date(Number(match[1]), Number(match[2]) - 1, 1) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const year = firstOfMonth.getFullYear();
  const monthIndex = firstOfMonth.getMonth();
  const start = new Date(year, monthIndex, 1);
  start.setDate(1 - ((start.getDay() + 6) % 7));
  const last = new Date(year, monthIndex + 1, 0);
  const end = new Date(last);
  end.setDate(last.getDate() + (6 - ((last.getDay() + 6) % 7)));
  const days: TopicalCalendarDay[] = [];
  for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    days.push({ date: formatLocalDate(date), inCurrentMonth: date.getMonth() === monthIndex });
  }
  return days;
};
