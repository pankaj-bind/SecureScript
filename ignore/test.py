import re

def extract_unique_types_from_file(file_path):
    """
    Reads an audit file and extracts the unique values from lines starting with 'type'.

    Args:
        file_path (str): The path to the audit file.

    Returns:
        list: A list of the unique extracted type values.
    """
    extracted_values = []
    try:
        with open(file_path, 'r') as file:
            for line in file:
                # Use a regular expression to find 'type' followed by a colon
                # and capture the value after it.
                match = re.search(r'^\s*type\s*:\s*(.*)', line)
                if match:
                    # The value is the first captured group, strip any extra whitespace
                    value = match.group(1).strip()
                    extracted_values.append(value)
    except FileNotFoundError:
        print(f"Error: The file '{file_path}' was not found.")
        return None
    
    # Convert the list to a set to get unique values, then convert back to a list
    unique_values = list(set(extracted_values))
    
    return unique_values

# --- How to Use ---
# 1. Save your content into a file named 'audit_file.txt'.
# 2. Run this Python script.

file_name = r'G:\SecureScript\tanable\audit files\portal_audits\Windows\CIS_Microsoft_Windows_10_Stand-alone_v3.0.0_NG.audit'
unique_types_list = extract_unique_types_from_file(file_name)

if unique_types_list:
    print("Unique Extracted Types:")
    for item_type in unique_types_list:
        print(item_type)