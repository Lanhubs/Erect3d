# Detailed building-plan interpretation

## What changed

Reconstruction now distinguishes enclosed rooms, attached balconies/porches and
site landscaping explicitly. Native OpenCV measurements remain evidence, rather
than a rule that every detected line must become a wall. Structural stair/post
symbols must be confirmed against the image before erection. Reference-index
classification replaces brittle fixed-length character strings; legacy cached
responses remain readable.

The source image reaches Gemini byte for byte. Native detail crops are PNG,
without resizing or JPEG recompression. A separate structural-detection buffer
suppresses broad saturated fills so coloured pools, planting and bathroom fills
are less likely to produce thick wall bands. This buffer never replaces the
uploaded file, download, model reference or provider source image. Existing ZIP
storage preserves the original bytes.

Source-supported corrections can resolve crossed contours, small room-envelope
rounding errors, genuine wall portions crossing an outdoor notch, opening jambs,
and a single door leaf whose original swing arc identifies the actual closed gap.
These operations do not use a convex hull, fill courtyards, invent a missing host,
or rewrite saved/manual elements. Ambiguous evidence stays reviewable.

The one bounded direct-reconstruction repair now prioritizes blocking geometry.
It receives at most four additional lossless close-ups of failed elements.
Optional furnishing/coverage audits run when there are no blocking errors;
they no longer distract that repair from invalid door/window hosts. Structural,
footprint, project and architectural-system validation still run afterward.

## Configuration

`GEMINI_MODEL_PLAN` continues to select the initial interpretation model.
`GEMINI_MODEL_REPAIR` optionally selects the sparse validation-repair model; an
empty value reuses the interpretation model. The environment example recommends
`gemini-4-argon` for repair. Restart both API and worker after configuration changes.
Provider usage records the actual model, and analysis cache identity includes the
repair-model setting and prompt version.

Full Argon reconstruction exceeded the configured 90-second timeout on all three
verification drawings. It has therefore **not** replaced the faster initial
interpretation model. Argon repair uses LOW thinking, a bounded output budget and
no unsupported temperature setting. No extra automatic repair round was added.
Model access and billing must be available on the configured Gemini API account.
An additional isolated call with only the original lower-storey image, without
native measurements or crops, also timed out. Removing geometric context did not
establish a working alternative.

Assistant editing is separate: it defaults to `gemini-4-argon`, resolves named or
ordinal floors before editing, and reports safe, actionable network/provider
failures. Acknowledged or failed messages no longer reuse a permanently failed
delivery key. Model-only Assistant editing does not require R2.

## Separate storey drawings

Create a level for each distinct drawing, using its printed floor title rather
than upload order. Reconstruct each source on its corresponding level. Provider
context includes the selected level, other source-bearing levels and bounded
circulation-core geometry in metres. It does not copy another floor's layout.

For an automatically scaled fresh reconstruction, a unique source-supported lift
or circular stair can supply a translation to an existing related floor. Manual
calibration and explicit alignment remain authoritative. When lift and circular
stair anchors disagree, automatic placement is withheld and a review warning is
returned. The tool does not stretch, rotate or silently relocate a floor to hide
contradictory evidence.

An upper `OPEN TO BELOW` void cuts only that storey's slab, preserving the lower
living-room floor and roof. Balconies use floor-relative elevation. Generated
fences are repaired after architectural platforms are included; manual fences
remain unchanged.

## Verification and limits

The user authorized live Gemini tests of three exact original JPEGs: an irregular
monochrome mansion and a paired coloured first/second-storey mansion. No R2 upload
was used. Source SHA-256 checks remained unchanged for all three.

With cached initial interpretations and one fresh focused Argon repair per source,
all three proposals compiled into editable models with `needs-review` status:

| Drawing             | Walls | Doors | Windows | Named spaces | Repair plus local validation |
| ------------------- | ----: | ----: | ------: | -----------: | ---------------------------: |
| Independent mansion |    38 |     8 |       6 |           12 |                       44.8 s |
| Paired upper storey |    89 |    10 |      10 |            9 |                       46.4 s |
| Paired lower storey |   224 |    10 |       6 |           14 |                       50.9 s |

These timings exclude the cached initial provider call. Counts are diagnostic,
**not evidence of complete source fidelity**. The live results still contain
unclassified strokes, uncertain doors/windows, incomplete fixtures and unresolved
stair connections. The paired source's inferred lift/stair locations contradict
one another; the alignment cross-check now exposes that problem. A combined
building is therefore not a verified, aligned reconstruction of these drawings.
Do not advertise these tests as perfect automatic mansion conversion.

Local evidence is saved outside source control under `.local/assistant-fix/` and
`api/.local/`: provider responses, source-hash checks, compiled documents,
validation reports, actual editor screenshots and test/build logs. The renderer
checks used the compatibility renderer and do not close the existing native
WebGPU startup issue.

Regression coverage includes floor targeting, delivery retries, provider settings,
per-model usage/cache identity, lossless source/crop preservation, colour masks,
opening hosts and swing evidence, contour/room fitting, native wall clipping,
floor alignment conflicts, and upper slab-only voids. All proposals still require
review and explicit Apply; existing project permissions, locks and Undo remain.
No database migration or project-document schema change is required.

Final local checks on 26 October 2026: 255 client tests and 219 backend tests
passed, with the optional Redis integration skipped. Client/backend type checks,
API file-size checks, formatting of changed backend sources, editor/film web
builds and API/worker bundles passed. Lint completed with existing warnings;
large-chunk, OpenCV browser-externalization and existing style warnings remain.

## Text-aware coverage and selection follow-up

Reconstruction now runs private local OCR using pinned `tesseract.js` 7.0.0 and
bundled English language data. No image is sent to an additional OCR service and
no language model/data is downloaded at runtime. Gemini still receives the
unchanged original, selected PDF context where present, and native lossless
detail crops. Only OCR working copies use grayscale, contrast, sharpening and
upscaling to improve small print. This does not alter stored/uploaded sources.

The OCR inventory includes literal readings, confidence and full-image positions.
It accepts uncommon names, abbreviations and numbered identifiers such as `101`
and `A102`, rather than using a room-name whitelist. Gemini classifies each
reading as architectural space, dimension, annotation, title, site text or
unreadable, linking architectural labels to actual source-positioned rooms,
stair guides, voids or owned architectural boundaries. OCR text boxes cannot
serve as room footprints. Named spaces cannot silently become a generic room
with another name. Low-confidence fragments remain uncertainty when their
claimed meaning conflicts with their source position; they do not prove a room
exists or justify inventing one.

Clear missing/misplaced spaces block acceptance and feed the bounded repair.
Unaccounted or unreadable text remains visible in model checks and the new
collapsed **Plan text** review. Errors are prioritized before the 100-message
review limit, so a long list of warnings cannot conceal a missing labelled area.
Source text is untrusted data, never instructions or executable tool input.

OCR work runs alongside native measurement, with one OCR worker per process,
a 20-second deadline and an eight-entry in-memory metadata cache. Large sheets
use overlapping native tiles. The inventory is capped at 300 readings; reaching
that budget or timing out explicitly marks coverage incomplete. No unreadable
word is claimed as recovered. The English OCR pack is the installed local
language; Gemini also reads the original directly. Additional languages have
not been independently verified in these tests.

Evidence is cached in the existing private `analysis_passes` JSON, preserving
label IDs/positions throughout resume and sparse repair. Local OCR creates no
`ai_calls` usage. The provider receives compact text rows to keep its geometry
grammar within Gemini's serving limits; full ID, role, location and project
validation still run locally. See the upstream
[Tesseract API](https://github.com/naptha/tesseract.js/blob/master/docs/api.md)
and [Gemini structured-output limits](https://ai.google.dev/gemini-api/docs/structured-output).
No database migration or project-document change is required. Install with the
updated frozen API lockfile and restart API/worker processes.

Live checks used the three previously authorized original mansion JPEGs, without
R2 uploads. After bounded provider repair and source-supported junction/envelope
fitting, each produced a compilable `needs-review` proposal: 13 named spaces in
the independent plan, 26 on the paired upper floor and 17 on the lower floor.
The earlier recorded upper-floor proposal had nine named spaces. These are
observed runs, not proof that every source symbol or fixture is now correct.
Closets, vestibules, mechanical rooms and utility areas are included. Uncertain
text, missing openings/fixtures, stair connections and the separately documented
paired-core alignment problem still require review. One dense lower-floor call
timed out before the compact-input retry succeeded. Provider latency and complete
source fidelity remain open limitations.

Empty primary clicks now clear selection in both the R3F viewer and software
fallback. Panning/orbiting and editing-handle interaction retain selection.
Fallback pointer capture begins after a real drag, preserving normal object
picking. Actual browser checks recorded handles disappearing, unchanged model
version/Undo history and one mounted GPU canvas. Screenshots are saved in
`.local/assistant-fix/selection-{before,cleared,fallback-cleared}.png`.

Final follow-up verification passed 256 client tests and 233 backend tests;
the optional Redis integration was skipped. Client/backend type checks, changed
source formatting, file-size guards, editor/film production web builds and
API/worker bundles passed. Existing lint/build warnings remain. Final revalidation
of the saved live responses accounted for 22/22, 44/44 and 31/31 OCR readings,
respectively; the lower plan retained seven explicitly uncertain readings. All
three source hashes remained unchanged. This is label accounting, not a
certification that OCR detected every word or that every architectural detail
was recovered.

The production dependency audit found an existing Zod collection-validation
memory issue, fixed by pinning compatible patch 4.6.6
([reviewed advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)).
The repeated production audit reports no vulnerabilities across 91 packages.
OCR/data dependencies remain outside the browser runtime; the API/worker
bundles keep Tesseract external so its worker and language-file paths resolve
from installed packages.
