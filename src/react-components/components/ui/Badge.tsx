import React from 'react'

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Badge({ children, ...props }: BadgeProps) {
  return <div {...props}>{children}</div>
}
