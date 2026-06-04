import {
  forwardRef,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";

type DropdownMenuAlign = "left" | "right";

export type DropdownMenuProps = {
  children: ReactNode;
  className?: string;
  align?: DropdownMenuAlign;
  /** Fixed position (portal menus); pass `left` / `top` via style */
  portal?: boolean;
  style?: CSSProperties;
  role?: "menu" | "listbox";
};

export const DropdownMenu = forwardRef<HTMLDivElement, DropdownMenuProps>(
  function DropdownMenu(
    {
      children,
      className,
      align = "left",
      portal = false,
      style,
      role = "menu",
    },
    ref,
  ) {
    const classes = [
      "ui-dropdown",
      align === "right" ? "ui-dropdown--align-right" : "",
      portal ? "ui-dropdown--portal" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div ref={ref} className={classes} style={style} role={role}>
        {children}
      </div>
    );
  },
);

export type DropdownMenuItemProps = {
  children: ReactNode;
  className?: string;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  onClick?: () => void;
};

export function DropdownMenuItem({
  children,
  className,
  active,
  danger,
  disabled,
  icon,
  onClick,
}: DropdownMenuItemProps) {
  const classes = [
    "ui-dropdown__item",
    active ? "ui-dropdown__item--active" : "",
    danger ? "ui-dropdown__item--danger" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      role="menuitem"
      className={classes}
      disabled={disabled}
      onClick={onClick}
    >
      {icon != null ? <span className="ui-dropdown__icon">{icon}</span> : null}
      <span className="ui-dropdown__label">{children}</span>
    </button>
  );
}

/** Wrapper for anchor + absolutely positioned dropdown */
export function DropdownMenuWrap({
  children,
  className,
  onMouseDown,
}: {
  children: ReactNode;
  className?: string;
  onMouseDown?: (e: MouseEvent) => void;
}) {
  return (
    <div
      className={["ui-dropdown-wrap", className].filter(Boolean).join(" ")}
      onMouseDown={onMouseDown}
    >
      {children}
    </div>
  );
}