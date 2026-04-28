const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

function hashPasswort(passwort) {
    return crypto.createHash('sha256').update(passwort).digest('hex');
}

function getAccountPath(email) {
    const safe = email.toLowerCase().replace(/[^a-z0-9]/gi, '_');
    return path.join(DATA_DIR, `${safe}.json`);
}

function accountExistiert(email) {
    return fs.existsSync(getAccountPath(email));
}

function accountErstellen(email, passwort) {
    if (accountExistiert(email)) return { erfolg: false, fehler: 'Email bereits registriert' };
    const account = {
        email: email.toLowerCase(),
        passwort: hashPasswort(passwort),
        erstellt: new Date().toISOString(),
        analysen: []
    };
    fs.writeFileSync(getAccountPath(email), JSON.stringify(account, null, 2));
    return { erfolg: true };
}

function accountLogin(email, passwort) {
    if (!accountExistiert(email)) return { erfolg: false, fehler: 'Account nicht gefunden' };
    const account = JSON.parse(fs.readFileSync(getAccountPath(email), 'utf8'));
    if (account.passwort !== hashPasswort(passwort)) return { erfolg: false, fehler: 'Falsches Passwort' };
    return { erfolg: true, account };
}

function getAccount(email) {
    if (!accountExistiert(email)) return null;
    return JSON.parse(fs.readFileSync(getAccountPath(email), 'utf8'));
}

function analyseHinzufuegen(email, ergebnis) {
    const account = getAccount(email);
    if (!account) return false;
    account.analysen.push({
        datum: new Date().toISOString(),
        dokumentTyp: ergebnis.dokumentTyp,
        urteil: ergebnis.analyse?.gesamturteil,
        zusammenfassung: ergebnis.analyse?.zusammenfassung,
        rohtext_vorschau: ergebnis.rohtext?.substring(0, 300)
    });
    fs.writeFileSync(getAccountPath(email), JSON.stringify(account, null, 2));
    return true;
}

function getHistory(email) {
    return getAccount(email);
}

module.exports = {
    accountErstellen,
    accountLogin,
    accountExistiert,
    getAccount,
    analyseHinzufuegen,
    getHistory
};