# api/models.py

import os
import random
import importlib.util
from datetime import timedelta
import json

from django.conf import settings
from django.contrib.auth.models import User
from django.db import models
from django.db.models.signals import post_save, pre_save, pre_delete
from django.dispatch import receiver
from django.utils import timezone
from django.utils.text import slugify

# --- Model for Audit Parsers ---
def get_audit_parser_upload_path(instance, filename):
    """
    Determines the upload path for an audit parser file, organizing it
    into a directory named after the parser instance.
    """
    # Sanitize the instance name to create a valid directory name
    dir_name = "".join(x for x in instance.name if x.isalnum() or x in " .-_").rstrip()
    return os.path.join('audit_parsers', dir_name, filename)


class AuditParser(models.Model):
    name = models.CharField(max_length=100, unique=True, help_text="A unique name for the parser, e.g., 'Google Chrome Parser'")
    parser_file = models.FileField(upload_to=get_audit_parser_upload_path, help_text="Upload the audit_parser.py file.")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ['name']
        verbose_name = "Audit Parser"
        verbose_name_plural = "Audit Parsers"


# --- Model for Password Reset ---
class PasswordResetOTP(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    otp = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)

    def is_valid(self):
        return timezone.now() < self.created_at + timedelta(minutes=5)

    @staticmethod
    def generate_otp():
        return str(random.randint(100000, 999999))


# --- Models for the Benchmark Directory ---
class TechnologyType(models.Model):
    name = models.CharField(max_length=100, unique=True, help_text="e.g., Cloud Providers")
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Technology Type"
        verbose_name_plural = "Technology Types"
        ordering = ['name']


class Organization(models.Model):
    name = models.CharField(max_length=100, unique=True, help_text="e.g., Amazon Web Services")
    technology_type = models.ForeignKey(TechnologyType, on_delete=models.CASCADE, related_name='organizations')
    logo = models.URLField(
        max_length=500,
        blank=True,
        null=True,
        help_text="Paste the full URL of the organization's logo image"
    )
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ['name']


class Product(models.Model):
    # --- Choices for the page viewer ---
    VIEWER_CHOICES = [
        ('Default', 'Default Viewer'),
        ('Microsoft Edge', 'Microsoft Edge Viewer'),
        ('Google Chrome', 'Google Chrome Viewer'),
        ('Windows 11 Standalone', 'Windows 11 Standalone Viewer'),
        ('Windows 11 Enterprise', 'Windows 11 Enterprise Viewer'),
    ]

    name = models.CharField(
        max_length=255,
        help_text="e.g., CIS Foundation Benchmark v2.0.0",
        editable=False,
        default='<Name will be generated automatically>'
    )
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='products')

    audit_parser = models.ForeignKey(
        AuditParser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Select the audit parser to process the Tenable audit file."
    )

    page_viewer = models.CharField(
        max_length=100,
        choices=VIEWER_CHOICES,
        default='Default',
        help_text="Select the frontend component to use for displaying this product's details."
    )

    cis_benchmark_pdf = models.FileField(
        upload_to='cis_benchmarks/',
        blank=True,
        null=True,
        help_text="Upload the CIS Benchmark PDF file"
    )
    tenable_audit_file = models.FileField(
        upload_to='tenable_audits/',
        blank=True,
        null=True,
        help_text="Upload the Tenable audit file. This will be processed to generate JSON data."
    )
    audit_json_output_path = models.CharField(
        max_length=512,
        blank=True,
        null=True,
        editable=False,
        help_text="Path to the generated JSON output from the audit file."
    )
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ['name']


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='userprofile')

    first_name = models.CharField(max_length=50, blank=True)
    last_name = models.CharField(max_length=50, blank=True)
    phone_number = models.CharField(max_length=20, blank=True)
    company_name = models.CharField(max_length=100, blank=True, help_text="Your company name")

    GENDER_CHOICES = [
        ('male', 'Male'),
        ('female', 'Female'),
        ('other', 'Other'),
        ('prefer_not_to_say', 'Prefer not to say'),
    ]
    gender = models.CharField(max_length=20, choices=GENDER_CHOICES, blank=True)

    profile_picture = models.ImageField(
        upload_to='profile_pictures/',
        blank=True,
        null=True,
        help_text="Upload your profile picture"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username}'s Profile"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    @property
    def display_name(self):
        return self.full_name if self.full_name else self.user.username

    class Meta:
        verbose_name = "User Profile"
        verbose_name_plural = "User Profiles"

# Template Model
class Template(models.Model):
    id = models.CharField(max_length=14, primary_key=True, unique=True, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='templates')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='templates')
    policies = models.JSONField(default=list)
    # Store generated scripts
    harden_script = models.TextField(blank=True)
    check_script = models.TextField(blank=True)
    revert_script = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = timezone.now().strftime('%d%m%Y%H%M%S')
        super(Template, self).save(*args, **kwargs)

    def __str__(self):
        return f"Template {self.id} for {self.product.name} by {self.user.username}"

    class Meta:
        ordering = ['-created_at']

# Helper function for report upload path
def get_report_upload_path(instance, filename):
    """
    Determines the upload path for a report PDF, organizing it by template ID.
    """
    product_name_slug = slugify(instance.template.product.name)
    template_id = instance.template.id
    return os.path.join(
        'generated_reports',
        product_name_slug,
        template_id,
        filename
    )

# Model for storing generated reports
class Report(models.Model):
    REPORT_TYPE_CHOICES = [
        ('Audit-Report', 'Audit Report'),
        ('Hardening-Report', 'Hardening Report'),
        ('Revert-Hardening-Report', 'Revert Hardening Report'),
    ]

    template = models.ForeignKey(Template, on_delete=models.CASCADE, related_name='reports')
    report_type = models.CharField(max_length=50, choices=REPORT_TYPE_CHOICES)
    serial_number = models.CharField(max_length=255)
    results = models.JSONField(default=list, help_text="The policy-by-policy pass/fail results.")
    pdf_file = models.FileField(upload_to=get_report_upload_path, max_length=512)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.get_report_type_display()} for Template {self.template.id}"

    class Meta:
        ordering = ['-created_at']

# --- SIGNALS ---

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    if hasattr(instance, 'userprofile'):
        instance.userprofile.save()

@receiver(pre_save, sender=UserProfile)
def delete_old_profile_picture(sender, instance, **kwargs):
    if not instance.pk:
        return
    try:
        old_instance = UserProfile.objects.get(pk=instance.pk)
    except UserProfile.DoesNotExist:
        return
    if old_instance.profile_picture and instance.profile_picture != old_instance.profile_picture:
        if os.path.isfile(old_instance.profile_picture.path):
            os.remove(old_instance.profile_picture.path)

@receiver(post_save, sender=Product)
def update_organization_on_product_save(sender, instance, **kwargs):
    try:
        instance.organization.save()
    except Organization.DoesNotExist:
        pass

@receiver(post_save, sender=Organization)
def update_technology_type_on_organization_save(sender, instance, **kwargs):
    try:
        instance.technology_type.save()
    except TechnologyType.DoesNotExist:
        pass

_product_old_tenable_file = {}

@receiver(pre_save, sender=Product)
def product_pre_save_receiver(sender, instance, **kwargs):
    if instance.pk:
        try:
            _product_old_tenable_file[instance.pk] = sender.objects.get(pk=instance.pk).tenable_audit_file
        except sender.DoesNotExist:
            _product_old_tenable_file[instance.pk] = None

@receiver(post_save, sender=Product)
def process_audit_file_receiver(sender, instance, created, **kwargs):
    old_file = _product_old_tenable_file.get(instance.pk)
    new_file = instance.tenable_audit_file

    if new_file and old_file != new_file and instance.audit_parser:
        try:
            parser_file_path = instance.audit_parser.parser_file.path
            module_name = f"dynamic_parsers.{instance.audit_parser.name.replace(' ', '_')}"

            spec = importlib.util.spec_from_file_location(module_name, parser_file_path)
            parser_module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(parser_module)

            if not hasattr(parser_module, 'process_audit_file'):
                print(f"Error: 'process_audit_file' function not found in {parser_file_path}")
                return

            process_audit_file_func = parser_module.process_audit_file

            input_file_full_path = instance.tenable_audit_file.path
            output_base_dir = os.path.join(settings.MEDIA_ROOT, 'audit_json_output')

            # --- MODIFICATION START ---
            # Set a fallback product name from the filename
            filename = os.path.basename(input_file_full_path)
            base_name = os.path.splitext(filename)[0]
            product_name = base_name.replace('_', ' ')

            generated_folder_path = process_audit_file_func(input_file_full_path, output_base_dir)

            if generated_folder_path:
                # Try to read display_name from metadata.json
                metadata_path = os.path.join(generated_folder_path, 'metadata.json')
                try:
                    if os.path.exists(metadata_path):
                        with open(metadata_path, 'r', encoding='utf-8') as f:
                            metadata = json.load(f)
                            # Use the display_name if it exists and is not empty
                            if 'display_name' in metadata and metadata['display_name']:
                                product_name = metadata['display_name']
                except (IOError, json.JSONDecodeError) as e:
                    print(f"Warning: Could not read or parse metadata.json: {e}. Using fallback name.")

                relative_output_path = os.path.relpath(generated_folder_path, settings.MEDIA_ROOT)
                Product.objects.filter(pk=instance.pk).update(
                    name=product_name,
                    audit_json_output_path=relative_output_path
                )
            # --- MODIFICATION END ---
        except Exception as e:
            print(f"Error processing audit file with parser {instance.audit_parser.name}: {e}")