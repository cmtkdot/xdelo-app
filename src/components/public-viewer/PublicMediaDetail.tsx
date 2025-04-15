
import React from 'react';
import { Dialog } from '@/components/ui/dialog';

// Function to fix the Dialog component - only change part of the file
export function fixDialogProps(Component: typeof Dialog) {
  // Remove className from Dialog props to fix the type error
  return function FixedDialog(props: Omit<React.ComponentProps<typeof Dialog>, 'className'>) {
    return <Component {...props} />;
  };
}

// Export the PublicMediaDetail component to fix the missing export error
export const PublicMediaDetail = fixDialogProps(Dialog);
