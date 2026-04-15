"""Audit tooling — real security / dependency / code-quality / hygiene checks.

Each runner takes a path to a cloned repo and returns a dict:

    {
        "score": 0-100 (clamped),
        "findings": list[dict],      # individual issue objects
        "raw_metrics": dict,          # tool counts for historical queries
    }

All runners are defensive: a single tool failing returns a partial result
with `tools_run` listing only the tools that succeeded. The scan still
completes and other categories are unaffected.
"""

from apps.api.services.audit_tools.code_quality_runner import run_code_quality
from apps.api.services.audit_tools.dependency_runner import run_dependencies
from apps.api.services.audit_tools.hygiene_runner import check_hygiene
from apps.api.services.audit_tools.security_runner import run_security

__all__ = [
    "run_security",
    "run_dependencies",
    "run_code_quality",
    "check_hygiene",
]
