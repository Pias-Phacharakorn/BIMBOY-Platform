import "iconify-icon";
import React from "react";
import type { CSSProperties } from "react";
import { appIcons } from "../../globals";

export type AppIconName = keyof typeof appIcons;

interface IconProps {
  name: AppIconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export function Icon({ name, size = 18, className, style }: IconProps) {
  return (
    <span
      className={className}
      aria-hidden="true"
      style={{
        display: "inline-flex",
        width: size,
        height: size,
        ...style,
      }}
    >
      {/*
        iconify-icon is already present through the ThatOpen UI dependency tree.
        React can render the custom element without a dedicated React wrapper.
      */}
      {React.createElement("iconify-icon", {
        icon: appIcons[name],
        width: size,
        height: size,
      })}
    </span>
  );
}
