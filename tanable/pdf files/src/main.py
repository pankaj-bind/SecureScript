import os
import json
import re
import time
import fitz  # PyMuPDF
import google.generativeai as genai
from dotenv import load_dotenv

def extract_text_from_pdf(pdf_path):
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"The file was not found at: {pdf_path}")
    
    print(f"Extracting text from the PDF: {os.path.basename(pdf_path)}...")
    full_text = ""
    with fitz.open(pdf_path) as doc:
        for page in doc:
            full_text += page.get_text()
    return full_text

def generate_toc_from_chunks(text_chunks):
    """Processes text chunks and combines the results."""
    full_toc = {"recommendations": []}
    
    # Initialize the model once
    load_dotenv()
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("API key not found. Please set 'GEMINI_API_KEY' in your .env file.")
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-1.5-flash') # Or 'gemini-1.5-pro'

    for i, chunk in enumerate(text_chunks):
        print(f"Processing chunk {i+1} of {len(text_chunks)}...")
        try:
            prompt = f"""
            From the following text of a CIS Benchmark document, extract any Table of Contents entries.
            Format the output as a single JSON object with a root key "recommendations". Maintain the exact structure including IDs, titles, profiles, and children arrays.
            If this chunk is part of a larger document, only extract the items present in this text.

            --- TEXT CHUNK BEGIN ---
            {chunk}
            --- TEXT CHUNK END ---
            """
            
            response = model.generate_content(prompt)
            
            cleaned_json_match = re.search(r'```json\s*([\s\S]*?)\s*```', response.text)
            if cleaned_json_match:
                json_string = cleaned_json_match.group(1)
            else:
                json_string = response.text

            chunk_data = json.loads(json_string)
            
            if "recommendations" in chunk_data and chunk_data["recommendations"]:
                # A more robust solution would deeply merge the JSON trees.
                # For simplicity here, we are appending top-level items.
                full_toc["recommendations"].extend(chunk_data["recommendations"])

            # Wait to avoid hitting the rate limit again
            print("Waiting for 15 seconds before the next request...")
            time.sleep(15)

        except Exception as e:
            print(f"An error occurred on chunk {i+1}: {e}")
            print("Skipping this chunk.")
            time.sleep(15) # Wait even if there's an error
            
    return full_toc

if __name__ == "__main__":
    pdf_file_path = os.path.join("data", r"C:\Users\pankaj\OneDrive\Documents\cis\tanable\pdf files\CIS_Microsoft_Edge_Benchmark_v3.0.0.pdf")
    
    try:
        pdf_text = extract_text_from_pdf(pdf_file_path)
        
        if pdf_text:
            # Split the text into chunks of 15,000 characters
            chunk_size = 15000
            chunks = [pdf_text[i:i + chunk_size] for i in range(0, len(pdf_text), chunk_size)]
            
            toc_data = generate_toc_from_chunks(chunks)

            if toc_data and toc_data["recommendations"]:
                print("\n✅ Successfully extracted the complete Table of Contents:")
                print(json.dumps(toc_data, indent=2))
            else:
                print("\nCould not extract the table of contents. The result is empty.")

    except FileNotFoundError as e:
        print(f"Error: {e}")