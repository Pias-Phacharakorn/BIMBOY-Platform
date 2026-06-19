import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-center"
      offset={24}
      expand
      duration={4000}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:border-border group-[.toaster]:shadow-xl group-[.toaster]:rounded-lg group-[.toaster]:py-3 group-[.toaster]:px-4 group-[.toaster]:min-h-[56px] group-[.toaster]:text-sm gap-3",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-sm",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-md group-[.toast]:text-xs group-[.toast]:px-3 group-[.toast]:py-1.5",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-md group-[.toast]:text-xs group-[.toast]:px-3 group-[.toast]:py-1.5",
          icon: "group-[.toast]:text-foreground group-[.toast]:size-4",
          title: "group-[.toast]:font-medium group-[.toast]:text-sm",
          success: "group-[.toaster]:border-l-4 group-[.toaster]:border-l-success",
          error: "group-[.toaster]:border-l-4 group-[.toaster]:border-l-destructive",
          info: "group-[.toaster]:border-l-4 group-[.toaster]:border-l-info",
          warning: "group-[.toaster]:border-l-4 group-[.toaster]:border-l-warning",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
