import os
import time
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler


# --- Configuration ---
FOLDER_TO_WATCH = "frontend"
OUTPUT_FILENAME = "frontend.txt"
# Time to wait after a change before regenerating to group multiple quick changes (e.g., save-all)
DEBOUNCE_SECONDS = 2.0


# --- Report Generation Logic (from previous script) ---


def generate_structure_string(root_path, indent="", exclude_dirs=None):
    """Recursively generates a string representing the folder structure."""
    if exclude_dirs is None:
        exclude_dirs = {'.git', '__pycache__', 'venv', '.venv', 'node_modules', '.vscode', 'build'}
    
    lines = []
    try:
        # Sort items for consistent order
        items = sorted(os.listdir(root_path))
    except (FileNotFoundError, PermissionError):
        return []


    for i, name in enumerate(items):
        path = os.path.join(root_path, name)
        is_last = i == (len(items) - 1)
        prefix = "└── " if is_last else "├── "
        
        if os.path.isdir(path):
            if name in exclude_dirs:
                continue
            lines.append(f"{indent}{prefix}{name}/")
            child_indent = indent + ("    " if is_last else "│   ")
            lines.extend(generate_structure_string(path, child_indent, exclude_dirs))
        else:
            # Exclude the output file itself from the structure
            if name == OUTPUT_FILENAME:
                continue
            lines.append(f"{indent}{prefix}{name}")
            
    return lines


def is_text_file(filepath):
    """Heuristically checks if a file is text-based."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            f.read(512)
        return True
    except (UnicodeDecodeError, AttributeError, IOError):
        return False


def generate_folder_report(root_path, output_file):
    """Generates a detailed report of a folder's structure and file contents."""
    path_obj = Path(root_path)
    if not path_obj.is_dir():
        print(f"❌ Error: The directory '{root_path}' does not exist.")
        return


    print(f"🔄 Regenerating report for '{root_path}'...")
    
    exclude_dirs = {'.git', '__pycache__', 'venv', '.venv', 'node_modules', '.vscode', 'build'}
    exclude_files = {'.DS_Store', output_file} # IMPORTANT: Exclude the output file
    
    report_parts = []
    
    # 1. Generate Directory Structure
    report_parts.append("Directory structure:")
    structure_lines = generate_structure_string(str(path_obj), exclude_dirs=exclude_dirs)
    report_parts.extend(structure_lines)
    report_parts.append("\n\nFiles Content:\n")


    # 2. Walk through and get file contents
    for root, dirs, files in os.walk(root_path, topdown=True):
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        
        for filename in sorted(files):
            if filename in exclude_files:
                continue
            
            file_path = Path(root) / filename
            relative_path = file_path.relative_to(root_path)
            separator = "=" * 48
            report_parts.append(f"{separator}\nFILE: {relative_path}\n{separator}")
            
            try:
                if is_text_file(file_path):
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                        report_parts.append(content)
                else:
                    report_parts.append("[Binary file, content not displayed]")
            except Exception as e:
                report_parts.append(f"[Could not read file: {e}]")
            
            report_parts.append("\n\n")


    # 3. Write the report to the output file
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("\n".join(report_parts))
        print(f"✅ Report successfully updated in '{output_file}'")
    except IOError as e:
        print(f"❌ Error writing to file: {e}")



# --- File System Watcher Logic ---


class ReportEventHandler(FileSystemEventHandler):
    """Handles file system events and triggers report generation."""
    def __init__(self, folder_path, output_filename):
        self.folder_path = folder_path
        self.output_filename = output_filename
        self.last_triggered = 0


    def on_any_event(self, event):
        """
        This method is called for any event (created, deleted, modified, moved).
        """
        # Ignore events related to the output file itself to prevent loops
        if event.src_path.endswith(self.output_filename):
            return
            
        # Debounce: Check if enough time has passed since the last trigger
        current_time = time.time()
        if current_time - self.last_triggered > DEBOUNCE_SECONDS:
            print(f"\n🔔 Change detected: {event.event_type} at {event.src_path}")
            generate_folder_report(self.folder_path, self.output_filename)
            self.last_triggered = current_time



if __name__ == "__main__":
    # Ensure the folder to watch exists
    if not os.path.isdir(FOLDER_TO_WATCH):
        print(f"❌ Error: The folder '{FOLDER_TO_WATCH}' was not found.")
        print("Please create the folder or place this script in the correct parent directory.")
    else:
        # Generate the initial report on startup
        generate_folder_report(FOLDER_TO_WATCH, OUTPUT_FILENAME)
        
        # Set up and start the watcher
        event_handler = ReportEventHandler(FOLDER_TO_WATCH, OUTPUT_FILENAME)
        observer = Observer()
        observer.schedule(event_handler, FOLDER_TO_WATCH, recursive=True)
        
        print(f"\n🚀 Starting file watcher on folder: '{os.path.abspath(FOLDER_TO_WATCH)}'")
        print("   Any changes will automatically update the report.")
        print("   Press Ctrl+C to stop the watcher.")
        
        observer.start()
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            observer.stop()
            print("\n🛑 Watcher stopped.")
        observer.join()