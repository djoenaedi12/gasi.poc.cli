const path = require('path');
const fs = require('fs-extra');

const COPYRIGHT_MARKER = 'CONFIDENTIAL & PROPRIETARY - TRADE SECRET';
const COPYRIGHT_NOTICE_PATH = path.join(__dirname, '..', 'notices', 'copyright-notice.txt');
const GENERATED_NOTICE_PATH = path.join(__dirname, '..', 'notices', 'generated-notice.txt');

let cachedCopyrightNotice = null;
let cachedGeneratedNotice = null;

function loadCopyrightNotice() {
    if (cachedCopyrightNotice !== null) {
        return cachedCopyrightNotice;
    }

    cachedCopyrightNotice = fs.readFileSync(COPYRIGHT_NOTICE_PATH, 'utf8').trimEnd();
    return cachedCopyrightNotice;
}

function loadGeneratedNotice() {
    if (cachedGeneratedNotice !== null) {
        return cachedGeneratedNotice;
    }

    cachedGeneratedNotice = fs.readFileSync(GENERATED_NOTICE_PATH, 'utf8').trim();
    return cachedGeneratedNotice;
}

function addGeneratedHeader(content, relPath = '') {
    if (hasGeneratedHeader(content)) {
        return content;
    }

    if (supportsBlockComment(relPath)) {
        return `${loadCopyrightNotice()}\n${toBlockComment(loadGeneratedNotice())}\n${content}`;
    }

    return content;
}

function hasGeneratedHeader(content) {
    return content.includes(loadGeneratedNotice()) || content.includes(COPYRIGHT_MARKER);
}

function supportsBlockComment(relPath) {
    return /\.java$/i.test(relPath);
}

function toSqlComment(notice) {
    return toPlainNoticeLines(notice)
        .map((line) => (line ? `-- ${line}` : '--'))
        .join('\n');
}

function toPropertiesComment(notice) {
    return toPlainNoticeLines(notice)
        .map((line) => (line ? `# ${line}` : '#'))
        .join('\n');
}

function toXmlComment(notice) {
    const safeBody = toPlainNoticeLines(notice)
        .join('\n')
        .replace(/--/g, '- -');

    return `<!--\n${safeBody}\n-->`;
}

function toPlainNoticeLines(notice) {
    const body = notice
        .replace(/^\/\*\s*\n?/, '')
        .replace(/\n?\s*\*\/$/, '');

    return body
        .split(/\r?\n/)
        .map((line) => line.replace(/^\s*\* ?/, ''));
}

function toLineComment(notice, prefix) {
    return notice
        .split(/\r?\n/)
        .map((line) => (line ? `${prefix} ${line}` : prefix))
        .join('\n');
}

function toBlockComment(notice) {
    const lines = notice.split(/\r?\n/);
    return [
        '/*',
        ...lines.map((line) => (line ? ` * ${line}` : ' *')),
        ' */',
    ].join('\n');
}

module.exports = {
    addGeneratedHeader,
    loadCopyrightNotice,
    loadGeneratedNotice,
    toBlockComment,
    toLineComment,
    toPropertiesComment,
    toSqlComment,
    toXmlComment,
};
