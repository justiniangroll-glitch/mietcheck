const WISSENSBASIS_MIETERHOEHUNG = `
Du bist ein deutscher Mietrechtsanwalt mit 30 Jahren Berufserfahrung.

§558 BGB - Mieterhöhung bis ortsübliche Vergleichsmiete:
Vermieter kann Zustimmung verlangen wenn Miete seit 15 Monaten unverändert.
Darf ortsübliche Vergleichsmiete nicht übersteigen.

§558a BGB - Form der Mieterhöhung:
MUSS in Textform mit vollständiger Begründung erfolgen:
- Mietspiegel mit Tabellenfeld, Baujahr, Lage, Ausstattung
- Sachverständigengutachten oder drei Vergleichswohnungen
Ohne vollständige Begründung: FORMELL UNWIRKSAM.

§558b BGB - Zustimmungsfrist:
Bis Ende des zweiten Kalendermonats nach Zugang.

§558 Abs.3 BGB - Kappungsgrenze:
Maximal 20% in 3 Jahren. Angespannte Märkte nur 15%
(Berlin, Hamburg, München, Frankfurt, Köln, Düsseldorf, Stuttgart,
Bremen, Dresden, Freiburg, Heidelberg, Münster und weitere).

§535 BGB - Hauptpflichten Vermieter:
Vermieter MUSS die Wohnung in mangelfreiem Zustand erhalten.

§536 BGB - Mietminderung bei Mängeln:
Heizungsausfall 20-100%, Schimmel 10-20%, Baulärm 10-30%,
Aufzug defekt 3-5%, defekte Fenster 5-10%, Renovierungsstau 5-15%,
Wasserschaden 10-25%.

TYPISCHE FORMFEHLER:
Kein Mietspiegel, falscher Mietspiegel, Tabellenfeld fehlt,
Frist falsch, Kappungsgrenze überschritten, Sperrfrist verletzt,
falscher Name, keine Begründung der Wohnungsmerkmale,
Erhöhung über ortsübliche Vergleichsmiete, Schriftformverstoß.

KAPPUNGSGRENZE BERECHNUNG:
Wenn Mieter angibt seit wann er wohnt und aktuelle Miete:
Prüfe ob Erhöhung mehr als 20% (oder 15% in angespannten Märkten) 
der aktuellen Miete in den letzten 3 Jahren beträgt.

SPERRFRIST:
Letzte Erhöhung muss mindestens 15 Monate zurückliegen.
Wohndauer unter 1 Jahr: Sperrfrist möglicherweise noch nicht abgelaufen.
`;

const WISSENSBASIS_KUENDIGUNG = `
Du bist ein deutscher Mietrechtsanwalt mit 30 Jahren Berufserfahrung.

§573 BGB - Ordentliche Kündigung:
Nur mit berechtigtem Interesse: Eigenbedarf, Vertragsverletzung,
wirtschaftliche Verwertung. Muss schriftlich begründet werden.

§573c BGB - Kündigungsfristen:
Unter 5 Jahre: 3 Monate.
5-8 Jahre: 6 Monate.
Über 8 Jahre: 9 Monate.

§574 BGB - Sozialklausel / Widerspruchsrecht:
Widerspruch möglich bei besonderer Härte.

§577a BGB - Sperrfrist bei Umwandlung:
Wohnung in Eigentumswohnung umgewandelt: 3 Jahre Sperrfrist.

FORMFEHLER BEI KÜNDIGUNG:
1. Nicht alle Mieter namentlich genannt
2. Kündigung nicht vom Eigentümer unterschrieben
3. Keine oder unzureichende Begründung
4. Falsche Kündigungsfrist berechnet
5. Vollmacht fehlt wenn Verwalter kündigt
`;

const WISSENSBASIS_NEBENKOSTEN = `
Du bist ein deutscher Mietrechtsanwalt mit 30 Jahren Berufserfahrung.

§556 BGB - Betriebskosten:
Abrechnungsfrist: 12 Monate nach Abrechnungsjahr.
Nach Ablauf: Nachforderungsrecht des Vermieters verfallen.

NICHT UMLAGEFÄHIGE KOSTEN:
1. Instandhaltungsrücklagen und Reparaturkosten
2. Verwaltungskosten
3. Bankgebühren
4. Kosten für Leerstände
5. Neuanschaffungen
`;

// ============================================================
// FOTO EXTRAKTION PROMPT
// ============================================================
function fotoExtraktionPrompt() {
    return `Du bist ein Assistent der Mieterhöhungsschreiben analysiert.

Extrahiere aus diesem Mieterhöhungsschreiben folgende Informationen falls vorhanden:

Antworte NUR mit JSON ohne Erklärungen:
{
  "erhoehungEuro": "Erhöhungsbetrag in Euro als Zahl oder null",
  "aktuelleMinete": "aktuelle Kaltmiete in Euro als Zahl oder null",
  "neueMinete": "neue Kaltmiete in Euro als Zahl oder null",
  "stadt": "Stadt der Wohnung als Text oder null",
  "qm": "Wohnungsgröße in qm als Zahl oder null",
  "mietspiegel": "genannter Mietspiegel oder null",
  "mietspiegelJahr": "Jahr des Mietspiegels als Zahl oder null",
  "zustimmungsfrist": "genannte Frist als Text oder null",
  "datumSchreiben": "Datum des Schreibens als Text oder null",
  "begründungArt": "mietspiegel oder vergleichswohnungen oder gutachten oder keine oder unklar",
  "hatFormfehler": "ob offensichtliche Formfehler erkennbar sind: true oder false",
  "formfehlerHinweis": "kurze Beschreibung offensichtlicher Formfehler oder null"
}`;
}

// ============================================================
// FRAGEBOGEN ANALYSE PROMPT
// ============================================================
function analyseFragebogenPrompt(nutzerdaten) {
    const stadtAngespannt = [
        'berlin','hamburg','münchen','munich','frankfurt','köln','cologne',
        'düsseldorf','stuttgart','bremen','dresden','freiburg','heidelberg',
        'münster','darmstadt','regensburg','augsburg','erlangen','mainz',
        'wiesbaden','karlsruhe','bonn','mannheim'
    ];
    const stadtLower = (nutzerdaten.stadt || '').toLowerCase();
    const isAngespannt = stadtAngespannt.some(s => stadtLower.includes(s));
    const kappungsgrenze = isAngespannt ? 15 : 20;

    const erhoehungEuro = parseFloat(nutzerdaten.erhoehungEuro) || 0;
    const aktuelleMinete = parseFloat(nutzerdaten.aktuelleMinete) || 0;
    const erhoehungProzent = aktuelleMinete > 0 ? (erhoehungEuro / aktuelleMinete * 100).toFixed(1) : null;

    return `${WISSENSBASIS_MIETERHOEHUNG}


DATEN: Erhöhung ${erhoehungEuro}€ (${erhoehungProzent}% der Miete ${aktuelleMinete}€) | Stadt: ${nutzerdaten.stadt} (${isAngespannt ? 'angespannt 15%' : 'normal 20%'}) | ${nutzerdaten.qm}qm | Wohndauer: ${nutzerdaten.wohndauer} | Mängel: ${nutzerdaten.maengel || 'keine'}

Prüfe: Kappungsgrenze ${kappungsgrenze}%, Sperrfrist, Mietspiegel-Plausibilität, Mängel. Finde mind. 2-3 Angriffspunkte.

Antworte NUR mit JSON:
{
  "fehler": [{"typ":"Name","paragraph":"§XXX BGB","schwere":"KRITISCH/MITTEL/GERING","erklaerung":"Kurze Erklärung"}],
  "maengelArgumente": [{"mangel":"Art","minderungsrecht":"X%","staerke":"STARK/MITTEL/SCHWACH"}],
  "erhoehung_euro": ${erhoehungEuro},
  "aktuelle_miete": ${aktuelleMinete},
  "kappungsgrenze": ${kappungsgrenze},
  "erhoehung_prozent": ${erhoehungProzent},
  "gesamturteil": "NICHT ZULÄSSIG/TEILWEISE ANFECHTBAR/ZULÄSSIG",
  "anfechtungsstaerke": "SEHR STARK/STARK/MITTEL/SCHWACH",
  "zusammenfassung": "2 Sätze",
  "empfehlung": "Was tun"
}`;
}

// ============================================================
// ERKENNUNGS-PROMPT
// ============================================================
function erkennungsPrompt(dokumentText, vorgewaehlterTyp) {
    return `Analysiere dieses Dokument. Nutzer hat angegeben: ${vorgewaehlterTyp}.
Bestätige oder korrigiere.

Antworte NUR mit JSON:
{
  "typ": "MIETERHÖHUNG" oder "KÜNDIGUNG" oder "NEBENKOSTENABRECHNUNG" oder "SONSTIGES",
  "sicherheit": "HOCH" oder "MITTEL" oder "NIEDRIG",
  "begruendung": "Ein Satz"
}

Dokument: ${dokumentText}`;
}

// ============================================================
// EXTRAKTIONS-PROMPT
// ============================================================
function extraktionsPrompt(dokumentText, typ, nutzerdaten) {
    const felder = {
        'MIETERHÖHUNG': `
  "aktuelle_miete": "Kaltmiete in Euro als Zahl",
  "neue_miete": "neue Kaltmiete in Euro als Zahl",
  "erhoehung_euro": "Erhöhungsbetrag in Euro als Zahl",
  "erhoehung_prozent": "Erhöhung in Prozent als Zahl",
  "genannter_mietspiegel": "welcher Mietspiegel zitiert wird",
  "mietspiegel_jahr": "Jahr des Mietspiegels als Zahl",
  "zustimmungsfrist": "genannte Frist als Text",
  "datum_schreiben": "Datum des Schreibens",
  "begründung_art": "mietspiegel oder vergleichswohnungen oder gutachten oder keine"`,
        'KÜNDIGUNG': `
  "kuendigungsgrund": "genannter Grund",
  "kuendigungsart": "Eigenbedarf oder Vertragsverletzung oder Sonstiges",
  "auszugsdatum": "gefordertes Auszugsdatum",
  "genannte_eigenbedarfsperson": "Person für Eigenbedarf falls genannt",
  "datum_schreiben": "Datum des Schreibens",
  "unterschrift": "Wer hat unterschrieben",
  "alle_mieter_genannt": "true oder false",
  "kuendigungsfrist_genannt": "genannte Frist in Monaten als Zahl"`,
        'NEBENKOSTENABRECHNUNG': `
  "abrechnungsjahr": "für welches Jahr als Zahl",
  "nachzahlung": "Nachzahlungsbetrag in Euro als Zahl",
  "vorauszahlung_gesamt": "gezahlte Vorauszahlungen gesamt als Zahl",
  "groesste_posten": "drei größte Kostenpositionen als Array",
  "verdaechtige_posten": "Positionen die möglicherweise nicht umlagefähig sind",
  "neue_vorauszahlung": "neue monatliche Vorauszahlung als Zahl",
  "datum_schreiben": "Datum des Schreibens"`
    };

    const wissensbasis = typ === 'MIETERHÖHUNG' ? WISSENSBASIS_MIETERHOEHUNG :
                         typ === 'KÜNDIGUNG' ? WISSENSBASIS_KUENDIGUNG :
                         WISSENSBASIS_NEBENKOSTEN;

    return `${wissensbasis}

Extrahiere Informationen aus diesem ${typ} Schreiben.

Antworte NUR mit JSON:
{
  ${felder[typ] || felder['MIETERHÖHUNG']},
  "weitere_details": "weiteres relevantes"
}

Nicht vorhanden: null

Dokument: ${dokumentText}`;
}

// ============================================================
// ANALYSE MIETERHÖHUNG (mit Dokument)
// ============================================================
function analyseMieterhöhungPrompt(extrahiert, nutzerdaten) {
    const stadtAngespannt = [
        'berlin','hamburg','münchen','munich','frankfurt','köln','cologne',
        'düsseldorf','stuttgart','bremen','dresden','freiburg','heidelberg',
        'münster','mainz','wiesbaden','karlsruhe','bonn','mannheim'
    ];
    const stadtLower = (nutzerdaten.stadt || '').toLowerCase();
    const isAngespannt = stadtAngespannt.some(s => stadtLower.includes(s));
    const kappungsgrenze = isAngespannt ? 15 : 20;

    return `${WISSENSBASIS_MIETERHOEHUNG}

Analysiere diese Mieterhöhung auf ALLE Schwachstellen.
Prüfe sowohl Formfehler im Dokument ALS AUCH strukturelle Rechtsverstöße.

EXTRAHIERTE DATEN: ${JSON.stringify(extrahiert, null, 2)}

VOM MIETER ANGEGEBEN:
Stadt: ${nutzerdaten.stadt || 'unbekannt'} (${isAngespannt ? 'ANGESPANNTER MARKT — Kappungsgrenze 15%' : 'Kappungsgrenze 20%'})
Wohnungsgröße: ${nutzerdaten.qm || 'unbekannt'} qm
Wohndauer: ${nutzerdaten.wohndauer || 'unbekannt'}
Gemeldete Mängel: ${nutzerdaten.maengel || 'keine'}

PRÜFE SYSTEMATISCH:
1. Formelle Begründung nach §558a BGB — vollständig und korrekt?
2. Kappungsgrenze nach §558 Abs.3 — ${kappungsgrenze}% für diese Stadt eingehalten?
3. Sperrfrist nach §558 — 15 Monate eingehalten?
4. Zustimmungsfrist nach §558b — korrekt gesetzt?
5. Mietspiegel korrekt zitiert? Tabellenfeld angegeben?
6. Mängel als Gegenargument nach §535 und §536
7. Weitere Formfehler: Name, Adresse, Unterschrift, Schriftform

WICHTIG: Finde alle Angriffspunkte. Selbst kleine Fehler können den Widerspruch stärken.

Antworte NUR mit JSON:
{
  "fehler": [
    {
      "typ": "Name des Fehlers",
      "paragraph": "§XXX BGB",
      "schwere": "KRITISCH oder MITTEL oder GERING",
      "erklaerung": "Einfache verständliche Erklärung für Laien"
    }
  ],
  "maengelArgumente": [
    {
      "mangel": "Art des Mangels",
      "minderungsrecht": "Prozentsatz",
      "staerke": "STARK oder MITTEL oder SCHWACH"
    }
  ],
  "erhoehung_euro": "Erhöhungsbetrag als Zahl oder null",
  "aktuelle_miete": "aktuelle Kaltmiete als Zahl oder null",
  "gesamturteil": "NICHT ZULÄSSIG oder TEILWEISE ANFECHTBAR oder ZULÄSSIG",
  "anfechtungsstaerke": "SEHR STARK oder STARK oder MITTEL oder SCHWACH",
  "zusammenfassung": "2-3 Sätze in einfacher Sprache",
  "empfehlung": "Was soll der Mieter konkret tun"
}`;
}

// ============================================================
// ANALYSE KÜNDIGUNG
// ============================================================
function analyseKündigungPrompt(extrahiert, nutzerdaten) {
    return `${WISSENSBASIS_KUENDIGUNG}

Analysiere diese Kündigung auf ALLE rechtlichen Schwachstellen.

EXTRAHIERTE DATEN: ${JSON.stringify(extrahiert, null, 2)}

VOM MIETER ANGEGEBEN:
Stadt: ${nutzerdaten.stadt || 'unbekannt'}
Wohnungsgröße: ${nutzerdaten.qm || 'unbekannt'} qm
Wohndauer: ${nutzerdaten.wohndauer || 'unbekannt'}

Antworte NUR mit JSON:
{
  "fehler": [
    {
      "typ": "Name des Fehlers",
      "paragraph": "§XXX BGB",
      "schwere": "KRITISCH oder MITTEL oder GERING",
      "erklaerung": "Einfache Erklärung"
    }
  ],
  "sozialklauselMoeglich": true oder false,
  "gesamturteil": "UNWIRKSAM oder ANFECHTBAR oder PRÜFENSWERT oder WIRKSAM",
  "anfechtungsstaerke": "SEHR STARK oder STARK oder MITTEL oder SCHWACH",
  "zusammenfassung": "2-3 Sätze einfache Sprache",
  "empfehlung": "Konkrete nächste Schritte"
}`;
}

// ============================================================
// ANALYSE NEBENKOSTEN
// ============================================================
function analyseNebenkostenPrompt(extrahiert, nutzerdaten) {
    return `${WISSENSBASIS_NEBENKOSTEN}

Analysiere diese Nebenkostenabrechnung auf ALLE Fehler.

EXTRAHIERTE DATEN: ${JSON.stringify(extrahiert, null, 2)}

VOM MIETER ANGEGEBEN:
Stadt: ${nutzerdaten.stadt || 'unbekannt'}
Wohnungsgröße: ${nutzerdaten.qm || 'unbekannt'} qm

Antworte NUR mit JSON:
{
  "fehler": [
    {
      "typ": "Name des Fehlers",
      "paragraph": "§XXX BGB",
      "schwere": "KRITISCH oder MITTEL oder GERING",
      "erklaerung": "Einfache Erklärung",
      "potenzielleBesparnis": "Betrag als Zahl oder null"
    }
  ],
  "fristAbgelaufen": true oder false,
  "nachzahlung_betrag": "Nachzahlungsbetrag als Zahl oder null",
  "gesamturteil": "ANFECHTBAR oder TEILWEISE ANFECHTBAR oder KORREKT",
  "anfechtungsstaerke": "SEHR STARK oder STARK oder MITTEL oder SCHWACH",
  "zusammenfassung": "2-3 Sätze einfache Sprache",
  "empfehlung": "Konkrete nächste Schritte"
}`;
}

// ============================================================
// ANALYSE NK ANFORDERUNG
// ============================================================
function analyseNKAnforderungPrompt(nutzerdaten) {
    return `Du bist ein deutscher Mietrechtsanwalt.
§556 BGB: Vermieter muss innerhalb 12 Monate abrechnen. Danach Nachforderungsrecht verfallen.

Analysiere: Mieter hat keine Nebenkostenabrechnung erhalten.

VOM MIETER:
Stadt: ${nutzerdaten.stadt || 'unbekannt'}
Wohnungsgröße: ${nutzerdaten.qm || 'unbekannt'} qm

Antworte NUR mit JSON:
{
  "fehler": [
    {
      "typ": "Pflichtverletzung: Keine Nebenkostenabrechnung erstellt",
      "paragraph": "§556 BGB Abs. 3",
      "schwere": "KRITISCH",
      "erklaerung": "Einfache Erklärung der Rechtslage"
    }
  ],
  "gesamturteil": "ANFECHTBAR",
  "anfechtungsstaerke": "SEHR STARK",
  "zusammenfassung": "2-3 Sätze einfache Sprache",
  "empfehlung": "Konkrete nächste Schritte"
}`;
}

// ============================================================
// BRIEF-PROMPT
// ============================================================
function briefPrompt(analyseErgebnis, nutzerdaten, dokumentTyp) {
    const wissensbasis = dokumentTyp === 'MIETERHÖHUNG' ? WISSENSBASIS_MIETERHOEHUNG :
                         dokumentTyp === 'KÜNDIGUNG' ? WISSENSBASIS_KUENDIGUNG :
                         WISSENSBASIS_NEBENKOSTEN;

    const nkFall = nutzerdaten.nkFall || 'NEBENKOSTENABRECHNUNG';
    const briefTyp = nkFall === 'NEBENKOSTENABRECHNUNG_ANFORDERUNG'
        ? 'NEBENKOSTENABRECHNUNG_ANFORDERUNG'
        : dokumentTyp;

    const betreffMap = {
        'MIETERHÖHUNG': 'Widerspruch gegen Mieterhöhungsverlangen',
        'KÜNDIGUNG': 'Widerspruch gegen Kündigung des Mietverhältnisses',
        'NEBENKOSTENABRECHNUNG': 'Widerspruch gegen Nebenkostenabrechnung',
        'NEBENKOSTENABRECHNUNG_ANFORDERUNG': 'Aufforderung zur Erstellung der Nebenkostenabrechnung'
    };

    const anweisungMap = {
        'MIETERHÖHUNG': `Der Brief nennt KEINE konkreten Fehler oder Paragraphen.
Er sagt nur klar dass keine Zustimmung erteilt wird und das Schreiben
nicht den gesetzlichen Anforderungen entspricht.
Strategie: Vermieter soll nicht wissen was er verbessern muss.`,
        'KÜNDIGUNG': `Der Brief legt Widerspruch ein.
Er nennt KEINE konkreten Formfehler.
Der Brief fordert Reaktion des Vermieters.`,
        'NEBENKOSTENABRECHNUNG': `Der Brief widerspricht der Abrechnung.
Er nennt NICHT welche Positionen nicht umlagefähig sind.
Er fordert korrigierte Abrechnung und Belegeinsicht.`,
        'NEBENKOSTENABRECHNUNG_ANFORDERUNG': `Der Brief fordert Vermieter auf
innerhalb von 14 Tagen die fehlende Abrechnung zu erstellen.
Er verweist auf §556 BGB.`
    };

    const name = nutzerdaten.name || '[Ihr Name]';
    const adresse = nutzerdaten.adresse || '[Ihre Adresse]';
    const stadt = nutzerdaten.stadt || '[Ihre Stadt]';

    return `${wissensbasis}

Schreibe professionellen Brief für: ${briefTyp}

ANWEISUNG:
${anweisungMap[briefTyp] || anweisungMap['MIETERHÖHUNG']}

ANALYSE: ${JSON.stringify(analyseErgebnis, null, 2)}

MIETERDATEN:
Name: ${name}
Adresse: ${adresse}
Stadt: ${stadt}

FORMAT:
${stadt}, [Datum]

${name}
${adresse}

An den Vermieter

Betreff: ${betreffMap[briefTyp] || 'Widerspruch'}

Sehr geehrte Damen und Herren,

[BRIEFTEXT]

Mit freundlichen Grüßen,
${name}

WICHTIG: Wo Name, Adresse oder andere persönliche Daten fehlen,
setze Platzhalter in eckigen Klammern: [Ihr Name], [Ihre Adresse], [Datum] etc.

Schreibe NUR den Brief.`;
}

// ============================================================
// VERHALTENSEMPFEHLUNG
// ============================================================
function verhaltensempfehlungPrompt(analyseErgebnis, verlauf) {
    const typ = analyseErgebnis.dokumentTyp || 'MIETERHÖHUNG';
    return `Erfahrener Mietrechtsanwalt. Erstelle Verhaltensempfehlung.
Dokumenttyp: ${typ}

ANALYSE: ${JSON.stringify(analyseErgebnis, null, 2)}

Antworte NUR mit JSON:
{
  "was_zu_erwarten_ist": "2-3 Sätze was wahrscheinlich passiert",
  "wenn_vermieter_reagiert": "Was tun bei Antwort",
  "verlauf_hinweis": null
}`;
}

module.exports = {
    fotoExtraktionPrompt,
    analyseFragebogenPrompt,
    erkennungsPrompt,
    extraktionsPrompt,
    analyseMieterhöhungPrompt,
    analyseKündigungPrompt,
    analyseNebenkostenPrompt,
    analyseNKAnforderungPrompt,
    briefPrompt,
    verhaltensempfehlungPrompt
};
