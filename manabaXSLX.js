// manaba からダウンロードしたファイルを取り扱う

const XLSX = require('xlsx');
const path = require('path');

const REPORTFILE = 'reportlist.xls';
const REPORTFILE2 = 'reportlist.xlsx';

const rowMin = 7;
const colSystemId = 4;
const colStudentId = 5;
const colStudentName = 6;
const colStudentScore = 9;
const colStudentMark = 10;
const colStudentComment = 11;


function getCellValue(sheet, row, col) {
    let cell = sheet[XLSX.utils.encode_cell({r: row, c: col})];
    return (cell ? cell.v : undefined);
}


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
    }

    isAvairable() {
        return (this.workbook !== undefined);
    }

    get_status() {
        if (this.workbook === undefined) return undefined;
        const sheet = this.workbook.Sheets["Sheet1"];
        let value;
        let index = rowMin - 1;
        do {
            index = index + 1;
            value = getCellValue(sheet, index, 0);
        } while (value !== "#end");
        this.rowMax = index - 1;
        this.cource_id = getCellValue(sheet, 1, 1);
        this.content_id = getCellValue(sheet, 2, 1);

        return {
            "filename": path.basename(this.fullpath),
            "min": rowMin,
            "max": this.rowMax,
            "course_id": this.cource_id,
            "course": getCellValue(sheet, 1, 2),
            "content_id": this.content_id,
            "content": getCellValue(sheet, 2, 2),
        }
    }

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
        this.current_index = index;
        return {
            'index': index,
            'student_id': getCellValue(sheet, index, colStudentId),
            'student_name': getCellValue(sheet, index, colStudentName),
            'student_status': getCellValue(sheet, index, colStudentStatus),
            'student_score': getCellValue(sheet, index, colStudentScore),
            'student_mark': getCellValue(sheet, index, colStudentMark),
            'student_comment': getCellValue(sheet, index, colStudentComment),
        };
    }

    set_row_data(row_data) {
        const score = parseInt(row_data['student_score']);
        const index = row_data['index'];
        const sheet = this.workbook.Sheets["Sheet1"];
        if (!isNaN(score))
            sheet[XLSX.utils.encode_cell({r: index, c: colStudentScore})] = {t: 'n', v: score};
        sheet[XLSX.utils.encode_cell({r: index, c: colStudentMark})] = {t: 's', v: row_data['student_mark']};
        sheet[XLSX.utils.encode_cell({r: index, c: colStudentComment})] = {t: 's', v: row_data['student_comment']};
        XLSX.writeFile(this.workbook, this.fullpath, {booktype: "biff8"});
        let next = row_data['next'];
        if (next < rowMin) next = rowMin;
        if (next > this.rowMax) next = this.rowMax;
        return next;
    }

    get_student_file_path() {
        const index = this.current_index;
        const sheet = this.workbook.Sheets["Sheet1"];
        switch (path.basename(this.fullpath)) {
            case REPORTFILE:
            case REPORTFILE2: {
                if (getCellValue(sheet, index, 12) === '未提出') return undefined;
                let fname = getCellValue(sheet, index, 15);
                if (fname === '開く') fname = getCellValue(sheet, index, colStudentId) + '@' + getCellValue(sheet, index, colSystemId);
                return path.join(path.dirname(this.fullpath), fname)
            }
            default:
                return undefined;
        }
    }
}

