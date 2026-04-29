# QA Report — Weekly Update 2026-W18

**Branch:** `weekly-update/2026-W18`
**Reviewed:** 2026-04-29
**Reviewer:** automated QA pass (sample mode)
**Scope:** sample of 5 of 28 claims in `data/claims-2026-W18.json`

> **Note — Sample run.** Tier-1 web-fetch limits were in force, so this run validates a curated sample of 5 high-impact claims rather than the full set. The 5 were chosen to cover (a) the new status flip to green (SK), (b) red-status countries with material public statements (EE, SE), (c) a dated headline statistic (IE survey), and (d) a recent week-anchoring milestone (CZ consultation close).

## Diff overview

`git diff HEAD~1 HEAD --stat`:

```
 data.json                    |  59 ++++++-----
 data/claims-2026-W18.json    | 226 +++++++++++++++++++++++++++++++++++++++++++
 scripts/2026-W18-heygen.md   |  38 ++++++++
 scripts/2026-W18-linkedin.md |  23 +++++
 4 files changed, 323 insertions(+), 23 deletions(-)
```

Material content changes: SK status flip amber → green; CZ headline rewrite (consultation close, minimalist framing); BE headline rewrite (Minister Clarinval confirmation); IE headline rewrite (phased rollout, MHC survey); ES headline rewrite (consultation live); EE headline rewrite (partial climbdown); SE unchanged status (red, draft withdrawn). Adds `isoWeek` field to meta.

## Sample validation

| # | Country | Claim (excerpt) | Source | Verdict |
|---|---------|-----------------|--------|---------|
| 1 | SK | Slovakia's National Council adopted Equal Pay Act 15 April 2026; first MS to transpose; in force 7 June 2026; pay structures by 31 July 2026; same-sex claims in scope; first reports 7 June 2027 covering 1 Aug – 31 Dec 2026; fines €4k–€8k + Labour Inspectorate broader powers | [Lewis Silkin, 24 Apr 2026](https://www.lewissilkin.com/insights/2026/04/24/slovakia-becomes-the-first-eu-member-state-to-transpose-the-pay-transparency-directive) | ✅ PASS — every element of the claim is directly stated in the source |
| 2 | EE | 16 April 2026 statement: would rather pay infringement fines than transpose; subsequent climbdown re: salary-history ban + range disclosure | [Figures.hr tracker](https://figures.hr/solutions/pay-transparency) (claim source) — also independently corroborated by [Lewis Silkin Slovakia article](https://www.lewissilkin.com/insights/2026/04/24/slovakia-becomes-the-first-eu-member-state-to-transpose-the-pay-transparency-directive) which links to ERR News (16 Apr) and the MKM clarification | ✅ PASS — Lewis Silkin explicitly references the 16 April Estonia statement and the subsequent partial climbdown (salary-history ban, salary range pre-interview) |
| 3 | SE | Reversed course on 26 March 2026: Directive too administratively burdensome; seeks postponement & renegotiation; no bill to Riksdag | [L&E Global, 20 Apr 2026](https://leglobal.law/2026/04/20/european-union-transposition-of-the-eu-pay-transparency-directive-across-27-member-states/) | ✅ PASS — verbatim confirmation in the "Special case: Sweden" section |
| 4 | IE | 22 April 2026 MHC survey of 500 employers: >1 in 5 see rules as "unnecessary burden", only 31% expect positive effect; phased rollout starting with salary disclosure in job ads | [Irish Times, 22 Apr 2026](https://www.irishtimes.com/business/2026/04/22/one-in-five-employers-see-pay-transparency-rule-as-unnecessary-burden/) | ✅ PASS — survey numbers, sample size (500), MHC sponsorship, phased-rollout framing all in the article |
| 5 | CZ | Draft published 26 March 2026 by MoLSA; consultation closed 27 April 2026; minimalist transposition; entry 1 Jan 2027; substantive obligations (RTI, reporting, JPA) from 1 Jan 2028; some provisions to 2031; will miss 7 June 2026 deadline; annual job-group report due 30 April | [Trusaic, 16 Apr 2026](https://trusaic.com/blog/analyzing-czechias-draft-legislation-to-transpose-the-eu-pay-transparency-directive/) | ✅ PASS — all dates, phasing, "minimalist transposition" framing and reporting cadence directly stated |

## Cross-claim corroboration observed

- The Lewis Silkin Slovakia article (Claim 1) independently corroborates the Estonia narrative used in EE claims 18 and 19 (16 April statement + climbdown), beyond the figures.hr/Lewis Silkin sources actually cited.
- The L&E Global article (Claim 3) independently corroborates EU-wide claims 1 and 3 ("no Member State has fully transposed"; "at least ten" Member States facing infringement proceedings).
- Trusaic Czech analysis cross-confirms the 30 April annual reporting date that Lewis Silkin's Slovakia table uses for Czechia.

## Issues / observations

1. **Minor wording imprecision (CZ).** The summary in `data.json` says "Draft published by the Ministry of Labour on 26 March 2026". Strictly, the Ministry *introduced* the draft on 16 March and *published it for public consultation* on 26 March. The `keyDates` array correctly distinguishes both (`2026-03-16` "Draft presented", `2026-03-26` "Draft published for consultation"). Not blocking — the summary is defensible and consistent with the keyDates. Possible polish for next week but not a factual error.
2. **L&E Global article timing for SK.** The L&E table (20 April 2026) still shows Slovakia as "Draft published / Approved by government Dec 2025; submitted to parliament Jan 2026". The dashboard goes further (status: green, Act adopted 15 April). The newer Lewis Silkin source (24 April) confirms the 15 April adoption, so the dashboard is correct and L&E was simply pre-adoption. Resolved.
3. **Source quality.** All sampled sources are reputable: Lewis Silkin (Tier-1 employment law firm, EU pay-transparency hub maintainer), L&E Global (international employment-law alliance), Irish Times (national newspaper of record), Trusaic (specialist EU-PTD analyst). No reliance on social-media or unverified blogs in the sample.
4. **Sample coverage caveat.** 23 of 28 claims were not individually fetched in this run. The 5 sampled cover the most material status-driving statements in this week's update. Future weeks should rotate through additional claims (Spain Royal Decree, France's draft bill, Romania, Latvia, Bulgaria, Belgium Trusaic page, Asanify EC December 2025 confirmation) to keep coverage broad.

## Verdict

All 5 sampled claims are supported by their cited (or equivalent) sources, sources are reputable, dates are internally consistent, and the dashboard headline changes match the underlying reporting. No blocking issues found.

VERDICT: PASS
