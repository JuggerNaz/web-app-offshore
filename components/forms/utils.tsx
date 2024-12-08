import React, {useState} from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronsUpDown } from "lucide-react"

export const ColWrap = ({
    children,
  }: {
    children: React.ReactNode;
  }) => {
    return (
      <div className="flex flex-col w-1/3 gap-2">
          {children}
      </div>
    )
}

export const RowWrap = ({
    children,
  }: {
    children: React.ReactNode;
  }) => {
    return (
      <div className="flex justify-items-stretch gap-5">
          {children}
      </div>
    )
}

export const FormFieldCollapsible = ({
    children,
    title,
  }: {
    children: React.ReactNode;
    title: string;
  }) => {
    const [isOpen, setIsOpen] = useState(true);
    return (
      <div className="border border-gray-200 rounded p-2">
        <div
          className="flex justify-between items-center cursor-pointer"
          onClick={() => setIsOpen(!isOpen)}
        >
          <h3>{title}</h3>
          <span>{isOpen ? "▲" : "▼"}</span>
        </div>
        {isOpen && <div>{children}</div>}
      </div>
    );
  }

  export const CollapsibleField = ({
    children,
    title,
  }: {
    children: React.ReactNode;
    title: string;
  }) => {
    const [isOpen, setIsOpen] = useState(true)
    return (
      <Collapsible
        open={isOpen}
        onOpenChange={setIsOpen}
        className="space-y-2 pt-2 pb-4 px-4 rounded border"
      >
        <CollapsibleTrigger
          className="flex justify-between w-full items-center"
        >
          <h3>{title}</h3>
          <ChevronsUpDown className="h-4 w-4" />
        </CollapsibleTrigger>
        <CollapsibleContent>{children}</CollapsibleContent>
      </Collapsible>
    );
  }