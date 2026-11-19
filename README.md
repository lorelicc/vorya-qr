# Vorya QR

SaaS per creare e gestire **codici QR statici e dinamici**, su [qr.vorya.it](https://qr.vorya.it). Fa parte della famiglia **Vorya Apps** insieme a Vorya Sign, con cui condivide identità visiva, layout, autenticazione e modalità di deploy.

- **QR statici**: l'URL è scritto direttamente nel codice.
- **QR dinamici**: il codice punta a `https://qr.vorya.it/r/{slug}`. La destinazione si cambia in qualsiasi momento, si può mettere in pausa e ogni scansione viene contata (senza IP né geolocalizzazione).
- Export PNG e SVG con colori, margine e correzione d'errore personalizzabili, anteprima live e avviso se il contrasto non basta per la scansione.
- Prova gratuita di 14 giorni con i limiti del piano Pro. Il piano si assegna dall'area admin (nessun pagamento online nella 0.1).

Versione: **0.1.0**. Funzionalità e scelte architetturali: [docs/V01.md](docs/V01.md).

## Stack

| Livello | Tecnologia |
| --- | --- |
| Frontend / BFF | Next.js 16 (App Router, output standalone), React 19, TypeScript, CSS Modules con i token Vorya |
| API | FastAPI su Python 3.12, SQLAlchemy 2, Pydantic 2 |
| Database | PostgreSQL 17, migrazioni Alembic in un servizio one-shot |
| QR | `segno` (PNG e SVG lato server) |
| Analytics | `ua-parser` sullo user-agent: dispositivo, sistema operativo, browser, bot |
| Test | pytest, Vitest + Testing Library, Playwright |
| Qualità | ruff, ESLint, Prettier, GitHub Actions |
| Deploy | Docker, stack Git in Portainer, CloudPanel come reverse proxy |

Il browser parla solo con Next.js: `/api/*` è un proxy con allowlist esplicita verso FastAPI e `/r/{slug}` inoltra il redirect deciso dal backend. Il database non è mai esposto.

## Struttura

```
backend/    FastAPI: app/ (core, auth, qr, redirect, stats, admin, mail), migrations/, tests/
frontend/   Next.js: app/ (route), components/ (ui, layout, auth, qr, stats, admin), lib/, styles/, tests/, e2e/
deploy/     compose.portainer.yaml, .env.example, PORTAINER.md, VPS.md
docs/       V01.md, VALIDATION.md
```

## Avvio locale

Requisiti: Python 3.12+, Node.js 24 (minimo 20.9), Docker (per PostgreSQL).

```bash
make init
```

```bash
make install
```

```bash
make dbs
```

```bash
make migrate
```

```bash
make admin EMAIL=admin@example.com NAME="Admin"
```

Poi, in due terminali separati:

```bash
make backend
```

```bash
make frontend
```

Apri http://localhost:3000. In sviluppo le email (verifica e reset) non vengono spedite: con `MAIL_TRANSPORT=file` finiscono come file JSON in `backend/.mail-outbox/`, con il link da aprire. La documentazione OpenAPI è attiva solo con `APP_ENV=development`, su http://127.0.0.1:8000/api/docs.

In alternativa, tutto lo stack in Docker su http://localhost:3000:

```bash
make up
```

## Comandi

| Comando | Cosa fa |
| --- | --- |
| `make lint` | ruff (check + format), ESLint, Prettier, typecheck TypeScript |
| `make test` | pytest (richiede `TEST_DATABASE_URL`, database che termina con `_test`) e Vitest |
| `make e2e` | build Next.js + Playwright sullo stack reale (richiede `E2E_DATABASE_URL`) |
| `make build` | build di produzione del frontend |
| `make up` / `make down` | stack Docker locale |
| `make admin EMAIL=… NAME=…` | crea un super admin |

Gli script npm (`frontend/`): `dev`, `build`, `start`, `lint`, `typecheck`, `format`, `format:check`, `test`, `test:e2e`.

## Deploy

Stack Git in Portainer con `deploy/compose.portainer.yaml`, frontend su `127.0.0.1:3200` e sito Reverse Proxy di CloudPanel con Let's Encrypt. Le guide passo passo sono [deploy/PORTAINER.md](deploy/PORTAINER.md) e [deploy/VPS.md](deploy/VPS.md), compresi backup e restore. Dopo il deploy: [docs/VALIDATION.md](docs/VALIDATION.md).
