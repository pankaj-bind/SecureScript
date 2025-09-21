import os
import json
import re
import time
import fitz  # PyMuPDF
from openai import OpenAI
from dotenv import load_dotenv

def extract_text_from_pdf(pdf_path):
    """
    Opens a PDF file and extracts all text from its pages.
    """
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"The file was not found at: {pdf_path}")
    
    print(f"Extracting text from the PDF: {os.path.basename(pdf_path)}...")
    full_text = ""
    with fitz.open(pdf_path) as doc:
        for page in doc:
            full_text += page.get_text()
    return full_text

def generate_toc_with_perplexity(pdf_text_content):
    """
    Sends the full PDF text to the Perplexity API to extract the Table of Contents.
    """
    try:
        load_dotenv()
        api_key = os.getenv("PERPLEXITY_API_KEY")
        if not api_key:
            raise ValueError("API key not found. Please set 'PERPLEXITY_API_KEY' in your .env file.")
        
        # Configure the client to use Perplexity's API
        client = OpenAI(api_key=api_key, base_url="https://api.perplexity.ai")

        # The system prompt instructs the model on its role and the desired output format
        system_prompt = """
        You are an expert assistant designed to parse technical documents and extract a structured Table of Contents.
        The user will provide text from a PDF. Your task is to return a single, valid JSON object that represents the hierarchical structure of the table of contents.
        The JSON should have a root key "recommendations".
        - Each main entry should have an "id" and a "title".
        - If an entry has sub-items, it must include a "children" array.
        - For the lowest-level recommendation items (e.g., 1.2.1), include "profile" (L1/L2) and "assessment" (Automated/Manual).
        Do not include any text or explanations outside of the JSON object itself.
        """
        
        # The user prompt contains the actual text to be processed
        user_prompt = f"""
        Please extract the complete Table of Contents from the following text:

        --- PDF TEXT BEGIN ---
        {pdf_text_content}
        --- PDF TEXT END ---
        """

        print("Generating content with the Perplexity API...")
        
        response = client.chat.completions.create(
            model="llama-3-sonar-large-32k-online", # Or "llama-3-sonar-small-32k-online" for faster responses
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )

        json_string = response.choices[0].message.content
        
        # Clean the response to ensure it's just the JSON
        cleaned_json_match = re.search(r'```json\s*([\s\S]*?)\s*```', json_string)
        if cleaned_json_match:
            json_string = cleaned_json_match.group(1)
            
        return json.loads(json_string)

    except Exception as e:
        print(f"An error occurred: {e}")
        return None

if __name__ == "__main__":
    pdf_file_path = os.path.join("data", r"C:\Users\pankaj\OneDrive\Documents\cis\tanable\pdf files\CIS_Microsoft_Edge_Benchmark_v3.0.0.pdf")
    
    try:
        pdf_text = extract_text_from_pdf(pdf_file_path)
        
        if pdf_text:
            toc_data = generate_toc_with_perplexity(pdf_text)

            if toc_data:
                print("\n✅ Successfully extracted the complete Table of Contents:")
                print(json.dumps(toc_data, indent=2))
            else:
                print("\nCould not extract the table of contents.")

    except FileNotFoundError as e:
        print(f"Error: {e}")