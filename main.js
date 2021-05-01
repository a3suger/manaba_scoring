const {app, Menu, MenuItem, dialog, ipcMain, ipcRenderer, BrowserWindow, shell} = require('electron')
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');

const store = new Store()

//------------------------------------
// 定数
//------------------------------------
// ウィンドウのデフォルトサイズ
const DEFAULT_SIZE = {
    width: 800,
    height: 600
}
// ウィンドウのデフォルトポジション
const DEFAULT_POS = {
    x: 0,
    y: 0
}


// https://qiita.com/umamichi/items/8781e426e9cd4a88961b

let pdf_win;
const PDFWindow = require('electron-pdf-window');

function createPDFWindow() {
    if (pdf_win === undefined) {
        const pos = store.get('pdf.window.pos') || [DEFAULT_POS.x, DEFAULT_POS.y];
        const size = store.get('pdf.window.size') || [DEFAULT_SIZE.width, DEFAULT_SIZE.height];
        pdf_win = new PDFWindow({
            width: size[0],
            height: size[1],
            x: pos[0],
            y: pos[1],
            show: false
        });

        pdf_win.webContents.on('did-fail-load', (e, id, str, vurl) => {
            console.log(`fail open ${id} ${str} ${decodeURI(vurl)}`);
        })

        pdf_win.on('close', (e) => {
            store.set('pdf.window.pos', pdf_win.getPosition())  // ウィンドウの座標を記録
            store.set('pdf.window.size', pdf_win.getSize())     // ウィンドウのサイズを記録
            pdf_win.hide();
            e.preventDefault();
        })
    }
}

function app_main() {
    const mainMenu = new Menu();

    // mac original
    const appMenu = new Menu();
    appMenu.append(new MenuItem({role: "hideOthers"}));
    appMenu.append(new MenuItem({role: "unhide"}));
    appMenu.append(new MenuItem({role: "quit"}));
    mainMenu.append(new MenuItem({role: "appMenu", submenu: appMenu}));

    const fileMenu = new Menu();
    fileMenu.append(new MenuItem({
        label: 'Open', accelerator: 'CommandOrControl+O', click: (m, w, e) => {
            if ((pdf_win !== undefined) && (w === pdf_win)) return;
            if (w === undefined) {
                createMainWindow(null)
            } else {
                selectfile(w)
            }
        }
    }));
    fileMenu.append(new MenuItem({role: 'recentdocuments', submenu: [new MenuItem({role: 'clearrecentdocuments'})]}));
    fileMenu.append(new MenuItem({
        role: 'close', click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win === undefined) return;
            if (win === pdf_win) force_hide(win);
            win.close();
        }
    }));
    mainMenu.append(new MenuItem({role: 'fileMenu', submenu: fileMenu}));

    const editMenu = new Menu();
    editMenu.append(new MenuItem({role: 'cut'}));
    editMenu.append(new MenuItem({role: 'copy'}));
    editMenu.append(new MenuItem({role: 'paste'}));
    editMenu.append(new MenuItem({
        label: 'search', accelerator: 'CommandOrControl+f',  click: () => {
            const win = BrowserWindow.getFocusedWindow();
            search_main_opneDialog(win.webContents)
        }
    }));
    editMenu.append(new MenuItem({type: "separator"}));

    mainMenu.append(new MenuItem({role: 'editMenu', submenu: editMenu}));

    const winMenu = new Menu();
    winMenu.append(new MenuItem({'role': 'minimize'}));
    winMenu.append(new MenuItem({
        label: 'Focus Next', accelerator: 'Cmd+N', click: () => {
            console.info('focus next')
            var ws = BrowserWindow.getAllWindows();
            for (var i = 0; i < ws.length; i++) {
                if (ws[i].isFocused()) {
                    ws[i].blur();
                    break;
                }
            }
        }
    }));
    winMenu.append(new MenuItem({
        label: 'Reload Sub-window', accelerator: 'Cmd+R', click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win !== null) {
                win.closeFilePreview();
                open_student_file(win);
            }
        }
    }));
    winMenu.append(new MenuItem({
        label: 'open original', click: (m, w, e) => {
            open_original_file(w);
        }
    }));
    winMenu.append(new MenuItem({type: "separator"}));
    winMenu.append(new MenuItem({role: "front"}));
    mainMenu.append(new MenuItem({role: "windowmenu", submenu: winMenu}));

    const debugMenu = new Menu();
    debugMenu.append(new MenuItem({role: 'toggleDevTools'}));
    debugMenu.append(new MenuItem({
        label: 'Dialog', click: () => {
            dialog.showOpenDialog({defaultPath: "/"})
        }
    }));
    mainMenu.append(new MenuItem({label: 'debug', submenu: debugMenu}));

    Menu.setApplicationMenu(mainMenu);

    ipcMain.on('req_row_data', (e, json) => {
        console.log(json);
        const data = JSON.parse(json);
        const mfile = e.sender.manabaXSLX;
        const next = mfile.set_row_data(data);

        const next_data = mfile.get_row_data(next);
        next_data['flag'] = true;
        BrowserWindow.fromWebContents(e.sender).closeFilePreview();
        e.sender.send('rep_row_data', JSON.stringify(next_data));
        open_student_file(BrowserWindow.fromWebContents(e.sender));
    })

    createMainWindow(null);
}

function createMainWindow(filepath) {
    const pos = store.get('main.window.pos') || [DEFAULT_POS.x, DEFAULT_POS.y];
    const size = store.get('main.main.size') || [DEFAULT_SIZE.width, DEFAULT_SIZE.height];

    const win = new BrowserWindow({
        webPreferences: {
            width: size[0],
            height: size[1],
            x: pos[0],
            y: pos[1],
            nodeIntegration: true,
            contextIsolation: false,
            preload: path.resolve(__dirname, 'preload4score.js'),
        }
    });
    // search_win = searchInPage(win);
    if (filepath == null) {
        selectfile(win, {
            'callback': () => {
                win.close()
            }
        });
    } else {
        showScoreWindow(win, filepath)
    }
    win.on('close', (e) => {
        store.set('main.window.pos', win.getPosition())  // ウィンドウの座標を記録
        store.set('main.window.size', win.getSize())     // ウィンドウのサイズを記録
        force_hide(pdf_win);
    })

    search_main_setup(win.webContents)
}

function selectfile(_win, options) {
    dialog.showOpenDialog(_win, {
        title: "Please select score file",
        message: "Please select score file",
        properties: ['openFile']
    }).then((args) => {
        if (!args['canceled']) {
            if (showScoreWindow(_win, args['filePaths'][0]))
                return;
        }
        if (options.callback !== undefined)
            options['callback']();
    })
}


// このメソッドは、Electron が初期化処理と
// browser window の作成準備が完了した時に呼び出されます。
// 一部のAPIはこのイベントが発生した後にのみ利用できます。
app.whenReady().then(app_main)

// 全てのウィンドウが閉じられた時に終了します。
app.on('window-all-closed', () => {
    // macOSでは、ユーザが Cmd + Q で明示的に終了するまで、
    // アプリケーションとそのメニューバーは有効なままにするのが一般的です。
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    // macOSでは、ユーザがドックアイコンをクリックしたとき、
    // そのアプリのウインドウが無かったら再作成するのが一般的です。
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow(null);
    }
})

app.on('open-file', (e, filepath) => {
    createMainWindow(filepath);
})

// このファイル内には、
// 残りのアプリ固有のメインプロセスコードを含めることができます。
// 別々のファイルに分割してここで require することもできます。

function search_main_setup(webcontents) {
    queue = {}
    // contents への found_in_page の listener を設定する．
    // このリスナーは renderer　に通知する
    webcontents.on('found-in-page', (event, results) => {
        if (results.finalUpdate) {
            queue[results.requestId].send('res_search',
                {state: 'update', text: `${results.activeMatchOrdinal-1}/${results.matches-1}`})
            delete queue[results.requestId]
        }
    })
    // renderer からのイベントの listener を設定する．
    // このリスナーは webcontents の fineinpage AP　を操作する．
    ipcMain.on('req_search', (e, args) => {
        switch (args['state']) {
            case 'start':
                id = webcontents.findInPage(args['text'])
                queue[id] = e.sender
                break
            case 'forward':
                id = webcontents.findInPage(args['text'], {findNext: true})
                queue[id] = e.sender
                break
            case 'backward':
                id = webcontents.findInPage(args['text'], {forward: false, findNext: true})
                queue[id] = e.sender
                break
            case 'close':
                webcontents.stopFindInPage('clearSelection')
                break
        }
    })
    // renderer への通知
    // 1) dialog の open
    // 2) dialog への　設定（全体の数と，現在の位置）

    // renderer からの通知
    // 1) 最初の検索　（文字列）
    // 2) 前方向への次の検索
    // 3) 後方向への次の検索
    // 4) dialog の close/検索の終了

    // renderer 側でセットアップルーチンを作成する必要あり
    // 1) document の中に dialog 要素をつくる．
    // 2) dialog 内のボタン等からのイベントの listener を設定する．
    //    このリスナーは main に通知する．
    //        開始，前，後，閉じる　のボタン
    // 3) main からのイベントの listener の設定をする．
    //    このリスナーは，dialog の設定をする．
    //        オープン，現在の位置等の設定
}

function search_main_opneDialog(contents) {
    // search を行う際に dialog をオープンさせるときにこれを呼び出す．
    contents.send('res_search', {state: 'open', text: '0/0'})
}

function force_hide(_win) {
    if ((_win !== undefined) && !(_win.isDestroyed())) _win.hide();
}


const manabaXSLX = require("./manabaXSLX");

function showScoreWindow(win, filepath) {
    // open file dialog を開いて
    console.log(`in showScoreWindow ${win}`);
    const mfile = new manabaXSLX(filepath);
    if (!mfile.isAvairable()) return false;
    app.addRecentDocument(filepath);
    const data = mfile.get_status();
    data['win_id'] = win.webContents.id;
    win.webContents['manabaXSLX'] = mfile;
    createPDFWindow();

    ipcMain.once('req_init_data', (e) => {
        e.sender.send('rep_init_data', JSON.stringify(data))
        let row_data;
        for (let i = data['min']; i <= data['max']; i++) {
            row_data = mfile.get_row_data(i);
            row_data['flag'] = false;
            e.sender.send('rep_row_data', JSON.stringify(row_data));
        }
        row_data = mfile.get_row_data(data['min']);
        row_data['flag'] = true;
        e.sender.send('rep_row_data', JSON.stringify(row_data));
        open_student_file(BrowserWindow.fromWebContents(e.sender));
    });

    win.loadFile("score.html");
    console.log('out showScoreWindow');
    return true;
}


function open_student_dir(win, filepath) {
    dialog.showOpenDialog({
        title: "Please select preview file",
        message: "Please select preview file",
        defaultPath: filepath,
        properties: ['openFile']
    }).then((args) => {
        if (!args.canceled) open_student_one_file(win, args.filePaths[0])
    })
}

function open_student_one_file(win, filepath) {
    console.info(`open_student_one_file ${filepath}`)
    if (/^\.pdf$/i.test(path.extname(filepath))) {
        pdf_win.loadFile(filepath);
        pdf_win.showInactive();
    } else {
        pdf_win.hide();
        win.closeFilePreview();// これだとうまくいかない。
        win.previewFile(filepath);
    }
}


function open_student_file(win) {
    if ((win === undefined) || (win === null)) return;
    const filepath = win.webContents.manabaXSLX.get_student_file_path();
    if (filepath !== undefined) {
        fs.stat(filepath, (error, stats) => {
            if (error) {
                pdw_win.hide();
            } else if (stats.isDirectory()) {
                console.log(`dialog ${filepath}`);
                const files = get_file_in_dir(filepath);
                if (files.length === 1) {
                    open_student_one_file(win, path.join(filepath, files[0]))
                } else {
                    open_student_dir(win, filepath)
//                    shell.openPath(path.join(filepath));
//                    pdf_win.hide();
                }
            } else if (stats.isFile()) {
                open_student_one_file(win, filepath)
            } else {
                pdw_win.hide();
            }
        });
    } else {
        force_hide(pdf_win);
        force_hide(manaba_win);
    }
}

function get_file_in_dir(pathname) {
    let array = [];
    for (let dirent of fs.readdirSync(pathname, {withFileTypes: true}))
        if (dirent.isFile())
            array.push(dirent.name)
    return array;
}

function open_original_file(_win) {
    if ((_win === null) || (_win === undefined)) return;
    if (_win === pdf_win) return;
    if (_win === manaba_win) return;
    const f = _win.webContents.manabaXSLX.fullpath;
    shell.openPath(f);
    _win.close();
}
