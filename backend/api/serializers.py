# api/serializers.py

import re
import os
import time
from django.conf import settings
from django.contrib.auth.models import User
from rest_framework import serializers
from dj_rest_auth.registration.serializers import RegisterSerializer
from allauth.account.adapter import get_adapter
from .models import TechnologyType, Organization, Product, UserProfile, AuditParser, Template, Report

# --- Script Update Serializer ---
class ScriptUpdateSerializer(serializers.Serializer):
    """
    Serializer for validating the JSON content for the script file.
    """
    script_content = serializers.JSONField()

    class Meta:
        fields = ['script_content']


# --- Helper function for script generation (FALLBACK ONLY) ---
def get_scripts_for_policy(policy):
    """
    Processes a single policy to generate basic scripts.
    This acts as a fallback if scripts are not provided by the frontend.
    """
    scripts = {
        'harden': f"# No hardening script provided for: {policy.get('description')}",
        'check': f"# No audit script provided for: {policy.get('description')}",
        'revert': f"# No revert script provided for: {policy.get('description')}",
    }
    
    reg_key = policy.get('reg_key')
    reg_item = policy.get('reg_item')
    value_data = policy.get('value_data')
    value_type = policy.get('value_type')
    reg_option = policy.get('reg_option')

    harden_script, check_script, revert_script = '', '', ''

    if reg_option == 'MUST_NOT_EXIST' and value_data:
        harden_script = f'reg delete "{value_data}" /f'
        check_script = f'reg query "{value_data}"'
        revert_script = f"# No automatic revert for MUST_NOT_EXIST policy: {policy.get('description')}"
    elif reg_key and reg_item:
        reg_type = 'REG_DWORD' if value_type == 'POLICY_DWORD' else 'REG_SZ'
        harden_script = f'reg add "{reg_key}" /v "{reg_item}" /t {reg_type} /d "{value_data}" /f'
        check_script = f'reg query "{reg_key}" /v "{reg_item}"'
        revert_script = f'reg delete "{reg_key}" /v "{reg_item}" /f'

    if harden_script:
        scripts['harden'] = harden_script
    if check_script:
        scripts['check'] = check_script
    if revert_script:
        scripts['revert'] = revert_script
        
    return scripts


# --- Template Serializers ---
class TemplateListSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source='product.organization.name', read_only=True)
    benchmark_name = serializers.CharField(source='product.name', read_only=True)
    policy_count = serializers.SerializerMethodField()

    class Meta:
        model = Template
        fields = [
            'id', 'organization_name', 'benchmark_name', 'policies',
            'harden_script', 'check_script', 'revert_script', 'policy_count'
         ]

    def get_policy_count(self, obj):
        return len(obj.policies)

class TemplateCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Template
        fields = ['product', 'policies']

    def create(self, validated_data):
        policies = validated_data.get('policies', [])
        
        harden_script_parts = []
        check_script_parts = []
        revert_script_parts = []

        for policy in policies:
            description = policy.get('description', 'Unknown Policy')
            
            # Prioritize scripts sent from the frontend
            harden = policy.get('hardeningScript')
            check = policy.get('auditScript')
            revert = policy.get('revertHardeningScript')
            
            # If any script is missing, use the fallback generator
            if not all([harden, check, revert]):
                generated_scripts = get_scripts_for_policy(policy)
                harden = harden or generated_scripts['harden']
                check = check or generated_scripts['check']
                revert = revert or generated_scripts['revert']

            harden_script_parts.append(f"# Policy: {description}\n{harden}")
            check_script_parts.append(f"# Policy: {description}\n{check}")
            revert_script_parts.append(f"# Policy: {description}\n{revert}")

        template = Template.objects.create(
            user=self.context['request'].user,
            product=validated_data.get('product'),
            policies=policies,
            harden_script="\n\n".join(harden_script_parts),
            check_script="\n\n".join(check_script_parts),
            revert_script="\n\n".join(revert_script_parts)
        )
        return template

class TemplateDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Template
        fields = ['harden_script', 'check_script', 'revert_script']


# --- Serializers for the Report model ---
class ReportListSerializer(serializers.ModelSerializer):
    """Serializer for listing reports, includes the PDF URL."""
    pdf_url = serializers.SerializerMethodField()
    filename = serializers.SerializerMethodField()

    class Meta:
        model = Report
        fields = ['id', 'report_type', 'created_at', 'pdf_url', 'filename']

    def get_pdf_url(self, obj):
        request = self.context.get('request')
        if obj.pdf_file and request:
            return request.build_absolute_uri(obj.pdf_file.url)
        if obj.pdf_file:
            return obj.pdf_file.url
        return None

    def get_filename(self, obj):
        if obj.pdf_file:
            return os.path.basename(obj.pdf_file.name)
        return f"{obj.report_type} Report"


class ReportCreateSerializer(serializers.ModelSerializer):
    """Serializer used for creating a new report."""
    policies = serializers.JSONField(write_only=True)

    class Meta:
        model = Report
        fields = [
            'report_type', 'serial_number', 'policies'
         ]

    def create(self, validated_data):
        policies_data = validated_data.pop('policies')
        report = Report.objects.create(**validated_data)
        report.results = policies_data
        return report

# --- Other Application Serializers ---

class AuditParserSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditParser
        fields = ['id', 'name', 'parser_file', 'created_at', 'updated_at']
        read_only_fields = ('id', 'created_at', 'updated_at')

    def validate_name(self, value):
        if self.instance and self.instance.name == value:
            return value
        if AuditParser.objects.filter(name=value).exists():
            raise serializers.ValidationError(f"An audit parser with the name '{value}' already exists.")
        return value

class CustomRegisterSerializer(RegisterSerializer):
    def validate_password1(self, value):
        if len(value) < 8:
            raise serializers.ValidationError("Password must be at least 8 characters long.")
        if not re.search(r'[A-Z]', value):
            raise serializers.ValidationError("Password must contain at least one uppercase letter.")
        if not re.search(r'[a-z]', value):
            raise serializers.ValidationError("Password must contain at least one lowercase letter.")
        if not re.search(r'[0-9]', value):
            raise serializers.ValidationError("Password must contain at least one number.")
        if not re.search(r'[\W_]', value):
            raise serializers.ValidationError("Password must contain at least one special character.")
        return value

    def save(self, request):
        adapter = get_adapter()
        user = adapter.new_user(request)
        self.cleaned_data = self.get_cleaned_data()
        setattr(self, '_has_phone_field', False)
        adapter.save_user(request, user, self)
        UserProfile.objects.get_or_create(user=user)
        self.custom_signup(request, user)
        return user

    def custom_signup(self, request, user):
        pass

class OTPRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        if not User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("No user is registered with this email address.")
        return value

class OTPVerifySerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(max_length=6, min_length=6)

class SetNewPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(max_length=6, min_length=6)
    password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})

    def validate_password(self, value):
        # Password validation logic here
        return value

class SimpleProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ['id', 'name']

class ProductDetailSerializer(serializers.ModelSerializer):
    cis_benchmark_pdf_url = serializers.SerializerMethodField()
    tenable_audit_file_url = serializers.SerializerMethodField()
    audit_files = serializers.SerializerMethodField()
    script_json_url = serializers.SerializerMethodField()
    organization_id = serializers.PrimaryKeyRelatedField(source='organization', read_only=True)
    audit_parser = serializers.PrimaryKeyRelatedField(queryset=AuditParser.objects.all(), allow_null=True, required=False)
    page_viewer = serializers.CharField(read_only=True)

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'organization_id', 'audit_parser', 'page_viewer',
            'cis_benchmark_pdf_url', 'tenable_audit_file_url', 'audit_files',
            'script_json_url'
         ]

    def get_script_json_url(self, obj):
        if not obj.audit_json_output_path:
            return None
        script_path_fragment = os.path.join(obj.audit_json_output_path, 'commands', 'script.json')
        full_system_path = os.path.join(settings.MEDIA_ROOT, script_path_fragment)
        if os.path.exists(full_system_path):
            request = self.context.get('request')
            url = os.path.join(settings.MEDIA_URL, script_path_fragment).replace('\\', '/')
            try:
                mod_time = os.path.getmtime(full_system_path)
                url_with_version = f"{url}?v={int(mod_time)}"
            except OSError:
                url_with_version = f"{url}?v={int(time.time())}"
            return request.build_absolute_uri(url_with_version) if request else url_with_version
        return None

    def get_cis_benchmark_pdf_url(self, obj):
        if obj.cis_benchmark_pdf:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.cis_benchmark_pdf.url) if request else obj.cis_benchmark_pdf.url
        return None

    def get_tenable_audit_file_url(self, obj):
        if obj.tenable_audit_file:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.tenable_audit_file.url) if request else obj.tenable_audit_file.url
        return None

    def get_audit_files(self, obj):
        files_list = []
        if obj.audit_json_output_path:
            request = self.context.get('request')
            directory_path = os.path.join(settings.MEDIA_ROOT, obj.audit_json_output_path)
            try:
                if os.path.isdir(directory_path):
                    files = sorted(os.listdir(directory_path))
                    if 'metadata.json' in files:
                        files.insert(0, files.pop(files.index('metadata.json')))
                    for filename in files:
                        if filename.endswith('.json'):
                            file_path_fragment = os.path.join(obj.audit_json_output_path, filename)
                            full_file_path = os.path.join(settings.MEDIA_ROOT, file_path_fragment)
                            file_url = os.path.join(settings.MEDIA_URL, file_path_fragment).replace('\\', '/')
                            try:
                                mod_time = os.path.getmtime(full_file_path)
                                url_with_version = f"{file_url}?v={int(mod_time)}"
                            except OSError:
                                url_with_version = f"{file_url}?v={int(time.time())}"
                            absolute_url = request.build_absolute_uri(url_with_version) if request else url_with_version
                            files_list.append({'name': filename, 'url': absolute_url})
            except FileNotFoundError:
                return []
        return files_list

class OrganizationSerializer(serializers.ModelSerializer):
    products = SimpleProductSerializer(many=True, read_only=True)
    class Meta:
       model = Organization
       fields = ['id', 'name', 'logo', 'products', 'updated_at']

class TechnologyTypeSerializer(serializers.ModelSerializer):
    organizations = serializers.SerializerMethodField()
    class Meta:
        model = TechnologyType
        fields = ['id', 'name', 'organizations', 'updated_at']
    def get_organizations(self, obj):
        sorted_orgs = obj.organizations.order_by('-updated_at')
        return OrganizationSerializer(sorted_orgs, many=True, context=self.context).data

class UserProfileSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source='user.email', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    profile_picture_url = serializers.SerializerMethodField()
    class Meta:
        model = UserProfile
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'phone_number', 'company_name', 'profile_picture_url', 'gender',
            'display_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ('created_at', 'updated_at', 'display_name')
    def get_profile_picture_url(self, obj):
        if obj.profile_picture:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.profile_picture.url)
            return obj.profile_picture.url
        return None

class UserProfileUpdateSerializer(serializers.ModelSerializer):
    username = serializers.CharField(required=True, allow_blank=False, min_length=3, max_length=150)
    email = serializers.EmailField(required=True, allow_blank=False)
    class Meta:
        model = UserProfile
        fields = [
            'first_name', 'last_name', 'phone_number', 'company_name',
            'profile_picture', 'username', 'email', 'gender'
        ]
    def validate_username(self, value):
        # Validation logic here
        return value
    def validate_email(self, value):
        # Validation logic here
        return value
    def update(self, instance, validated_data):
        # Update logic here
        return instance