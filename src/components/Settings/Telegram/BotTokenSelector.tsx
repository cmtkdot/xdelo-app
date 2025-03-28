
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface BotTokenSelectorProps {
  availableTokens: string[];
  selectedToken: string;
  setSelectedToken: (token: string) => void;
  onSaveToken: () => void;
  isLoading: boolean;
}

export function BotTokenSelector({
  availableTokens,
  selectedToken,
  setSelectedToken,
  onSaveToken,
  isLoading
}: BotTokenSelectorProps) {
  const [customToken, setCustomToken] = useState<string>("");

  // Mask the bot token to only show the first few and last few characters
  const maskToken = (token: string) => {
    if (!token) return "Not configured";
    if (token.length <= 10) return token;
    return token.substring(0, 6) + "..." + token.substring(token.length - 4);
  };

  const handleTokenChange = (value: string) => {
    if (value === 'custom') {
      setSelectedToken('custom');
    } else {
      setSelectedToken(value);
      setCustomToken("");
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="botToken">Bot Token</Label>
      <Select 
        value={selectedToken} 
        onValueChange={handleTokenChange}
        disabled={isLoading}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select a bot token" />
        </SelectTrigger>
        <SelectContent>
          {availableTokens.map(token => (
            <SelectItem key={token} value={token}>
              {maskToken(token)}
            </SelectItem>
          ))}
          <SelectItem value="custom">Add new token...</SelectItem>
        </SelectContent>
      </Select>

      {selectedToken === 'custom' && (
        <Input
          id="customToken"
          placeholder="Enter new bot token"
          value={customToken}
          onChange={(e) => {
            setCustomToken(e.target.value);
            setSelectedToken(e.target.value);
          }}
          disabled={isLoading}
          className="mt-2"
        />
      )}

      <Button 
        onClick={onSaveToken}
        disabled={isLoading || !selectedToken || (selectedToken === 'custom' && !customToken)}
        className="mt-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          "Save Token"
        )}
      </Button>
    </div>
  );
}
