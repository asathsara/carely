import type { LoginInput, SignupInput } from "@/lib/schemas/auth";

export const loginDefaultValues: LoginInput = {
  email: "",
  password: "",
  rememberMe: false,
};

export const signupDefaultValues: SignupInput = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
};
