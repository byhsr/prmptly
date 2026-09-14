import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Layout, SquareAsterisk } from "lucide-react";
import { useTemplateStore } from "@/hooks/store/templateStore";
import { SnippetList } from "../library/SnippetList";
import { cn } from "@/lib/utils";

const ModeButton = ({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Layout;
  label: string;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-1.5 rounded-sm px-2 py-1 text-[11px] transition-colors duration-100",
      active ? "bg-background text-primary" : "text-secondary hover:bg-background/60"
    )}
  >
    <Icon size={11} style={{ color: active ? "var(--color-accent)" : "var(--color-muted)" }} />
    <span>{label}</span>
  </button>
);

export function TemplateSidebarPanel() {
  const { templates, selectedTemplateId, selectTemplate, loadTemplates, templateTab, setTemplateTab } = useTemplateStore();

  useEffect(() => {
    loadTemplates();
  }, []);

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex items-center gap-1 px-2 py-1 border-b border-border shrink-0">
        <ModeButton
          active={templateTab === "templates"}
          onClick={() => setTemplateTab("templates")}
          icon={Layout}
          label="Templates"
        />
        <ModeButton
          active={templateTab === "snippets"}
          onClick={() => setTemplateTab("snippets")}
          icon={SquareAsterisk}
          label="Snippets"
        />
      </div>

      {templateTab === "snippets" ? (
        <SnippetList />
      ) : (
        <div className="flex flex-col gap-1 px-2 py-2">
          <button
            onClick={() => selectTemplate(null)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors w-full text-left"
            style={{
              background: selectedTemplateId === null ? "var(--accent)" : "transparent",
              color: selectedTemplateId === null ? "var(--accent-foreground)" : "var(--muted)",
            }}
          >
            <span className="text-base">+</span>
            New Template
          </button>

          <div className="mt-1 flex flex-col gap-0.5">
            <AnimatePresence initial={false}>
              {templates.map((t) => (
                <motion.button
                  key={t.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => selectTemplate(t.id)}
                  className="flex items-center justify-between px-3 py-2 rounded-lg text-xs w-full text-left transition-colors group"
                  style={{
                    background: selectedTemplateId === t.id ? "var(--surface)" : "transparent",
                    color: selectedTemplateId === t.id ? "var(--foreground)" : "var(--muted)",
                    border: selectedTemplateId === t.id ? "1px solid var(--border)" : "1px solid transparent",
                  }}
                >
                  <span className="truncate">{t.name}</span>
                  {t.is_system === 1 && (
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded ml-2 shrink-0"
                      style={{ background: "var(--border)", color: "var(--muted)" }}
                    >
                      sys
                    </span>
                  )}
                </motion.button>
              ))}
            </AnimatePresence>

            {templates.length === 0 && (
              <p className="text-[11px] px-3 py-2" style={{ color: "var(--muted)" }}>
                No templates yet
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
