// manaba からダウンロードしたファイルを取り扱う

const XLSX = require('xlsx');
const path = require('path');

/**
 * manaba のレポートの一括回収したときの採点シートのファイル名
 * @type {string}
 */
const REPORTFILE = 'reportlist.xls';
/**
 * manaba のレポートの一括回収したときの採点シートのファイル名
 * @type {string}
 */
const REPORTFILE2 = 'reportlist.xlsx';

const rowMin = 7;
const colSystemId = 4;
const colStudentId = 5;
const colStudentName = 6;
const colStudentScore = 9;
const colStudentMark = 10;
const colStudentComment = 11;

module.exports = class Manaba {
    constructor(filepath) {
        switch (path.basename(filepath)) {
            case REPORTFILE:
            case REPORTFILE2: {
                break;
            }
            default: {
                this.workbook = undefined;
                return
            }
        }
        this.workbook = XLSX.readFile(filepath);
        this.fullpath = filepath;
        // this.current_index is index number fof xlsx file.
    }

    isAvairable() {
        return (this.workbook !== undefined);
    }

    /**
     * 採点シートの指定したシート，行番号，列番頭を指定してセルの値を取得する．
     * @param sheet
     * @param row
     * @param col
     * @returns {*|undefined}
     */
    getCellValue(sheet, row, col) {
        let cell = sheet[XLSX.utils.encode_cell({r: row, c: col})];
        return (cell ? cell.v : undefined);
    }

    /**
     * このファイルの状態を取得する。
     * @returns {{course_id: *, filename: string, min: number, max: number, content_id: *, course: (*|undefined), content: (*|undefined)}|undefined}
     */
    get_status() {
        if (this.workbook === undefined) return undefined;
        const sheet = this.workbook.Sheets["Sheet1"];
        let value;
        let index = rowMin - 1;
        do {
            index = index + 1;
            value = this.getCellValue(sheet, index, 0);
        } while (value !== "#end");
        this.rowMax = index - 1;
        this.cource_id = this.getCellValue(sheet, 1, 1);
        this.content_id = this.getCellValue(sheet, 2, 1);

        return {
            "filename": path.basename(this.fullpath),
            "min": 1,                        // rowMin
            "max": this.rowMax - rowMin + 1, // this.rowMax
            "course_id": this.cource_id,
            "course": this.getCellValue(sheet, 1, 2),
            "content_id": this.content_id,
            "content": this.getCellValue(sheet, 2, 2),
        }
    }

    /**
     * 指定した　index （学生の先頭を１とした順番）の学生のデータを取得する。
     * @param index
     * @returns {{student_name: (*|undefined), student_status: (*|undefined), index, student_id: (*|undefined), student_score: (*|undefined), student_comment: (*|undefined), student_mark: (*|undefined)}}
     */
    get_row_data(index) {
        let colStudentStatus;
        const sheet = this.workbook.Sheets["Sheet1"];
        switch (path.basename(this.fullpath)) {
            case REPORTFILE:
            case REPORTFILE2: {
                colStudentStatus = 12;
                break;
            }
        }
        let row_index = rowMin - 1 + index; // index
        this.current_index = row_index;
        return {
            'index': index,
            'student_id': this.getCellValue(sheet, row_index, colStudentId),
            'student_name': this.getCellValue(sheet, row_index, colStudentName),
            'student_status': this.getCellValue(sheet, row_index, colStudentStatus),
            'student_score': this.getCellValue(sheet, row_index, colStudentScore),
            'student_mark': this.getCellValue(sheet, row_index, colStudentMark),
            'student_comment': this.getCellValue(sheet, row_index, colStudentComment),
        };
    }

    /**
     * 指定されたデータで学生のデータを上書きする。 next で指定した index の値が正しい範囲となるように
     * 修正した値を返す。
     * @param row_data
     * @returns {number}
     */
    set_row_data(row_data) {
        const score = parseInt(row_data['student_score']);
        const row_index = rowMin - 1 + row_data['index'];
        if ((row_index >= rowMin) && (row_index <= this.rowMax)) {
            const sheet = this.workbook.Sheets["Sheet1"];
            if (!isNaN(score))
                sheet[XLSX.utils.encode_cell({r: row_index, c: colStudentScore})] = {t: 'n', v: score};
            sheet[XLSX.utils.encode_cell({r: row_index, c: colStudentMark})] = {t: 's', v: row_data['student_mark']};
            sheet[XLSX.utils.encode_cell({r: row_index, c: colStudentComment})] = {
                t: 's',
                v: row_data['student_comment']
            };
            XLSX.writeFile(this.workbook, this.fullpath, {booktype: "biff8"});
        }
        let next = row_data['next'];
        if (next < 1) next = 1;
        if (next > this.rowMax - rowMin + 1) next = this.rowMax - rowMin + 1;
        return next;
    }

    /**
     * 学生の提出物が格納されているディレクトリの path を返す。
     * @returns {string|undefined}
     */
    get_student_file_path() {
        const row_index = this.current_index;
        const sheet = this.workbook.Sheets["Sheet1"];
        switch (path.basename(this.fullpath)) {
            case REPORTFILE:
            case REPORTFILE2: {
                if (this.getCellValue(sheet, row_index, 12) === '未提出') return undefined;
                let fname = this.getCellValue(sheet, row_index, 15);
                if (fname === '開く') fname = this.getCellValue(sheet, row_index, colStudentId) + '@' + this.getCellValue(sheet, row_index, colSystemId);
                return path.join(path.dirname(this.fullpath), fname)
            }
            default:
                return undefined;
        }
    }
}

