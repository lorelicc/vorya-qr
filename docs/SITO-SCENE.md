# Sito commerciale: scene animate e sezioni a colori

Rifacimento del sito pubblico (`(marketing)`) sulla base della 0.5. **L'app non è stata toccata**: solo
`frontend/app/(marketing)`, `frontend/components/site`, `frontend/content/site`.

## Le «scene» (piccoli video in codice)

Sette animazioni di prodotto fatte di HTML/CSS, non di file video: pochi KB ciascuna, nitide su ogni schermo,
testo leggibile dai motori di ricerca, modificabili senza rigirare un video.

| Scena | Dove | Cosa mostra |
|---|---|---|
| `HeroScene` | home, funzionalità «QR dinamici», eventi/negozi | Stampi il QR una volta, cambi la destinazione dalla dashboard, la stessa scansione apre la pagina nuova |
| `LinkScene` | home (passo 1), `/link-brevi`, import | URL lunghissimo → link breve → copiato → condiviso → click che salgono |
| `DesignScene` | home (passo 2), pagine dei tipi di QR | Colori, forma dei moduli, logo e controllo «Scansionabile» |
| `StatsScene` | home (passo 3), statistiche, agenzie | Scansioni per giorno, città, dispositivo; «nessun IP salvato» |
| `MenuScene` | home (settori), ristoranti, cantine, menu | Cambi un prezzo e il menu sul telefono si aggiorna |
| `GuaranteeScene` | home | L'abbonamento finisce, il QR continua a funzionare |
| `ReportScene` | home, immobiliare | Il report arriva da solo via email, con disiscrizione |

Codice in `components/site/scenes/`: `Scene.tsx` (cornice), `product.tsx` e `story.tsx` (le scene),
`scenes.module.css` (animazioni), `for.tsx` (quale scena illustra quale pagina).

### Regole che le tengono leggere e accessibili
- Il fotogramma finale è lo stile di base; le animazioni aggiungono solo il percorso per arrivarci. Con
  «riduci movimento», senza JavaScript, o prima che la scena sia entrata nello schermo si vede un'immagine completa.
- Partono solo quando sono visibili (IntersectionObserver) e si fermano fuori schermo.
- Pulsante play/pausa su ogni scena (WCAG 2.2.2). Si animano solo `transform`, `opacity` e una variabile CSS.
- Ogni scena ha `aria-label` descrittivo e didascalia «dati di esempio»: **le cifre mostrate sono illustrative**,
  non dati reali, e lo dichiarano.
- Scalano con la larghezza del riquadro (`container-type` + `cqw`): stesso aspetto da telefono a desktop.

## Home

Hero con la scena e il generatore a schede · fascia dei messaggi chiave (verde scuro) · «Come funziona»
a scorrimento (scena fissa a destra che cambia, su telefono una scena per passo) · funzionalità (lilla) ·
settori con la scena del menu (giallo) · garanzia «QR sempre attivi» (verde scuro) · report automatici (pesca) ·
prezzi · FAQ (menta) · invito finale (verde scuro). Testi in `content/site/home.json`.

`Section` accetta i toni `soft | mint | forest | sun | lilac | peach`; anche le landing interne alternano i colori.
Il mega-menu mostra una riga di descrizione sotto ogni voce di Prodotto e Soluzioni.
