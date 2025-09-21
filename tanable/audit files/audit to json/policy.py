import json
import re

def parse_attributes(attr_string):
    """
    Parses key-value attributes from a tag's attribute string.
    Example: 'type:"Windows" version:"2"' -> {'type': 'Windows', 'version': '2'}
    """
    attributes = {}
    # Regex to find key:"value" pairs
    pattern = re.compile(r'(\w+)\s*:\s*(".*?")')
    matches = pattern.findall(attr_string)
    for key, value in matches:
        # Remove quotes from the value
        attributes[key] = value.strip('"')
    return attributes

def parse_custom_item(item_content):
    """
    Parses the key-value pairs inside a <custom_item> block.
    """
    item_dict = {}
    # Regex to find key : value lines
    pattern = re.compile(r'^\s*([\w_]+)\s+:\s+(.*)', re.MULTILINE)
    lines = item_content.strip().split('\n')
    
    # Using a more robust way to handle multi-line values
    current_key = None
    for line in lines:
        match = re.match(r'^\s*([\w_]+)\s+:\s+(.*)', line)
        if match:
            key, value = match.groups()
            current_key = key.strip()
            item_dict[current_key] = value.strip().strip('"')
        elif current_key and line.strip(): # It's a continuation of the previous key
            # Append the line to the existing value
            item_dict[current_key] += ' ' + line.strip().strip('"')

    return item_dict


def parse_to_dict(text_data):
    """
    Recursively parses the custom text format into a nested Python dictionary.
    """
    # Using a stack to handle nested structures
    stack = [{}]
    # Find all tags and the content between them
    # This regex is complex and handles opening tags, closing tags, and content
    # It captures: 1. Closing tag, 2. Opening tag with attributes, 3. Content between tags
    pattern = re.compile(r'</([a-zA-Z_]+)>|<([a-zA-Z_]+)([^>]*)>|([^<]+)', re.DOTALL)
    
    for match in pattern.finditer(text_data):
        closing_tag, opening_tag, attrs, content = match.groups()

        if opening_tag:
            # Create a new dictionary for the new tag
            new_node = {}
            # Parse attributes if they exist
            if attrs:
                new_node.update(parse_attributes(attrs))

            # Special handling for custom_item and report which have multiline content
            if opening_tag in ['custom_item', 'report']:
                # Find the end of this specific tag to capture all its content
                end_tag_regex = f"</{opening_tag}>"
                end_match = re.search(end_tag_regex, text_data[match.end():])
                if end_match:
                    # Extract the content within the custom_item block
                    item_content = text_data[match.end():match.end() + end_match.start()]
                    parsed_item = parse_custom_item(item_content)
                    new_node.update(parsed_item)

            # Get the current dictionary from the top of the stack
            parent = stack[-1]
            # Add the new node to the parent
            # If the tag already exists, turn it into a list
            if opening_tag not in parent:
                parent[opening_tag] = new_node
            elif isinstance(parent[opening_tag], list):
                parent[opening_tag].append(new_node)
            else:
                parent[opening_tag] = [parent[opening_tag], new_node]
            
            # Push the new node onto the stack to handle nested children
            stack.append(new_node)

        elif closing_tag:
            # When a tag closes, pop from the stack to go back to the parent context
            if len(stack) > 1:
                stack.pop()

    # The final result is the first item on the stack
    return stack[0]

def convert_file_to_json(input_filepath, output_filepath):
    """
    Reads the input file, converts its content to JSON, and saves it to the output file.
    """
    try:
        with open(input_filepath, 'r') as f:
            # Read the file and remove the outer braces if they exist
            content = f.read().strip()
            if content.startswith('{') and content.endswith('}'):
                content = content[1:-1].strip()

        # Parse the text content into a dictionary
        parsed_dict = parse_to_dict(content)
        
        # Convert the dictionary to a JSON string with indentation
        json_output = json.dumps(parsed_dict, indent=4)
        
        # Write the JSON string to the output file
        with open(output_filepath, 'w') as f:
            f.write(json_output)
            
        print(f"Successfully converted '{input_filepath}' to '{output_filepath}'")
        
    except FileNotFoundError:
        print(f"Error: The file '{input_filepath}' was not found.")
    except Exception as e:
        print(f"An error occurred: {e}")

# --- Main Execution ---
if __name__ == "__main__":
    # Define the input and output file paths
    # The user should replace 'test.txt' with their actual file name
    input_file = r'C:\Users\pankaj\OneDrive\Documents\cis\tanable\CIS_Microsoft_Windows_11_Stand-alone_v4.0.0_L1.audit' 
    output_file = 'output.json'
    
    # Run the conversion
    convert_file_to_json(input_file, output_file)

# here everything is correct