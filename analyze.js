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

function parseJSON(text) {
    try {
        return JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch (e) {
        console.error('JSON Parse Fehler:', e);
        return null;
    }
}

async function analyzeDocument(dokumentText, nutzerdaten) {
    console.log('Starte Analyse...');

    // vorgewaehlterTyp ist IMMER führend - niemals überschreiben
    const vorgewaehlterTyp = nutzerdaten.vorgewaehlterTyp || 'MIETERHÖHUNG';
    const nkFall = nutzerdaten.nkFall || 'NEBENKOSTENABRECHNUNG';

    // Sonderfall: NK Anforderung ohne Dokument
    if (nkFall === 'NEBENKOSTENABRECHNUNG_ANFORDERUNG') {
        console.log('NK Anforderung erkannt');
        const analyseRaw = await callClaude(
            prompts.analyseNKAnforderungPrompt(nutzerdaten)
        );
        const analyse = parseJSON(analyseRaw);

        const empfehlungRaw = await callClaude(
            prompts.verhaltensempfehlungPrompt(
                { analyse, dokumentTyp: 'NEBENKOSTENABRECHNUNG' },
                nutzerdaten.email ? getHistory(nutzerdaten.email) : null
            )
        );
        const empfehlung = parseJSON(empfehlungRaw);

        const ergebnis = {
            dokumentTyp: 'NEBENKOSTENABRECHNUNG',
            nkFall: 'NEBENKOSTENABRECHNUNG_ANFORDERUNG',
            extraktion: {},
            analyse,
            empfehlung,
            rohtext: nutzerdaten.sachverhalt || ''
        };

        if (nutzerdaten.email) {
            analyseHinzufuegen(nutzerdaten.email, ergebnis);
        }
        return ergebnis;
    }

    // Normaler Flow - vorgewaehlterTyp wird NICHT durch Erkennung überschrieben
    // Erkennung nur zur Bestätigung nutzen, nicht als Override
    console.log('Verwende Typ:', vorgewaehlterTyp);

    // Extraktion direkt mit vorgewaehlterTyp
    const extraktionRaw = await callClaude(
        prompts.extraktionsPrompt(dokumentText, vorgewaehlterTyp, nutzerdaten)
    );
    const extraktion = parseJSON(extraktionRaw);
    console.log('Extraktion abgeschlossen');

    // Analyse je nach vorgewaehlterTyp
    let analyseRaw;
    if (vorgewaehlterTyp === 'MIETERHÖHUNG') {
        analyseRaw = await callClaude(
            prompts.analyseMieterhöhungPrompt(extraktion, nutzerdaten)
        );
    } else if (vorgewaehlterTyp === 'KÜNDIGUNG') {
        analyseRaw = await callClaude(
            prompts.analyseKündigungPrompt(extraktion, nutzerdaten)
        );
    } else {
        analyseRaw = await callClaude(
            prompts.analyseNebenkostenPrompt(extraktion, nutzerdaten)
        );
    }
    const analyse = parseJSON(analyseRaw);
    console.log('Urteil:', analyse?.gesamturteil);

    const verlauf = nutzerdaten.email ? getHistory(nutzerdaten.email) : null;
    const empfehlungRaw = await callClaude(
        prompts.verhaltensempfehlungPrompt(
            { analyse, dokumentTyp: vorgewaehlterTyp },
            verlauf
        )
    );
    const empfehlung = parseJSON(empfehlungRaw);

    const ergebnis = {
        dokumentTyp: vorgewaehlterTyp,
        nkFall: nkFall,
        extraktion,
        analyse,
        empfehlung,
        rohtext: dokumentText
    };

    if (nutzerdaten.email) {
        analyseHinzufuegen(nutzerdaten.email, ergebnis);
    }

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

module.exports = { analyzeDocument, generateBrief };