# PR 66 follow-up evidence

Follow-up to the initial Feature 006 commit f146298. The original performance-results.json and initial validation report remain historical evidence; this record describes subsequent fixes.

## Renderer-loading regression

Both hosted Windows CI jobs originally failed tests/contract/renderer-loading.test.ts because the new eager recipe import pulled Zod and the full contracts module into the initial renderer graph. The failure was reproduced locally before changes.

App now opens LazyMissionRecipeLibrary; the library opens LazyRecipeEditor only for authoring. Each loader offers a visible failure/retry/close path and ignores late responses after navigation. Browsing uses a new dependency-free domain/mission-recipe-values subpath, preserving the existing reconciliation API without importing expansion, starter schemas or the full domain barrel. Both source-build aliases and package exports are aligned.

The loading contract now verifies two boundaries: initial renderer excludes recipe screens and validation, and the recipe browsing graph also excludes the editor and Zod/full contracts. All 316 contract tests pass locally, including this strengthened check. All 531 unit tests pass locally.

## Accessibility progress

Three Electron accessibility scenarios pass: source selection/failure recovery, 100% CSS text scale and 200% CSS text scale. Source fields start unchecked. Keyboard-only preview retry, selected-text correction, failed editor save/retry and final preview/save preserve the exact intended content and leave the source draft unchanged.

The captured evidence/rendered-contrast.json contains 112 supported text samples across five states, with zero skipped samples. Minimum measured sRGB contrast is 5.77088:1, above the required 4.5:1 for ordinary text. Solid ancestor backgrounds are composited; unsupported opacity/filter/image cases would be explicitly excluded rather than silently passed. This does not establish non-text/focus contrast, forced colors, or actual Windows OS accessibility scaling. T046 therefore remains open for those manual/platform checks; T049 still requires five participants.

## Retained memory investigation

Lazy loading alone resolved the CI dependency regression but failed the original retained-working-set target. Separately deferring the editor reduced first-open allocation; it did not resolve retained working set. Disabling Playwright tracing also did not resolve the failure. The 10 MiB target and assertion remain unchanged.

The untraced run is preserved in evidence/untraced-performance.json. The optional diagnostic run is in evidence/memory-diagnostic.json. Reports now include a digest of the renderer asset bundle, in addition to the main build hash, so renderer-only changes can be distinguished. Diagnostic mode adds 40 extra cycles after the original 20-cycle measurement; it does not change the assertion or original budget. No collection or trim call was added to production.

| Diagnostic stage | Working set KiB | JS used heap bytes | DOM nodes | JS listeners |
|---|---:|---:|---:|---:|
| Baseline | 90,132 | 2,331,068 | 102 | 152 |
| First opening | 97,104 | 4,300,348 | 915 | 246 |
| Closed after 20 cycles and test GC | 118,060 | 4,081,632 | 103 | 165 |
| Closed after 40 cycles and test GC | 126,076 | 4,166,464 | 103 | 165 |
| Closed after 60 cycles and test GC | 129,308 | 4,247,252 | 103 | 165 |

The original 20-cycle delta is 27,928 KiB (27.27 MiB), still above 10,240 KiB. Stable closed-view node/listener counts do not support accumulating detached DOM as the explanation in this scenario. Working set continues to grow while JS heap grows much less; the underlying native/engine allocation cause is not yet established, and this is not a claim that no leak exists. T047 remains open. All measured list/preview timing, pagination, long-task and idle assertions passed before the memory assertion failed. The test still fails and must not be represented as green CI.

Commands: full unit and contract projects; focused recipe/navigation and accessibility Electron suites; lint/typecheck; desktop build. Performance runs used the original 500-record fixture and unchanged budgets, including a tracing-off control. Hardware remains Windows 10.0.26200, Ryzen 7 5700U, approximately 32 GiB RAM, Balanced power.

### Settling and memory-pressure control

The additional same-build, untraced run in evidence/settled-memory-diagnostic.json still fails: baseline 94,080 KiB to 122,808 KiB after 20 cycles, a 28,728 KiB (28.05 MiB) increase. Explicitly verifying unmount, waiting two animation frames and another five seconds, and collecting test GC left 122,656 KiB. Private bytes increased from 37,156 to 60,188 KiB. After 60 cycles working set was 133,448 KiB; a test-only CDP critical memory-pressure notification plus GC left 133,520 KiB. This control did not demonstrate reclaimable memory. Closed DOM stayed at 103 nodes and 165 listeners. The allocation cause remains unresolved; no production GC/trim workaround or budget relaxation was introduced.

At commit 7c67b77, both hosted Windows architectures have passed format, lint, Rust checks, native build, typecheck, unit tests, contract tests and desktop build. Integration and end-to-end jobs were still running when checked. This is partial hosted evidence, not a full green CI claim.
