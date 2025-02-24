
import React from "react";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function PageContainer({ children, className = "" }: PageContainerProps) {
  return (
    <div className={`container mx-auto py-6 px-4 ${className}`}>
      {children}
    </div>
  );
}
