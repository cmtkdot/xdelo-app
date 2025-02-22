import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  variant?: 'icon' | 'full';
}

export const Logo = ({ className, variant = 'full' }: LogoProps) => {
  return (
    <img 
      src={variant === 'icon' ? '/xdelo-icon.png' : '/xdelo.png'} 
      alt="Xdelo Logo"
      className={cn(
        "h-8 w-auto",
        variant === 'icon' && "max-w-[32px]",
        className
      )}
    />
  );
}; 