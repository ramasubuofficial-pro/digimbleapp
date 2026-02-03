import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition, Combobox } from '@headlessui/react'
import { MagnifyingGlassIcon, ClipboardDocumentListIcon, FolderIcon } from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

export default function GlobalSearchModal({ isOpen, onClose }) {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState({ tasks: [], projects: [] })
    const navigate = useNavigate()

    useEffect(() => {
        const timer = setTimeout(() => {
            if (query.trim()) {
                performSearch(query)
            } else {
                setResults({ tasks: [], projects: [] })
            }
        }, 300)
        return () => clearTimeout(timer)
    }, [query])

    const performSearch = async (q) => {
        try {
            // In a real app, you might have a dedicated /api/search endpoint.
            // For now, we'll fetch all and filter client-side or use existing endpoints if they support search strings.
            // Let's assume we fetch all for now (simulated global search) or hit specific endpoints.
            // optimization: create a specific search endpoint in backend later.

            const [tasksRes, projectsRes] = await Promise.all([
                axios.get('/api/tasks'),
                axios.get('/api/projects')
            ])

            const tasks = tasksRes.data.filter(t => t.title.toLowerCase().includes(q.toLowerCase()))
            const projects = projectsRes.data.filter(p => p.title.toLowerCase().includes(q.toLowerCase()))

            setResults({ tasks, projects })
        } catch (e) {
            console.error(e)
        }
    }

    const handleSelect = (item) => {
        if (!item) return
        if (item.type === 'project') {
            navigate(`/projects/${item.id}`)
        } else {
            navigate(`/tasks`)
            // In future, maybe open task detail modal or navigate to specific task route if valid
        }
        onClose()
    }

    return (
        <Transition.Root show={isOpen} as={Fragment} afterLeave={() => setQuery('')}>
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
                    <div className="fixed inset-0 bg-gray-500 bg-opacity-25 transition-opacity" />
                </Transition.Child>

                <div className="fixed inset-0 z-10 overflow-y-auto p-4 sm:p-6 md:p-20">
                    <Transition.Child
                        as={Fragment}
                        enter="ease-out duration-300"
                        enterFrom="opacity-0 scale-95"
                        enterTo="opacity-100 scale-100"
                        leave="ease-in duration-200"
                        leaveFrom="opacity-100 scale-100"
                        leaveTo="opacity-0 scale-95"
                    >
                        <Dialog.Panel className="mx-auto max-w-xl transform divide-y divide-gray-100 overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black ring-opacity-5 transition-all">
                            <Combobox onChange={handleSelect}>
                                <div className="relative">
                                    <MagnifyingGlassIcon
                                        className="pointer-events-none absolute top-3.5 left-4 h-5 w-5 text-gray-400"
                                        aria-hidden="true"
                                    />
                                    <Combobox.Input
                                        className="h-12 w-full border-0 bg-transparent pl-11 pr-4 text-gray-800 placeholder-gray-400 focus:ring-0 sm:text-sm"
                                        placeholder="Search projects and tasks..."
                                        onChange={(event) => setQuery(event.target.value)}
                                        autoComplete="off"
                                    />
                                </div>

                                {(results.tasks.length > 0 || results.projects.length > 0) && (
                                    <Combobox.Options static className="max-h-72 scroll-py-2 overflow-y-auto py-2 text-sm text-gray-800">
                                        {results.projects.length > 0 && (
                                            <>
                                                <div className="px-4 py-2 text-xs font-semibold text-gray-400 bg-gray-50">Projects</div>
                                                {results.projects.map((project) => (
                                                    <Combobox.Option
                                                        key={project.id}
                                                        value={{ ...project, type: 'project' }}
                                                        className={({ active }) =>
                                                            `cursor-pointer select-none px-4 py-2 flex items-center gap-3 ${active ? 'bg-indigo-600 text-white' : ''}`
                                                        }
                                                    >
                                                        <FolderIcon className="w-5 h-5 flex-none opacity-70" />
                                                        <span className="flex-auto truncate">{project.title}</span>
                                                    </Combobox.Option>
                                                ))}
                                            </>
                                        )}

                                        {results.tasks.length > 0 && (
                                            <>
                                                <div className="px-4 py-2 text-xs font-semibold text-gray-400 bg-gray-50 mt-2">Tasks</div>
                                                {results.tasks.map((task) => (
                                                    <Combobox.Option
                                                        key={task.id}
                                                        value={{ ...task, type: 'task' }}
                                                        className={({ active }) =>
                                                            `cursor-pointer select-none px-4 py-2 flex items-center gap-3 ${active ? 'bg-indigo-600 text-white' : ''}`
                                                        }
                                                    >
                                                        <ClipboardDocumentListIcon className="w-5 h-5 flex-none opacity-70" />
                                                        <span className="flex-auto truncate">{task.title}</span>
                                                    </Combobox.Option>
                                                ))}
                                            </>
                                        )}
                                    </Combobox.Options>
                                )}

                                {query !== '' && results.tasks.length === 0 && results.projects.length === 0 && (
                                    <p className="p-4 text-sm text-gray-500">No results found.</p>
                                )}
                            </Combobox>
                        </Dialog.Panel>
                    </Transition.Child>
                </div>
            </Dialog>
        </Transition.Root>
    )
}
