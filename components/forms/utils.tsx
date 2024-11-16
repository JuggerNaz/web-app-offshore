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