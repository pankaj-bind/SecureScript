#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Extracts the Table of Contents (bookmarks) from a CIS Benchmark PDF and
outputs it as a structured JSON file with parsed recommendation details.
"""

import fitz  # PyMuPDF
import json
import sys
import re
import argparse

def transform_node(node):
    """
    Recursively transforms a node from the PyMuPDF ToC structure to the desired
    custom JSON format. It parses the title to extract ID, profile, and assessment.
    """
    new_node = {}
    original_title = node.get("title", "").strip()

    # UPDATED REGEX: Changed (L1|L2) to (.*?) to capture any text within
    # the parentheses for the profile, making it flexible.
    pattern = re.compile(
        r'^\s*([\d\.]*)\s*(?:\((.*?)\))?\s*(.*?)\s*(?:\((Automated|Manual)\))?\s*$'
    )
    match = pattern.match(original_title)

    if match:
        # Unpacking remains the same
        node_id, profile, title_text, assessment = match.groups()

        # Populate the new node with parsed data
        if node_id:
            new_node["id"] = node_id
        
        new_node["title"] = title_text.strip()
        
        if profile:
            new_node["profile"] = profile.strip() # Added strip() for cleanliness
        if assessment:
            new_node["assessment"] = assessment
    else:
        # Fallback for titles that don't match the pattern
        new_node["title"] = original_title

    # Recursively transform children if they exist
    if "subsections" in node:
        new_node["children"] = [transform_node(child) for child in node["subsections"]]

    return new_node


def generate_raw_toc(toc_list):
    """
    Converts a flat ToC list from PyMuPDF into a basic hierarchical structure.
    """
    if not toc_list:
        return []

    result = []
    parents = []

    for item in toc_list:
        level, title, _ = item  # Page number is ignored
        node = {"title": title}

        if level == 1:
            result.append(node)
            parents = [node]
        else:
            while len(parents) >= level:
                parents.pop()

            if not parents:
                result.append(node)
                parents.append(node)
                continue
                
            parent_node = parents[-1]

            if "subsections" not in parent_node:
                parent_node["subsections"] = []
            
            parent_node["subsections"].append(node)
            parents.append(node)

    return result

def main():
    """
    Main function to parse arguments and run the ToC extraction and transformation.
    """
    parser = argparse.ArgumentParser(
        description="Extract and format a CIS Benchmark ToC from a PDF into structured JSON.",
        epilog="Example: python your_script_name.py C:\\path\\to\\benchmark.pdf -o recommendations.json"
    )
    parser.add_argument("input_pdf", help="The path to the input PDF file.")
    parser.add_argument("-o", "--output", help="The path to the output JSON file. If not provided, prints to console.")
    args = parser.parse_args()

    try:
        doc = fitz.open(args.input_pdf)
    except Exception as e:
        print(f"Error opening PDF '{args.input_pdf}': {e}", file=sys.stderr)
        sys.exit(1)

    toc = doc.get_toc()
    doc.close()

    if not toc:
        print(f"Warning: Document '{args.input_pdf}' has no ToC.", file=sys.stderr)
        json_output = json.dumps({"recommendations": []})
    else:
        # 1. Generate the basic nested structure
        raw_toc = generate_raw_toc(toc)
        
        # 2. Find the primary "Recommendations" section
        recommendations_root = None
        for item in raw_toc:
            if "recommendations" in item.get("title", "").lower():
                recommendations_root = item
                break
        
        # 3. Transform the nodes into the final format
        if recommendations_root and "subsections" in recommendations_root:
            transformed_children = [transform_node(child) for child in recommendations_root["subsections"]]
            final_json_obj = {"recommendations": transformed_children}
        else:
            # Fallback: if "Recommendations" not found, transform the whole ToC
            print("Warning: 'Recommendations' section not found. Transforming entire ToC.", file=sys.stderr)
            transformed_children = [transform_node(child) for child in raw_toc]
            final_json_obj = {"recommendations": transformed_children}
            
        json_output = json.dumps(final_json_obj, indent=2)

    # 4. Output the result
    if args.output:
        try:
            with open(args.output, 'w', encoding='utf-8') as f:
                f.write(json_output)
            print(f"Successfully created ToC file at '{args.output}'")
        except Exception as e:
            print(f"Error writing to output file '{args.output}': {e}", file=sys.stderr)
            sys.exit(1)
    else:
        print(json_output)

if __name__ == "__main__":
    main()
    
# correct for windows only