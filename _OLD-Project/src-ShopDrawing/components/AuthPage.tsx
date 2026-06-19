import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const ALLOWED_DOMAIN = "ritta.co.th";

const getFunctionErrorMessage = async (error: unknown, fallback: string) => {
  const context = error && typeof error === "object" && "context" in error
    ? (error as { context?: Response }).context
    : undefined;

  if (context) {
    try {
      const payload = await context.clone().json();
      if (typeof payload?.error === "string") return payload.error;
    } catch {
      // Keep friendly fallback when the response body is not JSON.
    }
  }

  const message = error instanceof Error ? error.message : "";
  if (/edge function returned|non-2xx status code/i.test(message)) {
    return fallback;
  }

  return message || fallback;
};

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      }
    };
    checkUser();
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        toast({
          title: "Welcome back!",
          description: "You have successfully logged in.",
        });
        navigate("/dashboard");
      } else {
        // Validate password confirmation
        if (password !== confirmPassword) {
          toast({
            title: "Error",
            description: "Passwords do not match.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        const trimmedFirstName = firstName.trim();
        const trimmedLastName = lastName.trim();

        if (!trimmedFirstName || !trimmedLastName) {
          toast({
            title: "Error",
            description: "Please enter your first and last name.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        // Validate name lengths
        if (trimmedFirstName.length > 50) {
          toast({
            title: "Error",
            description: "First name is too long (max 50 characters).",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        if (trimmedLastName.length > 50) {
          toast({
            title: "Error",
            description: "Last name is too long (max 50 characters).",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        const emailDomain = email.trim().split("@")[1]?.toLowerCase();
        if (emailDomain !== ALLOWED_DOMAIN) {
          toast({
            title: "Unable to proceed",
            description: `Please use your @${ALLOWED_DOMAIN} email address to create an account.`,
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        // Use edge function for registration with domain validation
        const { data: registerData, error } = await supabase.functions.invoke('register', {
          body: {
            email,
            password,
            firstName: trimmedFirstName,
            lastName: trimmedLastName,
          }
        });

        if (error || !registerData?.success) {
          const errorMessage = registerData?.error || await getFunctionErrorMessage(
            error,
            "Registration could not be completed. Please check your details and try again."
          );
          throw new Error(errorMessage);
        }

        toast({
          title: "Account created!",
          description: "You can now log in with your credentials.",
        });
        setIsLogin(true);
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        setFirstName("");
        setLastName("");
      }
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : "";
      const bodyMatch = raw.match(/\{[^}]+\}$/);
      let description = raw;
      if (bodyMatch) {
        try {
          const parsed = JSON.parse(bodyMatch[0]);
          if (parsed.error) description = parsed.error;
        } catch { /* keep raw */ }
      }
      if (/edge function returned|non-2xx status code/i.test(description)) {
        description = "Registration could not be completed. Please check your details and try again.";
      }
      toast({
        title: "Unable to proceed",
        description: description || "Something went wrong during authentication.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg border-border/60">
        <CardHeader className="space-y-1 text-center">
          <img src="/logo1.png" alt="RITTA logo" className="h-16 w-auto mb-2 mx-auto" loading="lazy" />
          <CardTitle className="text-2xl font-bold tracking-tight">
            RITTA CONNXT
          </CardTitle>
          <CardDescription>
            {isLogin ? "Sign in to your account" : "Create a new account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      type="text"
                      placeholder="John"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      type="text"
                      placeholder="Doe"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
              placeholder={`name@${ALLOWED_DOMAIN}`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                minLength={6}
              />
            </div>
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={6}
                />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLogin ? "Sign In" : "Sign Up"}
            </Button>
            <Button
              type="button"
              variant="link"
              className="w-full"
              onClick={() => setIsLogin(!isLogin)}
              disabled={loading}
            >
              {isLogin ? "Need an account? Sign up" : "Already have an account? Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthPage;
