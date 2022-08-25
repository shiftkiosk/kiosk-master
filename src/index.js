const path = require("path");
const { app, globalShortcut, BrowserWindow, session } = require("electron");
const { autoUpdater } = require("electron-updater");
const Sentry = require("@sentry/electron");
const isDev = require("electron-is-dev");
const fs = require('fs');
const axios = require('axios');
const { exec } = require("child_process");
const homeDir = require('os').homedir(); 
const hostName = require('os').hostname();
const desktopDir = homeDir.replace(/\\/g, "/") + '/Desktop/.env';
const globalEnv = JSON.parse(fs.readFileSync(desktopDir, 'utf8'));
const execPromise = (command, count = 1, log = 'label') => {
  const promises = [];
  for (i = 0; i < count; ++i) {
    promises.push(new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
          if (error) {
              reject(error);
              return;
          }
          resolve(stdout.trim());
      });
    }));
  }

  return Promise.all(promises);
}

let interval;
let isReset = false;
Sentry.init({ dsn: "https://200d2a04e2034aefae2280893a4e3553@o245675.ingest.sentry.io/6518084" });

if(globalEnv.printer) {
  setInterval(() => {
    const config = {
        method: 'post',
        url: 'https://api.shift.online/printer/v1/qr_pending?location=' +  globalEnv.printer_location,
        headers: { 
            'Authorization': globalEnv.printer_api_key
        }
    };
    axios(config)
    .then(async(response) => {
        var resData = response.data;
        if(resData.data.length){
          try {
            await execPromise('COPY /B '+ path.join(__dirname,"zplStorage", "blank.txt") + ' \\\\' + hostName + '\\zpl', 1, 'blank');
            await resData.data.forEach(async(item, count) => {
                await fs.writeFileSync(path.join(__dirname,"zplStorage", item.qr_id + "_" + count + ".txt"), item.zpl,"UTF8",{ flag: 'wx' })
                await execPromise('COPY /B '+ path.join(__dirname,"zplStorage", item.qr_id + "_" + count + ".txt") + ' \\\\' + hostName + '\\zpl', 1);
                fs.unlink(path.join(__dirname,"zplStorage", item.qr_id + "_" + count + ".txt"), function (err) {
                    if (err) throw err;
                    console.log('File deleted!');
                });
            })  
            await execPromise('COPY /B '+ path.join(__dirname,"zplStorage", "blank.txt") + ' \\\\' + hostName + '\\zpl', 1, 'blank');
        } catch (e) {
          console.error(e);
        }
      }
    })
    .catch((error) => {
        console.log(error);
    });
  }, 2000);  
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow(globalEnv.kiosk_params);

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.webContents.executeJavaScript(`document.getElementById("iframe").setAttribute('src', '${globalEnv.iframe.url}')`);
  mainWindow.webContents.addListener("did-start-navigation", () => {   
    if (interval && isReset) {
      isReset = false;
      clearInterval(interval);
      reload();
    }
  })

  mainWindow.once('ready-to-show', () => {
    if(globalEnv.zoom){
      mainWindow.webContents.setZoomFactor(globalEnv.zoom);
    }
  });

  const reload = () => {
    setTimeout(() => {
      console.log('blocked code execute');
      isReset = true;
      interval = setInterval(() => {
        mainWindow.webContents.mainFrame.frames.forEach(frame => {
          const url = new URL(frame.url)
          if (url.host === 'homebase-kiosk.shift.delivery') {
            let execute = frame.executeJavaScript('document.getElementById("main-content-container");').then(
              response => {
                if(response === null) {
                  console.log('relaunch app code execute');
                  clearInterval(interval);
                  app.relaunch()
                  app.exit()
                }
              }
            )
          }
        })
      }, 30000)
    }, 60000)}
    
  reload();

  //register esc key to toggle kiosk mode for use with teamviewer
  globalShortcut.register('Escape', () => {
      return mainWindow.isKiosk() 
          ? mainWindow.setKiosk(false) 
          : (mainWindow.setKiosk(true),
          setTimeout(() => {
            mainWindow.webContents.executeJavaScript(`
              document.getElementById("iframe").setAttribute('src', '${globalEnv.iframe.url}')
            `);
          }, 300));
  });
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
}, 3600000);

autoUpdater.on("update-downloaded", () => {
  setTimeout(() => {
    autoUpdater.quitAndInstall()
  }, 500)
});
