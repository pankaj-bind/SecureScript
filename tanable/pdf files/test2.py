#!/usr/bin/env python3
"""
toc_extract.py – Extract and pretty-print the Table-of-Contents from a CIS (or
similar) PDF.

Features
--------
1. Autodetects every TOC page in the first N pages (default 10).
2. Recognizes TOC entries with trailing page numbers or numbered prefixes.
3. Handles plain unnumbered headings.
4. Reassembles wrapped TOC lines heuristically.
5. Prints hierarchy levels using "-----" as indentation per level.

Dependencies
------------
pip install pdfplumber

Usage
-----
python toc_extract.py <pdf_file> [pages_to_scan]

Example
-------
python toc_extract.py CIS_Google_Android_Benchmark_v1.5.0.pdf 12
"""

import re
import sys
from pathlib import Path
from typing import List

import pdfplumber

# Regex patterns
TOC_HEADER_RE = re.compile(r"\btable of contents\b", re.I)
DOTS_PAGE_RE = re.compile(r"^(?P<title>.+?)\s+\.{2,}\s+\d+\s*$")
NUM_PREFIX_RE = re.compile(r"^(?P<dashes>-*)(?P<num>\d+(?:\.\d+)*)\s+(?P<rest>.+)$")
HEADER_FOOTER_RE = re.compile(r"^(table of contents|page\s+\d+)", re.I)


def _find_toc_pages(pdf: pdfplumber.PDF, first_n: int = 10) -> List[int]:
    """
    Return list of 0-based page indexes that look like TOC pages, based on header
    presence or typical TOC line pattern.
    """
    pages = []
    for idx, page in enumerate(pdf.pages[:first_n]):
        txt = page.extract_text() or ""
        if TOC_HEADER_RE.search(txt):
            pages.append(idx)
            continue
        if DOTS_PAGE_RE.search(txt, re.M):
            pages.append(idx)
    return sorted(set(pages))


def _clean_lines(raw_text: str) -> List[str]:
    """
    Cleans and attempts to join wrapped TOC lines using a basic heuristic:
    If a line doesn't match TOC patterns and the next line starts lowercase,
    join them.
    """
    lines = [line.rstrip() for line in raw_text.splitlines()]
    # Remove blank lines and headers/footers
    lines = [l for l in lines if l and not HEADER_FOOTER_RE.match(l)]
    
    glued_lines = []
    skip_next = False
    for i, line in enumerate(lines):
        if skip_next:
            skip_next = False
            continue
        if i + 1 < len(lines):
            next_line = lines[i + 1]
            # Join if current line doesn't look like TOC entry, next line starts lowercase
            if not DOTS_PAGE_RE.match(line) and not NUM_PREFIX_RE.match(line):
                if next_line and next_line[0].islower():
                    glued_lines.append(line + " " + next_line)
                    skip_next = True
                    continue
        glued_lines.append(line)
    return glued_lines


def extract_toc(pdf_path: str, scan_pages: int = 10) -> List[str]:
    """
    Extract and format TOC lines from PDF.

    :param pdf_path: Path to the PDF file.
    :param scan_pages: Number of first pages to scan for TOC.
    :return: List of TOC lines formatted with hierarchy indentation.
    """
    pdf_path = Path(pdf_path).expanduser().resolve()
    if not pdf_path.exists():
        raise FileNotFoundError(f"File not found: {pdf_path}")

    extracted_lines = []

    with pdfplumber.open(pdf_path) as pdf:
        toc_pages = _find_toc_pages(pdf, first_n=scan_pages)
        if not toc_pages:
            raise RuntimeError("No TOC pages found automatically. "
                               "Try increasing pages_to_scan or specify pages manually.")

        for page_idx in toc_pages:
            page_text = pdf.pages[page_idx].extract_text(x_tolerance=1, y_tolerance=3) or ""
            cleaned_lines = _clean_lines(page_text)

            for line in cleaned_lines:
                title = ""
                level = 1

                # Try match “Title …… page” style
                m_dots = DOTS_PAGE_RE.match(line)
                if m_dots:
                    title = m_dots.group("title").strip()
                else:
                    # Try match optional dashes + numbering prefix style
                    m_num = NUM_PREFIX_RE.match(line.lstrip("-"))
                    if m_num:
                        num = m_num.group("num")
                        rest = m_num.group("rest").strip()
                        title = f"{num} {rest}"
                    else:
                        # Otherwise treat as plain heading
                        title = line.strip()

                # Determine level from numeric prefix if present
                first_token = title.split()[0]
                if re.fullmatch(r"\d+(?:\.\d+)*", first_token):
                    level = first_token.count(".") + 1
                else:
                    level = 1

                indent = "-----" * (level - 1)
                extracted_lines.append(f"{indent}{title}")

    return extracted_lines


def main():
    if len(sys.argv) < 2:
        print("Usage: toc_extract.py <pdf_file> [pages_to_scan]", file=sys.stderr)
        sys.exit(1)

    pdf_file = sys.argv[1]
    pages_to_scan = int(sys.argv[2]) if len(sys.argv) >= 3 else 10

    try:
        toc_lines = extract_toc(pdf_file, scan_pages=pages_to_scan)
        for line in toc_lines:
            print(line)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
