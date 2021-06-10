const electron = require('electron');

process.once('loaded', () => {
    global.process = process;
    global.electron = electron;
    global.remote = electron.remote;
    global.ipcRenderer = electron.ipcRenderer;
});
