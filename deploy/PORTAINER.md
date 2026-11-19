# Vorya QR 0.3: stack in Portainer

Configurazione per **Portainer CE / Docker Standalone**, con lo stesso schema di Vorya Sign: stack Git, build delle immagini sul server, CloudPanel come reverse proxy sullo stesso host. Per il sito in CloudPanel, i certificati e i backup vedere [VPS.md](VPS.md).

## Dati da inserire nella UI

| Campo | Valore |
| --- | --- |
| Ambiente | Il Docker Standalone del VPS (lo stesso host di CloudPanel) |
| Nome stack | `vorya-qr` |
| Metodo | Repository Git |
| Repository | `https://github.com/lorelicc/vorya-qr` |
| Reference | `refs/heads/main` dopo il merge della PR (oppure `refs/heads/vorya-qr-v0.3` per una prova) |
| **Compose path** | **`deploy/compose.portainer.yaml`** |

Non incollare il file nel Web editor: le build hanno bisogno dei sorgenti `backend/` e `frontend/` del repository.

## Variabili dello stack

Inserirle in **Environment variables** (l'elenco completo, con segnaposto, è in [`deploy/.env.example`](.env.example)). Non serve caricare un file `.env`.

| Variabile | Obbligatoria | Default | Indicazioni |
| --- | --- | --- | --- |
| `POSTGRES_PASSWORD` | **Sì** | nessuno | Generata dal password manager, almeno 32 caratteri. Solo lettere, numeri, `_` e `-`: finisce dentro `DATABASE_URL`. |
| `PUBLIC_BASE_URL` | **Sì** | nessuno | `https://qr.vorya.it`, senza barra finale. In produzione deve essere HTTPS. |
| `SHORT_LINK_BASE_URL` | **Sì** | nessuno | `https://qr.vorya.it` nella 0.1. È l'indirizzo scritto dentro i QR dinamici: **non cambiarlo dopo aver stampato dei QR**. |
| `SMTP_USER`, `SMTP_PASSWORD` | Sì, per le email | vuoto | Credenziali della casella `noreply@vorya.it`. Senza, registrazione e reset password non inviano email (l'errore resta in `mail_logs`). |
| `SMTP_HOST` | No | `smtps.aruba.it` | Come in Vorya Sign. |
| `SMTP_PORT` / `SMTP_SECURITY` | No | `465` / `ssl` | Per STARTTLS usare `587` / `starttls`. Il certificato è sempre verificato. |
| `SMTP_FROM_EMAIL` | No | `noreply@vorya.it` | Mittente delle email. |
| `SMTP_FROM_NAME` | No | `Vorya QR` | |
| `SUPPORT_EMAIL` | No | `supporto@vorya.it` | Indirizzo del pulsante "Contattaci" a fine prova o con account sospeso. |
| `PUBLIC_REGISTRATION_ENABLED` | No | `true` | `false` chiude le nuove registrazioni. |
| `VORYA_QR_HTTP_PORT` | No | `3200` | Porta su `127.0.0.1` del frontend. Cambiarla solo se la 3200 è occupata, e usare la stessa in CloudPanel. |
| `POSTGRES_USER` / `POSTGRES_DB` | No | `vorya_qr` | Lasciare i default. Cambiarli dopo il primo avvio non modifica un volume esistente. |
| `SAFE_BROWSING_API_KEY` | No (0.2) | vuoto | Chiave di Google Safe Browsing v4 per controllare le destinazioni. Vuota = controllo saltato (lo segnala il log). Vedi la nota sui termini d'uso in [docs/V02.md](../docs/V02.md). |
| `STORAGE_DRIVER` | No (0.2) | `local` | `local` salva i file caricati nel volume `uploads_data`; `s3` su un servizio compatibile S3. |
| `STRIPE_SECRET_KEY` | Per i pagamenti (0.3) | vuoto | Chiave segreta (`sk_test_…`/`rk_test_…` per provare, `sk_live_…` in produzione). Senza chiave i pagamenti online restano spenti e `/plans` mostra solo i piani. **Mai** committarla. I prezzi non vanno in nessuna variabile: si collegano da **Admin → Pagamenti**. |
| `STRIPE_WEBHOOK_SECRET` | Per i pagamenti (0.3) | vuoto | Segreto di firma (`whsec_…`) dell'endpoint webhook (vedi sotto). Senza, il webhook risponde 503. |
| `STRIPE_LIVE_ALLOWED` | No (0.3) | `false` | Con `false` le chiavi `live` sono rifiutate: serve `true` solo quando si passa davvero in produzione. |
| `STORAGE_S3_*` | Solo con `s3` | vuoto | `ENDPOINT`, `REGION`, `BUCKET`, `PREFIX`, `ACCESS_KEY`, `SECRET_KEY`. Il bucket deve restare privato: i file passano sempre da `/f/`. |

`DATABASE_URL`, `APP_ENV=production`, `MAIL_TRANSPORT=smtp`, `API_INTERNAL_URL`, `STORAGE_LOCAL_PATH` e `GEOIP_DB_PATH` sono già fissati nel Compose. Le variabili restano in Portainer e non in GitHub: chi amministra Portainer può leggerle.

## Procedura

1. **Stacks → Add stack**, nome `vorya-qr`, metodo Repository, con repository, reference e compose path come nella tabella.
2. In **Environment variables** inserire almeno `POSTGRES_PASSWORD`, `PUBLIC_BASE_URL`, `SHORT_LINK_BASE_URL`, `SMTP_USER` e `SMTP_PASSWORD`.
3. **Deploy the stack**. Al primo avvio Portainer scarica le immagini base e compila backend e frontend (servono Docker Hub, PyPI e npm). Può richiedere qualche minuto.
4. Nel dettaglio dello stack controllare i servizi:
   - `db`: **healthy**;
   - `migrate`: **exited (0)**. È un servizio *one-shot*: applica le migrazioni Alembic e termina. Uno stato "exited" con codice 0 è corretto. Se termina con errore, il backend non parte: leggere i log di `migrate`;
   - `backend`: **healthy**;
   - `worker`: **running** (0.2). Esegue ogni 5 minuti le pulizie: file e aziende eliminati da più di 30 giorni, trasferimenti scaduti, rotazione della chiave dei visitatori unici, conservazione delle statistiche;
   - `frontend`: **healthy**, pubblicato solo su `127.0.0.1:3200`.
5. Creare il primo super admin dalla console del container `backend` (**Containers → vorya-qr-backend-1 → Console → /bin/sh**):

   ```bash
   python -m app.cli create-super-admin --email tuo@indirizzo.it --name "Nome Cognome"
   ```

   La password viene chiesta due volte e non compare nei log. Per un amministratore in sola lettura aggiungere `--role platform_admin`.
6. Configurare il sito in CloudPanel verso `http://127.0.0.1:3200` con Let's Encrypt: vedere [VPS.md](VPS.md).
7. Eseguire la checklist di [docs/VALIDATION.md](../docs/VALIDATION.md).

## Aggiornare da 0.1 a 0.2

La 0.2 aggiunge solo tabelle e colonne (migrazioni `0002`–`0007`, nessuna cancellazione): i QR della 0.1 mantengono slug e destinazione e ogni cliente ritrova i suoi QR nella sua prima azienda. Procedere comunque con il backup.

1. **Backup** del database ([VPS.md](VPS.md#backup-e-restore-del-database)) e copia del file fuori dal VPS. Annotare la reference attuale dello stack (es. `refs/heads/vorya-qr-v0.1` o il commit di `main`).
2. In CloudPanel alzare il limite degli upload (file fino a 50 MB): vedere [VPS.md](VPS.md#upload-dei-file-02).
3. In Portainer, nello stack `vorya-qr` → **Editor**: cambiare la reference in `refs/heads/vorya-qr-v0.2` (o `main` dopo il merge). Facoltativo: aggiungere `SAFE_BROWSING_API_KEY`.
4. **Update the stack** con **Re-pull image and redeploy**. Ordine atteso: `migrate` applica `0002`–`0007` ed esce con 0; partono `backend` e il nuovo `worker`; vengono creati i volumi `uploads_data` e `geoip_data`.
5. Controllare: `curl --fail http://127.0.0.1:3201/api/health` (la porta impostata in `VORYA_QR_HTTP_PORT`) deve rispondere `"version":"0.2.0"`, e un QR dinamico stampato con la 0.1 deve aprire la stessa destinazione di prima.
6. Scaricare il database dei luoghi (DB-IP Lite, aggiornato ogni mese) dalla console del container `backend`:

   ```bash
   python -m app.cli download-geoip
   ```

   Poi riavviare il container `backend`. Senza questo file le statistiche funzionano lo stesso, solo senza paesi e città. Il file non va mai committato.
7. Eseguire le sezioni 0.2 di [docs/VALIDATION.md](../docs/VALIDATION.md).

### Rollback a 0.1

Le migrazioni 0.2 sono additive, ma il codice 0.1 non conosce le aziende né le pagine ospitate: per tornare indietro si ripristina il backup.

1. Fermare `frontend`, `backend` e `worker`.
2. Ripristinare il dump fatto al punto 1 ([VPS.md](VPS.md#restore)).
3. Nello stack rimettere la reference annotata (0.1) e fare **Update the stack**. `migrate` della 0.1 trova lo schema `0001` del dump e non fa nulla.
4. I volumi `uploads_data` e `geoip_data` possono restare: la 0.1 li ignora. QR, pagine e file creati dopo l'aggiornamento vanno persi con il rollback.

## Aggiornare da 0.2 a 0.3

La 0.3 aggiunge solo tabelle e colonne (migrazioni `0008`–`0013`, nessuna cancellazione): **tutti i QR e i link esistenti continuano ad aprire la stessa destinazione** e `/r/{slug}` non cambia. Gli account la cui prova era già scaduta con la 0.2 ricevono una nuova finestra di 30 giorni di redirect (non vengono spenti al deploy).

1. **Backup** del database ([VPS.md](VPS.md#backup-e-restore-del-database)) e del volume dei file. Annotare la reference attuale (es. `refs/heads/vorya-qr-v0.2`).
2. In Portainer, nello stack `vorya-qr` → **Editor**: reference `refs/heads/vorya-qr-v0.3` (o `main` dopo il merge). I pagamenti sono facoltativi: senza `STRIPE_*` tutto il resto funziona.
3. **Update the stack** con **Re-pull image and redeploy**. Ordine atteso: `migrate` applica `0008`–`0013` ed esce con 0; ripartono `backend`, `worker` e `frontend`.
4. Controllare: `curl --fail http://127.0.0.1:3200/api/health` deve rispondere `"version":"0.3.0"`, e un QR stampato con la 0.2 deve aprire la stessa destinazione di prima.
5. Eseguire le sezioni 0.3 di [docs/VALIDATION.md](../docs/VALIDATION.md).

### Configurare il webhook Stripe

Stripe invia gli eventi (abbonamenti, pagamenti) a un endpoint pubblico dell'app.

1. In Stripe → **Developers → Webhooks → Add endpoint**: URL `https://qr.vorya.it/api/public/stripe-webhook` (passa dal frontend e dal reverse proxy di CloudPanel, nessuna regola aggiuntiva).
2. Eventi da selezionare: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.
3. Copiare il **Signing secret** in `STRIPE_WEBHOOK_SECRET` (Environment variables dello stack) insieme a `STRIPE_SECRET_KEY`, poi **Update the stack**. Usare chiavi e webhook **di test** finché non si è pronti: chiavi di test e segreto di test vanno insieme; le chiavi `live` sono rifiutate se `STRIPE_LIVE_ALLOWED` non è `true`.
4. In Stripe creare i prodotti **di Vorya QR** (separati da quelli di Vorya Sign, stesso account) con i prezzi ricorrenti mensili e annuali di Start, Pro e Plus. In **Admin → Pagamenti** incollare i relativi ID `price_…` nel piano e nel ciclo giusti: importo e intervallo vengono letti da Stripe.
5. Verifica: in Stripe → Webhooks → **Send test event**, risposta attesa `200`. Dopo un acquisto di prova (carta `4242 4242 4242 4242`) gli eventi devono risultare consegnati.
6. Per il portale clienti (metodo di pagamento, ricevute): attivarlo in Stripe → **Settings → Billing → Customer portal**.

### Rollback a 0.2

Le migrazioni 0.3 sono additive, ma il codice 0.2 non conosce link brevi, alias, versioni né pagamenti: per tornare indietro si ripristina il backup.

1. Fermare `frontend`, `backend` e `worker`.
2. Ripristinare il dump fatto al punto 1 ([VPS.md](VPS.md#restore)).
3. Nello stack rimettere la reference annotata (0.2) e fare **Update the stack**.
4. Link brevi, alias, versioni, importazioni e abbonamenti creati dopo l'aggiornamento vanno persi con il rollback: **gli abbonamenti Stripe restano attivi** e vanno gestiti (o annullati) dal dashboard di Stripe. Per disattivare solo i pagamenti basta svuotare `STRIPE_SECRET_KEY` e fare **Update the stack**, senza tornare indietro di versione.

## Aggiornare lo stack

1. Fare un backup del database ([VPS.md](VPS.md#backup-e-restore-del-database)) e, dalla 0.2, del volume dei file.
2. In Portainer: **Pull and redeploy** sullo stack. `migrate` riparte, applica le nuove migrazioni ed esce; poi ripartono backend e frontend.
3. Non eliminare il volume `postgres_data` e non rinominare lo stack: un nome diverso crea un volume nuovo e vuoto.

## Errore "port is already allocated"

Se il deploy fallisce con `Bind for 127.0.0.1:3200 failed: port is already allocated`, un altro processo usa già la porta. Dal VPS:

```bash
sudo ss -ltnp 'sport = :3200'
```

```bash
docker ps -a --format '{{.Names}}\t{{.Ports}}' | grep 3200
```

Se è un container rimasto da un tentativo precedente, eliminarlo; altrimenti impostare `VORYA_QR_HTTP_PORT` su una porta libera (es. `3201`), rifare il deploy e usare la stessa porta nel Reverse Proxy URL di CloudPanel.

## Note

- Il database è solo sulla rete interna `data`: nessuna porta è pubblicata sull'host.
- La porta 3200 è legata al loopback: dall'esterno si passa solo dal dominio HTTPS di CloudPanel.
- Vorya Sign usa `127.0.0.1:3100`: i due stack convivono sullo stesso host senza conflitti.
