const {app, Menu, MenuItem, dialog, ipcMain, BrowserWindow, nativeTheme} = require('electron')
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
// ダークモードのデフォルト
const DEFAULT_DARK_MODE = false


// https://qiita.com/umamichi/items/8781e426e9cd4a88961b

let pdf_win;
const PDFWindow = require('electron-pdf-window');

let dark_menu;

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

        pdf_win.on('close', (e) => {
            store.set('pdf.window.pos', pdf_win.getPosition())  // ウィンドウの座標を記録
            store.set('pdf.window.size', pdf_win.getSize())     // ウィンドウのサイズを記録
            pdf_win.hide();
            e.preventDefault();
        })
        const pdf_contents = pdf_win.webContents
        pdf_contents.on('did-finish-load', () => {
            if (pdf_contents.dark_css_key)
                delete pdf_contents.dark_css_key
            set_pdf_dark(pdf_contents, dark_menu.checked)
        })
    }
}

function set_pdf_dark(pdf_contents, flag) {
    if (flag) {
        // dark mode に設定する
        if (!pdf_contents.dark_css_key) {
            // 設定がないので設定する
            const dark_css = 'embed {filter: brightness(0.91) grayscale(0.95) invert(0.95) sepia(0.55) hue-rotate(180deg);}'
            pdf_contents.insertCSS(dark_css).then((key) => {
                pdf_contents.dark_css_key = key
            })
            //          ':root[theme="normal"] embed {filter: brightness(1) grayscale(0) invert(0) sepia(0) hue-rotate(0deg);}'
        }
    } else {
        // dark mode を解除する
        if (pdf_contents.dark_css_key) {
            // すでに設定がされているので解除する．
            pdf_contents.removeInsertedCSS(pdf_contents.dark_css_key).then(() => {
                delete pdf_contents.dark_css_key
            })
        }
    }
}

let main_win;

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
        label: 'Open', accelerator: 'CommandOrControl+O', click: (m, w) => {
            if ((pdf_win !== undefined) && (w === pdf_win)) return;
            if ((main_win !== undefined) && (w === main_win)) {
                selectfile(w)
            } else {
                main_win = createMainWindow(null)
            }
        }
    }));
    fileMenu.append(new MenuItem({role: 'recentdocuments', submenu: [new MenuItem({role: 'clearrecentdocuments'})]}));
    fileMenu.append(new MenuItem({
        role: 'close', click: () => {
            if (main_win !== undefined) {
                force_hide(pdf_win)
                main_win.close()
            }
        }
    }));
    mainMenu.append(new MenuItem({role: 'fileMenu', submenu: fileMenu}));

    const editMenu = new Menu();
    editMenu.append(new MenuItem({role: 'undo'}));
    editMenu.append(new MenuItem({role: 'cut'}));
    editMenu.append(new MenuItem({role: 'copy'}));
    editMenu.append(new MenuItem({role: 'paste'}));
    editMenu.append(new MenuItem({
        label: 'Search', accelerator: 'CommandOrControl+f', click: () => {
            const win = BrowserWindow.getFocusedWindow();
            search_main_openDialog(win.webContents)
        }
    }));

    mainMenu.append(new MenuItem({role: 'editMenu', submenu: editMenu}));

    const viewMenu = new Menu();
    dark_menu = new MenuItem({
        label: 'DarkMode', type: 'checkbox',
        checked: store.get('dark_mode') || DEFAULT_DARK_MODE,
        click: (menuItem) => {
            set_pdf_dark(pdf_win.webContents, menuItem.checked)
            if (menuItem.checked) {
                nativeTheme.themeSource = 'dark'
            } else {
                nativeTheme.themeSource = 'system'
            }
            store.set('dark_mode',menuItem.checked)
        }
    })
    if (dark_menu.checked) {
        nativeTheme.themeSource = 'dark'
    } else {
        nativeTheme.themeSource = 'system'
    }

    viewMenu.append(dark_menu);
    mainMenu.append(new MenuItem({role: 'viewMenu', submenu: viewMenu}));

    const winMenu = new Menu();
    winMenu.append(new MenuItem({'role': 'minimize'}));
    winMenu.append(new MenuItem({
        label: 'Reload Sub-window', accelerator: 'Cmd+R', click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win !== null) {
                win.closeFilePreview();
                open_student_file(win);
            }
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

    ipcMain.on('req_row_data', (e, args) => {
        const mfile = e.sender.manabaXSLX;
        const next = mfile.set_row_data(args);

        const next_data = mfile.get_row_data(next);
        next_data['flag'] = true;
        BrowserWindow.fromWebContents(e.sender).closeFilePreview();
        e.sender.send('rep_row_data', next_data);
        open_student_file(BrowserWindow.fromWebContents(e.sender));
    })

    main_win = createMainWindow(null);
}

function createMainWindow(filepath) {
    const pos = store.get('main.window.pos') || [DEFAULT_POS.x, DEFAULT_POS.y];
    const size = store.get('main.window.size') || [DEFAULT_SIZE.width, DEFAULT_SIZE.height];

    const win = new BrowserWindow({
        width: size[0],
        height: size[1],
        x: pos[0],
        y: pos[1],
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            preload: path.resolve(__dirname, 'preload4score.js'),
        }
    });

    if (filepath == null) {
        selectfile(win, {
            'callback': () => {
                win.close()
            }
        });
    } else {
        showScoreWindow(win, filepath)
    }
    search_main_setup(win.webContents)

    function _local_save() {
        store.set('main.window.pos', main_win.getPosition())  // ウィンドウの座標を記録
        store.set('main.window.size', main_win.getSize())     // ウィンドウのサイズを記録
    }

    win.on('close', () => {
        _local_save()
        if (pdf_win !== undefined)
            pdf_win.destroy()
    })
    win.on('resized', () => {
        _local_save()
    })
    win.on('moved', () => {
        _local_save()
    })
    return win
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
// src.on('window-all-closed', () => {
//     // macOSでは、ユーザが Cmd + Q で明示的に終了するまで、
//     // アプリケーションとそのメニューバーは有効なままにするのが一般的です。
//     if (process.platform !== 'darwin') {
//         src.quit()
//     }
// })
//
// src.on('activate', () => {
//     // macOSでは、ユーザがドックアイコンをクリックしたとき、
//     // そのアプリのウインドウが無かったら再作成するのが一般的です。
//     if (BrowserWindow.getAllWindows().length === 0) {
//         createMainWindow(null);
//     }
// })

app.on('open-file', (e, filepath) => {
    if (main_win !== undefined) {
        main_win = createMainWindow(filepath);
    } else {
        showScoreWindow(main_win, filepath)
    }
})

// このファイル内には、
// 残りのアプリ固有のメインプロセスコードを含めることができます。
// 別々のファイルに分割してここで require することもできます。

function search_main_setup(webcontents) {
    let queue = {}
    // contents への found_in_page の listener を設定する．
    // このリスナーは renderer　に通知する
    webcontents.on('found-in-page', (event, results) => {
        if (results.finalUpdate) {
            queue[results.requestId].send('res_search',
                {state: 'update', text: `${results.activeMatchOrdinal - 1}/${results.matches - 1}`})
            delete queue[results.requestId]
        }
    })
    // renderer からのイベントの listener を設定する．
    // このリスナーは webcontents の fineinpage AP　を操作する．
    ipcMain.on('req_search', (e, args) => {
        let id;
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

function search_main_openDialog(contents) {
    // search を行う際に dialog をオープンさせるときにこれを呼び出す．
    contents.send('res_search', {state: 'open', text: '0/0'})
}

function force_hide(_win) {
    if ((_win !== undefined) && !(_win.isDestroyed())) _win.hide();
}


const manabaXSLX = require("./manabaXSLX");

function showScoreWindow(win, filepath) {
    // open file dialog を開いて
    const mfile = new manabaXSLX(filepath);
    if (!mfile.isAvairable()) return false;
    app.addRecentDocument(filepath);
    const data = mfile.get_status();
    win.webContents['manabaXSLX'] = mfile;
    createPDFWindow();

    ipcMain.once('req_init_data', (e) => {
        //e.sender.send('rep_init_data', data)
        let row_data;
        for (let i = data['min']; i <= data['max']; i++) {
            row_data = mfile.get_row_data(i);
            row_data['flag'] = false;
            e.sender.send('rep_row_data', row_data);
        }
        row_data = mfile.get_row_data(data['min']);
        row_data['flag'] = true;
        e.sender.send('rep_row_data', row_data);
        e.sender.send('rep_init_data', data)
        open_student_file(BrowserWindow.fromWebContents(e.sender));
    });

    win.loadFile("score.html");
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
                pdf_win.hide();
            } else if (stats.isDirectory()) {
                const files = get_file_in_dir(filepath);
                if (files.length === 1) {
                    open_student_one_file(win, path.join(filepath, files[0]))
                } else {
                    open_student_dir(win, filepath)
                }
            } else if (stats.isFile()) {
                open_student_one_file(win, filepath)
            } else {
                pdf_win.hide();
            }
        });
    } else {
        force_hide(pdf_win);
    }
}

function get_file_in_dir(pathname) {
    let array = [];
    for (let dirent of fs.readdirSync(pathname, {withFileTypes: true}))
        if (dirent.isFile())
            array.push(dirent.name)
    return array;
}

