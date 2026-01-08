# api/views.py

import os
import json
from django.conf import settings
from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.core.files.base import ContentFile
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import generics, status, serializers
from rest_framework.parsers import FormParser, MultiPartParser, JSONParser
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes

from .pdf_utils import generate_report_pdf
from .models import AuditParser, Organization, PasswordResetOTP, Product, TechnologyType, Template, UserProfile, Report
from .serializers import (
    AuditParserSerializer,
    OrganizationSerializer,
    OTPRequestSerializer,
    OTPVerifySerializer,
    ProductDetailSerializer,
    SetNewPasswordSerializer,
    TechnologyTypeSerializer,
    TemplateCreateSerializer,
    TemplateListSerializer,
    TemplateDetailSerializer,
    UserProfileSerializer,
    UserProfileUpdateSerializer,
    ReportListSerializer,
    ReportCreateSerializer,
    ScriptUpdateSerializer,
)


class CheckUsernameView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        username = request.query_params.get("username", None)
        if username:
            exists = User.objects.filter(username__iexact=username).exists()
            return Response({"exists": exists})
        return Response({"error": "Username parameter not provided"}, status=status.HTTP_400_BAD_REQUEST)


# OTP Views
class RequestPasswordResetOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = OTPRequestSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data["email"]
            
            # Check if user exists
            user = User.objects.filter(email__iexact=email).first()
            if not user:
                return Response({"error": "No user found with this email address."}, status=status.HTTP_404_NOT_FOUND)
            
            PasswordResetOTP.objects.filter(user=user).delete()
            otp_code = PasswordResetOTP.generate_otp()
            PasswordResetOTP.objects.create(user=user, otp=otp_code)
            
            # Send email using Django's SMTP backend
            try:
                from django.core.mail import EmailMultiAlternatives
                
                html_content = f'''
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: 'Segoe UI', Arial, sans-serif;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <!-- Header -->
                        <div style="text-align: center; padding: 30px 0;">
                            <h1 style="color: #0078d4; margin: 0; font-size: 32px; font-weight: 600;"> SecureScript</h1>
                            <p style="color: #666; margin: 10px 0 0 0; font-size: 14px;">Security Configuration Management</p>
                        </div>
                        
                        <!-- Main Content -->
                        <div style="background: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                            <h2 style="color: #333; margin: 0 0 20px 0; font-size: 24px; font-weight: 600;">Password Reset Request</h2>
                            
                            <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
                                Hello,
                            </p>
                            
                            <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 25px 0;">
                                We received a request to reset your password. Please use the verification code below to complete the process:
                            </p>
                            
                            <!-- OTP Box -->
                            <div style="background: linear-gradient(135deg, #0078d4 0%, #005a9e 100%); border-radius: 10px; padding: 30px; text-align: center; margin: 30px 0;">
                                <p style="color: #ffffff; font-size: 14px; margin: 0 0 15px 0; opacity: 0.9;">Your Verification Code</p>
                                <div style="background: rgba(255,255,255,0.15); border-radius: 8px; padding: 20px; display: inline-block;">
                                    <span style="color: #ffffff; font-size: 36px; font-weight: bold; letter-spacing: 10px; font-family: 'Courier New', monospace;">
                                        {otp_code}
                                    </span>
                                </div>
                            </div>
                            
                            <!-- Instructions -->
                            <div style="background: #f8f9fa; border-left: 4px solid #0078d4; padding: 20px; border-radius: 5px; margin: 25px 0;">
                                <p style="margin: 0; color: #555; font-size: 14px; line-height: 1.6;">
                                    <strong>⏱️ Time Limit:</strong> This code will expire in <strong>5 minutes</strong><br>
                                    <strong>🔒 Security:</strong> Never share this code with anyone<br>
                                    <strong>❓ Didn't request this?</strong> Ignore this email - your account is safe
                                </p>
                            </div>
                            
                            <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 25px 0 0 0;">
                                If you didn't request a password reset, please ignore this email or contact our support team if you have concerns.
                            </p>
                        </div>
                        
                        <!-- Footer -->
                        <div style="text-align: center; padding: 30px 20px;">
                            <p style="color: #999; font-size: 12px; margin: 0 0 5px 0;">
                                This is an automated message from SecureScript
                            </p>
                            <p style="color: #999; font-size: 11px; margin: 0;">
                                © 2026 SecureScript. All rights reserved.
                            </p>
                        </div>
                    </div>
                </body>
                </html>
                '''
                
                # Print OTP to console for development/testing
                print(f"\n{'='*60}")
                print(f"PASSWORD RESET OTP")
                print(f"{'='*60}")
                print(f"Email: {email}")
                print(f"OTP Code: {otp_code}")
                print(f"Valid for: 5 minutes")
                print(f"{'='*60}\n")
                
                email_message = EmailMultiAlternatives(
                    subject="SecureScript - Password Reset OTP",
                    body=f"Your OTP for password reset is: {otp_code}. It is valid for 5 minutes.",
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    to=[email],
                )
                email_message.attach_alternative(html_content, "text/html")
                email_message.send(fail_silently=True)
                
                return Response({"message": "An OTP has been sent to your email."})
                    
            except Exception as e:
                print(f"Email Error: {str(e)}")
                # Even if email fails, print OTP to console for testing
                print(f"\n{'='*60}")
                print(f"PASSWORD RESET OTP (Email failed, but OTP is valid)")
                print(f"{'='*60}")
                print(f"Email: {email}")
                print(f"OTP Code: {otp_code}")
                print(f"Valid for: 5 minutes")
                print(f"{'='*60}\n")
                return Response({"message": "An OTP has been sent to your email."})
                
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class VerifyPasswordResetOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = OTPVerifySerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data["email"]
            otp_code = serializer.validated_data["otp"]
            try:
                user = User.objects.get(email__iexact=email)
                otp_instance = PasswordResetOTP.objects.get(user=user, otp=otp_code)
                if otp_instance.is_valid():
                    return Response({"message": "OTP verified successfully."})
                else:
                    otp_instance.delete()
                    return Response({"error": "OTP has expired."}, status=status.HTTP_400_BAD_REQUEST)
            except (User.DoesNotExist, PasswordResetOTP.DoesNotExist):
                return Response({"error": "Invalid OTP or email."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SetNewPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SetNewPasswordSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data["email"]
            otp_code = serializer.validated_data["otp"]
            password = serializer.validated_data["password"]
            try:
                user = User.objects.get(email__iexact=email)
                otp_instance = PasswordResetOTP.objects.get(user=user, otp=otp_code)
                if otp_instance.is_valid():
                    user.set_password(password)
                    user.save()
                    otp_instance.delete()
                    return Response(
                        {"message": "Password has been reset successfully."}
                    )
                else:
                    otp_instance.delete()
                    return Response({"error": "OTP has expired."}, status=status.HTTP_400_BAD_REQUEST)
            except (User.DoesNotExist, PasswordResetOTP.DoesNotExist):
                return Response(
                    {"error": "Invalid OTP or email. Please start over."}, status=status.HTTP_400_BAD_REQUEST
                )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ChangePasswordView(APIView):
    """Change password for authenticated users"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        current_password = request.data.get('current_password')
        new_password = request.data.get('new_password')

        if not current_password or not new_password:
            return Response(
                {"error": "Both current password and new password are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = request.user

        # Check if current password is correct
        if not user.check_password(current_password):
            return Response(
                {"error": "Current password is incorrect."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate new password length
        if len(new_password) < 8:
            return Response(
                {"error": "New password must be at least 8 characters long."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Set new password
        user.set_password(new_password)
        user.save()

        return Response({"message": "Password changed successfully."})


class DeleteAccountView(APIView):
    """Delete account for authenticated users"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        password = request.data.get('password')

        if not password:
            return Response(
                {"error": "Password is required to delete your account."},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = request.user

        # Verify password
        if not user.check_password(password):
            return Response(
                {"error": "Password is incorrect."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Delete user profile if exists
        try:
            if hasattr(user, 'profile'):
                user.profile.delete()
        except:
            pass

        # Delete the user account
        user.delete()

        return Response({"message": "Account deleted successfully."})


# --- Audit Parser Views ---
class AuditParserListView(generics.ListAPIView):
    queryset = AuditParser.objects.all()
    serializer_class = AuditParserSerializer
    permission_classes = [IsAdminUser]

class AuditParserUploadView(generics.CreateAPIView):
    queryset = AuditParser.objects.all()
    serializer_class = AuditParserSerializer
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAdminUser]


# --- View for editing the generated script.json ---
class UpdateProductScriptView(APIView):
    """
    Allows updating the 'commands/script.json' file for a specific product.
    """
    permission_classes = [IsAuthenticated] # Or IsAdminUser to restrict further

    def put(self, request, pk):
        try:
            product = Product.objects.get(pk=pk)
        except Product.DoesNotExist:
            return Response({"error": "Product not found."}, status=status.HTTP_404_NOT_FOUND)

        if not product.audit_json_output_path:
            return Response(
                {"error": "This product has no generated audit files to edit."},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = ScriptUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Construct the full path to the target file
        script_file_path = os.path.join(
            settings.MEDIA_ROOT,
            product.audit_json_output_path,
            'commands',
            'script.json'
        )
        
        if not os.path.exists(os.path.dirname(script_file_path)):
             return Response(
                {"error": "The 'commands' directory does not exist for this product."},
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            # Write the validated JSON content to the file
            with open(script_file_path, 'w', encoding='utf-8') as f:
                json.dump(serializer.validated_data['script_content'], f, indent=4)
        except IOError as e:
            return Response(
                {"error": f"Failed to write to the script file: {e}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response({"message": "Successfully updated the script.json file."})


# Technology Data Views
class TechnologyDataView(generics.ListAPIView):
    queryset = TechnologyType.objects.prefetch_related("organizations__products").order_by('-updated_at').all()
    serializer_class = TechnologyTypeSerializer
    permission_classes = [AllowAny]

    def get_serializer_context(self):
        return {"request": self.request}


class OrganizationDetailView(generics.RetrieveAPIView):
    queryset = Organization.objects.all()
    serializer_class = OrganizationSerializer
    permission_classes = [AllowAny]

    def get_serializer_context(self):
        return {"request": self.request}


class ProductDetailView(generics.RetrieveAPIView):
    queryset = Product.objects.all()
    serializer_class = ProductDetailSerializer
    permission_classes = [AllowAny]

    def get_serializer_context(self):
        return {"request": self.request}


class RecentProductsView(generics.ListAPIView):
    """
    Returns recently added/updated products for the 'New Updates' section
    """
    serializer_class = ProductDetailSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        # Get products ordered by updated_at (most recent first)
        # Limit to 20 most recent products
        return Product.objects.select_related('organization', 'technology_type').order_by('-updated_at')[:20]

    def get_serializer_context(self):
        return {"request": self.request}


# --- Template Views ---
class TemplateListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return TemplateCreateSerializer
        return TemplateListSerializer

    def get_queryset(self):
        return Template.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class TemplateDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = TemplateDetailSerializer

    def get_queryset(self):
        return Template.objects.filter(user=self.request.user)

class TemplateImportView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]

    def post(self, request, *args, **kwargs):
        data = request.data
        org_name = data.get('organization_name')
        benchmark_name = data.get('benchmark_name')
        policies = data.get('policies')

        harden_script = data.get('harden_script')
        check_script = data.get('check_script')
        revert_script = data.get('revert_script')

        if not org_name or not benchmark_name:
            return Response(
                {"error": "Invalid template file. Missing name fields."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            product = Product.objects.get(name=benchmark_name, organization__name=org_name)
        except Product.DoesNotExist:
            return Response(
                {"error": "The benchmark for this template could not be found."},
                status=status.HTTP_404_NOT_FOUND
            )

        # Create the template object directly, using scripts from the file
        template = Template.objects.create(
            user=request.user,
            product=product,
            policies=policies if policies is not None else [],
            harden_script=harden_script or "",
            check_script=check_script or "",
            revert_script=revert_script or ""
        )

        # Serialize the new object for the response
        response_serializer = TemplateListSerializer(template)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

# --- Views for handling Reports ---

class ReportListCreateView(generics.ListCreateAPIView):
    """
    Handles listing reports for a template and creating new reports.
    """
    permission_classes = [IsAuthenticated]

    def get_serializer_context(self):
        return {'request': self.request}

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ReportCreateSerializer
        return ReportListSerializer

    def get_queryset(self):
        template_id = self.kwargs.get('template_pk')
        return Report.objects.filter(template_id=template_id, template__user=self.request.user)

    def perform_create(self, serializer):
        template_id = self.kwargs.get('template_pk')
        try:
             template = Template.objects.get(id=template_id, user=self.request.user)
        except Template.DoesNotExist:
            raise serializers.ValidationError("Template not found or you don't have permission.")

        report = serializer.save(template=template)

        # Get additional data for the PDF
        local_time = timezone.localtime(timezone.now())
        try:
            # Safely get the user's profile and company name
            user_profile = UserProfile.objects.get(user=self.request.user)
            company_name = user_profile.company_name or 'N/A'
        except UserProfile.DoesNotExist:
            company_name = 'N/A'

        pdf_data_for_generator = {
            'username': self.request.user.username,
            'template_id': template.id,
            'serial_number': report.serial_number,
            'product_name': template.product.organization.name,
            'benchmark_name': template.product.name,
            'report_type': report.get_report_type_display(),
            'policies': report.results,
            'date': local_time.strftime('%d/%m/%Y'),
            'time': local_time.strftime('%I:%M:%S %p'),
            'organization_name': company_name,
        }

        pdf_buffer = generate_report_pdf(pdf_data_for_generator)

        timestamp = timezone.now().strftime('%d%m%Y%H%M%S')
        pdf_filename = f"{report.serial_number}-{timestamp}-{report.report_type}.pdf"

        report.pdf_file.save(pdf_filename, ContentFile(pdf_buffer.read()), save=True)


class ReportDetailView(generics.RetrieveDestroyAPIView):
    """
    Handles deleting a report.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ReportListSerializer

    def get_queryset(self):
        return Report.objects.filter(template__user=self.request.user)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_user_profile(request):
    try:
        profile = request.user.userprofile
    except UserProfile.DoesNotExist:
        profile = UserProfile.objects.create(user=request.user)
    serializer = UserProfileSerializer(profile, context={"request": request})
    return Response(serializer.data)


@api_view(["PUT", "PATCH"])
@permission_classes([IsAuthenticated])
def update_user_profile(request):
    try:
        profile = request.user.userprofile
    except UserProfile.DoesNotExist:
        profile = UserProfile.objects.create(user=request.user)
    serializer = UserProfileUpdateSerializer(
        profile, data=request.data, partial=True, context={"request": request}
    )
    if serializer.is_valid():
        serializer.save()
        updated_profile = UserProfileSerializer(profile, context={"request": request})
        return Response(updated_profile.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)