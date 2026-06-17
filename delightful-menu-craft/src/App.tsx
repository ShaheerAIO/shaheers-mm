import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Workspaces from "./pages/Workspaces";
import Team from "./pages/Team";
import SetPassword from "./pages/SetPassword";
import NotFound from "./pages/NotFound";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import {
  useWorkspaceSession,
  openWorkspace,
  rememberedWorkspaceId,
} from "@/lib/workspaceSync";

const queryClient = new QueryClient();

const FullScreen = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

/** Block until auth resolves; bounce to /login when signed out. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullScreen />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <>{children}</>;
}

/** Gate a route to admins only; non-admins bounce to the project list. */
function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return <FullScreen />;
  if (!isAdmin) return <Navigate to="/workspaces" replace />;
  return <>{children}</>;
}

/** Ensure a workspace is loaded before the builder renders; re-open this tab's last one after a refresh. */
function RequireWorkspace({ children }: { children: ReactNode }) {
  const currentId = useWorkspaceSession((s) => s.currentId);
  const [checking, setChecking] = useState(currentId == null);

  useEffect(() => {
    if (currentId != null) {
      setChecking(false);
      return;
    }
    const remembered = rememberedWorkspaceId();
    if (remembered) {
      openWorkspace(remembered)
        .catch(() => {})
        .finally(() => setChecking(false));
    } else {
      setChecking(false);
    }
  }, [currentId]);

  if (checking) return <FullScreen />;
  if (currentId == null) return <Navigate to="/workspaces" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/set-password" element={<SetPassword />} />
              <Route
                path="/workspaces"
                element={
                  <RequireAuth>
                    <Workspaces />
                  </RequireAuth>
                }
              />
              <Route
                path="/team"
                element={
                  <RequireAuth>
                    <RequireAdmin>
                      <Team />
                    </RequireAdmin>
                  </RequireAuth>
                }
              />
              <Route
                path="/"
                element={
                  <RequireAuth>
                    <RequireWorkspace>
                      <Index />
                    </RequireWorkspace>
                  </RequireAuth>
                }
              />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
