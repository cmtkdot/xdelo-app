#!/bin/bash

# Synchronization script for Supabase Edge Functions
# This script removes deprecated functions and deploys the consolidated ones

echo "Starting Supabase Functions Synchronization..."

# Move to the supabase directory
cd "$(dirname "$0")"

# ==== STEP 1: Clean up deprecated functions ====
echo "Removing deprecated functions..."

# List of deprecated functions that have been consolidated
DEPRECATED_FUNCTIONS=(
  "manual-caption-parser"
  "parse-caption-with-ai"
  "sync-media-group"
  "media-management"
  "validate-storage-files"
)

# Remove each deprecated function directory
for func in "${DEPRECATED_FUNCTIONS[@]}"; do
  if [ -d "functions/$func" ]; then
    echo "Removing $func..."
    rm -rf "functions/$func"
  else
    echo "Directory functions/$func not found, skipping..."
  fi
done

# ==== STEP 2: Ensure consolidated functions exist ====
echo "Verifying consolidated functions..."

REQUIRED_FUNCTIONS=(
  "message-processor"
  "media-processor"
)

for func in "${REQUIRED_FUNCTIONS[@]}"; do
  if [ -d "functions/$func" ]; then
    echo "Consolidated function $func exists"
  else
    echo "ERROR: Consolidated function $func not found!"
    exit 1
  fi
done

# ==== STEP 3: Verify shared utilities ====
echo "Verifying shared utilities..."

if [ -f "functions/_shared/baseUtils.ts" ]; then
  echo "Consolidated baseUtils.ts exists"
else
  echo "ERROR: Consolidated baseUtils.ts not found!"
  exit 1
fi

# ==== STEP 4: Synchronize with Supabase ====
echo "Synchronizing with Supabase..."

# List functions to verify deployment
echo "Current functions in project:"
npx supabase functions list

# Deploy consolidated functions
echo "Deploying consolidated functions..."
for func in "${REQUIRED_FUNCTIONS[@]}"; do
  echo "Deploying $func..."
  npx supabase functions deploy $func
done

echo "Synchronization complete!"
echo "-------------------------------------"
echo "Summary:"
echo "✓ Removed ${#DEPRECATED_FUNCTIONS[@]} deprecated functions"
echo "✓ Deployed ${#REQUIRED_FUNCTIONS[@]} consolidated functions"
echo "✓ Verified shared utilities"
echo ""
echo "Please update any frontend code that was using the deprecated functions."
echo "See functions/README.md for usage examples of the new consolidated functions." 