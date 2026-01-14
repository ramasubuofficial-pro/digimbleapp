const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

// CHANGE THIS URL TO YOUR LIVE HOSTED URL (e.g. https://your-app.onrender.com)
// For local testing, use 'http://localhost:5000' and ensure your Flask app is running.
const APP_URL = 'http://localhost:5000';

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        title: "DigiAnchorz PM",
        icon: path.join(__dirname, 'icon.png'), // Ensure you have an icon
        webPreferences: {
            nodeIntegration: false, // Security best practice for remote content
            contextIsolation: true
        }
    });

    win.loadURL(APP_URL);

    // Remove default menu for App-like feel
    Menu.setApplicationMenu(null);
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
