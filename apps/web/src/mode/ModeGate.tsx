import type React from 'react';
import { useUiMode } from './UiModeContext';

export interface ModeGateProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Renders children exclusively when the active mode is 'engineer'.
 */
export function EngineerOnly({ children, fallback = null }: ModeGateProps) {
  const { isEngineer } = useUiMode();
  return isEngineer ? (children as React.ReactElement) : (fallback as React.ReactElement);
}

/**
 * Renders children exclusively when the active mode is 'ops'.
 */
export function OpsOnly({ children, fallback = null }: ModeGateProps) {
  const { isOps } = useUiMode();
  return isOps ? (children as React.ReactElement) : (fallback as React.ReactElement);
}

export interface ModeRendererProps {
  engineer: React.ReactNode;
  ops: React.ReactNode;
}

/**
 * Declarative switch that renders the `engineer` or `ops` prop according to active mode.
 */
export function ModeRenderer({ engineer, ops }: ModeRendererProps) {
  const { isEngineer } = useUiMode();
  return isEngineer ? (engineer as React.ReactElement) : (ops as React.ReactElement);
}
