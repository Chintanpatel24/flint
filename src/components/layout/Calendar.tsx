import { useState } from 'react';
import { useStore } from '../../store';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Calendar() {
  const { openDailyNote } = useStore();
  const [currentDate, setCurrentDate] = useState(new Date());

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const days = daysInMonth(year, month);
  const firstDay = firstDayOfMonth(year, month);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1));

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <div className="bg-[#050505] rounded-lg border border-[#1a1a1a] p-3">
      <div className="flex items-center justify-between mb-4 px-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#444]">{monthNames[month]} {year}</span>
        <div className="flex gap-1">
          <button onClick={prevMonth} className="p-1 hover:text-white transition-colors"><ChevronLeft size={12}/></button>
          <button onClick={nextMonth} className="p-1 hover:text-white transition-colors"><ChevronRight size={12}/></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {["S", "M", "T", "W", "T", "F", "S"].map(d => <div key={d} className="text-[9px] font-bold text-[#222]">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
        {Array.from({ length: days }).map((_, i) => {
          const d = i + 1;
          const isToday = d === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
          return (
            <button key={d} onClick={() => openDailyNote(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)}
              className={`text-[10px] py-1 rounded transition-colors ${isToday ? 'bg-[#4a9eff] text-black font-bold' : 'hover:bg-[#111] text-[#444] hover:text-[#888]'}`}>
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}
