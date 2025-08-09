"use client";

import React, { useMemo, useState } from "react";

interface CalendarEvent {
  id: number;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
}

const MONTHS = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const WEEKDAYS = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

export default function Calendar() {
  const today = new Date();
  const [viewYear, setYear] = useState(today.getFullYear());
  const [viewMonth, setMonth] = useState(today.getMonth());
  const [hoverId, setHoverId] = useState<number | null>(null);

  const [events] = useState<CalendarEvent[]>([
    { id: 1, title: "Педсовет", description: "Обсуждение итогов четверти", date: "2025-08-10" },
    { id: 2, title: "Родительское собрание 9А", description: "Актовый зал, 18:00", date: "2025-08-12" },
  ]);

  const grid = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const startW = first.getDay() || 7;
    const days = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (Date | null)[] = Array(startW - 1).fill(null);
    for (let d = 1; d <= days; d++) cells.push(new Date(viewYear, viewMonth, d));
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }, [viewYear, viewMonth]);

  const byDay = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const list = m.get(e.date) ?? [];
      list.push(e); m.set(e.date, list);
    }
    return m;
  }, [events]);

  function key(d: Date){ return d.toISOString().slice(0,10); }

  return (
    <section>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <button onClick={() => (viewMonth === 0 ? (setYear(y=>y-1), setMonth(11)) : setMonth(m=>m-1))}>Назад</button>
        <h2>{MONTHS[viewMonth]} {viewYear}</h2>
        <button onClick={() => (viewMonth === 11 ? (setYear(y=>y+1), setMonth(0)) : setMonth(m=>m+1))}>Вперёд</button>
      </div>

      <table className="calendar">
        <thead>
          <tr>{WEEKDAYS.map(d => <th key={d}>{d}</th>)}</tr>
        </thead>
        <tbody>
          {grid.map((week, wi) => (
            <tr key={wi}>
              {week.map((date, di) => {
                if (!date) return <td key={di} />;
                const dayKey = key(date);
                const list = byDay.get(dayKey) || [];
                const isToday = date.toDateString() === today.toDateString();

                return (
                  <td key={di} style={{background: isToday ? "#fef7e5" : "#fff"}}>
                    <div className="day">{date.getDate()}</div>
                    <div style={{maxHeight:90, overflowY:"auto"}}>
                      {list.map(ev => (
                        <div
                          key={ev.id}
                          className="event"
                          onMouseEnter={() => setHoverId(ev.id)}
                          onMouseLeave={() => setHoverId(null)}
                        >
                          <div className="event-title">{ev.title}</div>
                          {hoverId === ev.id && (
                            <div className="tooltip">
                              <div><strong>Описание:</strong> {ev.description}</div>
                              <div style={{marginTop:4}}><strong>Дата:</strong> {dayKey}</div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
