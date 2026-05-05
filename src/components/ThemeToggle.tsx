import { useTheme } from "./ThemeProvider";
import { Moon, Sun, Laptop } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const opts = [
    { v: "light" as const, Icon: Sun, label: "Claro" },
    { v: "dark" as const, Icon: Moon, label: "Escuro" },
    { v: "system" as const, Icon: Laptop, label: "Auto" },
  ];
  return (
    <div className="inline-flex rounded-xl border border-border bg-card p-0.5">
      {opts.map(({ v, Icon, label }) => (
        <button
          key={v}
          onClick={() => setTheme(v)}
          aria-label={label}
          title={label}
          className={`h-8 w-8 rounded-lg flex items-center justify-center transition ${
            theme === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
          }`}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
