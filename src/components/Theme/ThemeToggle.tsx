import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "./ThemeProvider";
import { motion } from "framer-motion";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className="relative h-8 w-8 rounded-full"
    >
      <div className="relative h-4 w-4">
        {/* Sun icon */}
        <motion.div
          initial={{ scale: theme === "dark" ? 1 : 0 }}
          animate={{ scale: theme === "dark" ? 0 : 1, opacity: theme === "dark" ? 0 : 1 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all" />
        </motion.div>
        {/* Moon icon */}
        <motion.div
          initial={{ scale: theme === "dark" ? 0 : 1 }}
          animate={{ scale: theme === "dark" ? 1 : 0, opacity: theme === "dark" ? 1 : 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0"
        >
          <Moon className="absolute h-4 w-4 rotate-90 transition-all" />
        </motion.div>
      </div>
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
