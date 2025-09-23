# api/admin.py

from django.contrib import admin
from django.utils.html import format_html
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import User
from django import forms
import os
from django.conf import settings
from .models import TechnologyType, Organization, Product, UserProfile, AuditParser, Template, Report, Script
from django.urls import path
from django.http import HttpResponse, HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django.contrib import messages
from django.urls import reverse
import json

# --- Admin for AuditParser ---
@admin.register(AuditParser)
class AuditParserAdmin(admin.ModelAdmin):
    list_display = ('name', 'parser_file', 'created_at', 'updated_at')
    search_fields = ('name',)
    readonly_fields = ('created_at', 'updated_at')

# --- Admin for Template (Removed) ---
# @admin.register(Template)
# class TemplateAdmin(admin.ModelAdmin):
#     list_display = ('id', 'user', 'product', 'created_at')
#     list_filter = ('user', 'product__organization')
#     search_fields = ('id', 'user__username', 'product__name')
#     readonly_fields = ('id', 'created_at')

# --- Admin for Report ---
@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ('id', 'template', 'report_type', 'serial_number', 'created_at')
    list_filter = ('report_type', 'template__user', 'template__product__organization')
    search_fields = ('serial_number', 'template__id')
    readonly_fields = ('id', 'created_at')

# --- Admin for Script Editing (using a Proxy Model) ---
@admin.register(Script)
class ScriptAdmin(admin.ModelAdmin):
    """
    This admin interface provides a list of products and a link to a custom
    editor for the 'script.json' file associated with each product.
    """
    list_display = ('name', 'organization', 'edit_script_link')
    list_filter = ('organization',)
    search_fields = ('name', 'organization__name')
    list_display_links = None # Disable links on the list display items

    def get_queryset(self, request):
        # Only show products with a generated audit path, as they are the only ones with scripts.
        return super().get_queryset(request).filter(audit_json_output_path__isnull=False).exclude(audit_json_output_path__exact='')

    # Disable the default add, change, and delete actions for this proxy view
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    @admin.display(description='Action')
    def edit_script_link(self, obj):
        """Creates a button that links to our custom script editing view."""
        url = reverse('admin:api_script_edit', args=[obj.pk])
        return format_html('<a href="{}" class="button">Edit script.json</a>', url)

    def get_urls(self):
        """Adds the custom URL for our script editor view."""
        urls = super().get_urls()
        custom_urls = [
            path('<path:object_id>/edit/', self.admin_site.admin_view(self.edit_script_view), name='api_script_edit'),
        ]
        return custom_urls + urls

    def edit_script_view(self, request, object_id):
        """
        A custom admin view that renders a simple HTML form to edit the
        contents of the script.json file.
        """
        product = get_object_or_404(Product, pk=object_id)
        script_path = os.path.join(
            settings.MEDIA_ROOT, product.audit_json_output_path, 'commands', 'script.json'
        )

        if not os.path.exists(script_path):
            messages.error(request, "The file 'script.json' was not found for this product.")
            return HttpResponseRedirect(reverse('admin:api_script_changelist'))

        # Handle form submission
        if request.method == 'POST':
            script_content = request.POST.get('script_content', '')
            try:
                # Validate that the submitted content is valid JSON
                parsed_json = json.loads(script_content)
                with open(script_path, 'w', encoding='utf-8') as f:
                    json.dump(parsed_json, f, indent=4)
                messages.success(request, "The 'script.json' file has been updated successfully.")
                return HttpResponseRedirect(reverse('admin:api_script_changelist'))
            except json.JSONDecodeError:
                messages.error(request, "Invalid JSON. Please check the syntax and try again.")
            except IOError as e:
                messages.error(request, f"Failed to write to the file: {e}")
                return HttpResponseRedirect(reverse('admin:api_script_changelist'))
        
        # On initial page load (GET) or if the POST submission failed, show the editor
        current_content = ""
        if request.method == 'GET':
            try:
                with open(script_path, 'r', encoding='utf-8') as f:
                    current_content = f.read()
            except IOError as e:
                messages.error(request, f"Failed to read 'script.json': {e}")
                return HttpResponseRedirect(reverse('admin:api_script_changelist'))
        else: # On a failed POST, repopulate with the invalid content for correction
            current_content = request.POST.get('script_content', '')

        # Construct the HTML page with a form manually to avoid needing a separate template file
        html_page = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <title>Edit Script for {product.name}</title>
            <style>
                body {{ font-family: sans-serif; margin: 2em; background-color: #f8f8f8; color: #333; }}
                h1 {{ color: #555; }}
                em {{ font-style: normal; font-weight: bold; color: #000; }}
                form {{ background-color: white; padding: 2em; border: 1px solid #ddd; border-radius: 4px; }}
                textarea {{ width: 95%; height: 65vh; font-family: monospace; border: 1px solid #ccc; padding: 10px; font-size: 14px; }}
                .controls {{ margin-top: 1.5em; }}
                .btn {{ padding: 10px 15px; border-radius: 4px; border: none; cursor: pointer; font-weight: bold; }}
                .btn-save {{ background-color: #417690; color: white; }}
                .btn-cancel {{ background-color: #e0e0e0; color: #333; text-decoration: none; display: inline-block; }}
            </style>
        </head>
        <body>
            <h1>Edit <code>script.json</code> for Product: <em>{product.name}</em></h1>
            <form method="post">
                <input type="hidden" name="csrfmiddlewaretoken" value="{request.COOKIES.get('csrftoken', '')}">
                <div><textarea name="script_content">{current_content}</textarea></div>
                <div class="controls">
                    <button type="submit" class="btn btn-save">Save Changes</button>
                    <a href="{reverse('admin:api_script_changelist')}" class="btn btn-cancel">Cancel</a>
                </div>
            </form>
        </body>
        </html>
        """
        return HttpResponse(html_page)

# --- Custom Form for Product Admin Validation ---
class ProductAdminForm(forms.ModelForm):
    class Meta:
        model = Product
        fields = '__all__'

    def clean_tenable_audit_file(self):
        """
        Validates that the uploaded tenable_audit_file has a unique name.
        """
        uploaded_file = self.cleaned_data.get('tenable_audit_file')

        if not uploaded_file or not uploaded_file.name:
            return uploaded_file

        if self.instance.pk and self.instance.tenable_audit_file == uploaded_file:
             return uploaded_file

        file_name = os.path.basename(uploaded_file.name)

        query = Product.objects.filter(tenable_audit_file__endswith=file_name)

        if self.instance.pk:
            query = query.exclude(pk=self.instance.pk)

        if query.exists():
            raise forms.ValidationError(
                f"An audit file named '{file_name}' already exists. Please upload a file with a unique name."
            )

        return uploaded_file

class ProductInline(admin.TabularInline):
    model = Product
    extra = 1
    fields = ('cis_benchmark_pdf', 'tenable_audit_file', 'audit_parser', 'page_viewer')


@admin.register(TechnologyType)
class TechnologyTypeAdmin(admin.ModelAdmin):
    list_display = ('name',)
    search_fields = ('name',)

@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ('name', 'technology_type', 'logo_preview')
    list_filter = ('technology_type',)
    search_fields = ('name',)
    inlines = [ProductInline]

    fieldsets = (
        (None, {
            'fields': ('name', 'technology_type')
        }),
        ('Logo', {
            'description': "Paste the complete URL of the organization's logo image.",
            'fields': ('logo', 'logo_preview'),
        }),
    )
    readonly_fields = ('logo_preview',)

    @admin.display(description='Logo Preview')
    def logo_preview(self, obj):
        """Displays a thumbnail of the logo in the admin panel."""
        if obj.logo:
            return format_html(
                '<img src="{}" width="60" height="60" style="object-fit: contain; border: 1px solid #ddd; padding: 5px;" onerror="this.style.display=\'none\'; this.nextSibling.style.display=\'inline\';" /><span style="display:none; color:red;">Invalid Image URL</span>',
                obj.logo
            )
        return "No Logo Provided"

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    form = ProductAdminForm

    list_display = ('name', 'organization', 'get_technology_type', 'audit_parser', 'page_viewer', 'has_cis_pdf', 'has_tenable_file', 'view_generated_output_link')
    list_filter = ('organization__technology_type', 'organization', 'audit_parser', 'page_viewer')
    search_fields = ('name', 'organization__name')

    fieldsets = (
        (None, {
            'fields': ('organization', 'audit_parser', 'page_viewer')
        }),
        ('Files', {
            'description': "Upload the benchmark and audit files for this product. The product name and audit JSON will be generated automatically from the Tenable audit file.",
            'fields': ('cis_benchmark_pdf', 'tenable_audit_file', 'audit_json_output_path', 'view_generated_output_link'),
        }),
    )
    readonly_fields = ('audit_json_output_path', 'view_generated_output_link',)

    @admin.display(description='View Output')
    def view_generated_output_link(self, obj):
        """Creates a clickable link to the generated JSON output directory."""
        if obj.audit_json_output_path:
            url = os.path.join(settings.MEDIA_URL, obj.audit_json_output_path)
            return format_html('<a href="{}" target="_blank">View Files</a>', url)
        return "Not processed yet"

    @admin.display(description='Technology Type', ordering='organization__technology_type')
    def get_technology_type(self, obj):
        return obj.organization.technology_type

    @admin.display(description='CIS PDF', boolean=True)
    def has_cis_pdf(self, obj):
        return bool(obj.cis_benchmark_pdf)

    @admin.display(description='Tenable File', boolean=True)
    def has_tenable_file(self, obj):
        return bool(obj.tenable_audit_file)

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'full_name', 'company_name', 'phone_number', 'profile_picture_preview')
    list_filter = ('created_at', 'company_name')
    search_fields = ('user__username', 'user__email', 'first_name', 'last_name', 'phone_number', 'company_name')

    fieldsets = (
        ('User Information', {
            'fields': ('user', 'first_name', 'last_name', 'phone_number', 'company_name')
        }),
        ('Profile Picture', {
            'fields': ('profile_picture', 'profile_picture_preview')
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    readonly_fields = ('profile_picture_preview', 'created_at', 'updated_at')

    @admin.display(description='Profile Picture')
    def profile_picture_preview(self, obj):
        if obj.profile_picture:
            return format_html(
                '<img src="{}" width="80" height="80" style="object-fit: cover; border-radius: 50%;" />',
                obj.profile_picture.url
            )
        return "No Picture"

# Extend the default User admin to show profile link
class CustomUserAdmin(UserAdmin):
    def profile_link(self, obj):
        if hasattr(obj, 'userprofile'):
            return format_html(
                '<a href="/admin/api/userprofile/{}/change/">View Profile</a>',
                obj.userprofile.id
            )
        return "No Profile"

    profile_link.short_description = "Profile"
    list_display = UserAdmin.list_display + ('profile_link',)

# Unregister the default User admin and register our custom one
admin.site.unregister(User)
admin.site.register(User, CustomUserAdmin)