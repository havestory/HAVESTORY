import { Calendar } from "lucide-react";

// Date filter options exposed on every list page (Orders / Custom Projects /
// CRM Projects / Invoices). Keep the keys stable; the labels are what the
// admin sees in the dropdown.
export const DATE_FILTER_OPTIONS = [
  { value: "all",       label: "All Time" },
  { value: "today",     label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week",      label: "This Week" },
  { value: "month",     label: "This Month" },
  { value: "year",      label: "This Year" },
] as const;

export type DateFilterValue = (typeof DATE_FILTER_OPTIONS)[number]["value"];

// Returns true if the supplied date falls inside the chosen period. Robust
// against null/undefined/invalid dates — those return false (so they're
// hidden from time-bounded views).
export function dateMatchesFilter(
  raw: string | Date | null | undefined,
  filter: DateFilterValue,
  now: Date = new Date(),
): boolean {
  if (filter === "all") return true;
  if (!raw) return false;
  const d = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) return false;

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  switch (filter) {
    case "today":
      return d >= startOfToday && d < startOfTomorrow;
    case "yesterday":
      return d >= startOfYesterday && d < startOfToday;
    case "week": {
      // Week starts Monday. Compute the Monday of `now`.
      const day = now.getDay() === 0 ? 6 : now.getDay() - 1;
      const monday = new Date(startOfToday);
      monday.setDate(monday.getDate() - day);
      return d >= monday && d < startOfTomorrow;
    }
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return d >= start && d < startOfTomorrow;
    }
    case "year": {
      const start = new Date(now.getFullYear(), 0, 1);
      return d >= start && d < startOfTomorrow;
    }
    default:
      return true;
  }
}

interface Props {
  value: DateFilterValue;
  onChange: (v: DateFilterValue) => void;
  className?: string;
}

// Compact date-range dropdown used at the top-right of each list page so
// the admin can quickly filter to today / yesterday / this week / etc.
export function DateFilterSelect({ value, onChange, className = "" }: Props) {
  return (
    <div className={`relative inline-flex items-center shrink-0 ${className}`}>
      <Calendar size={14} className="absolute left-2.5 text-admin-muted pointer-events-none" />
      <select
        value={value}
        onChange={e => onChange(e.target.value as DateFilterValue)}
        className="appearance-none pl-7 pr-6 py-1.5 sm:py-2 border border-admin-border rounded-lg sm:rounded-xl text-xs sm:text-sm bg-admin-surface outline-none focus:border-admin-brand-line transition-colors cursor-pointer"
        aria-label="Filter by date"
      >
        {DATE_FILTER_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <svg
        className="absolute right-1.5 sm:right-2 w-3 h-3 text-admin-muted pointer-events-none"
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

