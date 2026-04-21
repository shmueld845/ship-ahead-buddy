import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import logo from "@/assets/tiger-medical-logo.png";
import { z } from "zod";

const schema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
});

export default function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgotMode, setForgotMode] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    navigate("/", { replace: true });
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = z.string().trim().email().safeParse(email);
    if (!parsed.success) return toast.error("Enter a valid email");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password reset link sent — check your inbox");
    setForgotMode(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
          <img src={logo} alt="Tiger Medical" className="h-16 w-auto" />
          <div className="text-center">
            <h1 className="text-xl font-semibold text-foreground">ShipQueue</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Sign in to manage your shipments
            </p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          {forgotMode ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <h2 className="text-lg font-semibold">Reset password</h2>
              <p className="text-sm text-muted-foreground">
                Enter your email and we'll send a reset link.
              </p>
              <Field id="reset-email" label="Email" type="email" value={email} onChange={setEmail} />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending…" : "Send reset link"}
              </Button>
              <button
                type="button"
                onClick={() => setForgotMode(false)}
                className="text-sm text-primary hover:underline w-full text-center"
              >
                Back to sign in
              </button>
            </form>
          ) : (
            <Tabs defaultValue="signin">
              <TabsList className="grid grid-cols-2 w-full mb-6">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <Field id="email-in" label="Email" type="email" value={email} onChange={setEmail} />
                  <Field id="pw-in" label="Password" type="password" value={password} onChange={setPassword} />
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Signing in…" : "Sign in"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setForgotMode(true)}
                    className="text-sm text-muted-foreground hover:text-primary w-full text-center"
                  >
                    Forgot password?
                  </button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <Field id="email-up" label="Email" type="email" value={email} onChange={setEmail} />
                  <Field id="pw-up" label="Password" type="password" value={password} onChange={setPassword} />
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Signing in…" : "Sign in"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Accounts are created by your admin. Use the credentials you were given.
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </div>

        <p className="text-xs text-center text-muted-foreground">
          © {new Date().getFullYear()} Tiger Medical
        </p>
      </div>
    </div>
  );
}

const Field = ({ id, label, type, value, onChange }: {
  id: string; label: string; type: string; value: string; onChange: (v: string) => void;
}) => (
  <div className="space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} required />
  </div>
);
