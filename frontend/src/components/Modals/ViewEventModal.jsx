
import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, CalendarIcon, ClockIcon, BellIcon, PencilSquareIcon, TrashIcon, CheckIcon } from '@heroicons/react/24/outline'
import axios from 'axios'
import { useToast } from '../../contexts/ToastContext'
import { format } from 'date-fns'

export default function ViewEventModal({ isOpen, onClose, event, onSuccess }) {
    const { addToast } = useToast()
    const [isEditing, setIsEditing] = useState(false)
    const [loading, setLoading] = useState(false)

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        date: '',
        start_time: '',
        end_time: '',
        description: '',
        priority: 'Normal',
        reminders: []
    })

    // Init Data
    useEffect(() => {
        if (event) {
            // Helper to parsing ISO strings back to inputs
            // Event start/end from FullCalendar are Date objects usually? 
            // API returns ISO, FullCalendar parses. info.event.start is Date object.

            const startDate = event.start
            const endDate = event.end || event.start // Safety

            // Format to YYYY-MM-DD
            const yyyy = startDate.getFullYear()
            const mm = String(startDate.getMonth() + 1).padStart(2, '0')
            const dd = String(startDate.getDate()).padStart(2, '0')

            // Time HH:MM
            const hh = String(startDate.getHours()).padStart(2, '0')
            const min = String(startDate.getMinutes()).padStart(2, '0')

            const endHh = String(endDate.getHours()).padStart(2, '0')
            const endMin = String(endDate.getMinutes()).padStart(2, '0')

            setFormData({
                title: event.title,
                date: `${yyyy}-${mm}-${dd}`,
                start_time: `${hh}:${min}`,
                end_time: `${endHh}:${endMin}`,
                description: event.extendedProps?.description || '',
                priority: event.extendedProps?.priority || 'Normal',
                reminders: event.extendedProps?.reminders || []
            })
            setIsEditing(false)
        }
    }, [event, isOpen])

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this event?")) return
        setLoading(true)
        try {
            await axios.delete(`/api/calendar/events/${event.id}`)
            addToast('Event deleted', 'success')
            onSuccess()
            onClose()
        } catch (e) {
            console.error(e)
            addToast('Failed to delete', 'error')
        } finally {
            setLoading(false)
        }
    }

    const handleUpdate = async (e) => {
        e.preventDefault()
        setLoading(true)
        try {
            const startDateTime = new Date(`${formData.date}T${formData.start_time}:00`).toISOString()
            const endDateTime = new Date(`${formData.date}T${formData.end_time}:00`).toISOString()

            if (new Date(startDateTime) >= new Date(endDateTime)) {
                addToast('End time must be after start time', 'error')
                setLoading(false)
                return
            }

            const payload = {
                title: formData.title,
                description: formData.description,
                start_time: startDateTime,
                end_time: endDateTime,
                priority: formData.priority,
                reminders: formData.reminders
            }

            await axios.patch(`/api/calendar/events/${event.id}`, payload)
            addToast('Event updated', 'success')
            onSuccess()
            onClose()
        } catch (e) {
            console.error(e)
            addToast('Failed to update', 'error')
        } finally {
            setLoading(false)
        }
    }

    const toggleReminder = (type) => {
        setFormData(prev => {
            const current = prev.reminders
            if (current.includes(type)) {
                return { ...prev, reminders: current.filter(r => r !== type) }
            } else {
                return { ...prev, reminders: [...current, type] }
            }
        })
    }

    if (!event) return null

    // Helper for Priority Colors
    const getPriorityColor = (p) => {
        if (p === 'High') return 'bg-rose-100 text-rose-700 border-rose-200'
        if (p === 'Medium') return 'bg-amber-100 text-amber-700 border-amber-200'
        return 'bg-blue-100 text-blue-700 border-blue-200'
    }

    return (
        <Transition show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" />
                </Transition.Child>

                <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                            enterTo="opacity-100 translate-y-0 sm:scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                        >
                            <Dialog.Panel className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-md border border-slate-100">

                                {isEditing ? (
                                    // --- EDIT FORM MODE ---
                                    <form onSubmit={handleUpdate} className="p-6 space-y-4">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="text-lg font-bold text-slate-800">Edit Event</h3>
                                            <button type="button" onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600">
                                                <XMarkIcon className="w-5 h-5" />
                                            </button>
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase">Title</label>
                                            <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="w-full mt-1 border-slate-200 rounded-md text-sm" required />
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 uppercase">Start</label>
                                                <input type="time" value={formData.start_time} onChange={e => setFormData({ ...formData, start_time: e.target.value })} className="w-full mt-1 border-slate-200 rounded-md text-sm" required />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 uppercase">End</label>
                                                <input type="time" value={formData.end_time} onChange={e => setFormData({ ...formData, end_time: e.target.value })} className="w-full mt-1 border-slate-200 rounded-md text-sm" required />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Priority</label>
                                            <div className="flex gap-2">
                                                {['Normal', 'Medium', 'High'].map(p => (
                                                    <button key={p} type="button" onClick={() => setFormData({ ...formData, priority: p })} className={`px-2 py-1 text-xs rounded border ${formData.priority === p ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-slate-200'}`}>
                                                        {p}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Reminders</label>
                                            <div className="flex gap-2">
                                                {['Same Day', '1 Day Before'].map(label => {
                                                    const val = label === 'Same Day' ? 'same_day' : 'one_day_before'
                                                    const active = formData.reminders.includes(val)
                                                    return (
                                                        <button key={val} type="button" onClick={() => toggleReminder(val)} className={`px-2 py-1 text-xs rounded border ${active ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-slate-200'}`}>
                                                            {label}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase">Description</label>
                                            <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full mt-1 border-slate-200 rounded-md text-sm" rows={2} />
                                        </div>

                                        <div className="flex gap-2 pt-2">
                                            <button type="submit" disabled={loading} className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-indigo-700">Save</button>
                                        </div>

                                    </form>
                                ) : (
                                    // --- VIEW MODE ---
                                    <div className="p-6">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex gap-2 items-center">
                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${getPriorityColor(event.extendedProps?.priority)}`}>
                                                    {event.extendedProps?.priority || 'Normal'}
                                                </span>
                                            </div>
                                            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
                                                <XMarkIcon className="w-6 h-6" />
                                            </button>
                                        </div>

                                        <h3 className="text-xl font-bold text-slate-900 mb-1">{event.title}</h3>

                                        <div className="text-sm text-slate-500 mb-6 flex flex-wrap items-center gap-2">
                                            <CalendarIcon className="w-4 h-4" />
                                            <span>{event.start ? format(event.start, 'EEEE, MMMM d, yyyy') : ''}</span>
                                            <span className="hidden sm:block w-1 h-1 rounded-full bg-slate-300"></span>
                                            <ClockIcon className="w-4 h-4 ml-1 sm:ml-0" />
                                            <span>
                                                {event.start ? format(event.start, 'h:mm a') : ''} - {event.end ? format(event.end, 'h:mm a') : ''}
                                            </span>
                                        </div>

                                        {event.extendedProps?.creator_name && (
                                            <div className="text-xs text-slate-400 mb-6 flex items-center gap-1.5 font-medium">
                                                <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                                    {event.extendedProps.creator_name.charAt(0).toUpperCase()}
                                                </div>
                                                Created by <span className="text-slate-600">{event.extendedProps.creator_name}</span>
                                            </div>
                                        )}

                                        {event.extendedProps?.description && (
                                            <div className="mb-6 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Description</h4>
                                                <p className="text-sm text-slate-700 leading-relaxed">{event.extendedProps.description}</p>
                                            </div>
                                        )}

                                        {event.extendedProps?.reminders && event.extendedProps.reminders.length > 0 && (
                                            <div className="mb-6">
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                                                    <BellIcon className="w-3 h-3" /> Active Reminders
                                                </h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {event.extendedProps.reminders.map(r => (
                                                        <span key={r} className="px-2 py-1 bg-indigo-50 text-indigo-600 text-xs font-semibold rounded-md border border-indigo-100">
                                                            {r === 'same_day' ? 'Same Day' : '1 Day Before'}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {event.extendedProps?.can_edit && (
                                            <div className="flex gap-3 pt-2">
                                                <button
                                                    onClick={() => setIsEditing(true)}
                                                    className="flex-1 flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold py-2.5 rounded-xl transition text-sm shadow-sm"
                                                >
                                                    <PencilSquareIcon className="w-4 h-4" /> Edit
                                                </button>
                                                <button
                                                    onClick={handleDelete}
                                                    className="flex-none flex items-center justify-center gap-2 bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 font-semibold px-4 py-2.5 rounded-xl transition text-sm shadow-sm"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    )
}
