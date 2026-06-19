import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is logged in, redirect to dashboard
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      }
    };
    checkAuth();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50">
      <div className="text-center max-w-2xl px-6">
        <div className="w-24 h-24 bg-gradient-to-br from-primary to-accent rounded-2xl mb-8 mx-auto shadow-lg" />
        <h1 className="mb-6 text-5xl font-bold text-foreground">
          Shop Drawing Tracker
        </h1>
        <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
          Professional construction project management for tracking shop drawings, 
          revisions, and documentation across all your sites.
        </p>
        <Button
          size="lg"
          className="text-lg px-8 py-6"
          onClick={() => navigate("/auth")}
        >
          Get Started
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};

export default Index;
