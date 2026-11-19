# Vorya QR 0.1: checklist di validazione dopo il deploy

Da eseguire dopo ogni deploy in produzione su `https://qr.vorya.it`, **da un PC** (Chrome, Edge o Firefox recenti) e **da un iPhone reale** (Safari, iOS aggiornato). Segnare ogni riga con ✅ o ❌ e annotare data, versione (`/api/health`) e chi ha eseguito il test.

Serve: una casella email raggiungibile per la registrazione, l'account super admin creato con la CLI, una stampante oppure un secondo schermo.

## 1. Infrastruttura

| # | Verifica | Dove | Atteso | Esito |
| --- | --- | --- | --- | --- |
| 1.1 | In Portainer, stato dei servizi | PC | `db`, `backend` e `frontend` healthy; `migrate` exited (0) | |
| 1.2 | Apri `https://qr.vorya.it/api/health` | PC | `status: ok`, `database: connected`, `version: 0.1.0` | |
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
| 7.1 | Il cliente ricarica la dashboard | PC | "Prova terminata" con "Il periodo di prova è terminato, contattaci per attivare un piano" e il pulsante email verso `SUPPORT_EMAIL` | |
| 7.2 | Scansiona un QR dinamico del cliente | iPhone | **Il redirect funziona ancora** e la scansione viene registrata | |
| 7.3 | L'admin assegna un piano | PC | Il cliente torna alla dashboard | |

## 8. Backup

| # | Verifica | Dove | Atteso | Esito |
| --- | --- | --- | --- | --- |
| 8.1 | Esegui il backup di [deploy/VPS.md](../deploy/VPS.md#backup-e-restore-del-database) | VPS | File `.dump` creato e leggibile con `pg_restore --list` | |
| 8.2 | Copia il file fuori dal VPS | VPS | Copia presente nello storage esterno | |
