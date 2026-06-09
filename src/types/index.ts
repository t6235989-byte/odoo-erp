export type ModuleId =
  | 'dashboard'
  | 'inventory'
  | 'accounting'
  | 'sales'
  | 'manufacturing'
  | 'ecommerce'
  | 'hr'
  | 'project'
  | 'marketing'
  | 'fieldservice'
  | 'livechat'
  | 'recruitment'
  | 'timeoff'
  | 'appraisals'
  | 'attendance';

export interface NavItem {
  id: ModuleId;
  label: string;
  icon: string;
  color: string;
  bgColor: string;
}
