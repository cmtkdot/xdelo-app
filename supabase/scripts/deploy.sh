
#!/bin/bash

# Script to deploy database optimizations and function updates
echo "Starting deployment of timeout optimization changes..."

# Define colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if we have Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}Error: Supabase CLI not found. Please install it first.${NC}"
    echo "You can install it by following instructions at: https://supabase.io/docs/guides/cli"
    exit 1
fi

# Apply database migrations to fix timeout issues
echo -e "${BLUE}Applying database migrations...${NC}"
supabase db push --db-url "$SUPABASE_DB_URL" || {
    echo -e "${RED}Failed to apply database migrations${NC}"
    exit 1
}

# Update and redeploy the edge functions
echo -e "${BLUE}Redeploying edge functions...${NC}"
supabase functions deploy telegram-webhook || {
    echo -e "${RED}Failed to deploy telegram-webhook function${NC}"
    exit 1
}

# Run the immediate timeout fix script
echo -e "${BLUE}Running timeout fix script...${NC}"
supabase db execute --file ./supabase/scripts/fix_timeouts.sql || {
    echo -e "${RED}Failed to run timeout fix script${NC}"
    echo "You can run it manually using the Supabase dashboard SQL editor"
}

# Success message
echo -e "${GREEN}Deployment completed successfully!${NC}"
echo "The following changes have been applied:"
echo "1. Removed large telegram_data field and replaced with lightweight telegram_metadata"
echo "2. Added indexes to improve query performance"
echo "3. Created utilities to manage database locks and timeouts"
echo "4. Updated edge functions to use optimized database client settings"

echo -e "${BLUE}Don't forget to check the logs after deployment to ensure everything is working properly.${NC}"
echo "You can view logs using: supabase functions logs telegram-webhook" 
