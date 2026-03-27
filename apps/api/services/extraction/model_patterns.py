"""Model/ORM extraction patterns for all supported ORMs."""

# Each entry: name, file_glob, class_regex, field_regex (optional), field_type_regex (optional).
# class_regex must have group(1) = class/model name.
# field_regex group(1) = field name (applied within class block).
# field_type_regex group(1) = field name, group(2) = type (for enriched extraction).
MODEL_PATTERNS: list[dict] = [
    # --- Python ORMs ---
    {
        "name": "sqlalchemy",
        "file_glob": "*.py",
        "class_regex": r"^class\s+(\w+)\(.*(?:Base|Model).*\):",
        "field_regex": r"^\s+(\w+):\s+Mapped\[",
        "field_type_regex": r"^\s+(\w+):\s+Mapped\[([^\]]+)\]",
    },
    {
        "name": "django",
        "file_glob": "*.py",
        "class_regex": r"^class\s+(\w+)\(.*models\.Model.*\):",
        "field_regex": r"^\s+(\w+)\s*=\s*models\.\w+",
        "field_type_regex": r"^\s+(\w+)\s*=\s*models\.(\w+)",
    },
    # --- JavaScript / TypeScript ORMs ---
    {
        "name": "prisma",
        "file_glob": "*.prisma",
        "class_regex": r"^model\s+(\w+)\s*\{",
        "field_regex": r"^\s+(\w+)\s+\w+",
        "field_type_regex": r"^\s+(\w+)\s+(\w+)",
    },
    {
        "name": "drizzle",
        "file_glob": "*.{ts,js}",
        "class_regex": r"(?:pgTable|mysqlTable|sqliteTable)\(\s*[\"'](\w+)",
        "field_regex": None,
    },
    {
        "name": "typeorm",
        "file_glob": "*.{ts,js}",
        "class_regex": r"@Entity\(.*\)\s*(?:export\s+)?class\s+(\w+)",
        "field_regex": r"@Column\(.*\)\s*(\w+)\s*[;:]",
        "field_type_regex": r"@Column\(.*\)\s*(\w+)\s*:\s*(\w+)",
    },
    {
        "name": "sequelize",
        "file_glob": "*.{ts,js}",
        "class_regex": r"(?:sequelize\.define|\.init)\(\s*[\"'](\w+)",
        "field_regex": None,
    },
    {
        "name": "mongoose",
        "file_glob": "*.{ts,js}",
        "class_regex": r"(?:new\s+Schema\s*\(|mongoose\.model\(\s*[\"'](\w+))",
        "field_regex": None,
    },
    # --- Solidity ---
    {
        "name": "solidity_contract",
        "file_glob": "*.sol",
        "class_regex": r"^(?:contract|interface|library)\s+(\w+)",
        "field_regex": r"^\s+\w+(?:\s+(?:public|private|internal|external))?\s+(\w+)\s*;",
        "field_type_regex": r"^\s+(\w+)(?:\s+(?:public|private|internal|external))?\s+(\w+)\s*;",
    },
]
