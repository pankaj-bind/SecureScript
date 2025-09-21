import fitz  # PyMuPDF
import sys

# --- CONFIGURATION ---
# IMPORTANT: Replace "your_document.pdf" with the actual name of your PDF file.
pdf_file_path = r"C:\Users\pankaj\OneDrive\Documents\cis\tanable\pdf files\CIS_Google_Cloud_Platform_Foundation_Benchmark_v4.0.0.pdf"
# ---------------------

try:
    # Open the PDF file
    doc = fitz.open(pdf_file_path)
except Exception as e:
    print(f"Error opening PDF file: {e}")
    print("Please make sure the file path is correct and the file is not corrupted.")
    sys.exit(1)

# Get the table of contents (bookmarks)
# The get_toc() method returns a list of lists.
# Each inner list has the format: [level, title, page_number]
toc = doc.get_toc()

if not toc:
    print(f"The document '{pdf_file_path}' does not have a Table of Contents (bookmarks).")
else:
    for item in toc:
        level = item[0]
        title = item[1]

        # Use the 'level' to create indentation for a hierarchical view
        # We subtract 1 from the level because top-level items (level 1) should have no indent.
        indent = "  " * (level - 1)

        # Print the formatted title
        print(f"{indent}- {title}")

# Close the document
doc.close()