// Proceso principal de Electron: abre el juego (dist/) en una ventana de escritorio.
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('node:path');

// Tamaño inicial: pantalla de DS (256x192) a x3.
const SCALE = 3;

function createWindow() {
  const win = new BrowserWindow({
    width: 256 * SCALE,
    height: 192 * SCALE,
    minWidth: 256 * 2,
    minHeight: 192 * 2,
    useContentSize: true,
    backgroundColor: '#141416',
    title: 'Pokémon Hollín',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  win.once('ready-to-show', () => win.show());

  // F11 o Alt+Enter: pantalla completa. F12: herramientas de desarrollo.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11' || (input.alt && input.key === 'Enter')) {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    } else if (input.key === 'F12') {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  // Los enlaces externos se abren en el navegador, no dentro del juego.
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
