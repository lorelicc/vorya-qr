# Vorya QR 0.1: creare lo stack in Portainer

Configurazione per **Portainer CE / Docker Standalone**, con lo stesso schema di Vorya Sign: stack Git, build delle immagini sul server, CloudPanel come reverse proxy sullo stesso host. Per il sito in CloudPanel, i certificati e i backup vedere [VPS.md](VPS.md).

## Dati da inserire nella UI

| Campo | Valore |
| --- | --- |
| Ambiente | Il Docker Standalone del VPS (lo stesso host di CloudPanel) |
| Nome stack | `vorya-qr` |
| Metodo | Repository Git |
| Repository | `https://github.com/lorelicc/vorya-qr` |
| Reference | `refs/heads/main` dopo il merge della PR (oppure `refs/heads/vorya-qr-v0.1` per una prova) |
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

`DATABASE_URL`, `APP_ENV=production`, `MAIL_TRANSPORT=smtp` e `API_INTERNAL_URL` sono già fissati nel Compose. Le variabili restano in Portainer e non in GitHub: chi amministra Portainer può leggerle.

## Procedura

1. **Stacks → Add stack**, nome `vorya-qr`, metodo Repository, con repository, reference e compose path come nella tabella.
2. In **Environment variables** inserire almeno `POSTGRES_PASSWORD`, `PUBLIC_BASE_URL`, `SHORT_LINK_BASE_URL`, `SMTP_USER` e `SMTP_PASSWORD`.
3. **Deploy the stack**. Al primo avvio Portainer scarica le immagini base e compila backend e frontend (servono Docker Hub, PyPI e npm). Può richiedere qualche minuto.
4. Nel dettaglio dello stack controllare i servizi:
   - `db`: **healthy**;
   - `migrate`: **exited (0)**. È un servizio *one-shot*: applica le migrazioni Alembic e termina. Uno stato "exited" con codice 0 è corretto. Se termina con errore, il backend non parte: leggere i log di `migrate`;
   - `backend`: **healthy**;
   - `frontend`: **healthy**, pubblicato solo su `127.0.0.1:3200`.
5. Creare il primo super admin dalla console del container `backend` (**Containers → vorya-qr-backend-1 → Console → /bin/sh**):

   ```bash
   python -m app.cli create-super-admin --email tuo@indirizzo.it --name "Nome Cognome"
   ```

   La password viene chiesta due volte e non compare nei log. Per un amministratore in sola lettura aggiungere `--role platform_admin`.
6. Configurare il sito in CloudPanel verso `http://127.0.0.1:3200` con Let's Encrypt: vedere [VPS.md](VPS.md).
7. Eseguire la checklist di [docs/VALIDATION.md](../docs/VALIDATION.md).

## Aggiornare lo stack

1. Fare un backup del database ([VPS.md](VPS.md#backup-e-restore-del-database)).
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
