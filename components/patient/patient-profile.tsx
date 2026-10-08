"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Check, KeyRound, Lock, Shield } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/patient/patient-shared";
import { PageTitle } from "@/components/workspace/workspace-ui";
import { appContent, demoPeople } from "@/lib/mock/content";
import { cn } from "@/lib/utils";

type ProfileFormData = {
  fullName: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  gender: string;
  address: string;
  emergencyContact: string;
};

const defaultProfile: ProfileFormData = {
  fullName: demoPeople.portalPatient.name,
  dateOfBirth: "2001-05-18",
  email: demoPeople.portalPatient.email,
  phone: "+94 77 123 4567",
  gender: "Female",
  address: demoPeople.portalPatient.address,
  emergencyContact: "Nimal Silva (Father) · +94 71 987 6543",
};

export function PatientProfile() {
  const [formData, setFormData] = useState(defaultProfile);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Password change state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedSuccess(false);

    setTimeout(() => {
      setIsSaving(false);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    }, 450);
  };

  const handleCancel = () => {
    setFormData(defaultProfile);
    setSavedSuccess(false);
  };

  const handlePasswordSubmit = (e: FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess(false);

    if (!currentPassword) {
      setPasswordError("Please enter your current password.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setPasswordSuccess(true);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setTimeout(() => {
      setShowPasswordForm(false);
      setPasswordSuccess(false);
    }, 2500);
  };

  return (
    <>
      <PageTitle
        eyebrow="Account"
        title="Profile & settings"
        description="Keep your personal contact details accurate and manage your hospital account security."
        action={
          <Image
            src="/images/profile.svg"
            alt={`${appContent.brand.name} profile assistant`}
            width={82}
            height={94}
            priority
          />
        }
      />

      <div className="grid gap-5 lg:grid-cols-[2.1fr_1fr]">
        {/* Left Column: Editable Personal Information Form */}
        <Card className="p-5 sm:p-7">
          {/* Header Banner */}
          <div className="bg-carely-surface flex items-center justify-between gap-4 rounded-xl border p-4 sm:p-5">
            <div className="flex items-center gap-3.5 sm:gap-4">
              <span className="bg-primary grid size-12 shrink-0 place-items-center rounded-full text-base font-bold text-white shadow-xs sm:size-14 sm:text-lg">
                {demoPeople.portalPatient.initials}
              </span>
              <div>
                <p className="text-foreground text-base font-bold sm:text-lg">
                  {formData.fullName}
                </p>
                <p className="text-muted-foreground text-xs sm:text-sm">
                  Patient ID · PT-20481 ·Hospital OPD
                </p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <StatusBadge tone="green">Email verified</StatusBadge>
                  <StatusBadge tone="blue">Active record</StatusBadge>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div className="border-b pb-3">
              <h2 className="text-foreground text-base font-semibold">
                Personal & contact details
              </h2>
              <p className="text-muted-foreground text-xs">
                These details are used by the OPD registry, pharmacy, and laboratory
                teams.
              </p>
            </div>

            {savedSuccess ? (
              <div className="bg-carely-success-soft text-carely-success border-carely-success/20 flex items-center gap-2.5 rounded-lg border p-3.5 text-xs font-medium">
                <Check className="size-4 shrink-0" />
                <span>
                  Profile updated successfully. Details are synced with the hospital
                  information system.
                </span>
              </div>
            ) : null}

            {/* Form Fields in Responsive 2-Column Grid */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                id="fullName"
                label="Full name"
                showLabel
                placeholder="Enter your full name"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                required
              />

              <Input
                id="dateOfBirth"
                label="Date of birth"
                showLabel
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) =>
                  setFormData({ ...formData, dateOfBirth: e.target.value })
                }
                required
              />

              <Input
                id="email"
                label="Email address"
                showLabel
                type="email"
                placeholder="name@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />

              <Input
                id="phone"
                label="Phone number"
                showLabel
                type="tel"
                placeholder="+94 77 123 4567"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
              />

              {/* Gender selector */}
              <div className="space-y-1.5">
                <label className="text-foreground block text-xs font-semibold">
                  Gender
                </label>
                <Select
                  value={formData.gender}
                  onValueChange={(val) => {
                    if (val) setFormData({ ...formData, gender: val });
                  }}
                >
                  <SelectTrigger id="gender">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                    <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Input
                id="emergencyContact"
                label="Emergency contact"
                showLabel
                placeholder="Name & contact number"
                value={formData.emergencyContact}
                onChange={(e) =>
                  setFormData({ ...formData, emergencyContact: e.target.value })
                }
              />

              <div className="sm:col-span-2">
                <Input
                  id="address"
                  label="Residential address"
                  showLabel
                  placeholder="Street address, city"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                type="submit"
                disabled={isSaving}
                className="min-w-32 font-semibold"
              >
                {isSaving ? "Saving..." : "Save changes"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSaving}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>

        {/* Right Column: Security, Privacy & Account Actions */}
        <div className="space-y-4">
          <Card className="p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <Shield className="text-primary size-4" />
              <h2 className="text-foreground text-base font-semibold">
                Account security
              </h2>
            </div>

            <div className="bg-carely-surface/60 mt-4 rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  Primary Email
                </p>
                <StatusBadge tone="green">Verified</StatusBadge>
              </div>
              <p className="text-foreground mt-2 text-xs font-semibold break-all sm:text-sm">
                {formData.email}
              </p>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                Used for patient identity, multi-factor logins, and prescription access.
              </p>
            </div>

            {/* Password Section with Interactive State */}
            <div className="mt-3.5 rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="text-muted-foreground size-4" />
                  <p className="text-foreground text-xs font-semibold sm:text-sm">
                    Account password
                  </p>
                </div>
                <span className="text-muted-foreground text-xs">Updated Sep 2026</span>
              </div>

              {!showPasswordForm ? (
                <Button
                  className="mt-3.5"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPasswordForm(true)}
                >
                  Change password
                </Button>
              ) : (
                <form
                  onSubmit={handlePasswordSubmit}
                  className="mt-4 space-y-3 border-t pt-3"
                >
                  <Input
                    id="currentPassword"
                    label="Current password"
                    showLabel
                    type="password"
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                  <Input
                    id="newPassword"
                    label="New password"
                    showLabel
                    type="password"
                    placeholder="Minimum 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <Input
                    id="confirmPassword"
                    label="Confirm new password"
                    showLabel
                    type="password"
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />

                  {passwordError ? (
                    <p className="text-destructive text-xs font-medium">
                      {passwordError}
                    </p>
                  ) : null}

                  {passwordSuccess ? (
                    <p className="text-carely-success text-xs font-medium">
                      Password updated successfully!
                    </p>
                  ) : null}

                  <div className="flex items-center gap-2 pt-1">
                    <Button type="submit" size="sm">
                      Update password
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPasswordForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <Lock className="text-primary size-4" />
              <p className="text-foreground text-xs font-semibold sm:text-sm">
                Privacy & health data access
              </p>
            </div>
            <p className="text-muted-foreground mt-2 text-xs leading-relaxed sm:text-sm">
              Your account can strictly view only your personal consultations, queue
              tokens, and active prescriptions in compliance with medical data privacy
              guidelines.
            </p>
          </Card>

          <Card className="p-5 sm:p-6">
            <p className="text-foreground text-xs font-semibold sm:text-sm">
              Session management
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              End your active session on this device.
            </p>
            <Link
              className={cn(
                buttonVariants({ variant: "destructive", size: "sm" }),
                "mt-3"
              )}
              href="/login"
            >
              Log out of this device
            </Link>
          </Card>
        </div>
      </div>
    </>
  );
}
