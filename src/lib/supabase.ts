import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ofgjuewjvitoivloqfql.supabase.co';
const supabaseKey = 'sb_publishable_ItiiKCf10ziShee-O4mvVA_-5FuQ18v';

export const supabase = createClient(supabaseUrl, supabaseKey);

export type Employee = {
  id?: string;
  name: string;
  department: string;
  role: string;
  salary: number;
  status: string;
  joined: string;
  email: string;
  phone: string;
  created_at?: string;
};
