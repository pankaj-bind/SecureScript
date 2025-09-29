# api/audit_parser/Microsoft Windows 11/audit_parser.py

import re
import json
import os
from collections import OrderedDict

# --- Metadata Parsing Functions ---
def parse_tag_content(tag_name, text):
    """Generic function to find content within a simple tag like <tag>content</tag>."""
    if text is None:
        return None
    pattern = re.compile(f"<{tag_name}>(.*?)</{tag_name}>", re.DOTALL)
    match = pattern.search(text)
    if not match:
        return None
    return match.group(1).strip()


def parse_spec_block(spec_text):
    """Parses the content of a <spec> block into a dictionary."""
    if not spec_text:
        return {}
    spec_data = OrderedDict()
    tags_to_find = ["type", "name", "profile", "version", "link"]
    for tag in tags_to_find:
        content = parse_tag_content(tag, spec_text)
        if content:
            if tag == "link" and not content.startswith("http"):
                content = (
                    "https:" + content
                    if content.startswith("//")
                    else "https://" + content
                )
            spec_data[tag] = content
    return spec_data


def parse_variables(variables_text):
    """Parses the <variables> block into a list of dictionaries."""
    if not variables_text:
        return []
    variables = []
    variable_blocks = re.findall(
        r"<variable>(.*?)</variable>", variables_text, re.DOTALL
    )
    for block in variable_blocks:
        var_data = OrderedDict()
        tags_to_find = ["name", "default", "description", "info", "value_type"]
        for tag in tags_to_find:
            var_data[tag] = parse_tag_content(tag, block)
        variables.append(var_data)
    return variables


def parse_ui_metadata_for_file(full_content):
    """
    Parses the full audit file content to extract the ui_metadata block for a single file.
    """
    ui_metadata_text_with_hashes = parse_tag_content("ui_metadata", full_content)
    if not ui_metadata_text_with_hashes:
        return None

    cleaned_ui_text = "\n".join(
        [
            line.strip().lstrip("#").strip()
            for line in ui_metadata_text_with_hashes.splitlines()
        ]
    ).strip()

    display_name = parse_tag_content("display_name", cleaned_ui_text)
    spec_text = parse_tag_content("spec", cleaned_ui_text)
    variables_text = parse_tag_content("variables", cleaned_ui_text)

    spec_data = parse_spec_block(spec_text)
    variables_data = parse_variables(variables_text)

    ui_metadata = OrderedDict()
    if display_name:
        ui_metadata["display_name"] = display_name
    if spec_data:
        ui_metadata["spec"] = spec_data
    if variables_data:
        ui_metadata["variables"] = variables_data

    return {"ui_metadata": ui_metadata}


# --- Individual Policy Check Parsing Functions ---
def extract_middle_content(file_path):
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        start_marker_end_tag = "</report>"
        end_marker_start_tag = "</then>"
        start_part_end_pos = content.find(start_marker_end_tag)
        if start_part_end_pos == -1:
            return None
        start_part_end_pos += len(start_marker_end_tag)
        end_part_start_pos = content.rfind(end_marker_start_tag)
        if end_part_start_pos == -1:
            return None
        return content[start_part_end_pos:end_part_start_pos]
    except (FileNotFoundError, Exception):
        return None


def extract_policy_blocks(content):
    if not content:
        return []
    blocks = re.findall(
        r"<if>.*?</if>|<custom_item>.*?</custom_item>", content, re.DOTALL
    )
    return [block.strip() for block in blocks if block.strip()]


def clean_value(value):
    """
    Cleans a captured value string by stripping whitespace and removing
    surrounding single or double quotes.
    """
    cleaned = value.strip()
    if (cleaned.startswith('"') and cleaned.endswith('"')) or \
       (cleaned.startswith("'") and cleaned.endswith("'")):
        cleaned = cleaned[1:-1].strip() # Strip again after removing quotes
    if cleaned == "YES":
        return True
    if cleaned == "NO":
        return False
    return cleaned


def parse_key_value_block(text):
    data = OrderedDict()
    # This regex correctly handles multi-line values by looking ahead for the next key
    pattern = re.compile(
        r"^\s*([^\s:]+)\s*:\s*(.*?)(?=\n\s*[^\s:]+\s*:|\Z)", re.DOTALL | re.MULTILINE
    )
    matches = pattern.findall(text)
    for key, value in matches:
        data[key.strip()] = clean_value(value)
    return data


def parse_custom_item(block_text):
    inner_content_match = re.search(
        r"<custom_item>(.*?)</custom_item>", block_text, re.DOTALL
    )
    if not inner_content_match:
        return {}
    return parse_key_value_block(inner_content_match.group(1))


def parse_if_block(block_text):
    result = {"check_type": "CONDITIONAL"}
    condition_match = re.search(
        r"<condition(.*?)>(.*?)</condition>", block_text, re.DOTALL
    )
    if condition_match:
        attrs, content = condition_match.groups()
        data = OrderedDict()
        # IMPROVED REGEX: Makes the colon optional to handle formats like auto:"FAILED"
        attr_matches = re.findall(r'(\w+)\s*:?\s*"([^"]*)"', attrs)
        for key, value in attr_matches:
            data[f"{key.lower()}_status" if key.lower() == "auto" else key.lower()] = (
                value
            )
        rules = re.findall(r"<custom_item>.*?</custom_item>", content, re.DOTALL)
        data["rules"] = [parse_custom_item(rule) for rule in rules]
        result["condition"] = data
        
    then_match = re.search(r"<then>(.*?)</then>", block_text, re.DOTALL)
    if then_match:
        report_match = re.search(
            r"<report(.*?)>(.*?)</report>", then_match.group(1), re.DOTALL
        )
        if report_match:
            attrs, content = report_match.groups()
            data = parse_key_value_block(content)
            # IMPROVED REGEX: Use the same improved regex for report attributes
            attr_matches = re.findall(r'(\w+)\s*:?\s*"([^"]*)"', attrs)
            for key, value in attr_matches:
                data[key.lower()] = value
            result["then"] = {"report": data}
            
    return result


def parse_block(block):
    if block.startswith("<if>"):
        return parse_if_block(block)
    elif block.startswith("<custom_item>"):
        return parse_custom_item(block)
    return {}


def get_base_filename_from_block(block):
    description = None
    # Regex to find description inside a report block or a standalone custom_item
    # It now correctly handles both single and double quotes
    desc_pattern = r'description\s*:\s*["\'](.*?)(?:["\'])'
    
    report_desc_match = re.search(
        r'<report.*?>.*?' + desc_pattern, block, re.DOTALL
    )
    
    if report_desc_match:
        description = report_desc_match.group(1)
    else:
        desc_match = re.search(desc_pattern, block, re.DOTALL)
        if desc_match:
            description = desc_match.group(1)
        else:
            return None
            
    if not description:
        return None

    # Extract leading numbers like "18.10.93.2.4"
    version_match = re.search(r"^\s*[\d\.]+", description)
    if version_match:
        return version_match.group(0).strip()
        
    return None


def process_policy_checks(input_file, output_folder, variables_map):
    """Processes the middle of the audit file to create individual policy JSONs."""
    middle_content = extract_middle_content(input_file)
    if not middle_content:
        return
    policy_blocks = extract_policy_blocks(middle_content)
    if not policy_blocks:
        return
        
    for block in policy_blocks:
        parsed_data = parse_block(block)
        if not parsed_data:
            continue

        # Check for and embed variable data
        for key, value in parsed_data.items():
            if isinstance(value, str) and value.startswith('@') and value.endswith('@') and len(value) > 2:
                variable_name = value[1:-1]
                if variable_name in variables_map:
                    parsed_data["variable"] = variables_map[variable_name]
                    break

        # Logic to determine policy type folder
        policy_type = parsed_data.get("type")
        if not policy_type and parsed_data.get("check_type") == "CONDITIONAL":
            try:
                policy_type = parsed_data['condition']['rules'][0].get('type')
            except (KeyError, IndexError, TypeError):
                policy_type = None
        if not policy_type:
            policy_type = "Uncategorized"

        type_specific_folder = os.path.join(output_folder, policy_type)
        os.makedirs(type_specific_folder, exist_ok=True)
        
        base_filename = get_base_filename_from_block(block)
        if base_filename:
            output_filename = f"{base_filename}.json"
            output_path = os.path.join(type_specific_folder, output_filename)
            try:
                with open(output_path, "w", encoding="utf-8") as f:
                    json.dump(parsed_data, f, indent=2)
            except IOError as e:
                print(f"Could not write to file {output_path}: {e}")
                continue

# --- Main Processing Function ---
def process_audit_file(input_file_path, base_output_folder):
    """
    Processes a single .audit file and generates JSON outputs in a dedicated folder.
    """
    try:
        output_folder_name = os.path.splitext(os.path.basename(input_file_path))[0].replace('_', ' ')
        output_folder_path = os.path.join(base_output_folder, output_folder_name)
        os.makedirs(output_folder_path, exist_ok=True)

        with open(input_file_path, "r", encoding="utf-8") as f:
            content = f.read()

        # 1. Generate metadata.json
        metadata = parse_ui_metadata_for_file(content)
        if metadata:
            metadata_path = os.path.join(output_folder_path, "metadata.json")
            with open(metadata_path, "w", encoding="utf-8") as f:
                json.dump(metadata, f, indent=2)
        
        # Prepare variables for efficient lookup
        variables_map = {}
        if metadata and "ui_metadata" in metadata and "variables" in metadata["ui_metadata"]:
            for var in metadata["ui_metadata"]["variables"]:
                if var.get("name"):
                    variables_map[var["name"]] = var

        # 2. Generate individual policy JSONs
        process_policy_checks(input_file_path, output_folder_path, variables_map)
        
        # 3. Generate an empty commands/script.json
        commands_folder_path = os.path.join(output_folder_path, "commands")
        os.makedirs(commands_folder_path, exist_ok=True)

        script_data = {}
        script_json_path = os.path.join(commands_folder_path, "script.json")
        with open(script_json_path, "w", encoding="utf-8") as f:
            json.dump(script_data, f, indent=2)

        return output_folder_path
    except Exception as e:
        print(f"Error processing audit file {input_file_path}: {e}")
        return None