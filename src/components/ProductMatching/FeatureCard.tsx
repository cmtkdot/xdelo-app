
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, TextSearch, Scale, ListFilter, BarChart, FileSearch, Database, RefreshCcw } from "lucide-react";

type IconType = "Search" | "TextSearch" | "Scale" | "ListFilter" | "BarChart" | "FileSearch" | "Database" | "RefreshCcw";

interface FeatureCardProps {
  title: string;
  description: string;
  icon: IconType;
}

export const FeatureCard = ({ title, description, icon }: FeatureCardProps) => {
  const renderIcon = () => {
    switch (icon) {
      case "Search":
        return <Search className="h-5 w-5 text-primary" />;
      case "TextSearch":
        return <TextSearch className="h-5 w-5 text-primary" />;
      case "Scale":
        return <Scale className="h-5 w-5 text-primary" />;
      case "ListFilter":
        return <ListFilter className="h-5 w-5 text-primary" />;
      case "BarChart":
        return <BarChart className="h-5 w-5 text-primary" />;
      case "FileSearch":
        return <FileSearch className="h-5 w-5 text-primary" />;
      case "Database":
        return <Database className="h-5 w-5 text-primary" />;
      case "RefreshCcw":
        return <RefreshCcw className="h-5 w-5 text-primary" />;
      default:
        return <Search className="h-5 w-5 text-primary" />;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-4 pb-2">
        <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
          {renderIcon()}
        </div>
        <div>
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-sm">{description}</CardDescription>
      </CardContent>
    </Card>
  );
};
