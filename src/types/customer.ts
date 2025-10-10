export interface CustomerUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  createdAt: string;
}

export interface LoginFormData {
  email: string;
  password: string;
}

export interface RegisterFormData {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}