import Modal from './Modal'

export default function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title = "Confirm Action",
    message = "Are you sure you want to proceed?",
    confirmText = "Confirm",
    cancelText = "Cancel",
    isDanger = false
}) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} size="max-w-sm">
            <div className="space-y-4">
                <p className="text-slate-600">
                    {message}
                </p>
                <div className="mt-6 flex flex-col sm:flex-row justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full sm:w-auto px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg transition order-2 sm:order-1"
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={`w-full sm:w-auto px-4 py-2 text-white rounded-lg shadow-lg transition order-1 sm:order-2 ${isDanger
                            ? 'bg-red-600 hover:bg-red-700 shadow-red-500/30'
                            : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/30'
                            }`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </Modal>
    )
}
