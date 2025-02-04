import { Bell } from "lucide-react";

export const Header = () => {
  return (
    <header className="border-b bg-white">
      <div className="flex h-16 items-center px-4 gap-4">
        <img 
          src="/lovable-uploads/23e0dfcc-40e5-4d70-9d82-e9603faa2563.png" 
          alt="Xdelo" 
          className="h-8"
        />
        <div className="ml-auto flex items-center gap-4">
          <button className="relative">
            <Bell className="h-5 w-5 text-gray-500" />
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] font-medium text-white flex items-center justify-center">
              3
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};