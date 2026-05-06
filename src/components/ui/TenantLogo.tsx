import React from "react";

interface TenantLogoProps {
  variant?: "full" | "mark" | "white";
  className?: string;
}

export function TenantLogo({ variant: _variant = "full", className = "" }: TenantLogoProps) {
  // Placeholder para o "T" gradiente da Tallpa
  return (
    <div
      className={`flex h-[42px] w-[42px] items-center justify-center rounded-[10px] bg-grad text-xl font-extrabold text-[#051127] shadow-glow-cyan font-display ${className}`}
    >
      T
    </div>
  );
}
