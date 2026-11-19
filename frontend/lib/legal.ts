/**
 * PLACEHOLDER legal texts. They must be completed and reviewed by the owner before launch.
 * The sections on scan analytics describe what the code actually does.
 */
export type LegalDocument = {
  title: string;
  updated: string;
  sections: { heading: string; body: string[] }[];
};

const TODO = "DA COMPLETARE: testo da redigere e far verificare prima della pubblicazione.";

export const LEGAL: Record<string, LegalDocument> = {
  termini: {
    title: "Termini di servizio",
    updated: "Bozza 0.2",
    sections: [
      {
        heading: "Oggetto del servizio",
        body: ["Vorya QR consente di creare e gestire codici QR statici e dinamici.", TODO],
      },
      {
        heading: "Prova gratuita e piani",
        body: [
          "La prova dura 14 giorni con i limiti del piano Pro. Al termine il piano viene attivato su richiesta.",
          "Allo scadere della prova i QR dinamici continuano a reindirizzare; l’area di gestione resta bloccata finché non viene attivato un piano.",
          TODO,
        ],
      },
      {
        heading: "Uso consentito",
        body: ["È vietato usare i QR per contenuti illeciti, phishing o malware.", TODO],
      },
      {
        heading: "Contenuti caricati",
        body: [
          "Immagini, PDF e audio caricati restano del cliente, che garantisce di avere i diritti per pubblicarli nelle pagine dei QR. I file eliminati vengono cancellati definitivamente dopo 30 giorni.",
          TODO,
        ],
      },
      {
        heading: "Segnalazione di abusi",
        body: [
          "Chiunque può segnalare un QR sospetto dalla pagina /report. Il team può bloccare il QR o sospendere l’account; le destinazioni vengono verificate con una lista di domini bloccati e, se configurato, con Google Safe Browsing.",
          TODO,
        ],
      },
      {
        heading: "Trasferimento di aziende",
        body: [
          "Un’azienda può essere trasferita a un altro account Vorya QR verificato, che deve accettare entro 7 giorni. Con l’accettazione passano QR, file e statistiche e il mittente perde l’accesso; i QR continuano a funzionare.",
          TODO,
        ],
      },
    ],
  },
  privacy: {
    title: "Informativa privacy",
    updated: "Bozza 0.2",
    sections: [
      { heading: "Titolare del trattamento", body: [TODO] },
      {
        heading: "Dati dell’account",
        body: [
          "Nome, email, nome dell’azienda e password (conservata solo come hash Argon2id).",
          TODO,
        ],
      },
      {
        heading: "Scansioni dei QR dinamici",
        body: [
          "Per ogni scansione registriamo data e ora, tipo di dispositivo, sistema operativo e browser ricavati dallo user-agent, il dominio di provenienza (se presente) e se la richiesta proviene da un bot.",
          "Dalla 0.2 registriamo anche paese e città approssimativi, ricavati dall’indirizzo IP con il database DB-IP Lite (licenza CC BY 4.0, attribuzione nella pagina delle statistiche). L’indirizzo IP non viene mai salvato.",
          "Per stimare i visitatori unici di ogni giorno calcoliamo un hash dell’IP e dello user-agent con una chiave casuale che viene distrutta il giorno dopo: dopo la cancellazione l’hash non è più collegabile né all’IP né alle visite degli altri giorni.",
          "I clic sui pulsanti delle pagine ospitate sono contati in forma aggregata, senza alcun identificativo del visitatore. Le statistiche sono conservate per il periodo previsto dal piano.",
          TODO,
        ],
      },
      { heading: "Conservazione e diritti", body: [TODO] },
    ],
  },
  cookie: {
    title: "Cookie",
    updated: "Bozza 0.2",
    sections: [
      {
        heading: "Cookie tecnici",
        body: [
          "vorya_qr_session: cookie di sessione HttpOnly, necessario per l’accesso.",
          "vorya_qr_csrf: protezione delle richieste contro attacchi CSRF.",
          "Non usiamo cookie di profilazione né strumenti di analisi di terze parti.",
        ],
      },
    ],
  },
};
