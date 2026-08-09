import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Lock, User, ShieldCheck, ArrowLeft, KeyRound } from "lucide-react";

/* ── Step 1: Username + Password ── */
function StepCredentials({
  onSuccess,
}: {
  onSuccess: (requiresPin: boolean) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onSuccess(data.requiresPin !== false);
      } else {
        setErrorMsg(data.error || "Invalid username or password");
      }
    } catch {
      setErrorMsg("Network error — please try again");
    } finally {
      setLoading(false);
    }
  };

  const isPending = loading;

  return (
    <>
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-200">
          <User size={26} className="text-white" />
        </div>
        <h1 className="text-2xl font-display font-bold text-purple-900 mb-1">Studio Console</h1>
        <p className="text-gray-400 text-sm">Sign in to the HAVESTORY Studio Console</p>
      </div>

      {errorMsg && (
        <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm text-center font-medium">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 ml-1 uppercase tracking-wide">Username</label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
            <input
              required
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-white/80 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 transition-all text-sm"
              placeholder="Enter username"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 ml-1 uppercase tracking-wide">Password</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
            <input
              required
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-white/80 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 transition-all text-sm"
              placeholder="••••••••••••"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full btn-gradient py-3.5 rounded-xl text-sm font-bold mt-2 flex items-center justify-center gap-2"
        >
          {isPending ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
              </svg>
              Verifying…
            </>
          ) : (
            "Continue →"
          )}
        </button>
      </form>
    </>
  );
}

/* ── Step 2: 4-digit PIN ── */
function StepPin({
  onSuccess,
  onBack,
}: {
  onSuccess: () => void;
  onBack: () => void;
}) {
  const [digits, setDigits] = useState<string[]>(["", "", "", ""]);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(false);
  const refs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    refs[0].current?.focus();
  }, []);

  const handleKey = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = [...digits];
      if (next[idx]) {
        next[idx] = "";
        setDigits(next);
      } else if (idx > 0) {
        next[idx - 1] = "";
        setDigits(next);
        refs[idx - 1].current?.focus();
      }
    }
  };

  const handleChange = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[idx] = digit;
    setDigits(next);
    setErrorMsg("");
    if (digit && idx < 3) {
      refs[idx + 1].current?.focus();
    }
    if (digit && idx === 3) {
      const pin = [...next].join("");
      if (pin.length === 4) verifyPin(pin);
    }
  };

  const verifyPin = async (pin: string) => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/admin/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onSuccess();
      } else {
        setDigits(["", "", "", ""]);
        refs[0].current?.focus();
        if (res.status === 429 || (data.error || "").includes("Too many")) {
          setLocked(true);
        }
        setErrorMsg(data.error || "Incorrect PIN");
      }
    } catch {
      setErrorMsg("Network error — please try again");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pin = digits.join("");
    if (pin.length === 4) verifyPin(pin);
  };

  return (
    <>
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-200">
          <ShieldCheck size={26} className="text-white" />
        </div>
        <h1 className="text-2xl font-display font-bold text-purple-900 mb-1">Security PIN</h1>
        <p className="text-gray-400 text-sm">Enter your 4-digit PIN to continue</p>
      </div>

      {errorMsg && (
        <div className={`mb-5 p-3.5 rounded-xl border text-sm text-center font-medium ${locked ? "bg-red-100 border-red-200 text-red-700" : "bg-red-50 border-red-100 text-red-600"}`}>
          {locked ? "🔒 " : ""}{errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* PIN boxes */}
        <div className="flex justify-center gap-4">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={refs[i]}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={d}
              disabled={loading || locked}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKey(i, e)}
              className={`
                w-14 h-16 text-center text-2xl font-bold rounded-2xl border-2 outline-none transition-all
                bg-white/90 caret-transparent
                ${d ? "border-purple-400 bg-purple-50 text-purple-800 shadow-md shadow-purple-100" : "border-gray-200 text-gray-800"}
                focus:border-pink-400 focus:ring-2 focus:ring-pink-200 focus:bg-pink-50
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            />
          ))}
        </div>

        {/* Dot progress indicator */}
        <div className="flex justify-center gap-2">
          {digits.map((d, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all ${d ? "bg-gradient-to-r from-pink-500 to-purple-600 scale-125" : "bg-gray-200"}`}
            />
          ))}
        </div>

        {!locked && (
          <button
            type="submit"
            disabled={digits.join("").length < 4 || loading}
            className="w-full btn-gradient py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                </svg>
                Verifying PIN…
              </>
            ) : (
              <><KeyRound size={15} /> Confirm PIN</>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={onBack}
          className="w-full text-sm text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1.5 transition-colors"
        >
          <ArrowLeft size={14} /> Back to login
        </button>
      </form>
    </>
  );
}

/* ── Main Login Page ── */
export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"credentials" | "pin">("credentials");

  const finishLogin = (destination = "/admin") => {
    queryClient.removeQueries({ queryKey: ["/api/admin/me"] });
    setLocation(destination);
  };

  const handleCredentialsSuccess = (requiresPin: boolean) => {
    if (requiresPin) setStep("pin");
    else finishLogin("/admin/orders");
  };

  return (
    <div className="havestory-admin-login min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 to-purple-600/20 -z-10" />
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-pink-400/10 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl -z-10" />

      <div className="glass-panel w-full max-w-md p-10 rounded-3xl shadow-2xl relative">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${step === "credentials" ? "text-purple-600" : "text-gray-300"}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === "credentials" ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white" : "bg-green-100 text-green-600"}`}>
              {step === "pin" ? "✓" : "1"}
            </div>
            Credentials
          </div>
          <div className={`w-8 h-px ${step === "pin" ? "bg-gradient-to-r from-pink-400 to-purple-400" : "bg-gray-200"}`} />
          <div className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${step === "pin" ? "text-purple-600" : "text-gray-300"}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === "pin" ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white" : "bg-gray-100 text-gray-400"}`}>
              2
            </div>
            Security PIN
          </div>
        </div>

        {step === "credentials" ? (
          <StepCredentials onSuccess={handleCredentialsSuccess} />
        ) : (
          <StepPin
            onSuccess={() => finishLogin("/admin")}
            onBack={() => setStep("credentials")}
          />
        )}
      </div>
    </div>
  );
}
