# Vorya QR 0.2: checklist di validazione dopo il deploy

Da eseguire dopo ogni deploy in produzione su `https://qr.vorya.it`, **da un PC** (Chrome, Edge o Firefox recenti) e **da un iPhone reale** (Safari, iOS aggiornato). Segnare ogni riga con ✅ o ❌ e annotare data, versione (`/api/health`) e chi ha eseguito il test.

Serve: una casella email raggiungibile per la registrazione, l'account super admin creato con la CLI, una stampante oppure un secondo schermo.

## 1. Infrastruttura

| # | Verifica | Dove | Atteso | Esito |
| --- | --- | --- | --- | --- |
| 1.1 | In Portainer, stato dei servizi | PC | `db`, `backend` e `frontend` healthy; `worker` running; `migrate` exited (0) | |
| 1.2 | Apri `https://qr.vorya.it/api/health` | PC | `status: ok`, `database: connected`, `version: 0.2.0` | |
| 1.3 | Lucchetto del browser su `https://qr.vorya.it` | PC + iPhone | Certificato Let's Encrypt valido, nessun avviso | |
| 1.4 | Apri `http://qr.vorya.it` (senza la s) | PC | Reindirizza a HTTPS | |
| 1.5 | Apri `https://qr.vorya.it/api/openapi.json` | PC | 404: documentazione API non esposta in produzione | |
| 1.6 | Apri `https://qr.vorya.it/r/abcdefg` | iPhone | Pagina brandizzata "QR non attivo" | |

## 2. Registrazione e accesso

| # | Verifica | Dove | Atteso | Esito |
| --- | --- | --- | --- | --- |
| 2.1 | Registrati da `/register` con un'email reale | iPhone | Messaggio "Controlla la tua casella email" | |
| 2.2 | Email ricevuta | iPhone | Mittente `noreply@vorya.it`, logo, pulsante "Conferma e inizia" (controllare anche lo spam) | |
| 2.3 | Apri il link e scegli la password (12+ caratteri) | iPhone | Accesso automatico alla dashboard, banner "Prova Pro: 14 giorni" | |
| 2.4 | Riapri lo stesso link di conferma | iPhone | "Link scaduto o già utilizzato" | |
| 2.5 | Esci e accedi da PC con le stesse credenziali | PC | Dashboard dello stesso spazio di lavoro | |
| 2.6 | Accesso con password errata | PC | "Email o password non valide." | |
| 2.7 | "Password dimenticata?", poi email e link | PC | Email ricevuta; nuova password impostata; l'iPhone viene disconnesso | |
| 2.8 | Tocca un campo di testo su iPhone | iPhone | Safari non ingrandisce la pagina | |

## 3. QR dinamico: test con iPhone reale (prima e dopo il cambio di destinazione)

| # | Verifica | Dove | Atteso | Esito |
| --- | --- | --- | --- | --- |
| 3.1 | Crea un QR **dinamico** "Test stampa" verso `https://www.vorya.it` | PC | Anteprima live; dopo il salvataggio, link breve `https://qr.vorya.it/r/xxxxxxx` | |
| 3.2 | Scarica il **PNG 1024 px** e lo **SVG** | PC | File `vorya-qr-test-stampa.png` / `.svg` che si aprono correttamente | |
| 3.3 | **Stampa** il PNG (o lo SVG) su carta, oppure mostralo a tutto schermo su un secondo monitor | PC | QR nitido, con margine bianco attorno | |
| 3.4 | **Scansiona il QR stampato o a schermo con la fotocamera dell'iPhone** | iPhone | Si apre `https://www.vorya.it` | |
| 3.5 | Sul PC cambia la destinazione in `https://www.vorya.it/contatti` (o un'altra pagina) e salva | PC | "Modifiche salvate." | |
| 3.6 | **Scansiona di nuovo lo stesso QR stampato o a schermo**, senza ristamparlo | iPhone | Si apre la **nuova** destinazione | |
| 3.7 | Ripeti la scansione da Chrome/Google Lens o da un secondo telefono (anche Android, se disponibile) | iPhone / altro | Nuova destinazione | |
| 3.8 | Apri "Statistiche" del QR | PC | Almeno 2 scansioni, barra di oggi nel grafico, "Smartphone" e "iOS" nella ripartizione; mai la parola "visitatori" | |
| 3.9 | "Metti in pausa", poi scansiona | PC → iPhone | Pagina "QR non attivo"; le scansioni non aumentano | |
| 3.10 | "Riattiva", poi scansiona | PC → iPhone | Si apre di nuovo la destinazione | |
| 3.11 | Condividi il link breve su WhatsApp (anteprima) | iPhone | Funziona; nelle statistiche l'anteprima conta tra i bot, non tra le scansioni | |

## 4. QR statico e personalizzazione

| # | Verifica | Dove | Atteso | Esito |
| --- | --- | --- | --- | --- |
| 4.1 | Crea un QR **statico** verso un URL qualsiasi e scansionalo dallo schermo | PC → iPhone | Apre direttamente l'URL, senza passare da `qr.vorya.it` | |
| 4.2 | Primo piano `#cccccc` su sfondo bianco | PC | Avviso "Contrasto insufficiente…" in tempo reale | |
| 4.3 | Primo piano bianco su sfondo scuro | PC | Avviso "QR invertito" | |
| 4.4 | Margine a 0 o 1 | PC | Avviso "Margine ridotto" | |
| 4.5 | Colori del brand (es. `#087f5b` su bianco), correzione H, poi scansiona il PNG | PC → iPhone | Il QR viene letto | |
| 4.6 | Nella modifica di un QR statico cambia l'URL | PC | Avviso: l'immagine cambia e i QR già stampati restano sul vecchio indirizzo | |

## 5. Dashboard, piano e mobile

| # | Verifica | Dove | Atteso | Esito |
| --- | --- | --- | --- | --- |
| 5.1 | Ricerca per nome e filtri tipo/stato | PC | Risultati coerenti | |
| 5.2 | Contatore d'uso | PC | Dinamici `n / 25`, statici `n / 100` durante la prova | |
| 5.3 | Dashboard, editor e statistiche su iPhone | iPhone | Menu laterale apribile, nessuno scorrimento orizzontale, testi leggibili | |
| 5.4 | Download PNG da iPhone | iPhone | L'immagine si apre o si salva in Foto/File | |
| 5.5 | Elimina un QR dinamico (con conferma) e scansiona il QR stampato | PC → iPhone | Pagina "QR non attivo" | |

## 6. Admin

| # | Verifica | Dove | Atteso | Esito |
| --- | --- | --- | --- | --- |
| 6.1 | Accedi come super admin | PC | Area "Spazi di lavoro" con il cliente di test | |
| 6.2 | Un cliente apre `/admin` | PC | "Accesso negato" | |
| 6.3 | Modifica i limiti del piano Start (es. 1 dinamico) e assegna Start al cliente | PC | Prova chiusa; il cliente vede "Oltre il limite del piano" ma i QR esistenti funzionano ancora | |
| 6.4 | Il cliente prova a creare un QR dinamico | PC | Errore "Hai più QR dinamici…" (409); nessun QR creato | |
| 6.5 | Ripristina i limiti originali del piano Start (10 / 3) | PC | Salvato | |
| 6.6 | **Sospendi** il cliente | PC | Il cliente finisce su "Account sospeso"; scansionando il QR stampato compare "QR non attivo" | |
| 6.7 | **Riattiva** il cliente | PC | Dashboard e redirect tornano a funzionare | |

## 7. Fine della prova (facoltativo, su un account di test)

Per simulare la scadenza senza attendere 14 giorni, dalla console del container `db`:

```bash
psql -U vorya_qr -d vorya_qr -c "UPDATE workspaces SET trial_ends_at = now() - interval '1 minute' WHERE name = 'NOME SPAZIO DI TEST';"
```

| # | Verifica | Dove | Atteso | Esito |
| --- | --- | --- | --- | --- |
| 7.1 | Il cliente ricarica la dashboard | PC | "Prova terminata" con il pulsante «Scegli un piano» (dalla 0.3: porta a `/account/plan`) | |
| 7.2 | Scansiona un QR dinamico del cliente | iPhone | **Il redirect funziona ancora** (per 30 giorni dalla scadenza, poi «QR non attivo») e la scansione viene registrata | |
| 7.3 | L'admin assegna un piano | PC | Il cliente torna alla dashboard | |

## 8. Backup

| # | Verifica | Dove | Atteso | Esito |
| --- | --- | --- | --- | --- |
| 8.1 | Esegui il backup di [deploy/VPS.md](../deploy/VPS.md#backup-e-restore-del-database) | VPS | File `.dump` creato e leggibile con `pg_restore --list` | |
| 8.2 | Copia il file fuori dal VPS | VPS | Copia presente nello storage esterno | |

---

# Verifiche della 0.2

Dopo l'aggiornamento, con **un iPhone reale** (Safari, iOS aggiornato). Per i test di stampa usare carta bianca opaca; per lo schermo, luminosità al massimo.

## 9. QR della 0.1 dopo l'aggiornamento

| # | Verifica | Dove | Atteso | Esito |
| --- | --- | --- | --- | --- |
| 9.1 | Scansiona un QR dinamico **stampato con la 0.1** | iPhone | Apre la stessa destinazione di prima dell'aggiornamento | |
| 9.2 | Accedi con l'account che lo ha creato | PC | Il QR è nella prima azienda (nome dello spazio di lavoro), con le statistiche di prima | |
| 9.3 | Cambia la destinazione e riscansiona lo stesso foglio | iPhone | Apre la nuova destinazione | |

## 10. Scansione di QR con stili e logo diversi

Crea e stampa (PDF a 3 cm di lato) questi QR, poi scansionali con la Fotocamera di iPhone:

| # | Stile | Atteso | Esito |
| --- | --- | --- | --- |
| 10.1 | Moduli quadrati, nero su bianco | Letto subito | |
| 10.2 | Pallini + cornice cerchio + centro cerchio | Letto subito | |
| 10.3 | Fluidi + gradiente lineare verde scuro → nero | Letto subito | |
| 10.4 | Classy + gradiente radiale + colore occhi diverso | Letto subito | |
| 10.5 | Logo al 25% (correzione H forzata) | Letto subito | |
| 10.6 | Logo al 30% con sfondo trasparente, stampato su carta bianca | Letto, eventualmente avvicinando il telefono | |
| 10.7 | Nel designer, colore dei moduli `#e0e0e0` | Badge rosso, "Crea codice QR" disabilitato | |
| 10.8 | Export PNG 2048 px aperto su un monitor | Letto dallo schermo | |

## 11. Pagine ospitate

| # | Verifica | Dove | Atteso | Esito |
| --- | --- | --- | --- | --- |
| 11.1 | Scansiona un QR **vCard** e tocca "Salva contatto" | iPhone | Si apre la scheda Contatti con nome, azienda, telefono, email e indirizzo corretti (accenti compresi); "Crea nuovo contatto" lo salva | |
| 11.2 | Scansiona un QR **PDF** e apri il documento | iPhone | Anteprime delle prime pagine visibili subito; "Apri" mostra il PDF intero e si può scorrere e ingrandire | |
| 11.3 | Scansiona un QR **Musica** e premi play | iPhone | L'audio parte; trascinando la barra di avanzamento la riproduzione salta al punto scelto senza ripartire da capo | |
| 11.4 | Durante la riproduzione blocca lo schermo | iPhone | Nessun errore alla riapertura; i link alle piattaforme aprono le app corrispondenti | |
| 11.5 | Link in bio e Pagina attività: tocca pulsanti e social | iPhone | Si aprono le destinazioni; nelle statistiche compaiono i clic per elemento | |
| 11.6 | Nessuna barra di scorrimento orizzontale su tutte le pagine | iPhone | Contenuto entro lo schermo, testo leggibile senza zoom | |

## 12. Bottom sheet, swipe e movimento

| # | Verifica | Dove | Atteso | Esito |
| --- | --- | --- | --- | --- |
| 12.1 | Apri un modale (es. "Crea azienda") | iPhone | Si apre dal basso come bottom sheet | |
| 12.2 | Trascina il bottom sheet verso il basso | iPhone | Segue il dito e si chiude con uno swipe deciso o trascinato abbastanza in basso; altrimenti torna su | |
| 12.3 | Wizard "Nuovo QR": avanti e indietro tra gli step | iPhone | Transizione orizzontale fluida, barra di avanzamento che si riempie | |
| 12.4 | Crea un QR | iPhone | Animazione di conferma breve (check che si disegna), una volta sola | |
| 12.5 | Attiva **Impostazioni → Accessibilità → Movimento → Riduci movimento** e ripeti 12.1–12.4 | iPhone | Niente scorrimenti né rimbalzi: solo dissolvenze brevi o cambi istantanei; grafici e numeri compaiono già completi | |

## 13. Aziende e trasferimento

| # | Verifica | Dove | Atteso | Esito |
| --- | --- | --- | --- | --- |
| 13.1 | Crea una seconda azienda e passa dall'una all'altra | PC | Il selettore mostra entrambe; ricaricando si riapre l'ultima usata | |
| 13.2 | Trasferisci un'azienda a un secondo account di test | PC | Il destinatario riceve l'email e vede la richiesta in Aziende | |
| 13.3 | Il destinatario accetta; scansiona un QR dell'azienda | iPhone | Il QR funziona come prima; il mittente non vede più l'azienda | |
| 13.4 | Elimina un'azienda di test e ripristinala | PC | I QR mostrano "QR non attivo" mentre è eliminata e tornano attivi dopo il ripristino | |

## 14. Statistiche, abusi e upload

| # | Verifica | Dove | Atteso | Esito |
| --- | --- | --- | --- | --- |
| 14.1 | Dopo alcune scansioni apri le statistiche | PC | Paese e città (se scaricato il database DB-IP), visitatori unici stimati, attribuzione DB-IP in fondo | |
| 14.2 | Esporta il CSV e aprilo in Excel | PC | Colonne separate, accenti corretti | |
| 14.3 | Apri `/report` e invia una segnalazione per un QR di test | iPhone | Messaggio di conferma; la segnalazione compare in Admin → Segnalazioni | |
| 14.4 | Admin: "Blocca il QR" | PC | Lo slug mostra "QR non attivo"; il cliente non può riattivarlo | |
| 14.5 | Admin: aggiungi un dominio bloccato e prova a usarlo in un QR | PC | Errore "Questa destinazione non è consentita" | |
| 14.6 | Carica un PDF di 20 MB su un account Pro | PC | Barra di avanzamento reale e upload completato (nessun errore 413 da CloudPanel) | |
| 14.7 | Trascina un file sulla dropzone | PC | L'area reagisce al trascinamento; un file SVG o EXE viene rifiutato con un messaggio chiaro | |
| 14.8 | Backup del volume dei file ([VPS.md](../deploy/VPS.md#backup-dei-file-caricati-02)) | VPS | Archivio `.tgz` creato | |

---

# Verifiche della 0.3

Con **un iPhone reale** (Safari, WhatsApp e Instagram installati). Prima dell'aggiornamento annota la destinazione di un QR dinamico della 0.2 stampato.

## 15. Link esistenti dopo l'aggiornamento

| # | Verifica | Dove | Atteso | Esito |
| --- | --- | --- | --- | --- |
| 15.1 | Scansiona un QR stampato con la 0.2 | iPhone | Apre la stessa destinazione di prima | |
| 15.2 | Apri `/r/{slug}` di quel QR da Safari | iPhone | Stessa destinazione; la scansione compare nelle statistiche | |
| 15.3 | Account con prova già scaduta prima dell'aggiornamento | iPhone | I suoi QR continuano a funzionare per 30 giorni dal deploy | |

## 16. Link breve da WhatsApp e Instagram

| # | Verifica | Dove | Atteso | Esito |
| --- | --- | --- | --- | --- |
| 16.1 | Crea un link breve (solo link) e invialo a te stesso su WhatsApp | PC + iPhone | L'anteprima è sensata; il tap apre la destinazione | |
| 16.2 | Incolla il link nella bio o in una storia di Instagram e aprilo dall'app | iPhone | Si apre nel browser interno senza errori e la scansione viene contata | |
| 16.3 | Aggiungi un UTM dal costruttore e riapri il link | iPhone | La destinazione contiene i parametri UTM, senza duplicati | |

## 17. QR stampato con back-half

| # | Verifica | Dove | Atteso | Esito |
| --- | --- | --- | --- | --- |
| 17.1 | Su un link Pro aggiungi il back-half `prova-vorya`, genera il QR e stampalo (3 cm) | PC | `/prova-vorya` apre la destinazione; il QR si legge subito | |
| 17.2 | Scansiona il QR stampato | iPhone | Apre la destinazione | |
| 17.3 | Cambia il tipo a vCard dal pannello e riscansiona lo stesso foglio | iPhone | Si apre la vCard senza ristampare; ripristina la versione precedente e riscansiona: torna la destinazione di prima | |
| 17.4 | Scansiona un QR **statico** | iPhone | Funziona; in dashboard compare l'avviso rosso «Questo QR è statico…» | |

## 18. Password, scadenza e programmazione

| # | Verifica | Dove | Atteso | Esito |
| --- | --- | --- | --- | --- |
| 18.1 | Imposta una password su un link e aprilo | iPhone | Pagina di sblocco con illustrazione; password errata → errore; corretta → destinazione | |
| 18.2 | Riapri subito il link | iPhone | Si apre senza richiedere la password (cookie 24 h) | |
| 18.3 | Scadenza fra 2 minuti con URL di ripiego, poi riapri dopo la scadenza | iPhone | Va all'URL di ripiego (senza ripiego: pagina «Link scaduto») | |

## 19. Menu e carta dei vini

| # | Verifica | Dove | Atteso | Esito |
| --- | --- | --- | --- | --- |
| 19.1 | Crea un Menu con una sezione Cucina e una Vini, allergeni e badge | iPhone | L'editor è usabile con il pollice; la pagina è veloce | |
| 19.2 | Attiva la lingua inglese e apri la pagina | iPhone | Selettore IT/EN; le voci senza traduzione restano in italiano | |
| 19.3 | Segna una voce «Esaurita» dal telefono | iPhone | Sulla pagina pubblica la voce risulta esaurita subito | |
| 19.4 | Barra delle sezioni, ricerca e filtri per allergeni | iPhone | Scorrimento fluido alla sezione, ricerca nella pagina, legenda degli allergeni | |

## 20. Pagamenti Stripe

Prima in **modalità test** (chiavi `sk_test_`, webhook di test configurato), poi, solo dopo il via libera, in live con `STRIPE_LIVE_ALLOWED=true`.

| # | Verifica | Dove | Atteso | Esito |
| --- | --- | --- | --- | --- |
| 20.1 | Admin → Pagamenti: collega i prezzi di test a Start/Pro/Plus (mensile e annuale) | PC | I prezzi compaiono su `/plans` con l'importo letto da Stripe | |
| 20.2 | Da un account di prova scegli Pro: inserisci dati di fatturazione (P.IVA errata → errore, corretta → avanti) | iPhone | Si apre Stripe Checkout | |
| 20.3 | Paga con la carta di prova `4242 4242 4242 4242` | iPhone | Pagina «Pagamento ricevuto»; piano Pro attivo; email di conferma | |
| 20.4 | Dashboard Stripe → Developers → Webhooks | PC | Eventi consegnati con risposta 200 | |
| 20.5 | Passa da Pro a Plus | PC | Anteprima del conguaglio, conferma, nuovi limiti subito | |
| 20.6 | Carta `4000 0000 0000 0341` al rinnovo (o «Pay» fallita da Stripe) | PC | Banner «Pagamento non riuscito», email, accesso attivo fino alla fine della tolleranza | |
| 20.7 | Annulla l'abbonamento dal portale clienti | PC | Piano attivo fino a fine periodo; poi piano Free: dashboard accessibile, QR oltre i limiti in sola lettura e ancora funzionanti | |
| 20.8 | Admin → Pagamenti → Esporta CSV | PC | I pagamenti con i dati di fatturazione, apribili in Excel | |

## 21. Sito, generatore e Free (0.5)

Da iPhone (Safari) e da PC. Sezione da compilare dopo il deploy di prova; non è stata eseguita su dispositivi reali.

| # | Verifica | Dove | Atteso | Esito |
| --- | --- | --- | --- | --- |
| 21.1 | Apri `/`, `/prezzi`, `/funzionalita`, `/qr-code/menu`, `/soluzioni/ristoranti`, `/link-brevi` | iPhone + PC | Nessun testo tagliato, menu mobile apribile, animazioni fluide, nessuno scorrimento orizzontale | |
| 21.2 | `/prezzi`: confronta con Admin → Piani e Admin → Pagamenti | PC | Limiti e prezzi identici alla tabella; nessun importo scritto a mano | |
| 21.3 | Generatore in home: sito web, colori, logo, scarica PNG e SVG | iPhone | File senza filigrana, il QR si scansiona | |
| 21.4 | Tipo vCard statica: compila e scarica | iPhone | La scansione propone il salvataggio del contatto | |
| 21.5 | Dal generatore: «Crealo dinamico» → registrazione → link nella email → password | iPhone | Esiste un QR dinamico con la stessa destinazione e lo stesso stile | |
| 21.6 | Anteprima link breve nel generatore senza account | PC | Chiede la registrazione; nessun dato salvato | |
| 21.7 | Account di prova con prova scaduta | PC | Piano Free, dashboard utilizzabile, QR oltre i 2 dinamici in sola lettura ma che aprono la destinazione | |
| 21.8 | Scansiona un QR stampato con la 0.2/0.3 | iPhone | Stessa destinazione di prima | |
| 21.9 | Impostazioni → Report: aggiungi un destinatario esterno | PC | Email di conferma (doppio opt-in); report solo dopo la conferma | |
| 21.10 | Email di benvenuto, giorno 1, giorno 3, report, conferma destinatario | Gmail + Apple Mail | Layout corretto, link funzionanti, link di disiscrizione presente | |
| 21.11 | Modulo `/contatti` | iPhone | Arriva una email a supporto; il sesto invio in un'ora è rifiutato | |
| 21.12 | Admin → Metriche | PC | Cifre coerenti con i dati; esporta CSV | |
| 21.13 | Con Umami attivo: naviga il sito | PC | Visite registrate, nessun cookie | |
| 21.14 | Errore forzato (es. `SENTRY_DSN` valido + rotta di prova) | PC | Evento in GlitchTip senza email/IP/token | |
| 21.15 | `/alternative/*` e `/guide/*` | PC | Sono `noindex` finché non verificate (vedi `docs/CONTENUTI-DA-VERIFICARE.md`) | |

