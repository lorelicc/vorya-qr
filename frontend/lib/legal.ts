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
    updated: "Bozza 0.1",
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
    ],
  },
  privacy: {
    title: "Informativa privacy",
    updated: "Bozza 0.1",
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
          "Non registriamo l’indirizzo IP né dati di geolocalizzazione. Per questo le statistiche mostrano il numero di scansioni, non di persone.",
        ],
      },
      { heading: "Conservazione e diritti", body: [TODO] },
    ],
  },
  cookie: {
    title: "Cookie",
    updated: "Bozza 0.1",
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
