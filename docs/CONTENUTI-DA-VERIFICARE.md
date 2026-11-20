# Contenuti da verificare prima di pubblicare (v0.5)

Tutto ciò che nel sito pubblico è **affermazione fattuale su terzi, testo legale o bozza editoriale** è
marcato qui. Nulla di questo va online "come è" senza una revisione umana.
Le pagine sensibili sono già protette: `noindex` finché il contenuto non è confermato.

## 1. Confronti con i concorrenti (`frontend/content/site/alternatives.json`)

Pagine `/alternative/bitly` e `/alternative/qr-code-generator`.

- Stato attuale: `"verified": false` → le pagine sono **noindex** e fuori dalla sitemap.
- Le affermazioni sui concorrenti (campo `claims`, ognuna con `"verify": true`) sono **segnaposto prudenti**
  scritti senza accesso ai siti dei concorrenti: vanno controllate una per una sulle fonti ufficiali.
- Per ogni pagina: aprire la fonte in `sources`, confermare o correggere ogni claim, compilare `intro`,
  impostare `checked` (data) per ogni fonte e `lastUpdated`, poi `"verified": true`.
- Regola: solo fatti verificabili e datati, nessun giudizio di valore, nessuna cifra non confermata.
- I punti di forza di Vorya (`vorya`) sono veri per costruzione (garanzia QR sempre attivi, niente pubblicità,
  prezzi in euro, italiano) ma vanno riletti.

## 2. Guide (`frontend/content/guide/*.mdx`)

Tre bozze, intestate **"BOZZA DA REVISIONARE"** (`draft: true` → noindex, fuori dalla sitemap):

| File | Da controllare |
|------|----------------|
| `qr-statico-o-dinamico.mdx` | correttezza tecnica, esempi, tono |
| `menu-digitale-ristorante-qr.mdx` | indicazioni per ristoratori, nessun riferimento normativo non verificato |
| `misurare-scansioni-qr-code.mdx` | descrizione delle metriche e della privacy (nessun IP salvato) |

Per pubblicare: revisione completa, rimuovere il banner e impostare `draft: false`.

## 3. FAQ (`frontend/content/site/faq.json`)

Risposte su piani, garanzia "QR sempre attivi", privacy, fatturazione. Controllare in particolare:
conservazione statistiche (12 mesi nascoste, poi eliminate), cosa succede alla scadenza dell'abbonamento,
rimborsi (nessuna promessa non decisa), tempi di supporto.

## 4. Testi legali

Privacy, termini, cookie **non** sono definitivi in 0.5. I footer rimandano alle pagine esistenti.
Da far redigere/validare da un consulente: informativa privacy (Umami senza cookie, GlitchTip, email di
report/onboarding con doppio opt-in), termini di servizio, informativa cookie se si attiva Google Ads.

## 5. Copy e numeri

- Messaggi chiave in `content/site/messages.json` e `home.json`: riletti dal committente.
- **Social proof** (`social-proof.json`): vuoto di proposito. Nessuna testimonianza, logo o numero inventato.
  I contatori pubblici mostrano solo dati reali del database oltre una soglia configurabile
  (impostazione `site` in `/admin`). Non inserire cifre a mano.
- Prezzi: mai nel codice. `/prezzi` li legge dalla tabella piani/Stripe (`/admin/billing`).

## 6. Da verificare a mano su dispositivi

Vedi `docs/VALIDATION.md` (sezione 0.5): iPhone/desktop, rendering email in Gmail e Apple Mail.
