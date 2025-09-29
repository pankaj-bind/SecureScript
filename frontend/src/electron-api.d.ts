// src/electron-api.d.ts

export interface Policy {
  type?: string;
  description: string;
  info: string;
  solution: string;
  Note?: string;
  Impact?: string;
  reference?: string;
  see_also?: string;
  right_type?: string;
  value_data: string;
  audit_policy_subcategory?: string;
  password_policy?: string;
  lockout_policy?: string;
  account_type?: string;
  value_type?: string;
  check_type?: string;
  powershell_args?: string;
  reg_key?: string;
  reg_item?: string;
  reg_option?: string;
  reg_include_hku_users?: string;
  variable?: {
    name: string;
    default: string;
    description: string;
    info: string;
    value_type: string;
  };
  condition?: {
    rules?: Partial<Policy>[];
    [key: string]: any;
  };
  then?: any;
}

export interface IElectronAPI {
  // NEW
  getSystemInfo: () => Promise<{
    success: boolean;
    serialNumber?: string;
    message?: string;
  }>;
  runScript: (data: {
    script: string;
    reg_option?: string;
  }) => Promise<{ success: boolean; message: string }>;
  
  // Existing
  getPolicyFiles: (dirPath: string) => Promise<{
    success: boolean;
    data?: Policy[];
    message?: string;
  }>;
  getPolicyCounts: (basePath: string) => Promise<{
    success: boolean;
    data?: {
     counts: { [key: string]: number };
      total: number;
    };
    message?: string;
  }>;
  setUserRight: (policy: {
    privilege: string;
    value_data: string;
    policyName: string;
  }) => Promise<{ success: boolean; message: string }>;
  setAuditPolicy: (policy: {
    subcategory: string;
    value_data: string;
  }) => Promise<{ success: boolean; message: string }>;
  setAccountPolicy: (policy: {
    policyName: string;
    value: string;
  }) => Promise<{ success: boolean; message: string }>;
  setCheckAccount: (data: {
    policy: Policy;
    newValue?: string;
  }) => Promise<{ success: boolean; message: string }>;
  setPowershellPolicy: (data: {
    script: string;
  }) => Promise<{ success: boolean; message: string }>;
  setSecurityOption: (data: {
    policy: Policy;
  }) => Promise<{ success: boolean; message: string }>;
  setBannerPolicy: (data: {
    policy: Policy;
    newValue: string;
  }) => Promise<{ success: boolean; message: string }>;
  setRegistrySetting: (data: {
    policy: Policy;
    newValue: any;
  }) => Promise<{ success: boolean; message: string }>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}