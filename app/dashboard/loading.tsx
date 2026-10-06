export default function DashboardLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading page"
      className="flex-1 w-full overflow-y-auto custom-scrollbar bg-slate-50/50 dark:bg-transparent animate-in fade-in duration-200"
    >
      <div className="max-w-7xl mx-auto w-full p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-3">
            <div className="h-3 w-40 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
            <div className="h-8 w-72 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
          </div>
          <div className="h-10 w-44 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="h-5 w-5 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
                <div className="h-4 w-14 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
              </div>
              <div className="h-7 w-24 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
              <div className="h-3 w-20 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
            </div>
          ))}
        </div>

        {/* Content area */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
          <div className="h-5 w-52 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
          <div className="h-64 w-full rounded-xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
