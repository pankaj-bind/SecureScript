# api/serializers.py

import re
from django.contrib.auth.models import User
from rest_framework import serializers
from dj_rest_auth.registration.serializers import RegisterSerializer
from allauth.account.adapter import get_adapter
from .models import TechnologyType, Organization, Product, UserProfile, AuditParser, Template, Report
from django.conf import settings
import os

# --- Helper function for script generation ---
def generate_script_from_policies(policies, script_type):
    script_parts = []
    for policy in policies:
        script_part = ''
        reg_key = policy.get('reg_key')
        reg_item = policy.get('reg_item')
        value_data = policy.get('value_data')
        value_type = policy.get('value_type')
        reg_option = policy.get('reg_option')

        if script_type == 'harden':
            if reg_option == 'MUST_NOT_EXIST' and value_data:
                script_part = f'reg delete "{value_data}" /f'
            elif reg_key and reg_item:
                reg_type = 'REG_DWORD' if value_type == 'POLICY_DWORD' else 'REG_SZ'
                script_part = f'reg add "{reg_key}" /v "{reg_item}" /t {reg_type} /d "{value_data}" /f'
        elif script_type == 'check':
            if reg_option == 'MUST_NOT_EXIST' and value_data:
                script_part = f'reg query "{value_data}"'
            elif reg_key and reg_item:
                script_part = f'reg query "{reg_key}" /v "{reg_item}"'
        elif script_type == 'revert':
            if reg_option == 'MUST_NOT_EXIST' and value_data:
                script_part = f"# No automatic revert for MUST_NOT_EXIST policy: {policy.get('description')}"
            elif reg_key and reg_item:
                script_part = f'reg delete "{reg_key}" /v "{reg_item}" /f'

        if script_part:
            script_parts.append(f"# Policy: {policy.get('description')}\n{script_part}")

    return "\n\n".join(script_parts)


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

        harden_script = generate_script_from_policies(policies, 'harden')
        check_script = generate_script_from_policies(policies, 'check')
        revert_script = generate_script_from_policies(policies, 'revert')

        template = Template.objects.create(
            user=self.context['request'].user,
            product=validated_data.get('product'),
            policies=policies,
            harden_script=harden_script,
            check_script=check_script,
            revert_script=revert_script
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
        # Pop the 'policies' data, which is not a model field
        policies_data = validated_data.pop('policies')

        # Create the report instance with the remaining valid data
        report = Report.objects.create(**validated_data)

        # Assign the policies data to the 'results' field of the instance
        report.results = policies_data

        # The PDF generation and saving will be handled in the view
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

class SimpleProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ['id', 'name']

class ProductDetailSerializer(serializers.ModelSerializer):
    cis_benchmark_pdf_url = serializers.SerializerMethodField()
    tenable_audit_file_url = serializers.SerializerMethodField()
    audit_files = serializers.SerializerMethodField()
    organization_id = serializers.PrimaryKeyRelatedField(source='organization', read_only=True)
    audit_parser = serializers.PrimaryKeyRelatedField(queryset=AuditParser.objects.all(), allow_null=True, required=False)
    page_viewer = serializers.CharField(read_only=True)

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'organization_id', 'audit_parser', 'page_viewer',
            'cis_benchmark_pdf_url', 'tenable_audit_file_url', 'audit_files'
         ]

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
                            file_url = os.path.join(settings.MEDIA_URL, obj.audit_json_output_path, filename)
                            absolute_url = request.build_absolute_uri(file_url) if request else file_url
                            files_list.append({
                                'name': filename,
                                'url': absolute_url
                            })
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
        if not value or not value.strip():
            raise serializers.ValidationError("Username cannot be empty")
        value = value.strip()
        user = self.instance.user
        if User.objects.filter(username=value).exclude(id=user.id).exists():
            raise serializers.ValidationError("This username is already taken")
        if len(value) < 3:
            raise serializers.ValidationError("Username must be at least 3 characters long")
        if not re.match(r'^[a-zA-Z0-9_-]+$', value):
            raise serializers.ValidationError("Username can only contain letters, numbers, underscores, and hyphens")
        return value

    def validate_email(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Email cannot be empty")
        value = value.strip()
        user = self.instance.user
        if User.objects.filter(email=value).exclude(id=user.id).exists():
            raise serializers.ValidationError("This email is already registered")
        return value

    def update(self, instance, validated_data):
        username = validated_data.pop('username', None)
        email = validated_data.pop('email', None)

        if username:
            instance.user.username = username.strip()
        if email:
            instance.user.email = email.strip()

        if username or email:
            instance.user.save()

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance