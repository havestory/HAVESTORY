import { useMemo, useState } from "react";
import { Search, X, User, UserPlus, AlertTriangle } from "lucide-react";
import { useListClients } from "@workspace/api-client-react";

export type ClientLite = {
  id: number;
  name: string;
  businessName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

export type ClientPickerValue = {
  clientId: number | null;
  name: string;
  phone: string;
  email: string;
  businessName: string;
  address: string;
};

export const EMPTY_CLIENT_VALUE: ClientPickerValue = {
  clientId: null,
  name: "",
  phone: "",
  email: "",
  businessName: "",
  address: "",
};

const inp =
  "w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-pink-400 transition-colors placeholder:text-gray-400";

// Format a client's numeric DB id as the user-facing customer code, matching
// the format used on the admin Clients page (e.g. id 1 → "C0001"). Keeping
// this in sync means admins can copy a code from one screen and search for
// it in another.
const formatClientCode = (id: number) => `C${String(id).padStart(4, "0")}`;

// Canonicalize a phone number for comparison. The business operates in Sri Lanka and
// business, so we treat `+94XXXXXXXXX`, `0094XXXXXXXXX`, `94XXXXXXXXX` and
// the local `0XXXXXXXXX` form as the same number. Returns the 9-digit
// subscriber portion when it can be detected, otherwise the full digit
// string. Empty / null inputs return "" so callers can early-out.
export const normalizePhone = (s: string | null | undefined) => {
  let digits = (s || "").replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("94")) return digits.slice(2);
  if (digits.length === 10 && digits.startsWith("0")) return digits.slice(1);
  return digits;
};

const savedPhoneKeys = (raw: string | null | undefined) =>
  String(raw || "").split(/[,;\n|/]+/).map(part => normalizePhone(part.trim())).filter(Boolean);
const savedPhoneMatches = (raw: string | null | undefined, wanted: string) =>
  !!wanted && savedPhoneKeys(raw).some(key => key === wanted);

type Props = {
  value: ClientPickerValue;
  onChange: (v: ClientPickerValue) => void;
  saveToClients: boolean;
  onSaveToClientsChange: (b: boolean) => void;
  /** Explicit override required when a phone already belongs to another client. */
  allowDuplicatePhone?: boolean;
  onAllowDuplicatePhoneChange?: (b: boolean) => void;
  /** Show the optional Business Name field (default true). */
  showBusinessName?: boolean;
  /** Mark the address field as required (default false). */
  requireAddress?: boolean;
  /** Mark the phone field as required (default false). */
  requirePhone?: boolean;
  /** Label shown above the picker. */
  label?: string;
  /** Force the initial mode. Useful in edit flows where a name is pre-filled
   *  but we still want the searchable dropdown (not the manual-entry form). */
  defaultMode?: "select" | "manual";
};

export function ClientPicker({
  value,
  onChange,
  saveToClients,
  onSaveToClientsChange,
  allowDuplicatePhone = false,
  onAllowDuplicatePhoneChange,
  showBusinessName = true,
  requireAddress = false,
  requirePhone = false,
  label = "CLIENT",
  defaultMode,
}: Props) {
  const { data: clientsRaw } = useListClients();
  const clients: ClientLite[] = Array.isArray(clientsRaw)
    ? (clientsRaw as ClientLite[])
    : [];

  // Mode: "select" = searchable dropdown of existing clients (with optional
  // selected/edit panel below). "manual" = full new-client entry form.
  const [mode, setMode] = useState<"select" | "manual">(
    defaultMode ?? (value.clientId ? "select" : value.name ? "manual" : "select"),
  );
  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Phone-shape detection: a query that is mostly digits (allowing common
  // separators like +, spaces, dashes, parens) is treated as a phone search.
  // We then compare it digit-for-digit using normalizePhone so "+94 77 …"
  // matches a saved "077 …" and vice-versa.
  const trimmedSearchRaw = search.trim();
  const trimmedSearch = trimmedSearchRaw.toLowerCase();
  const searchDigits = trimmedSearchRaw.replace(/\D+/g, "");
  const looksLikePhone =
    searchDigits.length >= 4 &&
    searchDigits.length / Math.max(trimmedSearchRaw.length, 1) >= 0.6;
  const normalizedSearchPhone = looksLikePhone
    ? normalizePhone(trimmedSearchRaw)
    : "";
  // Customer-code search prep — strip whitespace, leading "#", "id" prefix
  // and uppercase so "c0001", "C0001", "#C0001", "id C0001" and "c1"
  // all collapse to a comparable form. We extract the numeric portion and
  // drop leading zeros so partial typing still finds the row regardless of
  // padding (e.g. "C1", "C01", "C001", "C0001" all match id 1).
  const codeSearch = trimmedSearchRaw
    .replace(/^#/, "")
    .replace(/^id[:\s]*/i, "")
    .replace(/\s+/g, "")
    .toUpperCase();
  const codeMatch = /^C(\d*)$/.exec(codeSearch);
  const looksLikeCode = !!codeMatch;
  // Numeric portion stripped of leading zeros — "" when the user only
  // typed "C" (which we treat as "show every customer code", i.e. no filter).
  const codeIdDigits = codeMatch ? codeMatch[1].replace(/^0+/, "") : "";

  const filtered = useMemo(() => {
    const q = trimmedSearch;
    if (!q) return clients;
    return clients.filter(c => {
      if (c.name.toLowerCase().includes(q)) return true;
      if ((c.businessName || "").toLowerCase().includes(q)) return true;
      if ((c.email || "").toLowerCase().includes(q)) return true;
      // Customer ID search — supports the user-facing "C0001" code as well
      // as the raw integer id ("123", "#123", "id 123") so admins can paste
      // a code from the Clients page and find the same record here. customer-code
      // partial matches compare on the numeric portion with leading zeros
      // stripped so C1 / C01 / C001 / C0001 all match id 1.
      if (looksLikeCode && codeIdDigits && String(c.id) === codeIdDigits) return true;
      if (searchDigits && String(c.id) === searchDigits) return true;
      // Phone search — first try a substring match against the saved phone
      // (covers partial typing); then try a normalized digit match so
      // formatting differences (+94 vs 0, spaces, dashes) don't matter.
      const savedPhone = c.phone || "";
      if (savedPhone.includes(q)) return true;
      if (normalizedSearchPhone) {
        if (savedPhoneMatches(savedPhone, normalizedSearchPhone)) return true;
      }
      return false;
    });
  }, [clients, trimmedSearch, searchDigits, normalizedSearchPhone, looksLikeCode, codeIdDigits]);

  // When there's no search query, render no client rows at all. The full
  // client list is intentionally hidden until the admin types a query so
  // the dropdown stays compact (and so customer details aren't broadcast
  // by default). Typing surfaces matches by name, phone, email, business
  // or customer-code/numeric ID.
  const visible = trimmedSearch ? filtered : [];

  // When the admin types a known phone number into the search box (select
  // mode), surface "Existing customer found" prominently at the top of the
  // dropdown so they immediately notice the match instead of relying on
  // them spotting it in the list. Falls back to null when no normalized
  // phone match exists or when the user is currently editing a selected
  // client (in which case the search box shows "Selected: …").
  const phoneMatchInDropdown = useMemo<ClientLite | null>(() => {
    if (value.clientId) return null;
    if (!normalizedSearchPhone) return null;
    return (
      clients.find(
        c => savedPhoneMatches(c.phone, normalizedSearchPhone),
      ) ?? null
    );
  }, [clients, value.clientId, normalizedSearchPhone]);

  const hasExactMatch =
    trimmedSearch.length > 0 &&
    clients.some(c => c.name.trim().toLowerCase() === trimmedSearch);
  // Always offer "+ Add a new client" in the dropdown unless the typed search
  // exactly matches an existing client name. Previously this required the user
  // to type something first, which made the manual-add path invisible on first
  // open and admins thought the field only supported picking an existing
  // client. The button label below adapts to whether there's a search query.
  const showAddNew = !hasExactMatch;

  // Duplicate-phone detection — only meaningful in manual mode when the user
  // hasn't picked an existing client. We match by normalized phone digits so
  // formatting (spaces, dashes, +94 vs 0) doesn't matter.
  const phoneDupe = useMemo<ClientLite | null>(() => {
    if (mode !== "manual") return null;
    if (value.clientId) return null;
    const norm = normalizePhone(value.phone);
    if (norm.length < 4) return null;
    return (
      clients.find(c => savedPhoneMatches(c.phone, norm)) ?? null
    );
  }, [clients, value.clientId, value.phone, mode]);

  const selectClient = (c: ClientLite) => {
    onChange({
      clientId: c.id,
      name: c.name,
      phone: c.phone || "",
      email: c.email || "",
      businessName: c.businessName || "",
      address: c.address || "",
    });
    setMode("select");
    setSearch("");
    setDropdownOpen(false);
  };

  const clearClient = () => {
    onChange({ ...EMPTY_CLIENT_VALUE });
    onSaveToClientsChange(false);
    onAllowDuplicatePhoneChange?.(false);
    setSearch("");
    setMode("select");
  };

  const startManualEntry = () => {
    onChange({
      ...EMPTY_CLIENT_VALUE,
      name: search.trim() || value.name,
    });
    setMode("manual");
    setDropdownOpen(false);
    // Auto-tick "Save to my Clients database" — when the user explicitly
    // chooses to add a brand-new client via the picker, the most common
    // intent is to also persist them to the Clients DB. The user can still
    // untick it before saving the form.
    onSaveToClientsChange(true);
    onAllowDuplicatePhoneChange?.(false);
  };

  return (
    <div>
      <label className="text-xs text-gray-400 font-semibold mb-1.5 flex items-center gap-1">
        <User size={11} /> {label} *
      </label>

      {mode === "manual" && !value.clientId ? (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 rounded-xl border border-purple-100">
            <UserPlus size={13} className="text-purple-500 shrink-0" />
            <span className="text-xs font-semibold text-purple-700 flex-1">
              New client entry
            </span>
            <button
              type="button"
              onClick={clearClient}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Cancel and pick existing"
            >
              <X size={14} />
            </button>
          </div>

          <input
            required
            value={value.name}
            onChange={e => onChange({ ...value, name: e.target.value })}
            placeholder="Client name *"
            className={inp}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              required={requirePhone}
              value={value.phone}
              onChange={e => {
                onChange({ ...value, phone: e.target.value });
                onAllowDuplicatePhoneChange?.(false);
              }}
              placeholder={`📞 Phone${requirePhone ? " *" : ""}`}
              className={inp}
            />
            <input
              type="email"
              value={value.email}
              onChange={e => onChange({ ...value, email: e.target.value })}
              placeholder="✉ Email"
              className={inp}
            />
            {showBusinessName && (
              <input
                value={value.businessName}
                onChange={e =>
                  onChange({ ...value, businessName: e.target.value })
                }
                placeholder="🏢 Business name"
                className={inp}
              />
            )}
            <input
              required={requireAddress}
              value={value.address}
              onChange={e => onChange({ ...value, address: e.target.value })}
              placeholder={`📍 Address${requireAddress ? " *" : ""}`}
              className={`${inp} ${
                showBusinessName ? "" : "sm:col-span-2"
              }`}
            />
          </div>

          {/* Duplicate phone warning — fires when this manual phone matches an
              existing client. Lets the owner one-tap switch to that record. */}
          {phoneDupe && (
            <div className="flex items-start gap-2.5 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
              <div className="flex-1 text-xs text-amber-800">
                <div className="font-semibold">Existing customer found</div>
                <div className="text-amber-700/90 mt-0.5">
                  <span className="font-semibold">{phoneDupe.name}</span> already
                  uses this phone number
                  {phoneDupe.businessName ? ` (${phoneDupe.businessName})` : ""}.
                </div>
              </div>
              <button
                type="button"
                onClick={() => selectClient(phoneDupe)}
                className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
              >
                Use existing
              </button>
            </div>
          )}

          {phoneDupe && saveToClients && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700">
              Duplicate profiles are blocked. Use the existing customer record above.
            </div>
          )}

          {/* Opt-in: also save this manual entry to the Clients database. */}
          <label className="flex items-start gap-2.5 px-3 py-2.5 bg-pink-50 border border-pink-100 rounded-xl cursor-pointer select-none hover:bg-pink-100 transition-colors">
            <input
              type="checkbox"
              checked={saveToClients}
              onChange={e => onSaveToClientsChange(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-pink-500 cursor-pointer shrink-0"
            />
            <div className="flex-1 text-xs">
              <div className="font-semibold text-pink-700">
                Also save to my Clients database
              </div>
              <div className="text-pink-500/80 text-[11px] mt-0.5">
                {saveToClients
                  ? "A new client record will be created and linked."
                  : "Only this entry will record the client name. No client record will be created."}
              </div>
            </div>
          </label>
        </div>
      ) : (
        <div className="space-y-2.5">
          {/* Searchable dropdown for existing clients */}
          <div className="relative">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setDropdownOpen(true);
                }}
                onFocus={() => setDropdownOpen(true)}
                onBlur={() => {
                  setTimeout(() => setDropdownOpen(false), 150);
                }}
                placeholder={
                  value.clientId
                    ? `Selected: ${value.name}`
                    : "Search by name, phone, email, business, or C0001…"
                }
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-pink-200 placeholder:text-gray-400"
              />
            </div>
            {dropdownOpen && (
              <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-100 rounded-xl shadow-lg z-20 max-h-72 overflow-y-auto">
                {/* Phone-match banner — fires the moment the typed search
                    matches an existing client's phone (normalized so
                    "+94 77…" === "077…"). One-tap to select. */}
                {phoneMatchInDropdown && (
                  <div className="flex items-start gap-2.5 px-3 py-2.5 bg-amber-50 border-b border-amber-200 sticky top-0 z-10">
                    <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                    <div className="flex-1 text-xs text-amber-800 min-w-0">
                      <div className="font-semibold">Existing customer found</div>
                      <div className="text-amber-700/90 mt-0.5 truncate">
                        <span className="font-semibold">{phoneMatchInDropdown.name}</span> already
                        uses this phone number
                        {phoneMatchInDropdown.businessName ? ` (${phoneMatchInDropdown.businessName})` : ""}.
                      </div>
                    </div>
                    <button
                      type="button"
                      onMouseDown={e => {
                        e.preventDefault();
                        selectClient(phoneMatchInDropdown);
                      }}
                      className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                    >
                      Use existing
                    </button>
                  </div>
                )}
                {!trimmedSearch && (
                  <div className="px-4 py-3 text-xs text-gray-400 italic flex items-center gap-2">
                    <Search size={12} className="text-gray-300" />
                    Type to search by name, phone, email, business, or customer-code.
                    {clients.length > 0 && (
                      <span className="ml-auto text-[11px] text-gray-300 not-italic tabular-nums">
                        {clients.length} saved
                      </span>
                    )}
                  </div>
                )}
                {visible.map(c => (
                  <button
                    type="button"
                    key={c.id}
                    onMouseDown={e => {
                      e.preventDefault();
                      selectClient(c);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-pink-50 text-sm border-b border-gray-50 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <div className="font-semibold text-gray-800 truncate flex-1">{c.name}</div>
                      <span className="shrink-0 text-[10px] font-bold text-pink-600 bg-pink-50 border border-pink-100 rounded-full px-1.5 py-0.5 tabular-nums">
                        {formatClientCode(c.id)}
                      </span>
                    </div>
                    {(c.phone || c.businessName || c.email) && (
                      <div className="text-xs text-gray-400 truncate">
                        {c.phone}
                        {c.phone && (c.businessName || c.email) ? " · " : ""}
                        {c.businessName}
                        {c.businessName && c.email ? " · " : ""}
                        {c.email}
                      </div>
                    )}
                  </button>
                ))}
                {trimmedSearch && filtered.length === 0 && (
                  <div className="px-4 py-2.5 text-xs text-gray-400 italic">
                    No matching clients.
                  </div>
                )}
                {showAddNew && (
                  <button
                    type="button"
                    onMouseDown={e => {
                      e.preventDefault();
                      startManualEntry();
                    }}
                    className="w-full text-left px-4 py-2.5 bg-purple-50 hover:bg-purple-100 text-sm flex items-center gap-2 text-purple-700 font-semibold border-t border-purple-100"
                  >
                    <UserPlus size={13} />
                    {search.trim()
                      ? `+ Add "${search.trim()}" as new client`
                      : "+ Add a new client"}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Selected client details — editable, mirrors invoice form */}
          {value.name && (
            <div
              className="space-y-2.5"
              onClick={() => setDropdownOpen(false)}
            >
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
                  value.clientId
                    ? "bg-pink-50 border-pink-100"
                    : "bg-amber-50 border-amber-100"
                }`}
              >
                <User
                  size={13}
                  className={
                    value.clientId
                      ? "text-pink-500 shrink-0"
                      : "text-amber-500 shrink-0"
                  }
                />
                <span
                  className={`text-sm font-semibold flex-1 truncate ${
                    value.clientId ? "text-pink-700" : "text-amber-700"
                  }`}
                >
                  {value.name}
                </span>
                {value.clientId ? (
                  <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 shrink-0">
                    Linked
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5 shrink-0">
                    Not linked
                  </span>
                )}
                <button
                  type="button"
                  onClick={clearClient}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  title="Change client"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    📞 Phone{requirePhone ? " *" : ""}
                  </label>
                  <input
                    required={requirePhone}
                    value={value.phone}
                    onChange={e => onChange({ ...value, phone: e.target.value })}
                    placeholder="Enter phone"
                    className={inp}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    ✉ Email
                  </label>
                  <input
                    type="email"
                    value={value.email}
                    onChange={e => onChange({ ...value, email: e.target.value })}
                    placeholder="Enter email"
                    className={inp}
                  />
                </div>
                {showBusinessName && (
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">
                      🏢 Business
                    </label>
                    <input
                      value={value.businessName}
                      onChange={e =>
                        onChange({ ...value, businessName: e.target.value })
                      }
                      placeholder="Enter business"
                      className={inp}
                    />
                  </div>
                )}
                <div className={showBusinessName ? "" : "sm:col-span-2"}>
                  <label className="text-xs text-gray-500 block mb-1">
                    📍 Address{requireAddress ? " *" : ""}
                  </label>
                  <input
                    required={requireAddress}
                    value={value.address}
                    onChange={e =>
                      onChange({ ...value, address: e.target.value })
                    }
                    placeholder="Enter address"
                    className={inp}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Helper for the parent form's submit handler. If the picker has a linked
 * existing client, returns its id. Otherwise, if the user opted in via the
 * "Save to my Clients database" checkbox, POSTs /api/clients and returns the
 * new id. Returns null when the entry is purely transient (manual without
 * the opt-in).
 *
 * Throws on network failure so the caller can surface a toast / error.
 */
export async function ensureClientFromPicker(
  value: ClientPickerValue,
  saveToClients: boolean,
  _allowDuplicatePhone = false,
): Promise<number | null> {
  if (value.clientId) return value.clientId;
  if (!saveToClients) return null;
  if (!value.name.trim()) return null;
  const res = await fetch("/api/clients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: value.name.trim(),
      phone: value.phone.trim() || null,
      email: value.email.trim() || null,
      businessName: value.businessName.trim() || null,
      address: value.address.trim() || null,
      // Duplicate override intentionally removed: one phone can belong to only one client profile.
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 409 && body?.existingClient) {
      const existing = body.existingClient;
      throw new Error(`Existing customer found: ${existing.name} (${formatClientCode(existing.id)}). Select “Use existing”; duplicate client profiles are blocked.`);
    }
    throw new Error(body?.error || "Failed to create client. Please try again.");
  }
  const created = await res.json();
  return created?.id ?? null;
}

