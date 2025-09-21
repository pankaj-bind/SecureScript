# api/admin.py

from django.contrib import admin
from django.utils.html import format_html
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import User
from django import forms
import os
from django.conf import settings
from .models import TechnologyType, Organization, Product, UserProfile, AuditParser, Template, Report

# --- Admin for AuditParser ---
@admin.register(AuditParser)
class AuditParserAdmin(admin.ModelAdmin):
    list_display = ('name', 'parser_file', 'created_at', 'updated_at')
    search_fields = ('name',)
    readonly_fields = ('created_at', 'updated_at')

# --- Admin for Template ---
@admin.register(Template)
class TemplateAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'product', 'created_at')
    list_filter = ('user', 'product__organization')
    search_fields = ('id', 'user__username', 'product__name')
    readonly_fields = ('id', 'created_at')

# --- Admin for Report ---
@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ('id', 'template', 'report_type', 'serial_number', 'created_at')
    list_filter = ('report_type', 'template__user', 'template__product__organization')
    search_fields = ('serial_number', 'template__id')
    readonly_fields = ('id', 'created_at')

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