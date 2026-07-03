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
  | 'attendance'
  | 'purchase'
  | 'partyledger'
  | 'backup'
  | 'contacts';

export interface NavItem {
  id: ModuleId;
  label: string;
  icon: string;
  color: string;
  bgColor: string;
}
