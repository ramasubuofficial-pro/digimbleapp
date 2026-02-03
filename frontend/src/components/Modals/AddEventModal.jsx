
import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, CalendarIcon, ClockIcon, BellIcon } from '@heroicons/react/24/outline'
import axios from 'axios'
import { useToast } from '../../contexts/ToastContext'

export default function AddEventModal({ isOpen, onClose, onSuccess }) {
    const { addToast } = useToast()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        title: '',
        date: '',
        start_time: '',
        end_time: '',
        description: '',
        priority: 'Normal',
        reminders: []
    })

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
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

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!formData.title || !formData.date || !formData.start_time || !formData.end_time) {
            addToast('Please fill in all required fields', 'error')
            return
        }

        setLoading(true)
        try {
            // Construct ISO Datetimes
            // Input date is YYYY-MM-DD, time is HH:MM
            const startDateTime = new Date(`${formData.date}T${formData.start_time}:00`).toISOString()
            const endDateTime = new Date(`${formData.date}T${formData.end_time}:00`).toISOString()

            // Simple validation
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

            await axios.post('/api/calendar/events', payload)
            addToast('Event created successfully', 'success')

            // Reset and Close
            setFormData({
                title: '',
                date: '',
                start_time: '',
                end_time: '',
                description: '',
                priority: 'Normal',
                reminders: []
            })
            onSuccess()
            onClose()
        } catch (error) {
            console.error("Create Event Error:", error)
            const msg = error.response?.data?.error || 'Failed to create event'
            addToast(msg, 'error')
        } finally {
            setLoading(false)
        }
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
                    <div className="fixed inset-0 bg-gray-900/25 backdrop-blur-sm transition-opacity" />
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
                            <Dialog.Panel className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg border border-slate-100">
                                <form onSubmit={handleSubmit}>
                                    {/* Header */}
                                    <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                                        <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-slate-800">
                                            New Calendar Event
                                        </Dialog.Title>
                                        <button
                                            type="button"
                                            className="text-slate-400 hover:text-slate-500 transition focus:outline-none"
                                            onClick={onClose}
                                        >
                                            <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                                        </button>
                                    </div>

                                    {/* Body */}
                                    <div className="px-6 py-6 space-y-5">

                                        {/* Title */}
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Event Title <span className="text-red-500">*</span></label>
                                            <input
                                                type="text"
                                                name="title"
                                                required
                                                value={formData.title}
                                                onChange={handleChange}
                                                placeholder="e.g. Project Kickoff"
                                                className="w-full rounded-lg border-slate-200 text-sm focus:border-indigo-500 focus:ring-indigo-500 transition shadow-sm py-2.5 px-3"
                                            />
                                        </div>

                                        {/* Date & Time */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="col-span-full sm:col-span-2">
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Date <span className="text-red-500">*</span></label>
                                                <div className="relative">
                                                    <CalendarIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                                                    <input
                                                        type="date"
                                                        name="date"
                                                        required
                                                        value={formData.date}
                                                        onChange={handleChange}
                                                        className="w-full rounded-lg border-slate-200 text-sm focus:border-indigo-500 focus:ring-indigo-500 pl-9 shadow-sm"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Start Time <span className="text-red-500">*</span></label>
                                                <div className="relative">
                                                    <ClockIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                                                    <input
                                                        type="time"
                                                        name="start_time"
                                                        required
                                                        value={formData.start_time}
                                                        onChange={handleChange}
                                                        className="w-full rounded-lg border-slate-200 text-sm focus:border-indigo-500 focus:ring-indigo-500 pl-9 shadow-sm"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">End Time <span className="text-red-500">*</span></label>
                                                <div className="relative">
                                                    <ClockIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                                                    <input
                                                        type="time"
                                                        name="end_time"
                                                        required
                                                        value={formData.end_time}
                                                        onChange={handleChange}
                                                        className="w-full rounded-lg border-slate-200 text-sm focus:border-indigo-500 focus:ring-indigo-500 pl-9 shadow-sm"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Priority */}
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">Priority</label>
                                            <div className="flex gap-3">
                                                {['Normal', 'Medium', 'High'].map((p) => (
                                                    <button
                                                        key={p}
                                                        type="button"
                                                        onClick={() => setFormData(prev => ({ ...prev, priority: p }))}
                                                        className={`flex-1 py-2 text-xs font-medium rounded-lg border transition ${formData.priority === p
                                                            ? (p === 'High' ? 'bg-rose-50 border-rose-200 text-rose-700 ring-1 ring-rose-500' :
                                                                p === 'Medium' ? 'bg-amber-50 border-amber-200 text-amber-700 ring-1 ring-amber-500' :
                                                                    'bg-emerald-50 border-emerald-200 text-emerald-700 ring-1 ring-emerald-500')
                                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                                            }`}
                                                    >
                                                        {p}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Reminders */}
                                        <div>
                                            <label className="flex items-center text-sm font-medium text-slate-700 mb-2">
                                                <BellIcon className="w-4 h-4 mr-1.5 text-slate-400" /> Reminders
                                            </label>
                                            <div className="flex gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleReminder('same_day')}
                                                    className={`flex items-center px-3 py-1.5 rounded-full text-xs font-medium border transition ${formData.reminders.includes('same_day')
                                                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 ring-1 ring-indigo-500'
                                                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                                                        }`}
                                                >
                                                    Same Day
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleReminder('one_day_before')}
                                                    className={`flex items-center px-3 py-1.5 rounded-full text-xs font-medium border transition ${formData.reminders.includes('one_day_before')
                                                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 ring-1 ring-indigo-500'
                                                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                                                        }`}
                                                >
                                                    1 Day Before
                                                </button>
                                            </div>
                                        </div>

                                        {/* Description */}
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Description (Optional)</label>
                                            <textarea
                                                name="description"
                                                rows={3}
                                                value={formData.description}
                                                onChange={handleChange}
                                                className="w-full rounded-lg border-slate-200 text-sm focus:border-indigo-500 focus:ring-indigo-500 shadow-sm px-3 py-2 resize-none"
                                            ></textarea>
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="bg-slate-50 px-6 py-4 flex flex-row-reverse gap-3 rounded-b-2xl">
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="inline-flex w-full justify-center rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed transition"
                                        >
                                            {loading ? 'Saving...' : 'Create Event'}
                                        </button>
                                        <button
                                            type="button"
                                            className="mt-3 inline-flex w-full justify-center rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 sm:mt-0 sm:w-auto transition"
                                            onClick={onClose}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    )
}
