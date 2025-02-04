import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { motion } from "framer-motion";
import { useTheme } from "@/components/Theme/ThemeProvider";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme } = useTheme();

  const logoSrc = theme === "dark" 
    ? "/lovable-uploads/xdelo-whitefont.png"
    : "/lovable-uploads/xdelo-blackfont.png";

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              email: email,
            }
          }
        });

        if (signUpError) {
          if (signUpError.message.includes("already registered")) {
            setError("This email is already registered. Please try signing in instead.");
          } else {
            setError(signUpError.message);
          }
          setLoading(false);
          return;
        }

        toast({
          title: "Account created!",
          description: "Please check your email to verify your account.",
        });
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
          options: {
            persistSession: true
          }
        });

        if (signInError) {
          if (signInError.message.includes("Invalid login credentials")) {
            setError("Invalid email or password. Please try again.");
          } else {
            setError(signInError.message);
          }
          setLoading(false);
          return;
        }

        toast({
          title: "Welcome back!",
          description: "You have been successfully logged in.",
        });
      }

      navigate("/");
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Card className="max-w-md w-full space-y-6 p-8 backdrop-blur-xl bg-white/80 border border-gray-200 shadow-lg">
          <div className="flex flex-col items-center space-y-4 w-full">
            <div className="w-full flex justify-center">
              <img
                src={logoSrc}
                alt="Xdelo Logo"
                className="h-12 object-contain mx-auto"
              />
            </div>
            <h2 className="text-xl font-light tracking-wide text-gray-800">
              {isSignUp ? "Create your account" : "Welcome back"}
            </h2>
            <p className="text-sm text-gray-500">
              {isSignUp
                ? "Start managing your products with ease"
                : "Sign in to continue to your dashboard"}
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="animate-shake">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form className="space-y-4" onSubmit={handleAuth}>
            <div className="space-y-3">
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 px-4 transition-all border-gray-200 hover:border-gray-300 focus:border-gray-400"
              />
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={isSignUp ? "new-password" : "current-password"}
                required
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 px-4 transition-all border-gray-200 hover:border-gray-300 focus:border-gray-400"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-black hover:bg-gray-800 transition-colors"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <span>{isSignUp ? "Create account" : "Sign in"}</span>
              )}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                {isSignUp
                  ? "Already have an account? Sign in"
                  : "Need an account? Create one"}
              </button>
            </div>
          </form>
        </Card>
      </motion.div>
    </div>
  );
};

export default Auth;