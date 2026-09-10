# Handoff: calendar-window-12-months

**Date:** 2026-09-04 22:14 (töö tehti 2026-09-02, handoff kirjutatud hiljem)
**Branch:** main
**Last commit:** `248748b` Extend calendar sync window to 12 months ahead
**Pre-flight verdict:** END_NOW

---

## What shipped this session

- Kalendri sünkimise aken tõsteti 6 kuult 12 kuule ette. Muudetud kõik kohad, kus vaikeväärtus 6 esines: `api/config/index.js:57`, `api/services/calendar-sync.js:15`, `docker/docker-compose.yml:79`, `.env.example:35` ning vana Apps Scripti konfiguratsioon `apps-script/config.gs:29` ja selle README.
- Serveri `docker/.env` real 181 muudetud `CALENDAR_MONTHS_FORWARD=6` → `12`. Varukoopia serveris: `docker/.env.bak-2026-09-02`.
- Deployitud prodi `./docker/deploy.sh` skriptiga ja kontrollitud: konteineris `kaiumtu-api` on `CALENDAR_MONTHS_FORWARD=12`, sünk tõi 9 sündmust aknaga 2026-08-01 kuni 2027-09-02 (varem 7), `events.json` uuendatud S3-s, mõlemad konteinerid healthy.

---

## State

| | |
|---|---|
| Build | green (Docker build ja deploy läbisid prodis) |
| Tests | projektis ei ole testiraamistikku; verifitseeriti prodi logi ja konteineri env-i järgi |
| Working tree | clean |
| Running processes | none |

---

## Files touched

```
.env.example
api/config/index.js
api/services/calendar-sync.js
apps-script/README.md
apps-script/config.gs
docker/docker-compose.yml
```

---

## Open loops

### Deferred decisions
- (none)

### Waiting on others
- (none)

### Time-bound items
- (none)

### Risk flags
- Deploy logi andis neli hoiatust tühjade muutujate kohta: `GOOGLE_APPS_SCRIPT_URL`, `MEMBERSHIP_SPREADSHEET_ID`, `CONTACT_SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT`. Kalendrit need ei puuduta. Kui kontakt- või liikmevorm käib veel Apps Scripti kaudu, võib see olla katki. Kontrollimata.
- Serveris on alles `docker/.env.bak-2026-09-02`. Kustuta, kui muudatus on püsivalt korras.

---

## Lessons captured

### User-level → `~/.claude/lessons.md`
- Auto mode klassifikaator blokeerib live hostil `sed -i` konfifaili peal ja deploy-skripti käivitamise, aga lubab lugemist ja `cp` varukoopiat. Anna operaatorile täpne käsk `!` prefiksiga.
- `bash-guard.sh` loeb ka heredoc-i sisu: `cat`-iga kirjutamine blokeerub, kui tekstis esineb `.env`. Kasuta Write/Edit tööriista.

### Project auto-memory → `~/.claude/projects/-Users-kkiisler-code-personal-kaiu-kodukant-website/memory/`
- `kaiu-runtime-konf-serveri-env.md` (type: project) — serveri `docker/.env` on runtime-konfi tõeallikas ja kirjutab üle repo ning compose'i vaikeväärtused.

### MemoMind
- Retain: kaiukodukant.ee runtime-konfi tõeallikas serveri env-failis. Sildid `domain:devops`, `project:personal`, `env:prod`.

---

## Tracker updates applied

- (no trackers configured)

---

## Notes

Mahupiirang kontrollitud: Google Calendar API päring kasutab `maxResults: 250` ilma leheküljestamiseta. Kalendris on 9 sündmust, seega 12 kuu aken limiiti vastu ei jookse. Kui sündmuste arv peaks kordades kasvama, tuleb leheküljestamine lisada.
