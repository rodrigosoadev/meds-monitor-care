import { Outlet, createRootRoute, HeadContent, Scripts, useLocation, useNavigate, Link } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { AppLayout } from "@/components/AppLayout";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useEffect } from "react";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { supabase } from "@/integrations/supabase/client";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">A página que você procura não existe.</p>
        <Link to="/" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Ir para o início</Link>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "MediMind — Gestão de medicamentos" },
      { name: "description", content: "Acompanhe seus medicamentos, receba lembretes e visualize sua adesão diária com o MediMind." },
      { name: "author", content: "MediMind" },
      { property: "og:title", content: "MediMind — Gestão de medicamentos" },
      { property: "og:description", content: "Acompanhe seus medicamentos, receba lembretes e visualize sua adesão diária com o MediMind." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "MediMind — Gestão de medicamentos" },
      { name: "twitter:description", content: "Acompanhe seus medicamentos, receba lembretes e visualize sua adesão diária com o MediMind." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/31fae6d0-d7ed-4642-b3bd-bbc90f5a0aa3/id-preview-89a2c4da--025c9b6d-af5b-4bbf-a36a-7fb77dd0569e.lovable.app-1778027013537.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/31fae6d0-d7ed-4642-b3bd-bbc90f5a0aa3/id-preview-89a2c4da--025c9b6d-af5b-4bbf-a36a-7fb77dd0569e.lovable.app-1778027013537.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

const PUBLIC_ROUTES = ["/auth", "/reset-password"];

function AuthGate() {
  const { user, loading } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const isPublic = PUBLIC_ROUTES.includes(loc.pathname);

  useEffect(() => {
    if (!loading && !user && !isPublic) nav({ to: "/auth" });
  }, [user, loading, isPublic, nav]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }
  if (isPublic) return <Outlet />;
  if (!user) return null;
  return <AppLayout />;
}

function RootComponent() {
  useEffect(() => {
    let listener: any;

    const setupListener = async () => {
      listener = await App.addListener("appUrlOpen", async ({ url }) => {
        if (!url || (!url.includes("code=") && !url.includes("access_token"))) return;

        try {
          await Browser.close();
          const { data, error } = await supabase.auth.exchangeCodeForSession(url);
          if (error) {
            console.error("Supabase exchangeCodeForSession error:", error);
          }
        } catch (err) {
          console.error("Failed to handle appUrlOpen:", err);
        }
      });
    };

    setupListener();

    return () => {
      listener?.remove?.();
    };
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthGate />
        <Toaster position="top-center" richColors theme="system" />
      </AuthProvider>
    </ThemeProvider>
  );
}

export { Outlet };
