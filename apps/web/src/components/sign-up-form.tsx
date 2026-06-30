import { Button } from "@rdm-hack/ui/components/button";
import { Card, CardContent, CardTitle } from "@rdm-hack/ui/components/card";
import { Input } from "@rdm-hack/ui/components/input";
import { Label } from "@rdm-hack/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

import Loader from "./loader";

export default function SignUpForm({ onSwitchToSignIn }: { onSwitchToSignIn: () => void }) {
  const navigate = useNavigate({
    from: "/",
  });
  const { isPending } = authClient.useSession();

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
      name: "",
    },
    onSubmit: async ({ value }) => {
      await authClient.signUp.email(
        {
          email: value.email,
          password: value.password,
          name: value.name,
        },
        {
          onSuccess: () => {
            navigate({
              to: "/dashboard",
            });
            toast.success("Sign up successful");
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        },
      );
    },
    validators: {
      onSubmit: z.object({
        name: z.string().min(2, "Name must be at least 2 characters"),
        email: z.email("Invalid email address"),
        password: z.string().min(8, "Password must be at least 8 characters"),
      }),
    },
  });

  if (isPending) {
    return <Loader />;
  }

  return (
    <main className="flex min-h-full items-center justify-center bg-[#0A0C0F] px-4 py-6 text-[#EEE8DE]">
      <div className="flex w-full max-w-[420px] flex-col items-center">
        <img
          alt="RDM"
          className="mb-3 h-[92px] w-[240px] object-contain"
          src="/icons/rdm-logo.png"
        />

        <Card className="w-full gap-3 rounded-[11px] border border-[rgba(238,232,222,0.12)] bg-[#141618] p-4 py-4 text-[#EEE8DE] ring-0">
          <CardContent className="grid gap-3 p-0">
            <AuthSegment active="create" onSwitchToSignIn={onSwitchToSignIn} />
            <CardTitle className="text-base font-bold tracking-normal text-[#EEE8DE]">
              Create Account
            </CardTitle>

            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                form.handleSubmit();
              }}
            >
              <form.Field name="name">
                {(field) => (
                  <AuthField label="Name" name={field.name}>
                    <Input
                      autoComplete="name"
                      className={authInputClassName}
                      id={field.name}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      placeholder="Yash Diwan"
                      value={field.state.value}
                    />
                    <FieldErrors errors={field.state.meta.errors} />
                  </AuthField>
                )}
              </form.Field>

              <form.Field name="email">
                {(field) => (
                  <AuthField label="Email" name={field.name}>
                    <Input
                      autoComplete="email"
                      className={authInputClassName}
                      id={field.name}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      placeholder="you@example.com"
                      type="email"
                      value={field.state.value}
                    />
                    <FieldErrors errors={field.state.meta.errors} />
                  </AuthField>
                )}
              </form.Field>

              <form.Field name="password">
                {(field) => (
                  <AuthField label="Password" name={field.name}>
                    <Input
                      autoComplete="new-password"
                      className={authInputClassName}
                      id={field.name}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      placeholder="8+ characters"
                      type="password"
                      value={field.state.value}
                    />
                    <FieldErrors errors={field.state.meta.errors} />
                  </AuthField>
                )}
              </form.Field>

              <form.Subscribe
                selector={(state) => ({
                  canSubmit: state.canSubmit,
                  isSubmitting: state.isSubmitting,
                })}
              >
                {({ canSubmit, isSubmitting }) => (
                  <Button
                    className="mt-1 h-[42px] w-full rounded-[9px] bg-[#1EEAB0] text-[13px] font-bold text-[#03120C] hover:bg-[#1EEAB0]/85"
                    disabled={!canSubmit || isSubmitting}
                    type="submit"
                  >
                    <UserPlus className="size-4" />
                    {isSubmitting ? "Submitting..." : "Create Account"}
                  </Button>
                )}
              </form.Subscribe>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

const authInputClassName =
  "h-[42px] rounded-[8px] border border-[rgba(238,232,222,0.12)] bg-[#0D0F12] px-3 py-[9px] text-[13px] text-[#EEE8DE] outline-none placeholder:text-[#626058] focus-visible:border-[#1EEAB0] focus-visible:ring-1 focus-visible:ring-[#1EEAB0]/40";

function AuthSegment({
  active,
  onSwitchToSignIn,
}: {
  active: "create";
  onSwitchToSignIn: () => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-[8px] border border-[rgba(238,232,222,0.12)] bg-[#0D0F12] p-1">
      <Button
        className="h-8 rounded-[6px] border-transparent bg-transparent text-[11px] font-bold text-[#CCC6BA] hover:bg-[#061F18]/60 hover:text-[#1EEAB0]"
        onClick={onSwitchToSignIn}
        type="button"
        variant="ghost"
      >
        Sign In
      </Button>
      <Button
        className="h-8 rounded-[6px] border-[#4A1A90] bg-[#160A2A] text-[11px] font-bold text-[#A060FF] hover:bg-[#160A2A]/90"
        type="button"
        variant="outline"
      >
        Create
      </Button>
    </div>
  );
}

function AuthField({
  children,
  label,
  name,
}: {
  children: React.ReactNode;
  label: string;
  name: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label
        className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#626058]"
        htmlFor={name}
      >
        {label}
      </Label>
      {children}
    </div>
  );
}

function FieldErrors({ errors }: { errors: Array<{ message?: string } | undefined> }) {
  return errors.map((error) =>
    error?.message ? (
      <p className="text-xs leading-5 text-[#FF5A4A]" key={error.message}>
        {error.message}
      </p>
    ) : null,
  );
}
