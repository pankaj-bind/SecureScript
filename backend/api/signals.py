# api/signals.py
import os
import shutil
from django.conf import settings
from django.db.models.signals import pre_delete
from django.dispatch import receiver
from .models import Product, Report

@receiver(pre_delete, sender=Product)
def delete_product_files(sender, instance, **kwargs):
    """
    Deletes all associated files and directories when a Product instance is deleted.
    """
    # --- DEBUGGING: Print statements to confirm signal is firing ---
    print(f"--- Deleting files for Product: {instance.name} (ID: {instance.id}) ---")

    # 1. Delete the CIS benchmark PDF file
    if instance.cis_benchmark_pdf:
        if os.path.isfile(instance.cis_benchmark_pdf.path):
            print(f"Attempting to delete PDF: {instance.cis_benchmark_pdf.path}")
            instance.cis_benchmark_pdf.delete(save=False)
            print("PDF deleted successfully.")

    # 2. Delete the Tenable audit file
    if instance.tenable_audit_file:
        if os.path.isfile(instance.tenable_audit_file.path):
            print(f"Attempting to delete audit file: {instance.tenable_audit_file.path}")
            instance.tenable_audit_file.delete(save=False)
            print("Audit file deleted successfully.")

    # 3. Delete the entire directory of generated JSON files
    if instance.audit_json_output_path:
        dir_path = os.path.join(settings.MEDIA_ROOT, instance.audit_json_output_path)
        print(f"Attempting to delete directory: {dir_path}")
        if os.path.isdir(dir_path):
            shutil.rmtree(dir_path)
            print("Directory deleted successfully.")
        else:
            print("Directory not found, skipping.")

    print("--- File deletion signal finished. ---")


@receiver(pre_delete, sender=Report)
def delete_report_pdf_file(sender, instance, **kwargs):
    """
    Deletes the physical PDF file from storage when a Report object is deleted.
    """
    if instance.pdf_file:
        if os.path.isfile(instance.pdf_file.path):
            try:
                os.remove(instance.pdf_file.path)
            except OSError as e:
                print(f"Error deleting report file {instance.pdf_file.path}: {e}")