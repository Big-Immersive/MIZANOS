# Plan: Multi-Stack Artifact Extractor

## Context

The current `artifact_extractor.py` (226 LOC) is hardcoded for our stack (FastAPI + Next.js + SQLAlchemy + Pydantic). Since MIZANOS scans arbitrary customer repos, the extractor needs to support all major tech stacks. Adding all patterns inline would exceed the 300 LOC limit, so we'll refactor into a registry/strategy pattern.

**Key constraint**: The `extract()` return shape stays identical — `scan_job.py` and `progress_matcher.py` need zero changes.

---

## File Structure

```
apps/api/services/
  artifact_extractor.py              (refactored orchestrator, ~120 LOC)
  extraction/
    __init__.py                      (barrel exports)
    pattern_runner.py                (~100 LOC, generic matching engine)
    route_patterns.py                (~100 LOC, all route pattern defs)
    model_patterns.py                (~80 LOC, all model/ORM pattern defs)
    schema_patterns.py               (~50 LOC, schema/validation defs)
    component_patterns.py            (~40 LOC, component + page defs)
    dependency_parsers.py            (~100 LOC, dependency file parsers)
    migration_patterns.py            (~50 LOC, migration dir patterns)
    config_patterns.py               (~40 LOC, config file defs)
```

All files well under 300 LOC. No file exceeds 120 LOC.

---

## Step 1: Create `extraction/pattern_runner.py`

Generic matching engine reused by all categories. Contains:

- `SKIP_DIRS` set (moved from `artifact_extractor.py`)
- `should_skip(path)` — check if path contains skipped dirs
- `iter_files(root, globs)` — iterate files matching glob list, skipping excluded dirs. Handles brace expansion (`*.{ts,js}` → `["*.ts", "*.js"]`) since `Path.rglob()` doesn't support it
- `safe_read(path)` → `str | None`
- `find_block_end(text, start)` — find end of class body (moved from extractor)
- `run_regex_patterns(root, patterns)` → `list[dict]` — run regex patterns against files, return matches with group mapping
- `run_class_patterns(root, patterns)` → `list[dict]` — run class+field extraction (models, schemas), returns `{name, fields, file}`

## Step 2: Create `extraction/route_patterns.py`

Data-only pattern definitions:

**`ROUTE_PATTERNS`** (regex-based):
| Name | Glob | Matches |
|---|---|---|
| fastapi | `*.py` | `@router.get("/path")`, `@app.post("/path")` |
| flask | `*.py` | `@app.route("/path")`, `@blueprint.route("/path")` |
| django | `urls.py` | `path("url/", view)` |
| express | `*.ts, *.js` | `app.get("/path"`, `router.post("/path"` |
| rails | `routes.rb` | `get "/path"`, `resources :name` |

**`FILE_ROUTE_PATTERNS`** (file-presence based):
| Name | Base dir | File pattern |
|---|---|---|
| nextjs_app | `**/app` | `page.*` |
| sveltekit | `**/src/routes` | `+page.svelte` |
| sveltekit_api | `**/src/routes` | `+server.ts` |
| nuxt_api | `**/server/api` | `*.ts` |

## Step 3: Create `extraction/model_patterns.py`

**`MODEL_PATTERNS`** (class+field extraction):
| Name | Glob | Class regex | Field regex |
|---|---|---|---|
| sqlalchemy | `*.py` | `class X(Base/Model):` | `x: Mapped[` |
| django | `*.py` | `class X(models.Model):` | `x = models.Field` |
| prisma | `*.prisma` | `model X {` | `field Type` |
| drizzle | `*.ts, *.js` | `pgTable("name"` / `mysqlTable(` / `sqliteTable(` | — |
| typeorm | `*.ts, *.js` | `@Entity() class X` | `@Column() field` |
| sequelize | `*.ts, *.js` | `sequelize.define("name"` / `Model.init(` | — |
| mongoose | `*.ts, *.js` | `new Schema({` / `mongoose.model(` | — |
| solidity | `*.sol` | `contract X {` / `interface X {` | `Type visibility name;` |

## Step 4: Create `extraction/schema_patterns.py`

**`SCHEMA_PATTERNS`**:
| Name | Glob | Class regex | Field regex |
|---|---|---|---|
| pydantic | `*.py` | `class X(BaseModel/BaseSchema):` | `field: Type` |
| zod | `*.ts, *.js` | `const xSchema = z.object(` | `key: z.` |
| graphql | `*.graphql` | `type X {` | `field: Type` |
| solidity_struct | `*.sol` | `struct X {` | `Type name;` |

## Step 5: Create `extraction/component_patterns.py`

**`COMPONENT_PATTERNS`**:
| Name | Extensions | Dir keywords |
|---|---|---|
| react | `.tsx, .jsx` | `component`, `/ui/` |
| vue | `.vue` | `component` |
| svelte | `.svelte` | `component`, `lib` |
| astro | `.astro` | `component` |

**`PAGE_PATTERNS`**: Next.js `pages/`, SvelteKit `routes/`

## Step 6: Create `extraction/dependency_parsers.py`

Small parser functions (each <15 LOC) + dispatch dict:

| File | Ecosystem | Parser |
|---|---|---|
| `package.json` | npm | Parse deps + devDeps |
| `pyproject.toml` | pip | Existing TOML logic (moved) |
| `requirements.txt` | pip | Line-by-line `pkg==ver` |
| `Cargo.toml` | cargo | `[dependencies]` section |
| `go.mod` | go | `require (...)` block |
| `Gemfile` | ruby | `gem "name"` lines |
| `composer.json` | php | JSON `require` + `require-dev` |
| `pom.xml` | java | `<dependency>` tags |
| `build.gradle` | java | `implementation "group:name"` |

## Step 7: Create `extraction/migration_patterns.py`

**`MIGRATION_PATTERNS`**:
| Name | Glob |
|---|---|
| alembic | `**/versions/*.py` (exclude `__init__.py`) |
| prisma | `**/prisma/migrations/*/migration.sql` |
| drizzle | `**/drizzle/*.sql` |
| django | `**/migrations/*.py` (exclude `__init__.py`) |
| rails | `**/db/migrate/*.rb` |
| knex/typeorm | `**/migrations/*.{ts,js}` |
| hardhat | `**/deploy/*.ts` |
| foundry | `**/script/*.s.sol` |

## Step 8: Create `extraction/config_patterns.py`

**`CONFIG_ENTRIES`** — existing 8 entries plus:
`vite.config.*`, `next.config.*`, `svelte.config.*`, `nuxt.config.*`, `hardhat.config.*`, `foundry.toml`, `tailwind.config.*`, `prisma/schema.prisma`

## Step 9: Refactor `artifact_extractor.py`

- Expand `_CODE_EXTS` to include `.vue, .svelte, .astro, .sol, .go, .rs, .java, .kt, .rb, .php, .prisma, .graphql, .proto`
- Replace inline regex logic with calls to `run_regex_patterns()` and `run_class_patterns()` from `pattern_runner.py`
- Keep `extract()` return shape identical: `{file_tree, routes, models, schemas, components, pages, dependencies, migrations, configs}`
- `_extract_file_tree()` stays inline (uses expanded `_CODE_EXTS`)
- Everything else delegates to pattern definitions + runner

## Step 10: Create `extraction/__init__.py`

Barrel export of `ArtifactExtractor` for clean imports.

---

## Files Modified

| File | Change |
|---|---|
| `apps/api/services/artifact_extractor.py` | Refactor to thin orchestrator (~120 LOC) |

## Files Created (9)

| File | LOC |
|---|---|
| `apps/api/services/extraction/__init__.py` | ~5 |
| `apps/api/services/extraction/pattern_runner.py` | ~100 |
| `apps/api/services/extraction/route_patterns.py` | ~100 |
| `apps/api/services/extraction/model_patterns.py` | ~80 |
| `apps/api/services/extraction/schema_patterns.py` | ~50 |
| `apps/api/services/extraction/component_patterns.py` | ~40 |
| `apps/api/services/extraction/dependency_parsers.py` | ~100 |
| `apps/api/services/extraction/migration_patterns.py` | ~50 |
| `apps/api/services/extraction/config_patterns.py` | ~40 |

## Files NOT Modified (zero breaking changes)

- `apps/api/jobs/scan_job.py` — calls `ArtifactExtractor().extract()`, return shape unchanged
- `apps/api/services/progress_matcher.py` — receives artifacts dict, shape unchanged
- `apps/api/services/scan_prompts.py` — LLM prompt is artifact-key agnostic

---

## Verification

1. **Import check**: `python -c "from apps.api.services.artifact_extractor import ArtifactExtractor"`
2. **Smoke test**: Run extractor against this repo to verify output shape matches current behavior
3. **LOC check**: Verify no file exceeds 300 lines
4. **Manual scan test**: Trigger a scan via API and verify results still persist correctly
5. **Type check / lint**: `make lint` (frontend only but ensures no import issues in shared types)
