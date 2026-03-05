"""Component and page extraction patterns for frontend frameworks."""

# Components: matched by file extension + directory keyword in path.
COMPONENT_PATTERNS: list[dict] = [
    {"extensions": {".tsx", ".jsx"}, "dir_keywords": {"component", "/ui/"}},
    {"extensions": {".vue"}, "dir_keywords": {"component"}},
    {"extensions": {".svelte"}, "dir_keywords": {"component", "/lib/"}},
    {"extensions": {".astro"}, "dir_keywords": {"component"}},
]

# Pages: matched by directory convention.
# dir_name: the directory to search in.
# extensions: file suffixes to include.
PAGE_PATTERNS: list[dict] = [
    {
        "dir_name": "pages",
        "extensions": {".tsx", ".jsx", ".ts", ".js", ".vue"},
    },
]
