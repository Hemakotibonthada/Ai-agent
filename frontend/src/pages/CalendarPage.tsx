import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Clock,
  MapPin, Users, Video, Phone, Bell, Tag, Check, X,
  Repeat, AlertCircle, Zap
} from 'lucide-react';
import { FadeIn } from '../lib/animations';
import { useIsDemoAccount } from '@/hooks/useDemoData';

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  type: 'meeting' | 'task' | 'reminder' | 'event' | 'deadline';
  color: string;
  location?: string;
  attendees?: number;
  recurring?: boolean;
  priority: 'low' | 'medium' | 'high';
}

const eventColors: Record<string, { bg: string; text: string; dot: string }> = {
  meeting: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500' },
  task: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', dot: 'bg-purple-500' },
  reminder: { bg: 'bg-nexus-warning/15', text: 'text-nexus-warning', dot: 'bg-yellow-500' },
  event: { bg: 'bg-nexus-success/15', text: 'text-nexus-success', dot: 'bg-green-500' },
  deadline: { bg: 'bg-nexus-error/15', text: 'text-nexus-error', dot: 'bg-red-500' },
};

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const generateEvents = (): CalendarEvent[] => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const events: CalendarEvent[] = [];
  const titles = [
    { title: 'Team Standup', type: 'meeting' as const, desc: 'Daily standup with the dev team' },
    { title: 'Code Review', type: 'task' as const, desc: 'Review pull requests' },
    { title: 'Project Deadline', type: 'deadline' as const, desc: 'Sprint deliverables due' },
    { title: 'AI Workshop', type: 'event' as const, desc: 'Machine learning techniques workshop' },
    { title: 'Doctor Appointment', type: 'reminder' as const, desc: 'Annual health checkup' },
    { title: 'Client Call', type: 'meeting' as const, desc: 'Quarterly review with client' },
    { title: 'Deploy Release', type: 'task' as const, desc: 'Deploy v3.2 to production' },
    { title: 'Team Lunch', type: 'event' as const, desc: 'Team building lunch' },
    { title: 'Security Audit', type: 'deadline' as const, desc: 'Complete security audit report' },
    { title: 'Gym Session', type: 'reminder' as const, desc: 'Personal trainer session' },
    { title: 'Strategy Meeting', type: 'meeting' as const, desc: 'Q2 planning meeting' },
    { title: 'Design Review', type: 'task' as const, desc: 'UX/UI design review session' },
    { title: 'System Backup', type: 'reminder' as const, desc: 'Monthly system backup verification' },
    { title: 'Demo Day', type: 'event' as const, desc: 'Engineering demo presentations' },
    { title: 'Budget Review', type: 'deadline' as const, desc: 'Submit Q2 budget proposal' },
  ];

  for (let i = 0; i < titles.length; i++) {
    const day = Math.floor(Math.random() * 28) + 1;
    const startHour = Math.floor(Math.random() * 8) + 8;
    events.push({
      id: `ev-${i}`,
      ...titles[i],
      date: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      startTime: `${String(startHour).padStart(2, '0')}:00`,
      endTime: `${String(startHour + 1).padStart(2, '0')}:00`,
      color: titles[i].type,
      location: i % 3 === 0 ? 'Conference Room A' : i % 3 === 1 ? 'Virtual (Zoom)' : undefined,
      attendees: i % 2 === 0 ? Math.floor(Math.random() * 8) + 2 : undefined,
      recurring: i % 4 === 0,
      priority: i % 3 === 0 ? 'high' : i % 3 === 1 ? 'medium' : 'low',
    });
  }
  return events;
};

const CalendarPage: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events] = useState(isDemo ? generateEvents : []);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const calendarDays = useMemo(() => {
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    const remaining = 42 - days.length;
    for (let i = 0; i < remaining; i++) days.push(null);
    return days;
  }, [firstDay, daysInMonth]);

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(e => e.date === dateStr);
  };

  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) return [];
    return events.filter(e => e.date === selectedDate).sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [selectedDate, events]);

  const upcomingEvents = useMemo(() =>
    events.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)).slice(0, 5),
  [events]);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1));
  const goToday = () => setCurrentDate(new Date());

  return (
    <div className="space-y-6 p-6">
      <FadeIn>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-nexus-text flex items-center gap-3">
              <CalendarIcon className="text-blue-500" size={32} />
              Calendar
            </h1>
            <p className="text-nexus-muted mt-1">Manage your schedule, events, and reminders</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-nexus-surface rounded-xl p-1">
              {(['month', 'week', 'day'] as const).map(v => (
                <button key={v} onClick={() => setView(v)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${
                    view === v ? 'bg-white text-nexus-text shadow-sm' : 'text-nexus-muted'}`}>
                  {v}
                </button>
              ))}
            </div>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 shadow-lg shadow-blue-500/25">
              <Plus size={18} /> New Event
            </motion.button>
          </div>
        </div>
      </FadeIn>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Calendar Grid */}
        <div className="xl:col-span-3">
          <FadeIn delay={0.1}>
            <div className="bg-nexus-card rounded-2xl border border-nexus-border p-6">
              {/* Month Navigation */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-nexus-text">
                  {months[month]} {year}
                </h2>
                <div className="flex items-center gap-2">
                  <button onClick={goToday}
                    className="px-3 py-1.5 text-sm font-medium text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg">
                    Today
                  </button>
                  <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-nexus-surface">
                    <ChevronLeft size={18} className="text-nexus-muted" />
                  </button>
                  <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-nexus-surface">
                    <ChevronRight size={18} className="text-nexus-muted" />
                  </button>
                </div>
              </div>

              {/* Week Day Headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {weekDays.map(d => (
                  <div key={d} className="text-center text-xs font-semibold text-nexus-muted uppercase py-2">{d}</div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, i) => {
                  if (day === null) return <div key={i} className="h-24 rounded-lg" />;
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const dayEvents = getEventsForDay(day);
                  const isToday = dateStr === todayStr;
                  const isSelected = dateStr === selectedDate;

                  return (
                    <motion.div
                      key={i}
                      whileHover={{ scale: 1.02 }}
                      onClick={() => setSelectedDate(dateStr)}
                      className={`h-24 rounded-lg p-1.5 cursor-pointer border transition-all ${
                        isSelected ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10' :
                        isToday ? 'border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-900/5' :
                        'border-transparent hover:bg-nexus-surface/60/50'
                      }`}
                    >
                      <div className={`text-sm font-medium mb-1 ${
                        isToday ? 'text-blue-500' :
                        isSelected ? 'text-blue-600 dark:text-blue-400' :
                        'text-nexus-text'
                      }`}>
                        {isToday ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-500 text-white rounded-full text-xs">{day}</span>
                        ) : day}
                      </div>
                      <div className="space-y-0.5 overflow-hidden">
                        {dayEvents.slice(0, 2).map(ev => (
                          <div key={ev.id} className={`text-xs px-1 py-0.5 rounded truncate ${eventColors[ev.type]?.bg} ${eventColors[ev.type]?.text}`}>
                            {ev.title}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="text-xs text-nexus-muted pl-1">+{dayEvents.length - 2} more</div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </FadeIn>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Selected Day Events */}
          {selectedDate && (
            <FadeIn delay={0.15}>
              <div className="bg-nexus-card rounded-2xl border border-nexus-border p-5">
                <h3 className="font-semibold text-nexus-text mb-4">
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </h3>
                {selectedDayEvents.length === 0 ? (
                  <p className="text-sm text-nexus-muted text-center py-6">No events</p>
                ) : (
                  <div className="space-y-2">
                    {selectedDayEvents.map(ev => (
                      <motion.div
                        key={ev.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        whileHover={{ x: 4 }}
                        onClick={() => setSelectedEvent(ev)}
                        className={`p-3 rounded-xl cursor-pointer border-l-4 ${eventColors[ev.type]?.bg}`}
                        style={{ borderLeftColor: ev.type === 'meeting' ? '#3b82f6' : ev.type === 'task' ? '#8b5cf6' : ev.type === 'deadline' ? '#ef4444' : ev.type === 'event' ? '#10b981' : '#f59e0b' }}
                      >
                        <div className="font-medium text-sm text-nexus-text">{ev.title}</div>
                        <div className="flex items-center gap-2 text-xs text-nexus-muted mt-1">
                          <Clock size={12} /> {ev.startTime} - {ev.endTime}
                        </div>
                        {ev.location && (
                          <div className="flex items-center gap-1 text-xs text-nexus-muted mt-0.5">
                            <MapPin size={10} /> {ev.location}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </FadeIn>
          )}

          {/* Upcoming Events */}
          <FadeIn delay={0.2}>
            <div className="bg-nexus-card rounded-2xl border border-nexus-border p-5">
              <h3 className="font-semibold text-nexus-text mb-4 flex items-center gap-2">
                <Clock size={16} className="text-blue-500" /> Upcoming
              </h3>
              <div className="space-y-3">
                {upcomingEvents.map((ev, i) => (
                  <motion.div key={ev.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                    className="flex items-start gap-3 cursor-pointer group" onClick={() => setSelectedEvent(ev)}>
                    <div className={`w-2 h-2 rounded-full mt-1.5 ${eventColors[ev.type]?.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-nexus-text group-hover:text-blue-500 transition-colors truncate">{ev.title}</div>
                      <div className="text-xs text-nexus-muted">{ev.date} · {ev.startTime}</div>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-xs capitalize ${eventColors[ev.type]?.bg} ${eventColors[ev.type]?.text}`}>
                      {ev.type}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          </FadeIn>

          {/* Legend */}
          <FadeIn delay={0.25}>
            <div className="bg-nexus-card rounded-2xl border border-nexus-border p-5">
              <h3 className="font-semibold text-nexus-text mb-3 text-sm">Event Types</h3>
              <div className="space-y-2">
                {Object.entries(eventColors).map(([type, colors]) => (
                  <div key={type} className="flex items-center gap-2 text-sm">
                    <div className={`w-3 h-3 rounded-full ${colors.dot}`} />
                    <span className="text-nexus-muted capitalize">{type}</span>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </div>

      {/* Event Detail Modal */}
      <AnimatePresence>
        {selectedEvent && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedEvent(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              onClick={e => e.stopPropagation()}
              className="bg-nexus-card rounded-2xl max-w-md w-full p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${eventColors[selectedEvent.type]?.dot}`} />
                  <span className={`text-xs font-medium capitalize ${eventColors[selectedEvent.type]?.text}`}>{selectedEvent.type}</span>
                </div>
                <button onClick={() => setSelectedEvent(null)} className="p-1.5 rounded-lg hover:bg-nexus-surface">
                  <X size={16} className="text-nexus-muted" />
                </button>
              </div>
              <h2 className="text-xl font-bold text-nexus-text mb-2">{selectedEvent.title}</h2>
              <p className="text-nexus-muted mb-4">{selectedEvent.description}</p>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm text-nexus-text">
                  <CalendarIcon size={16} className="text-nexus-muted" />
                  <span>{new Date(selectedEvent.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-nexus-text">
                  <Clock size={16} className="text-nexus-muted" />
                  <span>{selectedEvent.startTime} - {selectedEvent.endTime}</span>
                </div>
                {selectedEvent.location && (
                  <div className="flex items-center gap-3 text-sm text-nexus-text">
                    <MapPin size={16} className="text-nexus-muted" />
                    <span>{selectedEvent.location}</span>
                  </div>
                )}
                {selectedEvent.attendees && (
                  <div className="flex items-center gap-3 text-sm text-nexus-text">
                    <Users size={16} className="text-nexus-muted" />
                    <span>{selectedEvent.attendees} attendees</span>
                  </div>
                )}
                {selectedEvent.recurring && (
                  <div className="flex items-center gap-3 text-sm text-nexus-text">
                    <Repeat size={16} className="text-nexus-muted" />
                    <span>Recurring</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm">
                  <AlertCircle size={16} className="text-nexus-muted" />
                  <span className={`capitalize font-medium ${
                    selectedEvent.priority === 'high' ? 'text-red-500' :
                    selectedEvent.priority === 'medium' ? 'text-yellow-500' : 'text-green-500'
                  }`}>{selectedEvent.priority} priority</span>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  className="flex-1 px-4 py-2.5 bg-blue-500 text-white rounded-xl font-medium">Edit</motion.button>
                <button className="px-4 py-2.5 bg-nexus-surface text-nexus-text rounded-xl font-medium">Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CalendarPage;
