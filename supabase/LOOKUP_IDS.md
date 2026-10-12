# Lookup ID ranges

Mirror of the API doc. Canonical source of truth:

`../refactor-dona-api/db/LOOKUP_IDS.md`  
(also `refactor-dona-api/internal/store/ids.go`)

| Range | Table |
|------:|-------|
| 101–199 | `roles` |
| 201–299 | `varieties` |
| 301–399 | `product_kinds` |
| 401–499 | `planting_plan_statuses` |
| 501–599 | `announcement_statuses` |
| 601–699 | `announcement_priorities` |
| 701–799 | reserved |

Portal FE constants for announcements: `lib/api/index.ts` (`ANNOUNCEMENT_STATUS`, `ANNOUNCEMENT_PRIORITY`).
