"""Prompt templates for repository progress scanning."""

HIGH_LEVEL_SYSTEM_PROMPT = """\
You are a code progress analyzer. Given PM tasks and code artifacts, determine \
which tasks have implementation evidence.

For each task return: verified (bool), confidence (0.0-1.0), artifacts_found (list of files/routes), summary (one line).

Rules:
- Semantic matching: "User auth" matches auth, login, jwt, session files.
- verification_criteria is the primary signal when present.
- verified=true if 2-3 relevant artifacts found (routes, models, components, functions).
- Partial: some artifacts but incomplete coverage → verified=false, confidence=0.4-0.6.
- PM status "done" + any matching artifact → confidence >= 0.5.
- File paths count as evidence.

Return ONLY valid JSON, no markdown fences:
"""

TASK_EVIDENCE_SCHEMA = """\
{"scan_summary":{"total_tasks":<int>,"verified":<int>,"partial":<int>,"no_evidence":<int>,"progress_pct":<float>},"task_evidence":[{"task_id":"<uuid>","task_title":"<str>","status_in_pm":"<str>","verified":<bool>,"confidence":<float>,"artifacts_found":["<file>"],"summary":"<one line>"}]}
"""

HIGH_LEVEL_USER_TEMPLATE = """\
{task_count} tasks | {file_count} files | {route_count} routes | {model_count} models | {schema_count} schemas | {component_count} components | {function_count} functions
{truncation_note}
## Tasks
{tasks_json}

## Routes
{routes_json}

## Models
{models_json}

## Schemas
{schemas_json}

## Components
{components_json}

## Functions
{functions_json}

## Files
{file_tree_json}

Match each task to code artifacts. Return JSON only.
"""
