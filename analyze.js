require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const prompts = require('./prompts');
const { analyseHinzufuegen, getHistory } = require('./accounts');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function callClaude(prompt) {
    const message = await client.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
    });
    return message.content[0].text;
}

async function callClaudeVision(base64, mediaType, textPrompt) {
    const message = await client.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 2000,
        messages: [{
            role: 'user',
            content: [
                {
                    type: 'image',
                    source: { type: 'base64', media_type: mediaType, data: base64 }
                },
                { type: 'text', text: textPrompt }
            ]
        }]
    });
    return message.content[0].text;
}

function parseJSON(text) {
    try {
        return JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch (e) {
        console.error('JSON Parse Fehler:', e);
        return null;
    }
}

// ============================================================
// FOTO EXTRAKTION — schnelle Vorverarbeitung
// ============================================================
async function extractFromFoto(base64, mediaType) {
    console.log('Extrahiere Daten aus Foto...');
    const raw = await callClaudeVision(base64, mediaType, prompts.fotoExtraktionPrompt());
    return parseJSON(raw) || {};
}

// ============================================================
// HAUPT-ANALYSE
// ============================================================
async function analyzeDocument(dokumentText, nutzerdaten) {
    console.log('Starte Analyse...');
    const vorgewaehlterTyp = nutzerdaten.vorgewaehlterTyp || 'MIETERHÖHUNG';
    const nkFall = nutzerdaten.nkFall || 'NEBENKOSTENABRECHNUNG';
    const istFragebogen = nutzerdaten.fragebogen === true;
    const hatFoto = nutzerdaten.fotoBase64 && nutzerdaten.fotoMediaType;

    // NK Anforderung ohne Dokument
    if (nkFall === 'NEBENKOSTENABRECHNUNG_ANFORDERUNG') {
        const analyseRaw = await callClaude(prompts.analyseNKAnforderungPrompt(nutzerdaten));
        const analyse = parseJSON(analyseRaw);
        const empfehlungRaw = await callClaude(
            prompts.verhaltensempfehlungPrompt({ analyse, dokumentTyp: 'NEBENKOSTENABRECHNUNG' }, null)
        );
        const empfehlung = parseJSON(empfehlungRaw);
        const ergebnis = {
            dokumentTyp: 'NEBENKOSTENABRECHNUNG',
            extraktion: {},
            analyse,
            empfehlung,
            rohtext: ''
        };
        if (nutzerdaten.email) analyseHinzufuegen(nutzerdaten.email, ergebnis);
        return ergebnis;
    }

    // FRAGEBOGEN MODUS — keine Dokumentanalyse
    if (istFragebogen && !hatFoto) {
        console.log('Fragebogen-Modus aktiv');
        const analyseRaw = await callClaude(prompts.analyseFragebogenPrompt(nutzerdaten));
        const analyse = parseJSON(analyseRaw);
        console.log('Urteil:', analyse?.gesamturteil);

        const empfehlungRaw = await callClaude(
            prompts.verhaltensempfehlungPrompt({ analyse, dokumentTyp: 'MIETERHÖHUNG' }, null)
        );
        const empfehlung = parseJSON(empfehlungRaw);

        const ergebnis = {
            dokumentTyp: 'MIETERHÖHUNG',
            extraktion: {
                aktuelle_miete: nutzerdaten.aktuelleMinete,
                erhoehung_euro: nutzerdaten.erhoehungEuro,
                neue_miete: (parseFloat(nutzerdaten.aktuelleMinete) + parseFloat(nutzerdaten.erhoehungEuro)).toFixed(0)
            },
            analyse,
            empfehlung,
            rohtext: '',
            modus: 'fragebogen'
        };
        if (nutzerdaten.email) analyseHinzufuegen(nutzerdaten.email, ergebnis);
        return ergebnis;
    }

    // FOTO MODUS — vollständige Analyse mit Bild
    if (hatFoto) {
        console.log('Foto-Modus aktiv');

        // Erst Foto lesen für Text-Extraktion
        const fotoText = await callClaudeVision(
            nutzerdaten.fotoBase64,
            nutzerdaten.fotoMediaType,
            `Lies dieses Mieterhöhungsschreiben vollständig und gib den kompletten Text wieder. 
             Dann antworte mit: TEXT: [vollständiger Text des Schreibens]`
        );

        const textMatch = fotoText.match(/TEXT:\s*([\s\S]+)/i);
        const extrahierterText = textMatch ? textMatch[1].trim() : fotoText;

        // Erkennnung
        const erkennungRaw = await callClaude(prompts.erkennungsPrompt(extrahierterText, vorgewaehlterTyp));
        const erkennung = parseJSON(erkennungRaw);
        const dokumentTyp = erkennung?.typ || vorgewaehlterTyp;

        // Extraktion
        const extraktionRaw = await callClaude(
            prompts.extraktionsPrompt(extrahierterText, dokumentTyp, nutzerdaten)
        );
        const extraktion = parseJSON(extraktionRaw);

        // Analyse — nutzt BEIDE: Dokument-Formfehler UND strukturelle Prüfung
        const nurFragebogenDaten = {
            ...nutzerdaten,
            erhoehungEuro: extraktion?.erhoehung_euro || nutzerdaten.erhoehungEuro,
            aktuelleMinete: extraktion?.aktuelle_miete || nutzerdaten.aktuelleMinete
        };

        let analyseRaw;
        if (dokumentTyp === 'MIETERHÖHUNG') {
            analyseRaw = await callClaude(prompts.analyseMieterhöhungPrompt(extraktion, nurFragebogenDaten));
        } else if (dokumentTyp === 'KÜNDIGUNG') {
            analyseRaw = await callClaude(prompts.analyseKündigungPrompt(extraktion, nutzerdaten));
        } else {
            analyseRaw = await callClaude(prompts.analyseNebenkostenPrompt(extraktion, nutzerdaten));
        }
        const analyse = parseJSON(analyseRaw);
        console.log('Urteil:', analyse?.gesamturteil);

        const empfehlungRaw = await callClaude(
            prompts.verhaltensempfehlungPrompt({ analyse, dokumentTyp }, null)
        );
        const empfehlung = parseJSON(empfehlungRaw);

        const ergebnis = {
            dokumentTyp,
            extraktion,
            analyse,
            empfehlung,
            rohtext: extrahierterText,
            modus: 'foto'
        };
        if (nutzerdaten.email) analyseHinzufuegen(nutzerdaten.email, ergebnis);
        return ergebnis;
    }

    // TEXT MODUS — normaler Flow mit eingefügtem Text
    const erkennungRaw = await callClaude(prompts.erkennungsPrompt(dokumentText, vorgewaehlterTyp));
    const erkennung = parseJSON(erkennungRaw);
    const dokumentTyp = erkennung?.typ || vorgewaehlterTyp;
    console.log('Typ erkannt:', dokumentTyp);

    const extraktionRaw = await callClaude(prompts.extraktionsPrompt(dokumentText, dokumentTyp, nutzerdaten));
    const extraktion = parseJSON(extraktionRaw);

    let analyseRaw;
    if (dokumentTyp === 'MIETERHÖHUNG') {
        analyseRaw = await callClaude(prompts.analyseMieterhöhungPrompt(extraktion, nutzerdaten));
    } else if (dokumentTyp === 'KÜNDIGUNG') {
        analyseRaw = await callClaude(prompts.analyseKündigungPrompt(extraktion, nutzerdaten));
    } else {
        analyseRaw = await callClaude(prompts.analyseNebenkostenPrompt(extraktion, nutzerdaten));
    }
    const analyse = parseJSON(analyseRaw);
    console.log('Urteil:', analyse?.gesamturteil);

    const empfehlungRaw = await callClaude(
        prompts.verhaltensempfehlungPrompt({ analyse, dokumentTyp }, null)
    );
    const empfehlung = parseJSON(empfehlungRaw);

    const ergebnis = {
        dokumentTyp,
        extraktion,
        analyse,
        empfehlung,
        rohtext: dokumentText,
        modus: 'text'
    };
    if (nutzerdaten.email) analyseHinzufuegen(nutzerdaten.email, ergebnis);
    return ergebnis;
}

async function generateBrief(analyseErgebnis, nutzerdaten) {
    return await callClaude(
        prompts.briefPrompt(
            analyseErgebnis.analyse,
            nutzerdaten,
            analyseErgebnis.dokumentTyp
        )
    );
}

module.exports = { analyzeDocument, generateBrief, extractFromFoto };
