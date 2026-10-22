"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";

type SelectOption = {
  value: string;
  label: string;
};

type AppSelectProps = {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  triggerClassName?: string;
  contentClassName?: string;
  itemClassName?: string;
  triggerLabel?: string;
  showItemIndicator?: boolean;
  required?: boolean;
  validationLabel?: string;
  contentSide?: "top" | "bottom";
  contentAlign?: "start" | "center" | "end";
  avoidCollisions?: boolean;
};

export function Select({
  id,
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  disabled = false,
  triggerClassName = "",
  contentClassName = "",
  itemClassName = "",
  triggerLabel,
  showItemIndicator = true,
  required = false,
  validationLabel = "selection",
  contentSide = "bottom",
  contentAlign = "start",
  avoidCollisions = true,
}: AppSelectProps) {
  return (
    <div className="relative">
      {required ? (
        <input
          tabIndex={-1}
          readOnly
          value={value}
          required
          aria-label={validationLabel}
          className="pointer-events-none absolute left-0 top-0 h-px w-px opacity-0"
        />
      ) : null}

      <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectPrimitive.Trigger
          id={id}
          className={[
            "group flex w-full items-center justify-between gap-3",
            "rounded-[18px] border border-[rgba(10,22,40,0.12)] bg-[#FCFCFA]",
            "px-4 py-3.5 text-left shadow-[0_8px_24px_rgba(10,22,40,0.04)]",
            "transition-all duration-300 outline-none",
            "focus:border-[#0A1628] focus:bg-white focus:shadow-[0_14px_34px_rgba(10,22,40,0.08)]",
            "data-[placeholder]:text-[#5F6878] disabled:cursor-not-allowed disabled:opacity-70",
            triggerClassName,
          ].join(" ")}
          aria-label={validationLabel}
        >
          {triggerLabel ? <span>{triggerLabel}</span> : <SelectPrimitive.Value placeholder={placeholder} />}
          <SelectPrimitive.Icon asChild>
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-[rgba(10,22,40,0.08)] bg-white text-[#B8922A]">
              <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" strokeWidth={1.6} />
            </span>
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>

        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            side={contentSide}
            align={contentAlign}
            avoidCollisions={avoidCollisions}
            sideOffset={10}
            className={[
              "z-[1500] min-w-[var(--radix-select-trigger-width)] max-h-[260px] overflow-y-auto rounded-[18px]",
              "border border-[rgba(10,22,40,0.1)] bg-white shadow-[0_26px_60px_rgba(10,22,40,0.16)]",
              contentClassName,
            ].join(" ")}
          >
            <SelectPrimitive.Viewport className="overscroll-contain p-2">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  className={["relative flex w-full cursor-pointer items-center justify-between rounded-[12px] px-4 py-3 text-[13px] font-light tracking-[0.02em] text-[#0A1628] outline-none transition-colors duration-200 focus:bg-[#F5F6F8] data-[state=checked]:bg-[#0A1628] data-[state=checked]:text-white", itemClassName].join(" ")}
                >
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                  {showItemIndicator ? (
                    <SelectPrimitive.ItemIndicator>
                      <Check className="h-4 w-4" strokeWidth={1.8} />
                    </SelectPrimitive.ItemIndicator>
                  ) : null}
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  );
}
