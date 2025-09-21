import re
import sys
import json
import os

def extract_policy_blocks(file_path):
    """
    Reads a file and extracts complete policy blocks, which can be either
    <custom_item>...</custom_item> or <if>...</if>.
    """
    try:
        with open(file_path, 'r') as file:
            content = file.read()
    except FileNotFoundError:
        print(f"Error: File not found at {file_path}")
        sys.exit(1)
    
    blocks = re.findall(r'<if>.*?</if>|<custom_item>.*?</custom_item>', content, re.DOTALL)
    return [block.strip() for block in blocks if block.strip()]

def clean_value(value):
    """Cleans up a parsed value string and converts types."""
    cleaned = value.strip()
    if cleaned.startswith('"') and cleaned.endswith('"'):
        cleaned = cleaned[1:-1]
    
    if cleaned == "YES": return True
    if cleaned == "NO": return False
        
    return cleaned

def parse_key_value_block(text):
    """Parses a block of 'key: value' pairs into a dictionary."""
    data = {}
    pattern = re.compile(r'^\s*([^\s:]+)\s*:\s*(.*?)(?=\n\s*[^\s:]+\s*:|\Z)', re.DOTALL | re.MULTILINE)
    matches = pattern.findall(text)
    
    for key, value in matches:
        data[key.strip()] = clean_value(value)
    return data

def parse_custom_item(block_text):
    """Parses a <custom_item> block into a dictionary."""
    inner_content_match = re.search(r'<custom_item>(.*?)</custom_item>', block_text, re.DOTALL)
    if not inner_content_match: return {}
    
    inner_content = inner_content_match.group(1)
    return parse_key_value_block(inner_content)
    
def parse_if_block(block_text):
    """Parses a complex <if> block into a nested dictionary."""
    result = {"check_type": "CONDITIONAL"}

    condition_match = re.search(r'<condition(.*?)>(.*?)</condition>', block_text, re.DOTALL)
    if condition_match:
        condition_attrs_str, condition_content = condition_match.groups()
        condition_data = {}
        attr_matches = re.findall(r'(\w+)\s*:\s*"?([^"]*)"?', condition_attrs_str)
        for key, value in attr_matches:
            condition_data[f"{key.lower()}_status" if key.lower() == 'auto' else key.lower()] = value

        rules = re.findall(r'<custom_item>.*?</custom_item>', condition_content, re.DOTALL)
        condition_data["rules"] = [parse_custom_item(rule) for rule in rules]
        result["condition"] = condition_data

    then_match = re.search(r'<then>(.*?)</then>', block_text, re.DOTALL)
    if then_match:
        then_content = then_match.group(1)
        report_match = re.search(r'<report(.*?)>(.*?)</report>', then_content, re.DOTALL)
        if report_match:
            report_attrs_str, report_content = report_match.groups()
            report_data = parse_key_value_block(report_content)
            report_attr_matches = re.findall(r'(\w+)\s*:\s*"?([^"]*)"?', report_attrs_str)
            for key, value in report_attr_matches:
                report_data[key.lower()] = value
            result["then"] = {"report": report_data}
            
    return result

def parse_block(block):
    """Dispatches a block to the correct parser based on its main tag."""
    if block.startswith("<if>"):
        return parse_if_block(block)
    elif block.startswith("<custom_item>"):
        return parse_custom_item(block)
    return {}

def get_base_filename_from_block(block):
    """Extracts the policy number from a block to use as a filename."""
    description = None
    # Prioritize the description from a <report> tag for <if> blocks
    report_desc_match = re.search(r'<report.*?>.*?description\s*:\s*"(.*?)"', block, re.DOTALL)
    
    if report_desc_match:
        description = report_desc_match.group(1)
    else:
        # Fallback to the first description found (for <custom_item> blocks)
        desc_match = re.search(r'description\s*:\s*"(.*?)"', block)
        if desc_match:
            description = desc_match.group(1)

    if description:
        # Find the leading policy number (e.g., "1.100" or "18.10.76.2.1")
        version_match = re.search(r'^\s*[\d\.]+', description)
        if version_match:
            return version_match.group(0).strip()
    return None

def main():
    """Main function to drive the script."""
    if len(sys.argv) < 2:
        print("Usage: python your_script.py <input_file> [output_folder]")
        sys.exit(1)

    input_file = sys.argv[1]
    output_folder = sys.argv[2] if len(sys.argv) > 2 else 'json_output'

    # Create the output directory if it doesn't exist
    os.makedirs(output_folder, exist_ok=True)

    policy_blocks = extract_policy_blocks(input_file)

    for block in policy_blocks:
        parsed_data = parse_block(block)
        if not parsed_data:
            print("Warning: Failed to parse a block, skipping.")
            continue

        base_filename = get_base_filename_from_block(block)
        if base_filename:
            output_path = os.path.join(output_folder, f"{base_filename}.json")
            try:
                with open(output_path, 'w') as f:
                    json.dump(parsed_data, f, indent=2)
                print(f"✅ Successfully created {output_path}")
            except IOError as e:
                print(f"❌ Error writing to file {output_path}: {e}")
        else:
            print("Warning: Could not determine filename for a block, skipping.")

if __name__ == "__main__":
    main()