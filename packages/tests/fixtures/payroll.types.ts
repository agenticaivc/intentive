export interface IntentGraph {
  apiVersion: string;
  kind: string;
  metadata: any;
  spec: any;
}

export type PayrollGraph = IntentGraph;

export interface PayrollContext {
  user: UserContext;
  period: string;
  expectedNodes: string[];
}

export interface UserContext {
  id: string;
  roles: string[];
  permissions: string[];
}

export interface MockUserContexts {
  finance_manager: UserContext;
  sales_rep: UserContext;
  payroll_admin: UserContext;
}

export const MOCK_USERS: MockUserContexts = {
  finance_manager: {
    id: 'finance_user_001',
    roles: ['finance_manager'],
    permissions: ['payroll:read', 'payroll:write', 'finance:calculate']
  },
  sales_rep: {
    id: 'sales_user_001', 
    roles: ['sales_rep'],
    permissions: ['sales:read', 'sales:write']
  },
  payroll_admin: {
    id: 'payroll_admin_001',
    roles: ['payroll_admin'],
    permissions: ['payroll:read', 'payroll:write', 'payroll:admin']
  }
};

export const EXPECTED_PAYROLL_NODES = [
  'authenticate_user',
  'check_approval_status', 
  'fetch_employee_data',
  'calculate_payroll',
  'process_payments'
];

export interface PayrollExecutionResult {
  status: 'SUCCESS' | 'FAILED' | 'DELAYED';
  nodesExecuted: number;
  executionTime: number;
  errors: Error[];
} 