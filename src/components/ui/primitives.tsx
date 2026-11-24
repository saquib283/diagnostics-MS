import React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  size?: "sm" | "md";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      type = "button",
      children,
      ...props
    },
    ref,
  ) => {
    const variants = {
      primary:
        "bg-[#1B365D] text-white border border-[#1B365D] hover:bg-[#122644] disabled:opacity-55",
      secondary:
        "bg-white text-[#0F172A] border border-[#CBD5E1] hover:bg-[#F8FAFC] disabled:opacity-55",
      ghost:
        "bg-transparent text-[#334155] border border-transparent hover:bg-[#F1F5F9] disabled:opacity-55",
      destructive:
        "bg-[#991B1B] text-white border border-[#991B1B] hover:bg-[#7F1D1D] disabled:opacity-55",
    };

    const sizes = {
      sm: "h-8 px-2.5 text-xs",
      md: "h-9 px-3.5 text-sm",
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-[4px] font-medium transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed",
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export interface FieldProps {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

export function FormField({
  id,
  label,
  required,
  hint,
  error,
  children,
}: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="text-[13px] font-medium text-[#0F172A] leading-snug"
      >
        {label}
        {required ? (
          <span aria-hidden="true" className="text-[#991B1B] ml-0.5">
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint ? (
        <span id={`${id}-hint`} className="text-xs text-[#475569] leading-snug">
          {hint}
        </span>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-[#991B1B] m-0">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-9 w-full rounded-[4px] border border-[#64748B] bg-white px-2.5 text-sm text-[#0F172A] placeholder:text-[#64748B] disabled:bg-[#F1F5F9] disabled:text-[#475569]",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "h-9 w-full rounded-[4px] border border-[#64748B] bg-white px-2.5 text-sm text-[#0F172A] disabled:bg-[#F1F5F9]",
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-[76px] w-full rounded-[4px] border border-[#64748B] bg-white p-2.5 text-sm text-[#0F172A] resize-y",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export function Panel({
  title,
  actions,
  children,
  className,
}: {
  title?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[6px] border border-[#E2E8F0] bg-white",
        className,
      )}
    >
      {title || actions ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5">
          {title ? (
            <h2 className="text-[15px] font-semibold text-[#0F172A] m-0">
              {title}
            </h2>
          ) : (
            <div />
          )}
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

