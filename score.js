

class Answers {
    constructor(){
        this.dict = [];
        this.rev_dict =[] ;
    }
    makeString(array){
        let tmp_array;
        if ( isNaN(array[0]) ){
            tmp_array = ['',array[1],array[2]] ;
        }else{
            tmp_array = [String(array[0]),array[1],array[2]] ;
        }
        return tmp_array.join(':');
    }
    append(array,index){
        const key = this.makeString(array);
        if( key === '::' ) return ;
        if( key in this.dict ){
            let item = this.dict[key];
            if (! item.includes( index ) )  
                item.push(index)
                if(this.rev_dict[index]!==undefined)
                    this.remove(this.rev_dict[index],index)
                this.rev_dict[index]=key
        }else{
            this.dict[key] = [index]
            // ここに追加された時の処理を追記する。
            const element = document.createElement("p");
            element.id = key ;
            element.innerText = key;
            element.className = 'panel_item'
            element.onclick = () => {
                const array = element.innerText.split(':');
                document.getElementById("student_score").value = array[0];
                document.getElementById("student_mark").value = array[1];
                document.getElementById("student_comment").value = array[2];
            }
            element.ondblclick = up ;
            document.getElementById("form_panel").appendChild(element);
        }
    }
    remove(key,index){
        if( key in this.dict ){
            let item = this.dict[key];
            if (! item.includes( index ) ){
                item.splice(item.indexOf( index ))
                if ( item.length === 0 ){
                    delete this.dict[key];
                    // ここに削除された時の処理を追記する。
                }
            }
        }
    }
}

let rowIndex ;
let win_id ;
let answers  ;

function go(){
    let next_index = parseInt(document.getElementById("range_value").innerText);
    if ( isNaN(next_index) ) next_index = rowIndex ;
    send_data(rowIndex,next_index)
}

function up(){
    send_data(rowIndex,(rowIndex+1));
}

function down(){
    send_data(rowIndex,(rowIndex-1));
}


// メインに送る時
// array をつくる（index + ３つの要素, next )
// add_dictonary
// send

function send_data(index,next){
    const data = {
        'id': win_id,
        'index': index,
        'student_score': document.getElementById("student_score").value,
        'student_mark': document.getElementById("student_mark").value,
        'student_comment': document.getElementById("student_comment").value,
        'next': next
    };
    add_dictonary(data);
    document.getElementById("form").reset();
    window.electron.ipcRenderer.send('req_row_data',JSON.stringify(data));
    console.log(`rep ${JSON.stringify(data)}`);
}


// メインから受け取ると
// flag = false なら add_dictonary
// flag = true  なら set_form_data


function add_dictonary(dict){
    answers.append([dict['student_score'],dict['student_mark'],dict['student_comment']],dict['index']);
}

function set_form_data(dict){
    rowIndex = dict['index'];
    document.getElementById("range_value").value = rowIndex;
    document.getElementById("range_value").innerText = rowIndex;
    document.getElementById("range").setAttribute("value",dict['index'])
    document.getElementById("student_id").innerText = dict['student_id'];
    document.getElementById("student_name").innerText = dict['student_name'];
    document.getElementById("student_status").innerText = dict['student_status'];
    if (document.getElementById("student_status").innerText === "未提出" ) {
        document.getElementById("input_part").style.visibility = "hidden";
        document.getElementById("button_next").focus();
    }else{
        if( dict['student_score'] !== undefined )
            document.getElementById("student_score").value = dict['student_score'];
        document.getElementById("student_mark").value = dict['student_mark'];
        document.getElementById("student_comment").value = dict['student_comment'];
        document.getElementById("input_part").style.visibility = "visible";
        document.getElementById("student_score").focus();
    }
}

//
//
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

function search_render_setup(win) {
    // 1) document の中に dialog 要素をつくる．
    const html_doc = `
<webvive>
<dialog id="search_dialog">
  <div>
    <input type="search" id="search_text" value="" placeholder="Please input search word" style="width:200px;">
  </div>
  <div>
    <button id="search_button_start">search</button>
    <span id="search_label_position">0/0</span>
    <button id="search_button_backward">&lt;</button>
    <button id="search_button_forward">&gt;</button>
    <button id="search_button_close">cancel</button>
  </div>
</dialog>
</webvive>
`
    const body_node = document.getElementById('search').innerHTML = html_doc

    // 2) dialog 内のボタン等からのイベントの listener を設定する．
    //    このリスナーは main に通知する．
    //        開始，前，後，閉じる　のボタン
    var search_input = document.getElementById('search_text')
    document.getElementById('search_button_start').addEventListener('click', () => {
        ipcRenderer.send('req_search', {state: "start", text: search_input.value})
    })
    document.getElementById('search_button_backward').addEventListener('click', () => {
        ipcRenderer.send('req_search', {state: "backward", text: search_input.value})
    })
    document.getElementById('search_button_forward').addEventListener('click', () => {
        ipcRenderer.send('req_search', {state: "forward", text: search_input.value})
    })
    document.getElementById('search_button_close').addEventListener('click', () => {
        ipcRenderer.send('req_search', {state: "close", text: search_input.value})
        document.getElementById('search_dialog').close()
    })
    search_input.onkeypress = (e) => {
        if(search_input.value != '') {
            ipcRenderer.send('req_search', {state: "start", text: search_input.value})
        }
    }
    // 3) main からのイベントの listener の設定をする．
    //    このリスナーは，dialog の設定をする．
    //        オープン，現在の位置等の設定
    ipcRenderer.on('res_search', (event, args) => {
        document.getElementById('search_label_position').innerText = args['text']
        if(args['state'] =='open') {
            document.getElementById('search_text').value = ''
            document.getElementById('search_dialog').show()
        }
    })
}

window.onload = () => {
    answers = new Answers ();


    window.ipcRenderer.once('rep_init_data', (e, json) => {
        const init = JSON.parse(json);
        console.log(`init ${json}`);
        rowIndex = init['min'] ;
        win_id = init['win_id'];
        document.getElementsByTagName("title")[0].innerText = `${init['content']}@${init['course']}`;
        const range = document.getElementById("range");
        range.setAttribute("min",init['min']);
        range.setAttribute("max",init['max']);
        document.getElementById("range_value").innerText = rowIndex;
    });

    window.ipcRenderer.on('rep_row_data', (e, json) => {
        console.log(`rep ${json}`);
        const row_data = JSON.parse(json);
        if( row_data['flag'] ){
            set_form_data(row_data);
        }else{
            add_dictonary(row_data);
        }
    });

    window.ipcRenderer.send('req_init_data','hello');

    search_render_setup(window)
}



