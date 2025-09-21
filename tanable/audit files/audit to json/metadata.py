import sys
import json
import xml.etree.ElementTree as ET

def main():
    if len(sys.argv) != 2:
        print("Usage: python script.py <input_file>")
        sys.exit(1)

    input_file = sys.argv[1]

    try:
        with open(input_file, 'r') as f:
            lines = f.readlines()

        # Process lines to find and extract the XML content starting from <ui_metadata> and ending at </ui_metadata>
        xml_lines = []
        in_xml = False
        for line in lines:
            stripped = line.lstrip('#').strip()
            if stripped.startswith('<ui_metadata>'):
                in_xml = True
            if in_xml:
                # Remove the leading '#' and add the line
                xml_lines.append(line.lstrip('#'))
            if stripped.startswith('</ui_metadata>'):
                break  # Stop once the closing tag is found, ensuring it ends here

        if not in_xml:
            raise ValueError("No <ui_metadata> section found in the input file.")
        if not xml_lines[-1].strip().startswith('</ui_metadata>'):
            raise ValueError("The <ui_metadata> section does not properly end with </ui_metadata>.")

        # Join the XML lines into a single string
        xml_content = ''.join(xml_lines)

        # Parse the XML content
        root = ET.fromstring(xml_content)

        # Build the dictionary structure
        ui_metadata = {}

        # Extract display_name
        ui_metadata['display_name'] = root.find('display_name').text.strip() if root.find('display_name') is not None else None

        # Extract spec
        spec = {}
        spec_elem = root.find('spec')
        if spec_elem is not None:
            spec['type'] = spec_elem.find('type').text.strip() if spec_elem.find('type') is not None else None
            spec['name'] = spec_elem.find('name').text.strip() if spec_elem.find('name') is not None else None
            spec['profile'] = spec_elem.find('profile').text.strip() if spec_elem.find('profile') is not None else None
            spec['version'] = spec_elem.find('version').text.strip() if spec_elem.find('version') is not None else None
            spec['link'] = spec_elem.find('link').text.strip() if spec_elem.find('link') is not None else None
        ui_metadata['spec'] = spec

        # Extract labels
        ui_metadata['labels'] = root.find('labels').text.strip() if root.find('labels') is not None else None

        # Extract benchmark_refs
        ui_metadata['benchmark_refs'] = root.find('benchmark_refs').text.strip() if root.find('benchmark_refs') is not None else None

        # Extract variables
        variables = []
        variables_elem = root.find('variables')
        if variables_elem is not None:
            for var_elem in variables_elem.findall('variable'):
                var = {
                    'name': var_elem.find('name').text.strip() if var_elem.find('name') is not None else None,
                    'default': var_elem.find('default').text.strip() if var_elem.find('default') is not None else None,
                    'description': var_elem.find('description').text.strip() if var_elem.find('description') is not None else None,
                    'info': var_elem.find('info').text.strip() if var_elem.find('info') is not None else None,
                    'value_type': var_elem.find('value_type').text.strip() if var_elem.find('value_type') is not None else None
                }
                variables.append(var)
        ui_metadata['variables'] = variables

        # Wrap in the outer dictionary
        output_data = {"ui_metadata": ui_metadata}

        # Write to output.json
        with open('metadata.json', 'w') as f:
            json.dump(output_data, f, indent=4)

        print("Conversion successful. Output written to 'output.json'.")

    except ET.ParseError as e:
        print(f"Error parsing XML: {e}")
        sys.exit(1)
    except FileNotFoundError:
        print(f"Input file not found: {input_file}")
        sys.exit(1)
    except ValueError as e:
        print(e)
        sys.exit(1)
    except Exception as e:
        print(f"An error occurred: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
