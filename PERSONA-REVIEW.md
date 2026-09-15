# Persona review — 2026-09-15

This is an AI-simulated persona review, not interviews or a conversion study.

## Findings and decisions

| Persona | Friction | Change |
| --- | --- | --- |
| First-time, nontechnical visitor | Product names before purposes; API-first CTA | Three task-based homepage entries; Sente primary CTA, API documentation secondary |
| First-time visitor | Conflicting KOE/SOLUNA descriptions and undated numerical claims | Homepage copy aligned with the guide; undated traction/funding claims removed |
| Corporate buyer | Training scope and exclusions hard to find | Always-visible training brief, tax/accommodation/BBQ exclusions and individually agreed scope |
| Corporate buyer | Venue photos can be mistaken for completed events | Visible photograph labels; no participant quote or unpublished-film links |
| Corporate buyer | Enquiry lacks company, budget and language context | Optional fields included in the same preview, mailto and clipboard message |
| International visitor | Homepage cannot be read in English | Complete homepage language toggle, including metadata and image descriptions |
| International visitor | Language and intent lost during navigation | Preserved lang/filter query values; filtered guide deep links and home navigation |
| Keyboard/mobile visitor | Closed-fold previews are actually hidden | Separate translated spans inside summary; navigation opens the destination disclosure |
| Mobile visitor | Image captions depend on cramped absolute positioning | Guide hero image retains its own 3:2 ratio; caption and link follow in normal flow |

## Scope and evidence

- AI training minimum is recorded as owner-approved in the existing pricing source, `~/.config/teai/memory/stayflow-experiences.md:15`. This does not establish an all-inclusive price, instructor availability or guaranteed deliverables.
- `verify-persona.cjs`: local and public-origin modes; 2 pages × 2 languages × 5 widths; image decode, overflow, text size, visible fold previews, filter deep links, anchor reveal, draft field retention, safe user-input rendering, mailto equality, edition=1, no-JS homepage.
- Independent follow-up static review found no remaining P0/P1 implementation defects in the changed scope.
- Existing mail-based enquiry handoff is explicit; it is not a server submission or receipt. No submission API or confirmation email was fabricated.
- No external enquiry was sent during verification. Existing analytics is blocked in the deterministic browser suite.
- Screenshot aesthetics, actual customer task completion and email-client compatibility have not been verified. No claim of perfection, conversion uplift or accessibility certification is made.
- Workspace's prescribed `yuki-reviewer/check.py` was unavailable at its configured path. Its automated copy check could not run; applicable written rules and independent review were used instead.

## Run

```sh
PLAYWRIGHT_PATH=/absolute/path/to/playwright node verify-persona.cjs
PLAYWRIGHT_PATH=/absolute/path/to/playwright node verify-persona.cjs https://enablerhq.com
```

The local mode binds Python's static server only to loopback and closes its own server/browser on exit.
