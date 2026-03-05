"""Schema and validation extraction patterns."""

# Each entry: name, file_glob, class_regex, field_regex (optional).
SCHEMA_PATTERNS: list[dict] = [
    # --- Python ---
    {
        "name": "pydantic",
        "file_glob": "*.py",
        "class_regex": r"^class\s+(\w+)\(.*(?:BaseModel|BaseSchema).*\):",
        "field_regex": r"^\s+(\w+):\s+",
    },
    {
        "name": "marshmallow",
        "file_glob": "*.py",
        "class_regex": r"^class\s+(\w+)\(.*(?:Schema|ma\.Schema).*\):",
        "field_regex": r"^\s+(\w+)\s*=\s*(?:fields|ma)\.\w+",
    },
    # --- JavaScript / TypeScript ---
    {
        "name": "zod",
        "file_glob": "*.{ts,js}",
        "class_regex": r"(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*z\.(?:object|string|number|array|enum)",
        "field_regex": r"(\w+)\s*:\s*z\.",
    },
    # --- GraphQL ---
    {
        "name": "graphql",
        "file_glob": "*.graphql",
        "class_regex": r"^type\s+(\w+)\s*\{",
        "field_regex": r"^\s+(\w+)\s*[:(]",
    },
    # --- Solidity ---
    {
        "name": "solidity_struct",
        "file_glob": "*.sol",
        "class_regex": r"^struct\s+(\w+)\s*\{",
        "field_regex": r"^\s+\w+\s+(\w+)\s*;",
    },
]
