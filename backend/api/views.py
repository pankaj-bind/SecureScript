# api/views.py

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
            user = User.objects.get(email__iexact=email)
            PasswordResetOTP.objects.filter(user=user).delete()
            otp_code = PasswordResetOTP.generate_otp()
            PasswordResetOTP.objects.create(user=user, otp=otp_code)
            send_mail(
                subject="Your Password Reset OTP Code", 
                message=f"Your OTP for password reset is: {otp_code}. It is valid for 5 minutes.", 
                from_email="noreply@yourapp.com",
                recipient_list=[email],
                fail_silently=False,
            )
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