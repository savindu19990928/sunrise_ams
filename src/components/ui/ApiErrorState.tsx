import React from 'react';
import type { ApiError } from '../../utils/api';
import { ErrorState } from './States';

interface ApiErrorStateProps {
  error: ApiError;
  onRetry?: () => void;
}

/** Error state for failed server requests. */
export function ApiErrorState({ error, onRetry }: ApiErrorStateProps) {
  return <ErrorState message={error.message} onRetry={onRetry} />;
}