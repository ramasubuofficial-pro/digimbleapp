// JS Logic for Antigravity PM

// The Supabase client is initialized in base.html as 'supabaseClient'

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString();
}

// Toast Notification
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 px-6 py-3 rounded-xl shadow-2xl text-white transform transition-all duration-300 translate-y-10 opacity-0 z-50 ${type === 'success' ? 'bg-slate-800' : 'bg-red-600'}`;
    toast.innerText = message;
    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => {
        toast.classList.remove('translate-y-10', 'opacity-0');
    }, 10);

    // Remove
    setTimeout(() => {
        toast.classList.add('translate-y-10', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Handle Sign Out
async function handleSignOut() {
    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
        // Redirect to backend logout to clear session
        window.location.href = "/auth/logout";
    } catch (error) {
        console.error('Error signing out:', error);
        // Even if supabase fails, we should probably clear local session
        if (confirm('Error signing out of Supabase. force local logout?')) {
            window.location.href = "/auth/logout";
        }
    }
}

console.log('Antigravity PM Loaded');
