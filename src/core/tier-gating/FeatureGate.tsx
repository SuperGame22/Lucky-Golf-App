import { ReactNode } from 'react';

interface FeatureGateProps {
  feature: string;
  children: ReactNode;
  fallback?: ReactNode;
}

// Simple pass-through for now — tier logic lives in the domain screens
export function FeatureGate({ children, fallback }: FeatureGateProps) {
  return <>{children}</>;
}
