import { useState, useEffect } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { PlusIcon } from '@heroicons/react/24/outline'
import AddEventModal from '../../components/Modals/AddEventModal'
import ViewEventModal from '../../components/Modals/ViewEventModal'
import './Calendar.css'

export default function Calendar() {
    const [events, setEvents] = useState([])
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedEvent, setSelectedEvent] = useState(null)
    const navigate = useNavigate()

    useEffect(() => {
        fetchEvents()
    }, [])

    const fetchEvents = async () => {
        try {
            const res = await axios.get('/api/calendar/events')
            if (res.data && Array.isArray(res.data)) {
                setEvents(res.data)
            }
        } catch (e) {
            console.error("Calendar Fetch Error:", e)
        }
    }

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* Header / Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">

                {/* Legend */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                    <h2 className="text-xl font-bold text-slate-800">Calendar</h2>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center space-x-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Normal/Task</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]"></div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Medium</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(243,68,68,0.4)]"></div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">High</span>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                    <div className="hidden sm:block text-[10px] font-black text-emerald-600 uppercase tracking-[0.1em] bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-full">
                        Sync Active
                    </div>

                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-lg shadow-indigo-200 transition-all hover:scale-105 active:scale-95"
                    >
                        <PlusIcon className="w-4 h-4" />
                        Add Event
                    </button>
                </div>
            </div>

            {/* Calendar Container */}
            <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 p-3 sm:p-6 md:p-8 relative overflow-hidden ring-1 ring-slate-50">
                {/* Decorative blobs */}
                <div className="absolute -top-32 -right-32 w-80 h-80 bg-indigo-50/50 rounded-full blur-3xl opacity-60 pointer-events-none"></div>
                <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-emerald-50/50 rounded-full blur-3xl opacity-60 pointer-events-none"></div>

                <div className="relative z-10 custom-calendar-wrapper">
                    <FullCalendar
                        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                        initialView="dayGridMonth"
                        headerToolbar={{
                            left: 'prev,next today',
                            center: 'title',
                            right: 'dayGridMonth,timeGridWeek,timeGridDay'
                        }}
                        height="auto"
                        events={events}
                        eventClick={(info) => {
                            if (info.event.extendedProps.type === 'event') {
                                info.jsEvent.preventDefault()
                                const eventData = {
                                    id: info.event.extendedProps.original_id, // Use original DB ID
                                    title: info.event.title,
                                    start: info.event.start,
                                    end: info.event.end,
                                    extendedProps: info.event.extendedProps
                                }
                                setSelectedEvent(eventData)
                            } else if (info.event.url) {
                                info.jsEvent.preventDefault()
                                navigate(info.event.url)
                            }
                        }}
                        dayMaxEvents={3}
                        nowIndicator={true}
                        stickyHeaderDates={true}
                        editable={false}
                        buttonText={{
                            today: 'Today',
                            month: 'Month',
                            week: 'Week',
                            day: 'Day'
                        }}
                        eventClassNames="cursor-pointer hover:opacity-80 transition-opacity shadow-sm border-0"
                    />
                </div>
            </div>

            <AddEventModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={fetchEvents}
            />

            <ViewEventModal
                isOpen={!!selectedEvent}
                onClose={() => setSelectedEvent(null)}
                event={selectedEvent}
                onSuccess={fetchEvents}
            />
        </div>
    )
}
