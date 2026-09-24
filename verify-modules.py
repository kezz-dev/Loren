#!/usr/bin/env python3
"""
verify-modules.py — completeness checker for the Loren modular split.

WHAT THIS DOES
    Extracts every top-level function/const/let declaration from the
    original single-file HTML (every inline <script> in it, concatenated),
    and from a set of module .js files. Reports, for each declaration in
    the monolith:
      - found and byte-identical in the modules -> fine
      - found but the body text differs         -> needs a manual look
      - found in a "pending" scratch file        -> known, not yet merged
      - not found anywhere                       -> real gap, or something
                                                     genuinely not built yet

    Also reports any name defined in more than one module file (a likely
    bug — whichever <script> loads last silently wins at runtime).

WHAT THIS DOES NOT DO
    This is a completeness/duplication check, not a JS parser. It uses a
    simple brace-counter to find where each top-level declaration ends,
    with a naive string/comment scanner. Its one known blind spot:
    regex literals containing a quote character (e.g. /[^a-z'-]/) can
    fool the scanner into thinking a string opened, which throws off
    brace-counting for the rest of that declaration. This shows up as a
    false "body differs" report. When you see a "differs" result, check
    it by eye before assuming it's a real problem — it usually isn't,
    but don't skip the check either.

    It also can't tell you whether the *behavior* is correct, only
    whether the *text* made it across intact. Order-of-loading bugs,
    typos that are still syntactically valid, and logic errors are out
    of scope for this tool.

USAGE
    python3 verify-modules.py <monolith.html> <module1.js> [module2.js ...] [options]

    --pending DIR     A directory of scratch files whose declarations
                       should count as "known, not yet merged" rather
                       than "missing". Repeatable.
    --json OUT.json   Also write the full machine-readable report here.

EXAMPLE
    python3 verify-modules.py Loren.html js/*.js \\
        --pending pending-for-app --pending pending-for-library

Zero dependencies — standard library only. Works with any Python 3.
"""

import argparse
import json
import re
import sys
from pathlib import Path


# ---------------------------------------------------------------------------
# Extraction
# ---------------------------------------------------------------------------

FUNC_RE = re.compile(r'^(async\s+function|function)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(')
VAR_RE  = re.compile(r'^(const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=')
SCRIPT_RE = re.compile(
    r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', re.DOTALL | re.IGNORECASE
)


def extract_inline_scripts(html_path: Path) -> str:
    """Concatenate every inline (non-src) <script> block in an HTML file."""
    text = html_path.read_text(encoding='utf-8')
    blocks = SCRIPT_RE.findall(text)
    return '\n\n'.join(blocks)


def find_toplevel_decls(src: str) -> dict:
    """
    Scan for top-level (column-0) function/const/let/var declarations.
    Returns {name: full_source_text}. See module docstring for the
    known regex-literal blind spot.
    """
    lines = src.split('\n')
    decls = {}
    i, n = 0, len(lines)

    def consume_balanced(start_idx, stop_on_semicolon_at_zero=False):
        depth = 0
        started = False
        j = start_idx
        text_lines = []
        in_str = None
        while j < n:
            line = lines[j]
            text_lines.append(line)
            k = 0
            while k < len(line):
                ch = line[k]
                if in_str:
                    if ch == '\\':
                        k += 2
                        continue
                    if ch == in_str:
                        in_str = None
                    k += 1
                    continue
                if ch in ("'", '"', '`'):
                    in_str = ch
                    k += 1
                    continue
                if ch == '/' and k + 1 < len(line) and line[k + 1] == '/':
                    break  # rest of line is a line comment
                if ch in '{(' + ('[' if stop_on_semicolon_at_zero else ''):
                    depth += 1
                    started = True
                elif ch in '})' + (']' if stop_on_semicolon_at_zero else ''):
                    depth -= 1
                elif stop_on_semicolon_at_zero and ch == ';' and depth <= 0:
                    j += 1
                    return j - 1, '\n'.join(text_lines)
                k += 1
            j += 1
            if not stop_on_semicolon_at_zero and started and depth <= 0:
                break
        return j - 1, '\n'.join(text_lines)

    while i < n:
        line = lines[i]
        m = FUNC_RE.match(line)
        if m:
            name = m.group(2)
            end_idx, text = consume_balanced(i)
            decls[name] = text
            i = end_idx + 1
            continue
        m = VAR_RE.match(line)
        if m:
            name = m.group(2)
            end_idx, text = consume_balanced(i, stop_on_semicolon_at_zero=True)
            decls[name] = text
            i = end_idx + 1
            continue
        i += 1
    return decls


def normalize(text: str) -> str:
    return re.sub(r'\s+', ' ', text).strip()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(
        description="Check that every declaration in the original monolith "
                     "made it into the split module files exactly once.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    ap.add_argument('monolith', type=Path, help='Path to the original single-file HTML')
    ap.add_argument('modules', type=Path, nargs='+', help='Module .js files to check')
    ap.add_argument('--pending', action='append', default=[], type=Path,
                     help='Directory of scratch/pending .js files (repeatable)')
    ap.add_argument('--json', type=Path, default=None,
                     help='Also write the full report as JSON to this path')
    args = ap.parse_args()

    if not args.monolith.exists():
        sys.exit(f"Monolith file not found: {args.monolith}")

    mono_src = extract_inline_scripts(args.monolith)
    if not mono_src.strip():
        sys.exit(f"No inline <script> content found in {args.monolith} "
                  f"— is this the right file?")
    mono = find_toplevel_decls(mono_src)

    combined = {}      # name -> [(filename, text), ...]
    for mod_path in args.modules:
        if not mod_path.exists():
            sys.exit(f"Module file not found: {mod_path}")
        d = find_toplevel_decls(mod_path.read_text(encoding='utf-8'))
        for name, text in d.items():
            combined.setdefault(name, []).append((mod_path.name, text))

    pending_names = set()
    for pending_dir in args.pending:
        if not pending_dir.is_dir():
            print(f"Warning: --pending path is not a directory, skipping: {pending_dir}",
                  file=sys.stderr)
            continue
        for f in sorted(pending_dir.glob('*.js')):
            d = find_toplevel_decls(f.read_text(encoding='utf-8'))
            pending_names.update(d.keys())

    dupes = {n: [m for m, _ in occ] for n, occ in combined.items() if len(occ) > 1}

    missing, identical, differs, pending = [], [], [], []
    for name, mono_text in mono.items():
        if name in pending_names:
            pending.append(name)
            continue
        if name not in combined:
            missing.append(name)
            continue
        occ = combined[name]
        if any(normalize(t) == normalize(mono_text) for _, t in occ):
            identical.append(name)
        else:
            differs.append((name, [m for m, _ in occ]))

    report = {
        'monolith_declarations': len(mono),
        'identical': sorted(identical),
        'differs': sorted(differs),
        'pending': sorted(pending),
        'missing': sorted(missing),
        'duplicates': dupes,
    }

    print("=== verify-modules report ===")
    print(f"Monolith top-level declarations found: {len(mono)}")
    print(f"  Identical in modules:  {len(identical)}")
    print(f"  Body differs:          {len(differs)}")
    print(f"  Staged in --pending:   {len(pending)}")
    print(f"  Missing entirely:      {len(missing)}")
    print(f"  Duplicate across files:{len(dupes)}")
    print()

    if dupes:
        print("--- DUPLICATES (same name defined in >1 module file) ---")
        for name, files in dupes.items():
            print(f"  {name}: {files}")
        print()

    if differs:
        print("--- BODY DIFFERS (check by eye — may be a false positive, see")
        print("    the regex-literal note in this script's docstring) ---")
        for name, files in differs:
            print(f"  {name}  (in: {files})")
        print()

    if missing:
        print("--- MISSING (not found in modules or --pending dirs) ---")
        for name in missing:
            print(f"  {name}")
        print()

    if args.json:
        args.json.write_text(json.dumps(report, indent=2))
        print(f"Full report written to {args.json}")

    if missing or dupes:
        sys.exit(1)


if __name__ == '__main__':
    main()
