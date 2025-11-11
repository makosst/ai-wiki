import React, { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export const Input: React.FC<InputProps> = ({
  type = "text",
  placeholder = "Enter text",
  className = "",
  style,
  ...props
}) => {
  return (
    <input
      type={type}
      placeholder={placeholder}
      className={`px-4 py-2 w-full rounded border-2 border-black transition focus:outline-hidden ${
        props["aria-invalid"]
          ? "border-destructive text-destructive"
          : ""
      } ${className}`}
      style={{
        boxShadow: "3px 3px 0px 0px rgba(0, 0, 0, 1)",
        ...style
      }}
      {...props}
    />
  );
};
