'use strict';
const {
    app,
    BrowserWindow,
    Menu,
    shell,
    session
} = require('electron');
const tor = require('@deadcanaries/granax')();
const {
    autoUpdater
} = require('electron-updater');
const {
    is
} = require('electron-util');
const unhandled = require('electron-unhandled');
const debug = require('electron-debug');
const contextMenu = require('electron-context-menu');
const config = require('./config');
const menu = require('./menu');
const packageJson = require('./package.json');
const URL = require('url').URL;
const BASE_URL = 'https://chessxdsmre65y2ow67yb3sszrekgkd6mcnb43zduhuhbnhc4hqyilqd.onion';
const PARSED_BASE_URL = new URL(BASE_URL);

// Prevent window from being garbage collected
let mainWindow;

unhandled();
debug();
contextMenu();

app.setAppUserModelId(packageJson.build.appId);

// Uncomment this before publishing your first version.
// It's commented out as it throws an error if there are no published versions.
if (!is.development) {
    const FOUR_HOURS = 1000 * 60 * 60 * 4;
    setInterval(() => {
        autoUpdater.checkForUpdates();
    }, FOUR_HOURS);

    autoUpdater.checkForUpdates();
}

tor.on('error', function(err) {
    console.error(err);
});

const createMainWindow = async () => {
    const win = new BrowserWindow({
        title: app.name,
        show: false,
        width: 800,
        height: 600,
    });

    tor.on('ready', () => {
        tor.getInfo('net/listeners/socks', async (err, result) => {
            let port = parseInt(result.split('"').join('').split(':')[1]);
            await win.webContents.session.setProxy({
                proxyRules: `socks5://127.0.0.1:${port}`
            });

            console.log(`TorSocks listening on ${port}!`);
            await win.loadURL(BASE_URL);

            win.on('ready-to-show', () => {
                win.maximize();
                win.show();
            });

        });
    });


    win.on('closed', () => {
        // Dereference the window
        // For multiple windows store them in an array
        mainWindow = undefined;
    });
    return win;
};

// Prevent multiple instances of the app
if (!app.requestSingleInstanceLock()) {
    app.quit();
}

app.on('web-contents-created', (event, contents) => {
    contents.on('will-navigate', async (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);
        if (parsedUrl.origin !== PARSED_BASE_URL.origin) {
            event.preventDefault();
            await shell.openExternal(navigationUrl);
        }
    })

    contents.on('new-window', async (event, navigationUrl) => {
        // In this example, we'll ask the operating system
        // to open this event's url in the default browser.
        const parsedUrl = new URL(navigationUrl);
        if (parsedUrl.origin !== PARSED_BASE_URL.origin) {
            event.preventDefault()
            await shell.openExternal(navigationUrl)
        }
    })
})

app.on('second-instance', () => {
    if (mainWindow) {
        if (mainWindow.isMinimized()) {
            mainWindow.restore();
        }
        mainWindow.show();
    }
});

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    // On certificate error we disable default behaviour (stop loading the page)
    // and we then say "it is all fine - true" to the callback
    const parsedUrl = new URL(url);
    if (parsedUrl.origin == PARSED_BASE_URL.origin) {
        event.preventDefault();
        callback(true);
    }
});

app.on('window-all-closed', () => {
    if (!is.macos) {
        app.quit();
    }
});

app.on('activate', () => {
    if (!mainWindow) {
        mainWindow = createMainWindow();
    }
});

(async () => {
    await app.whenReady();
    Menu.setApplicationMenu(menu);
    mainWindow = await createMainWindow();
})();
