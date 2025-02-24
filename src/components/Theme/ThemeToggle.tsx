import { Moon, Sun, Monitor } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTheme } from "./ThemeProvider"
import { motion } from "framer-motion"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon"
          className="glass-button h-9 w-9 relative"
        >
          <span className="relative h-4 w-4">
            {/* Sun icon */}
            <motion.div
              initial={{ scale: theme === "dark" ? 1 : 0 }}
              animate={{ scale: theme === "light" ? 1 : 0, opacity: theme === "light" ? 1 : 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 10 }}
              className="absolute inset-0"
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all text-yellow-500" />
            </motion.div>

            {/* Moon icon */}
            <motion.div
              initial={{ scale: theme === "light" ? 1 : 0 }}
              animate={{ scale: theme === "dark" ? 1 : 0, opacity: theme === "dark" ? 1 : 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 10 }}
              className="absolute inset-0"
            >
              <Moon className="h-4 w-4 rotate-90 transition-all text-blue-400" />
            </motion.div>

            {/* System icon */}
            <motion.div
              initial={{ scale: theme === "system" ? 0 : 1 }}
              animate={{ scale: theme === "system" ? 1 : 0, opacity: theme === "system" ? 1 : 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 10 }}
              className="absolute inset-0"
            >
              <Monitor className="h-4 w-4 transition-all text-purple-400" />
            </motion.div>
          </span>
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="glass-morphism">
        <DropdownMenuItem 
          onClick={() => setTheme("light")}
          className="flex items-center gap-2 cursor-pointer"
        >
          <Sun className="h-4 w-4 text-yellow-500" />
          <span>Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setTheme("dark")}
          className="flex items-center gap-2 cursor-pointer"
        >
          <Moon className="h-4 w-4 text-blue-400" />
          <span>Dark</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setTheme("system")}
          className="flex items-center gap-2 cursor-pointer"
        >
          <Monitor className="h-4 w-4 text-purple-400" />
          <span>System</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
