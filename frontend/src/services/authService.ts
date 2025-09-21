// src/services/authService.ts
// src/services/authService.ts
import axios from 'axios';
import apiClient from '../api/apiClient'; 
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/';

// --- Interfaces for data types ---
export interface AuditParser {
  id: number;
  name: string;
}

interface AuditFile {
  name: string;
  url: string;
}

export interface ProductDetails {
  id: number;
  name: string;
  organization_id: number;
  audit_files: AuditFile[];
  page_viewer: string;
}

export interface Template {
    id: string;
    organization_name: string;
    benchmark_name: string;
    policies: any[];
    harden_script?: string;
    check_script?: string;
    revert_script?: string;
    policy_count?: number;
}

export interface CreateTemplatePayload {
    product: number;
    policies: any[];
}

export interface Report {
    id: number;
    report_type: string;
    created_at: string;
    pdf_url: string;
    filename: string;
}

export interface ReportPayload {
    // MODIFIED: Use the new, longer report type names
    report_type: 'Audit-Report' | 'Hardening-Report' | 'Revert-Hardening-Report';
    serial_number: string;
    policies: { name: string; status: 'Passed' | 'Failed' }[];
}


// --- Authentication functions ---
export const register = async (username: string, email: string, password1: string, password2: string) => {
  const response = await axios.post(`${API_URL}auth/registration/`, {
    username, email, password1, password2,
  });
  return response.data;
};

export const login = async (username: string, password: string) => {
  try {
    const response = await apiClient.post('/auth/login/', { username, password });
    const token = response.data.key;
    
    localStorage.setItem('authToken', token);
    
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const logout = () => {
  localStorage.removeItem('authToken');
};

export const checkUsername = async (username: string) => {
  if (!username) return { exists: false };
  const response = await axios.get(`${API_URL}check-username/?username=${username}`);
  return response.data;
};


// --- Password reset functions ---
export const requestPasswordResetOTP = async (email: string) => {
  const response = await axios.post(`${API_URL}password-reset/request-otp/`, { email });
  return response.data;
};

export const verifyPasswordResetOTP = async (email: string, otp: string) => {
  const response = await axios.post(`${API_URL}password-reset/verify-otp/`, { email, otp });
  return response.data;
};

export const setNewPasswordWithOTP = async (email: string, otp: string, password: string) => {
  const response = await axios.post(`${API_URL}password-reset/set-new-password/`, { email, otp, password });
  return response.data;
};


// --- Technology directory functions ---
export const getTechnologies = async () => {
  const response = await apiClient.get('/technologies/');
  return response.data;
};

export const getOrganizationDetails = async (id: string) => {
  const response = await apiClient.get(`/organizations/${id}/`);
  return response.data;
};

export const getProductDetails = async (id: string): Promise<ProductDetails> => {
  const response = await apiClient.get(`/products/${id}/`);
  return response.data;
};


// --- Audit Parser functions ---
export const getAuditParsers = async (): Promise<AuditParser[]> => {
  const response = await apiClient.get('/audit-parsers/');
  return response.data;
};

export const uploadAuditParser = async (name: string, file: File) => {
  const formData = new FormData();
  formData.append('name', name);
  formData.append('parser_file', file);

  const response = await apiClient.post('/audit-parsers/upload/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};


// --- Profile API functions ---
export const getUserProfile = async () => {
  const response = await apiClient.get('/profile/');
  return response.data;
};

export const updateUserProfile = async (profileData: FormData) => {
  const response = await apiClient.put('/profile/update/', profileData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

// --- Template functions ---
export const createTemplate = async (payload: CreateTemplatePayload): Promise<Template> => {
    const response = await apiClient.post('/templates/', payload);
    return response.data;
};

export const getTemplates = async (): Promise<Template[]> => {
    const response = await apiClient.get('/templates/');
    return response.data;
};

export const getTemplateDetails = async (id: string): Promise<Template> => {
    const response = await apiClient.get(`/templates/${id}/`);
    return response.data;
};

export const updateTemplate = async (id: string, data: Partial<Template>): Promise<Template> => {
    const response = await apiClient.put(`/templates/${id}/`, data);
    return response.data;
};

export const deleteTemplate = async (id: string): Promise<void> => {
    await apiClient.delete(`/templates/${id}/`);
};

export const importTemplate = async (templateData: object): Promise<Template> => {
    const response = await apiClient.post('/templates/import/', templateData);
    return response.data;
}

// --- NEW Report Functions ---
export const createReport = async (templateId: string, payload: ReportPayload): Promise<any> => {
    const response = await apiClient.post(`/templates/${templateId}/reports/`, payload);
    return response.data;
};

export const getReportsForTemplate = async (templateId: string): Promise<Report[]> => {
    const response = await apiClient.get(`/templates/${templateId}/reports/`);
    return response.data;
};

export const deleteReport = async (reportId: number): Promise<void> => {
    await apiClient.delete(`/reports/${reportId}/`);
};