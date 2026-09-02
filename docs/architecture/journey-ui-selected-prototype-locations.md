# Journey UI Selected Prototype Locations

**Scope:** Selected Journey UI directions only

**Historical prototype ref:** `7ef0ad5^`

The browser prototypes were intentionally removed before production packaging. Their source remains
available in Git history at the ref above. The locations below identify only the directions selected
for the Journey UI; rejected comparison variants are omitted from this index.

## Selected locations

| Journey surface             | Selected direction                                    | Historical prototype location                              | Selected browser state                                                         |
| --------------------------- | ----------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Continuous mission creation | **D — Guided boundary with continuous Mission Coach** | `apps/desktop/src/renderer/prototypes/mission-create/`     | `?variant=D`                                                                   |
| Outcome coaching            | **Guided Outcome Coach**                              | `apps/desktop/src/renderer/prototypes/mission-create/`     | `?variant=D&stage=outcome&flow=guided`                                         |
| Smart Crew Builder          | **B — Crew Workshop with Brief + defaults**           | `apps/desktop/src/renderer/prototypes/mission-create/`     | `?variant=D&stage=crew&flow=guided&builder=workshop&crewState=ready&crew=card` |
| Guided profile drafting     | **B — Guided starters**                               | `apps/desktop/src/renderer/prototypes/mission-create/`     | `?variant=D&stage=prompt&crew=card&prompt=guided`                              |
| Access and limits           | **B — Guided guardrails inside the D hybrid**         | `apps/desktop/src/renderer/prototypes/mission-create/`     | `?variant=D&stage=access&flow=guided`                                          |
| Exact mission review        | **Guided Review Coach with Resolution Ledger**        | `apps/desktop/src/renderer/prototypes/mission-create/`     | `?variant=D&stage=review&flow=guided&review=ledger`                            |
| Primary mission workspace   | **D — Mission Course**                                | `apps/desktop/src/renderer/prototypes/mission-focus/`      | `?variant=D`                                                                   |
| Sessions and terminal       | **B — Mission dock**                                  | `apps/desktop/src/renderer/prototypes/session-workspace/`  | `?variant=B`                                                                   |
| Agents and templates        | **C — Guided library with Profile Studio detail**     | `apps/desktop/src/renderer/prototypes/agents-templates/`   | `?variant=C`                                                                   |
| Memory destination          | **B — Search-led Reading Desk with Librarian**        | `apps/desktop/src/renderer/prototypes/memory-library/`     | `?variant=B`                                                                   |
| Mission memory context      | **C — Mission reading room**                          | `apps/desktop/src/renderer/prototypes/memory-library/`     | `?variant=C`                                                                   |
| Setup and readiness         | **C — Guided setup**                                  | `apps/desktop/src/renderer/prototypes/settings-workspace/` | `?variant=C`                                                                   |
| Recovery queue              | **C — Cross-mission attention queue**                 | `apps/desktop/src/renderer/prototypes/recovery-actions/`   | `?variant=C`                                                                   |
| Opened recovery detail      | **B — Mission-context recovery treatment**            | `apps/desktop/src/renderer/prototypes/recovery-actions/`   | `?variant=B`                                                                   |

## Historical file layout

Each selected prototype location contains the same small browser-review structure:

```text
<prototype-location>/
├── NOTES.md       # recorded choice and boundaries
├── index.html     # disposable browser shell
├── prototype.js   # representative states and variant switching
├── serve.mjs      # local review server
└── styles.css     # prototype-only presentation
```

Read a selected decision directly from Git without restoring prototype code:

```powershell
git show "7ef0ad5^:apps/desktop/src/renderer/prototypes/mission-focus/NOTES.md"
```

Replace `mission-focus` with one of these selected prototype folders when reading another decision:

```text
mission-create
session-workspace
agents-templates
memory-library
settings-workspace
recovery-actions
```

These are historical design locations only. They are not production imports, current application
routes, or packaged content. The selected directions were rebuilt in production components listed in
`docs/architecture/journey-ui-from-prototyping.md`.
