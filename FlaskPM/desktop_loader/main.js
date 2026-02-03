const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

// CHANGE THIS URL TO YOUR LIVE HOSTED URL (e.g. https://your-app.onrender.com)
// For local testing, use 'http://localhost:5000'
const APP_URL = 'http://localhost:5000';

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 850,
        title: "Digianchorz",
        icon: path.join(__dirname, 'icon.png'),
        backgroundColor: '#f0fdf4', // Match your app background
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        },
        autoHideMenuBar: true, // Native look
        frame: true
    });

    win.loadURL(APP_URL);

    // Open external links in default browser, not Electron
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http:') || url.startsWith('https:')) {
            shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });

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
