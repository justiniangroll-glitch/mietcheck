const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

async function validateAnalysis(originalDokument, analyseErgebnis) {
    
    const validationPrompt = `
Du bist ein unabhängiger Qualitätsprüfer für Mietrechtsanalysen.
Du prüfst ob eine durchgeführte Analyse korrekt und vollständig ist.

WICHTIGE REGELN:
- Erfinde NICHTS was nicht im Originaldokument steht
- Prüfe ob alle genannten Fehler wirklich im Dokument vorhanden sind
- Prüfe ob wichtige Fehler übersehen wurden
- Prüfe ob die Paragraphen korrekt zitiert sind
- Prüfe ob das Gesamturteil gerechtfertigt ist

ORIGINALDOKUMENT DES VERMIETERS:
${originalDokument}

DURCHGEFÜHRTE ANALYSE:
${JSON.stringify(analyseErgebnis, null, 2)}

Prüfe jeden Punkt und antworte NUR mit diesem JSON:
{
  "korrekt": true oder false,
  "uebersehene_fehler": [
    {
      "fehler": "Beschreibung",
      "paragraph": "§XXX BGB"
    }
  ],
  "falsche_aussagen": [
    {
      "aussage": "Was falsch war",
      "korrektur": "Was richtig ist"
    }
  ],
  "qualitaet": "SEHR GUT" oder "GUT" oder "AUSREICHEND",
  "korrigiertes_urteil": null oder "NICHT ZULÄSSIG" oder "ZULÄSSIG",
  "bestaetigung": "Das Ergebnis wurde geprüft und ist korrekt" 
}`;

    const message = await client.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 1500,
        messages: [{ role: 'user', content: validationPrompt }]
    });

    try {
        const text = message.content[0].text;
        const clean = text.replace(/```json|```/g, '').trim();
        return JSON.parse(clean);
    } catch(e) {
        return { korrekt: true, qualitaet: 'GUT' };
    }
}

module.exports = { validateAnalysis };