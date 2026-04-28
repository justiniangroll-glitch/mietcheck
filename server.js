require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { analyzeDocument, generateBrief } = require('./analyze');
const { accountErstellen, accountLogin, getHistory } = require('./accounts');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));

const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 }
});

// ============================================================
// SEITEN ROUTEN
// ============================================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.get('/kuendigung', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'kuendigung.html'));
});

app.get('/nebenkosten', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'nebenkosten.html'));
});

app.get('/result.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'result.html'));
});

// ============================================================
// ACCOUNT ROUTEN
// ============================================================
app.post('/register', async (req, res) => {
    try {
        const { email, passwort } = req.body;
        if (!email || !passwort) {
            return res.status(400).json({
                success: false,
                error: 'Email und Passwort erforderlich'
            });
        }
        const result = accountErstellen(email, passwort);
        res.json(result.erfolg
            ? { success: true }
            : { success: false, error: result.fehler }
        );
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { email, passwort } = req.body;
        const result = accountLogin(email, passwort);
        if (result.erfolg) {
            res.json({
                success: true,
                account: {
                    email: result.account.email,
                    analysenAnzahl: result.account.analysen.length
                }
            });
        } else {
            res.status(401).json({ success: false, error: result.fehler });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/history/:email', (req, res) => {
    try {
        const history = getHistory(req.params.email);
        res.json({ success: true, history });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// ANALYSE ROUTE
// ============================================================
app.post('/analyze', upload.single('dokument'), async (req, res) => {
    try {
        let dokumentText = '';

        if (req.file) {
            const mimetype = req.file.mimetype;
            if (mimetype.startsWith('image/')) {
                const AnthropicVision = require('@anthropic-ai/sdk');
                const visionClient = new AnthropicVision({
                    apiKey: process.env.ANTHROPIC_API_KEY
                });
                const imageData = fs.readFileSync(req.file.path).toString('base64');
                const response = await visionClient.messages.create({
                    model: 'claude-opus-4-5',
                    max_tokens: 2000,
                    messages: [{
                        role: 'user',
                        content: [
                            {
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: mimetype,
                                    data: imageData
                                }
                            },
                            {
                                type: 'text',
                                text: 'Lies den gesamten Text aus diesem Bild eines Vermieter-Schreibens. Gib nur den reinen Text zurück.'
                            }
                        ]
                    }]
                });
                dokumentText = response.content[0].text;
                try { fs.unlinkSync(req.file.path); } catch(e) {}
            } else {
                dokumentText = fs.readFileSync(req.file.path, 'utf8');
                try { fs.unlinkSync(req.file.path); } catch(e) {}
            }
        } else if (req.body.text) {
            dokumentText = req.body.text;
        }

        const nutzerdaten = {
            name:                req.body.name || '',
            email:               req.body.email || '',
            adresse:             req.body.adresse || '',
            stadt:               req.body.stadt || '',
            qm:                  req.body.qm || '',
            einzug:              req.body.einzug || '',
            mietdauer:           req.body.mietdauer || '',
            sozialeHaerte:       req.body.sozialeHaerte || '',
            sozialDetails:       req.body.sozialDetails || '',
            kuendigungsart:      req.body.kuendigungsart || '',
            andereWohnungen:     req.body.andereWohnungen || '',
            eigenbedarfHinweise: req.body.eigenbedarfHinweise || '',
            personenAnzahl:      req.body.personenAnzahl || '',
            abrechnungsDatum:    req.body.abrechnungsDatum || '',
            fehlendJahre:        req.body.fehlendJahre || '',
            vorauszahlung:       req.body.vorauszahlung || '',
            vermieterReaktion:   req.body.vermieterReaktion || '',
            sachverhalt:         req.body.sachverhalt || '',
            auffaelligkeiten:    req.body.auffaelligkeiten || '',
            vorgewaehlterTyp:    req.body.vorgewaehlterTyp || 'MIETERHÖHUNG',
            nkFall:              req.body.nkFall || 'NEBENKOSTENABRECHNUNG',
            maengel:             req.body.maengel
                                   ? req.body.maengel.split(',').filter(Boolean)
                                   : [],
            maengelDetails:      req.body.maengelDetails || ''
        };

        console.log('Analyse für Typ:', nutzerdaten.vorgewaehlterTyp, '| NK Fall:', nutzerdaten.nkFall);
        const ergebnis = await analyzeDocument(dokumentText, nutzerdaten);
        res.json({ success: true, ergebnis });

    } catch (error) {
        console.error('Analyse Fehler:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// BRIEF GENERIERUNG
// ============================================================
app.post('/generate-brief', async (req, res) => {
    try {
        const { analyseErgebnis, nutzerdaten } = req.body;
        const brief = await generateBrief(analyseErgebnis, nutzerdaten);
        res.json({ success: true, brief });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// SERVER START
// ============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\nMietCheck Server läuft auf http://localhost:${PORT}`);
    console.log('Verfügbare Routen:');
    console.log(`  http://localhost:${PORT}/            → Mieterhöhung`);
    console.log(`  http://localhost:${PORT}/kuendigung  → Kündigung`);
    console.log(`  http://localhost:${PORT}/nebenkosten → Nebenkostenabrechnung`);
});