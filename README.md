# My Vinyl Collection – prototipo v1

Questa è la prima base funzionante dell'interfaccia: catalogo locale, ricerca, ordinamento, inserimento/modifica/eliminazione, copertine tramite URL o caricamento dal dispositivo, importazione CSV ed esportazione CSV apribile con Excel.

## Importante: stato della sincronizzazione
La versione consegnata **non è ancora collegata a Google Sheets**. Il campo URL nelle impostazioni è predisposto per la fase successiva, ma non effettua ancora letture/scritture remote. I dati di prova restano nel browser/dispositivo tramite localStorage. Non inserire ancora l'intera collezione prima di aver configurato e testato il backup/sync.

## Avvio rapido
Per provare l'app sul computer:
1. Estrai la cartella `app`.
2. Avvia un server statico locale dalla cartella, ad esempio `python -m http.server 8000`.
3. Apri `http://localhost:8000`.
   - Per l'installazione PWA e il service worker serve HTTPS oppure localhost.
4. Su Android, una volta pubblicata su un hosting HTTPS, apri l'indirizzo con Chrome e scegli "Aggiungi a schermata Home" / "Installa app".

## Struttura dati prevista per Google Sheets
Foglio `Vinili`, intestazioni:
`ID | Artista | Anno | Album | Genere | Etichetta | Info | Copertina | Data aggiunta | Data modifica`

Ogni riga rappresenta una copia fisica. Due copie dello stesso album hanno due ID distinti.

## Backend Google Apps Script
La cartella `google_apps_script` contiene uno script iniziale che crea/usa il foglio `Vinili`. La sincronizzazione browser→Apps Script va completata e testata nella prossima fase, tenendo conto di autenticazione, accesso e gestione sicura delle immagini. Non pubblicare il servizio con accesso anonimo senza prima aver definito un'autenticazione adeguata.

## Prossima fase
1. Preparare Google Sheet.
2. Importare le circa 60 righe esistenti.
3. Collegare app e Sheet con un endpoint Apps Script.
4. Implementare backup e sincronizzazione bidirezionale.
5. Spostare le copertine caricate in Google Drive (non nel foglio).
