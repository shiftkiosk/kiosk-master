const path = require("path");
const { app, globalShortcut, BrowserWindow } = require("electron");
const { autoUpdater } = require("electron-updater");
const Sentry = require("@sentry/electron");
const isDev = require("electron-is-dev");
const fs = require('fs');
let GlobalWindow = '';
let GlobalEnv= '';

Sentry.init({ dsn: "https://200d2a04e2034aefae2280893a4e3553@o245675.ingest.sentry.io/6518084" });

GlobalEnv = JSON.parse(fs.readFileSync('C:/Users/YUNOJ1900/Desktop/.env', 'utf8'));

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow(GlobalEnv.kiosk_params);

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.webContents.executeJavaScript(`
  document.getElementById("iframe").setAttribute('src', '${GlobalEnv.iframe.url}')
`);

  //register esc key to toggle kiosk mode for use with teamviewer
  globalShortcut.register('Escape', () => {
    return mainWindow.isKiosk() 
        ? mainWindow.setKiosk(false) 
        : (mainWindow.setKiosk(true),
        setTimeout(() => {
          mainWindow.webContents.executeJavaScript(`
            document.getElementById("iframe").setAttribute('src', '${GlobalEnv.iframe.url}')
          `);
        }, 300));
  });
  
  GlobalWindow = mainWindow;
  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Electron autoupdater check for updates and then quit and install
// when downloaded in background
setInterval(() => {
  autoUpdater.checkForUpdates();
}, 60000);

autoUpdater.on("update-downloaded", () => {
  setTimeout(() => {
    autoUpdater.quitAndInstall()
  }, 500)
});
