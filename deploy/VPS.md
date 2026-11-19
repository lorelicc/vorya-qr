# Vorya QR 0.1: VPS, CloudPanel e backup

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

Risposta attesa: `{"status":"ok","database":"connected","version":"0.1.0"}`. La porta 3200 non va aperta nel firewall: è solo su loopback.

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
docker stop vorya-qr-frontend-1 vorya-qr-backend-1
```

```bash
docker exec -i vorya-qr-db-1 sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' < vorya-qr-AAAAMMGG-HHMM.dump
```

```bash
docker start vorya-qr-backend-1 vorya-qr-frontend-1
```

Se il backup è di una versione precedente, fare **Pull and redeploy** dello stack in Portainer: il servizio `migrate` porta lo schema all'ultima versione.

### Frequenza consigliata

- **Ogni giorno**, automatico con cron, conservando almeno gli ultimi 14 giorni. Le scansioni dei QR dinamici arrivano continuamente, quindi un backup al giorno limita la perdita a meno di 24 ore di statistiche.
- **Sempre prima di ogni aggiornamento** dello stack o di un restore.
- **Una prova di restore al mese** su un database di prova: un backup mai ripristinato non è verificato.

Esempio di riga cron (utente con accesso a Docker; adattare il percorso):

```bash
15 3 * * * docker exec vorya-qr-db-1 sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > /root/backups/vorya-qr-$(date +\%Y\%m\%d).dump && find /root/backups -name 'vorya-qr-*.dump' -mtime +14 -delete
```
