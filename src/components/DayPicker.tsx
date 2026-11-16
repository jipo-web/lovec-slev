import React, { useMemo } from 'react';

interface DayPickerProps {
  selectedDay: string; // ISO yyyy-mm-dd
  onSelectDay: (isoDay: string) => void;
}

const WEEKDAYS = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];

export function toIsoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const DayPicker: React.FC<DayPickerProps> = ({ selectedDay, onSelectDay }) => {
  const days = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      return {
        iso: toIsoDay(d),
        label: i === 0 ? 'Dnes' : `${WEEKDAYS[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}`,
      };
    });
  }, []);

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
      {days.map((day) => (
        <button
          key={day.iso}
          onClick={() => onSelectDay(day.iso)}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition-colors ${
            selectedDay === day.iso
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-sm'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          {day.label}
        </button>
      ))}
    </div>
  );
};
