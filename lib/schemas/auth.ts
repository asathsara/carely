import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  rememberMe: z.boolean(),
});

export const signupSchema = z
  .object({
    firstName: z.string().trim().min(1, "Enter your first name"),
    lastName: z.string().trim().min(1, "Enter your last name"),
    email: z.email("Enter a valid email address"),
    phone: z.string().trim().min(7, "Enter a valid mobile number"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;

export const roleSchema = z.enum([
  "patient",
  "doctor",
  "nurse",
  "receptionist",
  "pharmacist",
  "admin",
]);
export const mockCredentialSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
  role: roleSchema,
});

export type MockCredential = z.infer<typeof mockCredentialSchema>;
