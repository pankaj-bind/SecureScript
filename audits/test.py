import os

def process_audit_file(input_file_path):
    """
    Processes an audit file by cutting out the middle section.

    It combines the start and end parts into 'metadata.txt' and saves
    the removed middle part into 'skipped_part.txt'.

    Args:
        input_file_path (str): The path to the input .audit file.
    """
    try:
        # Read the entire content of the input file
        with open(input_file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # --- Define the markers for splitting the file ---
        start_marker_end_tag = '</report>'
        end_marker_start_tag = '</then>'

        # --- Find the split points ---
        # Find the end position of the initial part
        start_part_end_pos = content.find(start_marker_end_tag)
        if start_part_end_pos == -1:
            print(f"Error: The tag '{start_marker_end_tag}' was not found.")
            return
        
        # Adjust position to include the tag itself
        start_part_end_pos += len(start_marker_end_tag)

        # Find the start position of the final part
        end_part_start_pos = content.rfind(end_marker_start_tag)
        if end_part_start_pos == -1:
            print(f"Error: The tag '{end_marker_start_tag}' was not found.")
            return

        # --- Extract the three sections of the content ---
        start_content = content[:start_part_end_pos]
        skipped_content = content[start_part_end_pos:end_part_start_pos]
        end_content = content[end_part_start_pos:]

        # --- Create the new files ---
        # 1. Combine the start and end parts into the new metadata.txt
        combined_metadata = start_content + end_content
        with open('metadata.txt', 'w', encoding='utf-8') as f:
            f.write(combined_metadata)
        print("Successfully created metadata.txt with combined start and end parts.")

        # 2. Save the removed middle part
        with open('skipped_part.txt', 'w', encoding='utf-8') as f:
            f.write(skipped_content)
        print("Successfully saved the removed section to skipped_part.txt")

    except FileNotFoundError:
        print(f"Error: The file '{input_file_path}' was not found.")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

# Assuming the uploaded file is named 'input.txt' in the same directory
input_filename = r'C:\Users\pankaj\OneDrive\Documents\cis\tanable\audit files\portal_audits\GCP\CIS_Google_Cloud_Platform_v3.0.0_L2.audit'
process_audit_file(input_filename)