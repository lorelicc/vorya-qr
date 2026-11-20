# Vorya QR 0.5: VPS, CloudPanel e backup

Percorso previsto: **stack Portainer sul Docker del VPS → sito Reverse Proxy di CloudPanel sullo stesso VPS → HTTPS con Let's Encrypt**. Lo stack si crea seguendo [PORTAINER.md](PORTAINER.md).

## 1. DNS

Creare un record per `qr.vorya.it` verso l'IP pubblico del VPS (record `A`, e `AAAA` se il VPS ha IPv6) e attendere la propagazione:

```bash
dig +short qr.vorya.it
```

## 2. Verifica dello stack dal VPS

Da SSH, sul VPS:

```bash
curl --fail http://127.0.0.1:3200/api/health
```

Risposta attesa: `{"status":"ok","database":"connected","version":"0.5.0"}`. La porta 3200 (o quella impostata in `VORYA_QR_HTTP_PORT`) non va aperta nel firewall: è solo su loopback.

## 3. Sito Reverse Proxy in CloudPanel

1. In CloudPanel: **Sites → Add Site → Create a Reverse Proxy**.
2. **Domain Name**: `qr.vorya.it`.
3. **Reverse Proxy URL**: `http://127.0.0.1:3200`.
4. Creare il sito. Non creare un'applicazione Node.js separata: Next.js gira già nel container.
5. Con il DNS propagato, in **SSL/TLS → Actions → New Let's Encrypt Certificate** emettere il certificato per `qr.vorya.it`.
6. Attivare il redirect HTTP → HTTPS se CloudPanel non lo fa in automatico.
7. Lasciare invariati gli header standard del vhost di CloudPanel (`Host`, `X-Forwarded-For`, `X-Forwarded-Proto`): l'app li usa per riconoscere l'origine HTTPS e per il rate limit. Non serve Basic Auth: Vorya QR ha il suo login.

Verifica dall'esterno:

```bash
curl -sI https://qr.vorya.it/login
```

```bash
curl -sI https://qr.vorya.it/r/abcdefg
```

Il primo deve rispondere `200`. Il secondo deve rispondere `404` con `cache-control: no-store`: è la pagina "QR non attivo" per un link inesistente.

> I link brevi `/r/{slug}` passano dallo stesso sito: non aggiungere cache di CloudPanel (Varnish o simili) sul percorso `/r/`, altrimenti i cambi di destinazione e la pausa non avrebbero effetto immediato. L'app invia sempre `Cache-Control: no-store`.

## Link brevi e webhook Stripe (0.3)

- I link brevi `/{slug}` (alla radice) e `/r/{slug}` passano dallo stesso sito: nessuna regola aggiuntiva e, come sopra, **nessuna cache** di CloudPanel su questi percorsi.
- Il webhook di Stripe (`/api/public/stripe-webhook`) deve essere raggiungibile da Internet: non metterlo dietro Basic Auth, IP allowlist o cache. La sicurezza è la firma verificata dall'app. Configurazione completa in [PORTAINER.md](PORTAINER.md#configurare-il-webhook-stripe).
- L'importazione CSV carica file di poche centinaia di KB: bastano i 60 MB già impostati per gli upload.

## Upload dei file (0.2)

Dalla 0.2 si caricano immagini, PDF e audio (fino a 50 MB per file nel piano Plus). Nginx di CloudPanel accetta di default corpi più piccoli: in **Sites → qr.vorya.it → Vhost** aggiungere dentro il blocco `server { ... }` (quello in ascolto su 443):

```nginx
client_max_body_size 60m;
```

Salvare: CloudPanel ricarica Nginx. Senza questa riga gli upload grandi falliscono con errore 413 prima di arrivare all'app. Non serve altro: le risposte di `/f/` supportano già le richieste parziali (Range) usate dai lettori audio e PDF di iPhone.

## Database dei luoghi (0.2)

Le statistiche mostrano paese e città approssimativi grazie a DB-IP Lite City (licenza CC BY 4.0; l'attribuzione compare nella pagina delle statistiche). Il file sta nel volume `geoip_data` e si aggiorna una volta al mese dalla console del container `backend`:

```bash
python -m app.cli download-geoip
```

Poi riavviare `backend`. Da SSH, per una riga cron mensile:

```bash
20 4 3 * * docker exec vorya-qr-backend-1 python -m app.cli download-geoip && docker restart vorya-qr-backend-1
```

## Backup e restore del database

I comandi vanno eseguiti via SSH sul VPS, dalla cartella in cui si vuole salvare il file. Il nome del container segue il nome dello stack (`vorya-qr`); verificarlo con:

```bash
docker ps --filter name=vorya-qr --format '{{.Names}}'
```

### Backup

Dump in formato custom (compresso, adatto a `pg_restore`), eseguito dal container `db`:

```bash
docker exec vorya-qr-db-1 sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > vorya-qr-$(date +%Y%m%d-%H%M).dump
```

Controllo che il file sia leggibile:

```bash
docker exec -i vorya-qr-db-1 pg_restore --list < vorya-qr-AAAAMMGG-HHMM.dump | head
```

Copiare poi il file **fuori dal VPS** (storage esterno o un altro server): un backup che resta solo sul disco del VPS non protegge da un guasto del VPS.

### Restore

Il restore sovrascrive i dati attuali. Fermare prima backend e frontend, così nessuno scrive durante l'operazione:

```bash
docker stop vorya-qr-frontend-1 vorya-qr-backend-1 vorya-qr-worker-1
```

```bash
docker exec -i vorya-qr-db-1 sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' < vorya-qr-AAAAMMGG-HHMM.dump
```

```bash
docker start vorya-qr-backend-1 vorya-qr-worker-1 vorya-qr-frontend-1
```

Se il backup è di una versione precedente, fare **Pull and redeploy** dello stack in Portainer: il servizio `migrate` porta lo schema all'ultima versione.

### Backup dei file caricati (0.2)

Con `STORAGE_DRIVER=local` i file sono nel volume `uploads_data`. Archivio compresso, eseguito da un container temporaneo che legge il volume:

```bash
docker run --rm -v vorya-qr_uploads_data:/data:ro -v "$PWD":/backup alpine tar czf /backup/vorya-qr-uploads-$(date +%Y%m%d).tgz -C /data .
```

Restore (con `backend` e `worker` fermi):

```bash
docker run --rm -v vorya-qr_uploads_data:/data -v "$PWD":/backup alpine sh -c 'rm -rf /data/* && tar xzf /backup/vorya-qr-uploads-AAAAMMGG.tgz -C /data'
```

Fare database e file nello stesso momento: il database contiene l'elenco dei file, il volume i loro byte. Il nome del volume dipende dal nome dello stack: verificarlo con `docker volume ls | grep vorya-qr`.

### Frequenza consigliata

- **Ogni giorno**, automatico con cron, conservando almeno gli ultimi 14 giorni. Le scansioni dei QR dinamici arrivano continuamente, quindi un backup al giorno limita la perdita a meno di 24 ore di statistiche.
- **Sempre prima di ogni aggiornamento** dello stack o di un restore.
- **Una prova di restore al mese** su un database di prova: un backup mai ripristinato non è verificato.

Esempio di riga cron (utente con accesso a Docker; adattare il percorso):

```bash
15 3 * * * docker exec vorya-qr-db-1 sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > /root/backups/vorya-qr-$(date +\%Y\%m\%d).dump && find /root/backups -name 'vorya-qr-*.dump' -mtime +14 -delete
```

## Backup automatici (0.5)

Il servizio `backup` (profilo `backup`, `COMPOSE_PROFILES=backup`) salva ogni giorno alle 03:15 (`BACKUP_CRON`) il dump del database dell'app (e di Umami/GlitchTip con `BACKUP_EXTRA_DATABASES`) più il volume dei file, **cifrati da restic** e inviati a uno storage S3 compatibile **fuori dal VPS** (es. OVH Object Storage).

- Variabili: `RESTIC_REPOSITORY` (es. `s3:https://s3.gra.io.cloud.ovh.net/vorya-backup`), `RESTIC_PASSWORD` (**conservarla fuori dal VPS: senza non si recupera nulla**), `BACKUP_S3_ACCESS_KEY`, `BACKUP_S3_SECRET_KEY`.
- Ritenzione: 7 giornalieri, 4 settimanali, 6 mensili. Ogni domenica `restic check` su un campione del 5%.
- `BACKUP_PING_URL` (facoltativo): URL di un servizio tipo Healthchecks chiamato a ogni backup riuscito, per essere avvisati se **non** parte.
- Backup su richiesta: `docker compose exec backup backup.sh`.

### Restore da restic

```bash
docker compose exec backup restore.sh latest
```

Il contenuto finisce in `/restore` nel container `backup` (sola lettura sul database vivo: non lo tocca). Poi seguire il restore del dump come sopra, copiando il file `vorya_qr.dump` fuori dal container.

### Test di restore mensile

```bash
docker compose exec backup restore-test.sh
```

Ripristina l'ultimo dump in un database temporaneo, conta tabelle e utenti, lo elimina. Segnare la data nel calendario: **un backup mai provato non è un backup**.

## Email: SPF, DKIM, DMARC (0.5)

Report, email di attivazione e fatture partono da `SMTP_FROM_EMAIL`. Per non finire in spam, sul DNS del dominio mittente:

| Record | Valore (esempio, adattare al provider SMTP) |
|---|---|
| SPF (TXT su `vorya.it`) | `v=spf1 include:<provider-smtp> -all` |
| DKIM (TXT `<selettore>._domainkey`) | chiave pubblica fornita dal provider SMTP |
| DMARC (TXT `_dmarc`) | `v=DMARC1; p=none; rua=mailto:dmarc@vorya.it` → dopo 2–4 settimane di report puliti passare a `p=quarantine` |

All'avvio il backend prova la connessione SMTP e scrive l'esito nei log (`app.mail.check`). Verificare con un invio di prova a Gmail e controllare in «Mostra originale» `SPF: PASS`, `DKIM: PASS`, `DMARC: PASS`.

## Monitoraggio esterno (0.5)

- Servizio esterno (UptimeRobot, Better Stack…) su `https://qr.vorya.it/api/health` ogni minuto, e su un QR di prova `https://qr.vorya.it/r/<slug>` (atteso 302).
- `/api/health/detail` con header `X-Health-Token: $HEALTH_TOKEN` mostra database, storage, SMTP e heartbeat del worker (allarme se il worker non risponde da più di 10 minuti).
- Errori applicativi: GlitchTip (`errors`). Visite: Umami (`analytics`).

