import type { LoginInput, SignupInput } from "@/lib/schemas/auth";
import { mockCredentialSchema } from "@/lib/schemas/auth";

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

export const mockCredentials = {
  patient: mockCredentialSchema.parse({
    email: "patient@carely.test",
    password: "patient123",
    role: "patient",
  }),
  doctor: mockCredentialSchema.parse({
    email: "doctor@carely.test",
    password: "doctor123",
    role: "doctor",
  }),
  nurse: mockCredentialSchema.parse({
    email: "nurse@carely.test",
    password: "nurse123",
    role: "nurse",
  }),
  receptionist: mockCredentialSchema.parse({
    email: "reception@carely.test",
    password: "reception123",
    role: "receptionist",
  }),
  pharmacist: mockCredentialSchema.parse({
    email: "pharmacy@carely.test",
    password: "pharmacy123",
    role: "pharmacist",
  }),
  admin: mockCredentialSchema.parse({
    email: "admin@carely.test",
    password: "admin123",
    role: "admin",
  }),
} as const;
