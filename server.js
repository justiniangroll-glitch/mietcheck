require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { analyzeDocument, generateBrief, extractFromFoto } = require('./analyze');
const { accountErstellen, accountLogin, getHistory } = require('./accounts');

let stripeInstance = null;
function getStripe() {
    if (!stripeInstance) {
        if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY nicht gesetzt');
        stripeInstance = require('stripe')(process.env.STRIPE_SECRET_KEY);
    }
    return stripeInstance;
}

const app = express();
app.use(cors());

// Stripe Webhook braucht raw body — MUSS vor express.json() stehen
app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.static('frontend'));

const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 }
});

// ============================================================
// SEITEN ROUTEN
// ============================================================
app.get('/impressum', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'impressum.html'));
});

app.get('/datenschutz', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'datenschutz.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.get('/pruefen', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'prufen.html'));
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
// STRIPE CHECKOUT
// ============================================================
app.post('/create-checkout', async (req, res) => {
    try {
        const { analyseErgebnis, nutzerdaten } = req.body;

        const session = await getStripe().checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: 'MietHilfe – Widerspruchsschreiben',
                        description: '3 versandfertige Widerspruchsschreiben + vollständige Fehleranalyse'
                    },
                    unit_amount: 3945
                },
                quantity: 1
            }],
            mode: 'payment',
            success_url: `${process.env.BASE_URL || 'https://miethilfe-online.xyz'}/result.html?success=true`,
            cancel_url: `${process.env.BASE_URL || 'https://miethilfe-online.xyz'}/result.html?cancelled=true`,
            metadata: {
                analyse: JSON.stringify(analyseErgebnis).substring(0, 500),
                nutzer_name: nutzerdaten?.name || '',
                nutzer_email: nutzerdaten?.email || ''
            }
        });

        res.json({ id: session.id });
    } catch (error) {
        console.error('Stripe Fehler:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// STRIPE WEBHOOK
// ============================================================
app.post('/webhook', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    try {
        event = getStripe().webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error('Webhook Fehler:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        console.log('Zahlung erfolgreich:', session.id);
    }

    res.json({ received: true });
});

// ============================================================
// ACCOUNT ROUTEN
// ============================================================
app.post('/register', async (req, res) => {
    try {
        const { email, passwort } = req.body;
        if (!email || !passwort) {
            return res.status(400).json({ success: false, error: 'Email und Passwort erforderlich' });
        }
        const result = accountErstellen(email, passwort);
        res.json(result.erfolg
            ? { success: true }
            : { success: false, fehler: result.fehler }
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
            res.json({ success: true, account: { email: result.account.email, analysenAnzahl: result.account.analysen.length } });
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
                const visionClient = new AnthropicVision({ apiKey: process.env.ANTHROPIC_API_KEY });
                const imageData = fs.readFileSync(req.file.path).toString('base64');
                const response = await visionClient.messages.create({
                    model: 'claude-opus-4-5',
                    max_tokens: 2000,
                    messages: [{
                        role: 'user',
                        content: [
                            { type: 'image', source: { type: 'base64', media_type: mimetype, data: imageData } },
                            { type: 'text', text: 'Lies den gesamten Text aus diesem Bild eines Vermieter-Schreibens. Gib nur den reinen Text zurück.' }
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
            maengel:             req.body.maengel ? req.body.maengel.split(',').filter(Boolean) : [],
            maengelDetails:      req.body.maengelDetails || '',
            weitereMaengel:      req.body.weitereMaengel || '',
            fragebogen:          req.body.fragebogen === true || req.body.fragebogen === 'true',
            erhoehungEuro:       req.body.erhoehungEuro || '',
            aktuelleMinete:      req.body.aktuelleMinete || '',
            wohndauer:           req.body.wohndauer || '',
            fotoBase64:          req.body.fotoBase64 || '',
            fotoMediaType:       req.body.fotoMediaType || ''
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
    console.log(`\nMietHilfe Server läuft auf http://localhost:${PORT}`);
    console.log('Verfügbare Routen:');
    console.log(`  http://localhost:${PORT}/            → Mieterhöhung`);
    console.log(`  http://localhost:${PORT}/prüfen      → Mieterhöhung AG2`);
    console.log(`  http://localhost:${PORT}/kuendigung  → Kündigung`);
    console.log(`  http://localhost:${PORT}/nebenkosten → Nebenkostenabrechnung`);
});

// ============================================================
// FOTO EXTRAKTION — schnelle Vorverarbeitung für Fragebogen
// ============================================================
app.post('/extract-foto', async (req, res) => {
    try {
        const { base64, mediaType } = req.body;
        if (!base64 || !mediaType) {
            return res.status(400).json({ error: 'base64 und mediaType erforderlich' });
        }
        const extracted = await extractFromFoto(base64, mediaType);
        res.json(extracted);
    } catch (error) {
        console.error('Foto-Extraktion Fehler:', error);
        res.status(500).json({ error: error.message });
    }
});
