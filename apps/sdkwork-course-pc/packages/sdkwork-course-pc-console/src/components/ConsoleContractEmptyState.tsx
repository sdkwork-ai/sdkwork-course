import React from 'react';
import { AlertCircle } from 'lucide-react';

export const CONSOLE_TENANT_ADMIN_CONTRACT_UNAVAILABLE =
  'console tenant admin contract is not available';

export const ConsoleContractEmptyState = ({
  title,
  description = CONSOLE_TENANT_ADMIN_CONTRACT_UNAVAILABLE,
}: {
  title: string;
  description?: string;
}) => (
  <div className="flex-1 flex flex-col items-center justify-center p-12 text-center gap-4 min-h-[320px]">
    <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center">
      <AlertCircle className="text-gray-400 dark:text-zinc-500" size={28} />
    </div>
    <p className="text-gray-900 dark:text-gray-100 font-medium">{title}</p>
    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-lg">{description}</p>
  </div>
);
