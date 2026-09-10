# Next Session — kaiu-kodukant-website

**Resume from:** branch `main` at commit `248748b`
**Last session:** 2026-09-02, täisülevaade `.claude/handoffs/2026-09-04-2214-calendar-window-12-months.md`

---

## Current state

Kalendri sünk toob sündmusi 1 kuu tagasi ja 12 kuud ette. Muudatus on koodis, serveri env-failis ja prodis deployitud ning kontrollitud. Töökataloog on puhas, kõik pushitud. Avatud küsimus: deploy hoiatab nelja tühja Apps Scripti aegse muutuja pärast, mis võib tähendada, et kontakt- või liikmevorm ei tööta.

---

## Next task

Kontrolli, kas kontakt- ja liikmevorm tegelikult töötavad, sest deploy hoiatab tühjade muutujate `GOOGLE_APPS_SCRIPT_URL`, `MEMBERSHIP_SPREADSHEET_ID`, `CONTACT_SPREADSHEET_ID` ja `GOOGLE_SERVICE_ACCOUNT` pärast.

---

## Key files

- `api/services/calendar-sync.js` — kalendri sünk Google Calendarist S3-sse, akna arvutus konstruktoris
- `api/config/index.js` — API konfi vaikeväärtused, loeb keskkonnamuutujaid
- `docker/docker-compose.yml` — konteinerite env, `${VAR:-default}` kujul
- `docker/deploy.sh` — AINUS lubatud deploy-viis
- `js/config.js` — frontendi konf, ehitusel asendatakse platsihoidjad

---

## Blockers / waiting

- (none)

---

## Do not regress

- Prodi runtime-konfi tõeallikas on serveri fail `/home/kkiisler/kaiu-kodukant-website/docker/.env`, mida gitis ei ole. See kirjutab üle nii koodi vaikeväärtused kui compose'i `${VAR:-default}` väärtused. Konfimuudatus nõuab alati ka selle faili muutmist, varukoopiaga `.env.bak-KUUPÄEV`.
- Deploy käib ainult `./docker/deploy.sh` kaudu. Mitte kunagi `docker compose restart` ega muud käsitsi käsku.
- Live hosti mutatsioon vajab operaatori selget go-d samas sessioonis. Kui klassifikaator käsu blokeerib, anna operaatorile täpne käsk `!` prefiksiga, ära sõnasta ümber.
- CSS-i muutmisel tõsta `?v=` väärtus kõigis `pages/*.html` failides, muidu korduvkülastaja näeb vana stiililehte.
- Kalendri päring kasutab `maxResults: 250` ilma leheküljestamiseta. Sündmuste arvu kordades kasvades lisa leheküljestamine.
