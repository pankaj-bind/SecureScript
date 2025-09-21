#!/usr/bin/env python3
import sys
import json
import re
import xml.etree.ElementTree as ET

#region: Metadata Parsing Functions (from metadata.py)
def parse_metadata(lines):
    """
    Finds and parses the <ui_metadata> XML block from the file lines.
    """
    xml_lines = []
    in_xml_block = False
    for line in lines:
        stripped_line = line.lstrip('#').strip()
        if stripped_line.startswith('<ui_metadata>'):
            in_xml_block = True
        
        if in_xml_block:
            xml_lines.append(line.lstrip('#'))
            if stripped_line.startswith('</ui_metadata>'):
                break
    
    if not xml_lines:
        return {}

    xml_content = ''.join(xml_lines)
    
    try:
        root = ET.fromstring(xml_content)
        ui_metadata = {}

        for tag in ['display_name', 'labels', 'benchmark_refs']:
             elem = root.find(tag)
             if elem is not None:
                 ui_metadata[tag] = elem.text.strip()

        spec = {}
        spec_elem = root.find('spec')
        if spec_elem is not None:
            for child in spec_elem:
                spec[child.tag] = child.text.strip() if child.text else None
        ui_metadata['spec'] = spec

        variables = []
        variables_elem = root.find('variables')
        if variables_elem is not None:
            for var_elem in variables_elem.findall('variable'):
                var = {
                    'name': var_elem.find('name').text.strip() if var_elem.find('name') is not None else None,
                    'default': var_elem.find('default').text.strip() if var_elem.find('default') is not None else None,
                    'info': var_elem.find('info').text.strip() if var_elem.find('info') is not None else None,
                    'value_type': var_elem.find('value_type').text.strip() if var_elem.find('value_type') is not None else None
                }
                
                description_text = var_elem.find('description').text.strip() if var_elem.find('description') is not None else ""
                match = re.match(r'^(\S+)\s*(?:\((.*?)\))?\s*(.*)$', description_text)
                
                if match:
                    var['id'] = match.group(1)
                    if match.group(2):
                        var['profile'] = match.group(2)
                    var['title'] = match.group(3)
                else:
                    var['description'] = description_text

                variables.append(var)
        ui_metadata['variables'] = variables
        
        return ui_metadata
        
    except ET.ParseError as e:
        print(f"Error parsing metadata XML: {e}", file=sys.stderr)
        return {}

#endregion

#region: Policy Parsing Functions (from policy.py)
def parse_attributes(attr_string):
    """
    Parses key-value attributes from a tag's attribute string.
    """
    attributes = {}
    pattern = re.compile(r'(\w+)\s*:\s*(".*?")')
    matches = pattern.findall(attr_string)
    for key, value in matches:
        attributes[key] = value.strip('"')
    return attributes

def parse_custom_item(item_content):
    """
    Parses the key-value pairs inside a <custom_item> or <report> block.
    """
    item_dict = {}
    pattern = re.compile(r'^\s*([\w\s_]+?)\s*:\s*(.*)', re.MULTILINE)
    matches = pattern.findall(item_content.strip())
    
    for key, value in matches:
        clean_key = key.strip()
        clean_value = value.strip().strip('"')
        
        # --- THIS IS THE FIX ---
        # If the key is 'description', parse it into id, profile, and title.
        if clean_key.lower() == 'description':
            desc_match = re.match(r'^(\S+)\s*(?:\((.*?)\))?\s*(.*)$', clean_value)
            if desc_match:
                item_dict['id'] = desc_match.group(1)
                if desc_match.group(2): # Add profile only if it exists
                    item_dict['profile'] = desc_match.group(2)
                item_dict['title'] = desc_match.group(3)
            else:
                # If format doesn't match, keep original description
                item_dict[clean_key] = clean_value
        else:
            # For all other keys, add them normally
            item_dict[clean_key] = clean_value
            
    return item_dict

def parse_policy(text_data):
    """
    Parses the custom text format into a nested Python dictionary.
    """
    text_data = re.sub(r'#\s*<ui_metadata>.*?</ui_metadata>', '', text_data, flags=re.DOTALL)
    
    stack = [{}]
    pattern = re.compile(r'<(?:/([a-zA-Z_]+)|([a-zA-Z_]+)([^>]*))>', re.DOTALL)
    last_index = 0

    for match in pattern.finditer(text_data):
        content = text_data[last_index:match.start()].strip()
        if content:
            pass

        closing_tag, opening_tag, attrs = match.groups()
        
        if opening_tag:
            new_node = parse_attributes(attrs)
            
            if opening_tag in ['custom_item', 'report']:
                end_tag = f'</{opening_tag}>'
                end_pos = text_data.find(end_tag, match.end())
                if end_pos != -1:
                    item_content = text_data[match.end():end_pos]
                    new_node.update(parse_custom_item(item_content))

            parent = stack[-1]
            if opening_tag not in parent:
                parent[opening_tag] = new_node
            elif isinstance(parent[opening_tag], list):
                parent[opening_tag].append(new_node)
            else:
                parent[opening_tag] = [parent[opening_tag], new_node]
            
            stack.append(new_node)
        
        elif closing_tag:
            if len(stack) > 1:
                stack.pop()

        last_index = match.end()

    return stack[0]

#endregion

def main():
    """
    Main function to read file, parse, and print combined JSON.
    """
    if len(sys.argv) != 2:
        print(f"Usage: python {sys.argv[0]} <path_to_audit_file>", file=sys.stderr)
        sys.exit(1)

    input_file = sys.argv[1]

    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            content = f.read()
            f.seek(0)
            lines = f.readlines()

    except FileNotFoundError:
        print(f"Error: Input file not found at '{input_file}'", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"An error occurred while reading the file: {e}", file=sys.stderr)
        sys.exit(1)
        
    metadata_data = parse_metadata(lines)
    policy_data = parse_policy(content)

    combined_output = {
        "metadata": metadata_data,
        "policy": policy_data
    }

    print(json.dumps(combined_output, indent=2))

if __name__ == "__main__":
    main()