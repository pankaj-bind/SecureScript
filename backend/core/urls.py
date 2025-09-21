# core/urls.py

from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.views.static import serve

from api.views import (
    CheckUsernameView,
    RequestPasswordResetOTPView,
    VerifyPasswordResetOTPView,
    SetNewPasswordView,
    TechnologyDataView,
    OrganizationDetailView,
    ProductDetailView,
    get_user_profile,
    update_user_profile,
    AuditParserListView,
    AuditParserUploadView,
    TemplateListCreateView,
    TemplateDetailView,
    TemplateImportView,
    ReportListCreateView,
    ReportDetailView,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/check-username/', CheckUsernameView.as_view(), name='check-username'),
    path('api/password-reset/request-otp/', RequestPasswordResetOTPView.as_view(), name='request-otp'),
    path('api/password-reset/verify-otp/', VerifyPasswordResetOTPView.as_view(), name='verify-otp'),
    path('api/password-reset/set-new-password/', SetNewPasswordView.as_view(), name='set-new-password'),
    path('api/technologies/', TechnologyDataView.as_view(), name='technologies-list'),
    path('api/organizations/<int:pk>/', OrganizationDetailView.as_view(), name='organization-detail'),
    path('api/products/<int:pk>/', ProductDetailView.as_view(), name='product-detail'),

    path('api/audit-parsers/', AuditParserListView.as_view(), name='audit-parser-list'),
    path('api/audit-parsers/upload/', AuditParserUploadView.as_view(), name='audit-parser-upload'),

    # Template routes
    path('api/templates/', TemplateListCreateView.as_view(), name='template-list-create'),
    path('api/templates/import/', TemplateImportView.as_view(), name='template-import'),
    path('api/templates/<str:pk>/', TemplateDetailView.as_view(), name='template-detail'),

    # Report routes nested under templates
    path('api/templates/<str:template_pk>/reports/', ReportListCreateView.as_view(), name='report-list-create'),
    path('api/reports/<int:pk>/', ReportDetailView.as_view(), name='report-detail'),

    # Profile endpoints
    path('api/profile/', get_user_profile, name='get-profile'),
    path('api/profile/update/', update_user_profile, name='update-profile'),

    path('api/auth/', include('dj_rest_auth.urls')),
    path('api/auth/registration/', include('dj_rest_auth.registration.urls')),
]

if settings.DEBUG:
    urlpatterns += [
        re_path(r'^media/(?P<path>.*)$', serve, {
            'document_root': settings.MEDIA_ROOT,
        }),
    ]