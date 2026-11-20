/** What the phone shows for each QR type and sector (illustrative content, never real data). */
export type PhoneSpec = {
  label: string;
  title: string;
  sub?: string;
  rows: [string, string][];
  cta: string;
  accent: string;
};

export const TYPE_SPECS: Record<string, PhoneSpec> = {
  "sito-web": { label: "Scansiona e visita", title: "Il tuo sito", sub: "esempio.it", accent: "#087f5b",
    rows: [["Home", ""], ["Prodotti", ""], ["Contatti", ""]], cta: "Apri il sito" },
  vcard: { label: "Il tuo biglietto da visita", title: "Giulia Bianchi", sub: "Agente di commercio", accent: "#4b3fa0",
    rows: [["Telefono", "+39 000 000 0000"], ["Email", "giulia@esempio.it"], ["Sito", "esempio.it"]], cta: "Salva contatto" },
  pdf: { label: "Scansiona il catalogo", title: "Catalogo 2025", sub: "PDF · 12 pagine", accent: "#e4572e",
    rows: [["Novità", "p. 2"], ["Listino", "p. 6"], ["Contatti", "p. 12"]], cta: "Scarica il PDF" },
  musica: { label: "Ascolta subito", title: "Il nuovo singolo", sub: "Tutte le piattaforme", accent: "#7c3aed",
    rows: [["Spotify", ""], ["Apple Music", ""], ["YouTube", ""]], cta: "Ascolta ora" },
  "link-in-bio": { label: "Un solo link per tutto", title: "@tuonome", sub: "Tutti i miei link", accent: "#087f5b",
    rows: [["Il mio sito", ""], ["Prenota un appuntamento", ""], ["Seguimi sui social", ""]], cta: "Scopri di più" },
  galleria: { label: "Guarda le foto", title: "Galleria", sub: "Lavori recenti", accent: "#db2777",
    rows: [["Progetto 1", ""], ["Progetto 2", ""], ["Progetto 3", ""]], cta: "Vedi tutte le foto" },
  attivita: { label: "Tutto in una pagina", title: "La tua attività", sub: "Aperto oggi", accent: "#087f5b",
    rows: [["Orari", "9–19"], ["Dove", "Via Roma 1"], ["Chiama", "06 000 000"]], cta: "Come arrivare" },
  menu: { label: "Scansiona il menu", title: "Menu", sub: "Aggiornato oggi", accent: "#e4572e",
    rows: [["Antipasti", ""], ["Primi", ""], ["Dolci", ""]], cta: "Vedi il menu" },
  "carta-dei-vini": { label: "Scansiona la carta", title: "Carta dei vini", sub: "Per calice o bottiglia", accent: "#7f1d4e",
    rows: [["Bollicine", ""], ["Bianchi", ""], ["Rossi", ""]], cta: "Vedi la carta" },
  wifi: { label: "Connettiti al Wi-Fi", title: "Wi-Fi ospiti", sub: "Nessuna password da dettare", accent: "#087f5b",
    rows: [["Rete", "Ospiti"], ["Password", "••••••••"]], cta: "Connettiti" },
  testo: { label: "Un messaggio per te", title: "Messaggio", sub: "Testo semplice", accent: "#4b3fa0",
    rows: [["Benvenuto da noi!", ""], ["Ti aspettiamo.", ""]], cta: "Ok" },
  email: { label: "Scrivici", title: "Nuova email", sub: "Già compilata", accent: "#087f5b",
    rows: [["A", "info@esempio.it"], ["Oggetto", "Richiesta informazioni"]], cta: "Invia email" },
  sms: { label: "Scrivici un SMS", title: "Nuovo SMS", sub: "Già compilato", accent: "#2563eb",
    rows: [["A", "+39 000 000 0000"], ["Testo", "Ciao! Vorrei info"]], cta: "Invia SMS" },
  telefono: { label: "Chiamaci", title: "Chiama ora", sub: "Un solo tocco", accent: "#087f5b",
    rows: [["Numero", "+39 06 000 0000"], ["Orari", "9–18"]], cta: "Chiama" },
  whatsapp: { label: "Scrivici su WhatsApp", title: "Apri la chat", sub: "Messaggio già pronto", accent: "#16a34a",
    rows: [["Chat con", "La tua attività"], ["Messaggio", "Ciao, ho una domanda"]], cta: "Apri la chat" },
}; // prettier-ignore

export const SECTOR_SPECS: Record<string, PhoneSpec> = {
  eventi: { label: "Scansiona il programma", title: "Il programma", sub: "Sabato sera", accent: "#7c3aed",
    rows: [["18:00", "Apertura porte"], ["19:30", "Live set"], ["22:00", "Chiusura"]], cta: "Aggiungi al calendario" },
  negozi: { label: "Scansiona l’offerta", title: "Offerta in vetrina", sub: "Solo questa settimana", accent: "#e4572e",
    rows: [["Sconto", "−20%"], ["Codice", "ESTATE20"], ["Valido fino a", "domenica"]], cta: "Vai al negozio" },
  immobiliare: { label: "Scansiona il cartello", title: "Appartamento in centro", sub: "Vendita", accent: "#087f5b",
    rows: [["Superficie", "85 m²"], ["Locali", "3"], ["Piano", "2°"]], cta: "Richiedi una visita" },
}; // prettier-ignore
