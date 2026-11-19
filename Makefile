SHELL := /bin/bash
include $(wildcard .env)
export
.PHONY: init install db dbs migrate backend frontend admin lint test e2e build up down

init:          ## Crea .env con una password locale casuale
	python3 scripts/init-env.py

install:       ## Dipendenze backend (venv) e frontend
	python3 -m venv backend/.venv
	backend/.venv/bin/pip install -r backend/requirements-dev.txt
	cd frontend && npm ci

db:            ## Avvia solo PostgreSQL (porta 5433)
	docker compose up -d db

dbs: db        ## Crea i database dedicati a test ed e2e
	-docker compose exec -T db createdb -U $(POSTGRES_USER) $(POSTGRES_DB)_test
	-docker compose exec -T db createdb -U $(POSTGRES_USER) $(POSTGRES_DB)_e2e

migrate:       ## Applica le migrazioni al database di sviluppo
	cd backend && .venv/bin/python -m app.migrate

backend:       ## API FastAPI con reload (OpenAPI su /api/docs)
	cd backend && .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

frontend:      ## Next.js in sviluppo su http://localhost:3000
	cd frontend && npm run dev

admin:         ## Crea un super_admin: make admin EMAIL=... NAME="..."
	cd backend && .venv/bin/python -m app.cli create-super-admin --email "$(EMAIL)" --name "$(NAME)"

lint:          ## ruff + ESLint + Prettier + typecheck
	cd backend && .venv/bin/ruff check . && .venv/bin/ruff format --check .
	cd frontend && npm run lint && npm run format:check && npm run typecheck

test:          ## pytest (richiede TEST_DATABASE_URL) + Vitest
	cd backend && .venv/bin/python -m pytest
	cd frontend && npm test

e2e: build     ## Playwright sullo stack reale (richiede E2E_DATABASE_URL)
	cd frontend && PYTHON=../backend/.venv/bin/python npm run test:e2e

build:         ## Build di produzione Next.js
	cd frontend && npm run build

up:            ## Stack completo in Docker su http://localhost:3000
	docker compose up -d --build

down:
	docker compose down
