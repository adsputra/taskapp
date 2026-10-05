import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay } from 'date-fns';

const CalendarEvent = ({ item, board, onSelect }) => {
  const priorityColumn = board?.columns?.find(col => col.type === 'priority');
  const priorityValue = item.data?.[priorityColumn?.id];
  const priorityOption = priorityColumn?.options?.choices?.find(c => c.value === priorityValue);
  
  return (
    <div 
      className="p-1.5 mb-1 bg-card rounded-md shadow-sm border border-border hover:bg-muted cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-105"
      title={item.title}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(item);
      }}
    >
      <div className="flex items-center gap-1.5">
        {priorityOption && (
          <div 
            className="w-2 h-2 rounded-full flex-shrink-0" 
            style={{ backgroundColor: priorityOption.color || '#ccc' }}
          />
        )}
        <p className="text-xs font-medium text-foreground truncate">{item.title}</p>
      </div>
    </div>
  );
};

export default function CalendarView({ board, items, onUpdateItem, onDeleteItem, onSelectTask }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  // First date column drives the calendar.
  const dateColumnId = board?.columns?.find((col) => col.type === 'date')?.id ?? null;

  const handleSelectTask = (task) => {
    if (onSelectTask) onSelectTask(task);
  };

  const renderHeader = () => {
    return (
      <div className="flex justify-between items-center mb-4 px-2">
        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-xl font-semibold text-foreground">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    );
  };

  const renderDays = () => {
    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return (
      <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground mb-2">
        {daysOfWeek.map(day => <div key={day} className="py-2 border-b dark:border-slate-700">{day}</div>)}
      </div>
    );
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const today = new Date();

    return (
      <div className="grid grid-cols-7 grid-rows-5 gap-px">
        {days.map(day => (
          <div
            key={day.toString()}
            className={`p-2 border border-border min-h-[100px] relative transition-colors hover:bg-muted 
              ${!isSameMonth(day, monthStart) ? 'bg-muted text-subtle-foreground dark:text-slate-600' : 'bg-card dark:bg-slate-800'}
              ${isSameDay(day, today) ? 'ring-2 ring-primary ring-inset' : ''}
            `}
          >
            <span className={`text-xs font-medium ${isSameDay(day, today) ? 'text-primary dark:text-blue-400' : 'text-foreground dark:text-slate-300'}`}>
              {format(day, 'd')}
            </span>
            <div className="mt-1 space-y-1 overflow-y-auto max-h-[70px]">
              {dateColumnId && items
                .filter(item => item.data?.[dateColumnId] && isSameDay(new Date(item.data[dateColumnId]), day))
                .map(item => (
                  <CalendarEvent 
                    key={item.id} 
                    item={item} 
                    board={board} 
                    onSelect={handleSelectTask}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (!board) return <div className="p-4 text-center text-muted-foreground">Board data not available.</div>;
  
  if (!dateColumnId) {
    return <div className="p-8 text-center text-muted-foreground">No suitable date column found for Calendar view. Please add a &ldquo;Date&rdquo; type column to your board.</div>;
  }

  return (
    <Card className="shadow-lg border-border dark:bg-slate-900">
      <CardContent className="p-4">
        {renderHeader()}
        {renderDays()}
        {renderCells()}
      </CardContent>
    </Card>
  );
}