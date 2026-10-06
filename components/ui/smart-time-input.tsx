"use client";

import React, { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Clock, Sparkles } from "lucide-react";
import { parseFlexibleTimeTo24Hour, to12HourTime, to24HourTime, toLocalTimeString } from "@/utils/client-date";

export interface SmartTimeInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value?: string;
  onChange?: (val24: string) => void;
  includeSeconds?: boolean;
  defaultFormat?: "12" | "24";
  showToggle?: boolean;
  showNowButton?: boolean;
  error?: boolean;
}

export const SmartTimeInput = React.forwardRef<HTMLInputElement, SmartTimeInputProps>(
  (
    {
      value = "",
      onChange,
      includeSeconds = true,
      defaultFormat = "24",
      showToggle = true,
      showNowButton = true,
      error = false,
      placeholder,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const [formatMode, setFormatMode] = useState<"12" | "24">(defaultFormat);
    const [textValue, setTextValue] = useState<string>("");
    const [isFocused, setIsFocused] = useState<boolean>(false);
    const lastEmittedValueRef = useRef<string>("");

    // Sync external value to internal text display
    useEffect(() => {
      if (isFocused) return; // Do not overwrite while typing

      if (!value) {
        setTextValue("");
        return;
      }

      const parsed24 = parseFlexibleTimeTo24Hour(value);
      if (parsed24) {
        if (formatMode === "12") {
          setTextValue(to12HourTime(parsed24, includeSeconds));
        } else {
          setTextValue(to24HourTime(parsed24, includeSeconds));
        }
      } else {
        setTextValue(value);
      }
    }, [value, formatMode, includeSeconds, isFocused]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value;
      setTextValue(input);

      // Attempt parsing live
      const parsed24 = parseFlexibleTimeTo24Hour(input);
      if (parsed24) {
        const out = includeSeconds ? parsed24 : parsed24.substring(0, 5);
        if (out !== lastEmittedValueRef.current) {
          lastEmittedValueRef.current = out;
          onChange?.(out);
        }
      } else if (!input.trim()) {
        if (lastEmittedValueRef.current !== "") {
          lastEmittedValueRef.current = "";
          onChange?.("");
        }
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      props.onBlur?.(e);

      if (!textValue.trim()) {
        setTextValue("");
        if (lastEmittedValueRef.current !== "") {
          lastEmittedValueRef.current = "";
          onChange?.("");
        }
        return;
      }

      const parsed24 = parseFlexibleTimeTo24Hour(textValue);
      if (parsed24) {
        const formatted = formatMode === "12" 
          ? to12HourTime(parsed24, includeSeconds) 
          : to24HourTime(parsed24, includeSeconds);
        setTextValue(formatted);
        const out = includeSeconds ? parsed24 : parsed24.substring(0, 5);
        lastEmittedValueRef.current = out;
        onChange?.(out);
      }
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      props.onFocus?.(e);
    };

    const toggleFormatMode = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const newMode = formatMode === "24" ? "12" : "24";
      setFormatMode(newMode);

      const parsed24 = parseFlexibleTimeTo24Hour(textValue || value);
      if (parsed24) {
        setTextValue(newMode === "12" ? to12HourTime(parsed24, includeSeconds) : to24HourTime(parsed24, includeSeconds));
      }
    };

    const handleSetNow = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const now = new Date();
      const time24 = toLocalTimeString(now, includeSeconds);
      const display = formatMode === "12" ? to12HourTime(time24, includeSeconds) : to24HourTime(time24, includeSeconds);
      setTextValue(display);
      lastEmittedValueRef.current = time24;
      onChange?.(time24);
    };

    const defaultPlaceholder = formatMode === "12" 
      ? (includeSeconds ? "02:30:00 PM" : "02:30 PM")
      : (includeSeconds ? "14:30:00 or 2:30pm" : "14:30 or 2:30pm");

    const rightPaddingClass = (showNowButton && showToggle && !disabled)
      ? "pr-[52px]"
      : ((showNowButton || showToggle) && !disabled)
        ? "pr-8"
        : "pr-2.5";

    return (
      <div className="relative flex items-center w-full group">
        <div className="absolute left-2 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
          <Clock className="w-3 h-3" />
        </div>

        <input
          ref={ref}
          type="text"
          value={textValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          disabled={disabled}
          placeholder={placeholder || defaultPlaceholder}
          className={cn(
            "flex h-9 w-full rounded-md border bg-slate-900/90 pl-6.5 text-xs font-mono font-bold text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 focus-visible:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
            rightPaddingClass,
            error ? "border-red-500 ring-red-500" : "border-slate-800 hover:border-slate-700",
            className
          )}
          {...props}
        />

        <div className="absolute right-1 flex items-center gap-0.5 pointer-events-auto">
          {showNowButton && !disabled && (
            <button
              type="button"
              onClick={handleSetNow}
              title="Set to Current Time (NOW)"
              className="h-5 px-1 rounded text-[8px] font-black uppercase tracking-tight bg-slate-800/90 hover:bg-cyan-950 text-cyan-400 hover:text-cyan-300 border border-slate-700/80 hover:border-cyan-500/50 transition-all flex items-center gap-0.5 shadow-sm"
            >
              <Sparkles className="w-2 h-2" />
              NOW
            </button>
          )}

          {showToggle && !disabled && (
            <button
              type="button"
              onClick={toggleFormatMode}
              title={`Switch to ${formatMode === "24" ? "12-Hour (AM/PM)" : "24-Hour"} Mode`}
              className={cn(
                "h-5 px-1 rounded text-[8px] font-black tracking-tight border transition-all select-none shadow-sm",
                formatMode === "24"
                  ? "bg-blue-950/90 text-blue-300 border-blue-600/50 hover:bg-blue-900"
                  : "bg-purple-950/90 text-purple-300 border-purple-600/50 hover:bg-purple-900"
              )}
            >
              {formatMode === "24" ? "24H" : "12H"}
            </button>
          )}
        </div>
      </div>
    );
  }
);

SmartTimeInput.displayName = "SmartTimeInput";
