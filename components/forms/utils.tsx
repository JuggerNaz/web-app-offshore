import React, {useState} from "react";
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