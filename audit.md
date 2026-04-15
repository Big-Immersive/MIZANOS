# Real Audit — Proposal for Mizan OS Audit History

## TL;DR

The current audit shows 4 categories — **Code Confidence, Architecture, Delivery Health, Performance** — which all derive from the same task data plus a few file-tree counts. They feel duplicated because they *are* the same data reshuffled. **No actual code is being checked.** The "0 security issues" placeholder is always 0 because nothing is scanning.

This proposal replaces them with **4 honest, real categories** powered by industry-standard open-source tools that already exist and run for free. Everything piggy-backs on the existing **Code Progress Scan** — no new infrastructure, no monthly cost, no vendor lock-in.

> **One-line pitch**: *"We already clone the repo every scan. We just aren't looking at what's in it. This fix looks at what's in it."*

---

## Current state — what the scan does today

From `apps/api/jobs/scan_job.py`:

1. **Clone** the repo (shallow, depth 1)
2. **Parse the file tree** — counts routes, models, schemas, components, pages
3. **Fetch tasks** from the DB
4. **LLM match** — sends tasks + artifacts to Claude via OpenRouter, which returns per-task evidence and a `progress_pct`

That's it. No real static analysis, no security checks, no dependency audit, no complexity, no duplication — nothing.

The audit categories (`style → Code Confidence`, `architecture`, `security → Delivery Health`, `performance`) are then derived from that same data plus task state, which is why they feel duplicated.

---

## The 4 new categories (real)

### 1. Security

**What it is**

Scans the cloned repository and its git history for hardcoded secrets (API keys, tokens, private keys), known CVE vulnerabilities in third-party dependencies, and dangerous code patterns like SQL injection, unsafe eval, weak crypto, and hardcoded passwords.

**Why it's helpful**

Catches the kind of issues that actually get projects hacked in production — a leaked AWS key in a commit from 6 months ago, a package with a critical CVE nobody noticed, a hardcoded password in a test file that shipped to prod. Replaces the current "0 security issues" placeholder with a real, actionable severity-graded count the team can fix today.

**Implementation**

Runs inside the existing scan job. Subprocess calls to:

- **gitleaks** — single Go binary, secrets detection across full git history
- **osv-scanner** — Google's CVE database, covers npm/pypi/go/rust/java/maven/etc
- **Bandit** — Python SAST (`pip install bandit`), catches hardcoded passwords, unsafe eval, SQL injection, weak crypto
- **Semgrep** — multi-language SAST with free community rules (30+ languages, 3000+ rules)

All four are single-binary or pip-installable, all produce JSON, all run locally on the cloned directory. **No external API, no auth, no vendor, no cost.**

**Time per scan**: 5–15 seconds.

**Audit sub-score formula**:
```
score = max(0, 100 − (critical × 20 + high × 10 + medium × 3 + low × 1))
```

---

### 2. Dependency Health

**What it is**

Inspects every package listed in `package.json`, `pyproject.toml`, `requirements.txt`, etc. Reports:
- How many are outdated (with major versions behind)
- How many have known CVEs
- How many use unpinned wildcard versions
- Any license conflicts (GPL/AGPL in a proprietary project)

**Why it's helpful**

A project running on 6-month-old dependencies is one upgrade away from a production outage or a security incident. This turns "are we up to date?" from a manual chore nobody does into a single tracked number with a to-do list attached. Also catches accidental GPL imports before legal finds out.

**Implementation**

Runs inside the existing scan job after the clone. Uses native tools already shipped with pip and npm:
- `pip list --outdated --format=json` (Python)
- `npm outdated --json` (JavaScript / TypeScript)
- **osv-scanner** — reused from the Security step
- **pip-licenses** / **license-checker** for license audit

PyPI and npm registry lookups are anonymous public HTTP. **No external API key, no vendor, no cost.**

**Time per scan**: 3–5 seconds.

**Audit sub-score formula**:
```
score = max(0, 100 − (outdated_major × 3 + vulnerable × 10))
```

---

### 3. Code Quality

**What it is**

Measures objective code health with real metrics:
- **Cyclomatic complexity** per function
- **Duplication percentage** across files
- **Linter error count** (running the project's own lint rules)
- **Average function length**
- **Test-to-source file ratio**

Replaces the current "Code Confidence" score, which is actually just task-to-code matching, not quality at all.

**Why it's helpful**

PMs get a single honest number that answers "is this codebase maintainable or is it slowly rotting?" without having to read the code. Developers get a concrete to-do list:

> *"Refactor these 3 functions with complexity >15, remove these 12% duplicated blocks, fix these 47 linter warnings."*

It's what every real code quality platform (SonarQube, Codacy, CodeClimate) measures — the same signals, just run against your own clone.

**Implementation**

Runs inside the existing scan job on the cloned directory. Subprocess calls to:

- **radon** — Python complexity (`pip install radon`, JSON output)
- **lizard** — multi-language complexity (JS/TS/Python/Go/Java/Rust/C++)
- **jscpd** — duplication detection across languages
- **Ruff / ESLint** — runs the project's own linter configs (reusing whatever rules the team already agreed on)
- File count regex — test files (`*.test.*`, `*.spec.*`, `tests/`, `__tests__/`) vs source files

**No external API, no vendor, no cost.**

**Time per scan**: 10–30 seconds (linters are the slowest).

**Audit sub-score formula** (weighted blend):
```
score = (
    complexity_score × 0.35 +    # % of functions under complexity 15
    duplication_score × 0.25 +   # 100 − duplication%
    linter_score × 0.25 +        # 100 − errors_per_1000_loc
    test_ratio_score × 0.15      # min(test_files / source_files, 0.5) × 200
)
```

**KISS / SOLID / DRY coverage**

| Principle | Static tool coverage | Notes |
|---|---|---|
| **DRY** | ✅ 95% — jscpd direct | Duplication % is a literal DRY measurement |
| **KISS** | 🟡 60% — complexity proxies | Cyclomatic complexity + function length catch obvious violations |
| **SOLID SRP** | 🟠 30% — file/class size only | Needs LLM for true design intent |
| **SOLID OCP/LSP/ISP/DIP** | 🟠 10–40% — pattern rules | Needs LLM |
| **OOP 4 pillars** | 🟠 20% | Needs LLM |
| **File size limits (300/150/50 LOC)** | ✅ 100% — trivial LOC count | `wc -l` per file |
| **Naming / comment quality** | 🟠 0% with linters | Needs LLM |

So **Code Quality catches ~60%** of CLAUDE.md's KISS/SOLID/DRY requirements automatically. The remaining 40% (design intent, naming, abstraction quality, deeper SOLID nuances) requires either human review or an LLM review pass — see the **optional 5th category** below.

---

### 4. Project Hygiene

**What it is**

A pass/fail checklist of "things every well-run project has":
- README present and non-trivial (>50 words)
- LICENSE file
- CI pipeline configured (`.github/workflows/`, circleci, gitlab-ci)
- Tests directory exists
- Dockerfile / docker-compose present
- Meaningful `.gitignore`
- Active commits in the last 30 days
- More than one contributor

Replaces the current "Performance" category, which is 5 pass/fail checks no one on the team actually trusts.

**Why it's helpful**

Catches projects that look active on the surface but have zero tests, no CI, no docs — invisible rot. Gives a new team member or stakeholder a 5-second answer to "is this project healthy enough to onboard onto / ship to prod?". Especially useful for the PM to spot projects where Delivery Health looks good but the engineering foundation is missing, which is often the earliest warning sign that a project is about to blow up.

**Implementation**

Runs inside the existing scan job. Pure Python:
- `os.path.exists()` for README / LICENSE / Dockerfile / `.github/workflows/` / `tests/` / `.gitignore`
- Word count on README content
- `git log --since="30 days ago" --oneline | wc -l` for commit frequency
- `git shortlog -sn | wc -l` for contributor count

No tools needed beyond what's already on the system. **No external API, no vendor, no cost.**

**Time per scan**: under 1 second.

**Audit sub-score formula**:
```
score = (checks_passed / total_checks) × 100
```

---

## Optional 5th category — Design Principles Compliance (LLM-based)

For full coverage of CLAUDE.md's KISS / SOLID / DRY / OOP rules that static tools can't catch.

**What it is**

Sends each source file (or the diff since the last audit) to Claude via OpenRouter — already wired up — with the project's CLAUDE.md scaffolding rules as the system prompt. Claude returns a per-file score and a list of specific violations.

**Why it's helpful**

This is the only way to get a real "does this codebase follow our standards?" number. Static tools can't infer design intent. An LLM reading the code with the principles in context actually can.

**Implementation**

- Runs after the static tools in `scan_job.py`
- Uses the existing OpenRouter Claude integration (`anthropic/claude-sonnet-4`) — no new dependency
- Token cost: ~$0.01–0.10 per project per scan depending on repo size
- Time: 30–90 seconds per project

**Limitation**: non-deterministic. Two runs on the same code may disagree by a few points. Use as directional, not exact.

**External dependencies**: OpenRouter API (already configured). No new services.

---

## How the new scan pipeline looks

The current `high_level_scan_job` has 4 steps. Enhanced version inserts new steps between the clone and the AI matching:

```
Current                           Enhanced
=======                           ========
10% — Clone repo                  10% — Clone repo                          ← unchanged
                                  20% — Run security tools                  ← NEW
                                  30% — Run dependency tools                ← NEW
                                  40% — Run code quality tools              ← NEW
                                  50% — Check project hygiene               ← NEW
30% — Extract code artifacts      60% — Extract code artifacts              ← unchanged
50% — Load project tasks          70% — Load project tasks                  ← unchanged
70% — AI task-to-code matching    80% — AI task-to-code matching            ← unchanged
                                  85% — (optional) LLM design review        ← NEW
85% — Save scan results           90% — Save scan results (extended)        ← extended
100% — Done                       100% — Done
```

**One job, one clone, one worker, one trigger.** The user still clicks "Scan Now" once and gets every metric.

---

## What stays 100% the same

- The trigger button in the UI (`ScanProgressCard`)
- The `trigger_high_level_scan` endpoint
- The arq worker setup
- The repo clone logic
- The task-to-code matching (which becomes the **"Spec Alignment"** metric — rename it honestly)
- The React Query hooks fetching scan results

## What needs to change (concrete checklist)

1. **Worker Dockerfile** — install gitleaks, osv-scanner, semgrep, bandit, radon, lizard, jscpd. Few `RUN` lines.
2. **New service** — `apps/api/services/audit_tools_service.py` wrapping each subprocess into a clean API: `run_security(path)`, `run_dependencies(path)`, `run_code_quality(path)`, `check_hygiene(path)`.
3. **`scan_job.py`** — call those four services between the clone and the AI matching step.
4. **DB migration** — add columns to `RepositoryAnalysis` (or new `audit_results` table) for the real metrics.
5. **`audit_service.py`** — replace the 4 fake-category calculations with reads from the new columns.
6. **UI labels** in `AuditDashboard.tsx` / `AuditHistoryItem.tsx` — rename `style / security / architecture / performance` to `code_quality / security / dependencies / hygiene`.

---

## Summary table for lead review

| Category | Tools used | External API / vendor | Monthly cost | Time per scan |
|---|---|---|---|---|
| **Security** | gitleaks, osv-scanner, Semgrep, Bandit | None (OSV.dev is free public data) | $0 | 5–15s |
| **Dependency Health** | pip / npm / osv-scanner / license checkers | None | $0 | 3–5s |
| **Code Quality** | radon, lizard, jscpd, Ruff / ESLint | None | $0 | 10–30s |
| **Project Hygiene** | Python `os.path` + `git log` | None | $0 | <1s |
| **Design Principles** (optional) | OpenRouter / Claude (already integrated) | OpenRouter (already paying for this) | ~$0.01–0.10 / scan | 30–90s |

**Total added per scan: ~20–50 seconds** (or +60–140s with the optional LLM design review) on top of what's already running.

**Total monthly infrastructure cost: $0** for the four base categories. **All tools are open-source industry standards used by SonarQube, Snyk, DeepSource, and CodeClimate internally.**

**Implementation effort**:
- **Minimum viable** (gitleaks + osv-scanner only, just for Security category): ~2–3 hours
- **Full 4-category replacement**: ~1–2 days of focused work
- **Plus LLM design review category**: +1 day

---

## Recommended rollout order

1. **Day 1 — Security MVP**: ship gitleaks + osv-scanner only. Will likely find real secrets in old projects on day one. Highest immediate ROI.
2. **Day 2 — Dependency Health**: add the dependency tools. Same osv-scanner already installed.
3. **Day 3 — Code Quality**: add radon/lizard/jscpd + linter integration. This is the biggest category and the one PMs will care about most.
4. **Day 4 — Project Hygiene**: pure Python checks, fastest to implement. Replace the fake "Performance" category.
5. **Day 5 (optional) — Design Principles LLM review**: only if KISS/SOLID/DRY enforcement is strict enough to justify the extra LLM call cost.

After step 4, the audit is **trustworthy and actionable for the first time** — every number maps to a real check the team can verify and fix.

---

*Generated as a proposal for replacing the current placeholder audit with a real one. No code in this document — implementation begins after lead sign-off.*
