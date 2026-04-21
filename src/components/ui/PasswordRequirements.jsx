// src/components/ui/PasswordRequirements.jsx
//
// Live checklist that updates as the user types a password. Rendered
// under every password-setting input (signup, reset, self-change,
// owner-side staff create/reset).
//
// Exports:
//   <PasswordRequirements value={password} />  — the visual checklist
//   checkPasswordStrength(value)               — boolean; ALL rules met
//
// The rule set matches the backend's Laravel Password::defaults()
// policy exactly so a password that passes the UI also passes the
// server — no "looks fine, got rejected" surprises.
//
// Rules enforced:
//   • at least 8 characters
//   • contains an uppercase letter
//   • contains a lowercase letter
//   • contains a number
//   • contains a special character
//
// All five must be true for the submit button to enable. Keep in
// lockstep with app/Http/Controllers where `Password::defaults()` is
// applied (AuthController::register, ::resetPassword,
// ProfileController::changePassword, Admin\UserController).

const RULES = [
  { key: 'length',   label: 'At least 8 characters',        test: v => (v?.length ?? 0) >= 8 },
  { key: 'upper',    label: 'An uppercase letter (A–Z)',    test: v => /[A-Z]/.test(v ?? '') },
  { key: 'lower',    label: 'A lowercase letter (a–z)',     test: v => /[a-z]/.test(v ?? '') },
  { key: 'number',   label: 'A number (0–9)',               test: v => /\d/.test(v ?? '')    },
  { key: 'special',  label: 'A special character (!@#$…)',  test: v => /[^A-Za-z0-9]/.test(v ?? '') },
];

// Return true only when every rule passes — used by the caller to
// gate the submit button.
export function checkPasswordStrength(value) {
  return RULES.every(r => r.test(value));
}

export default function PasswordRequirements({ value, className = '' }) {
  return (
    <ul
      className={`mt-2 space-y-1 text-xs ${className}`}
      aria-label="Password requirements"
    >
      {RULES.map(r => {
        const met = r.test(value);
        return (
          <li
            key={r.key}
            className={`flex items-center gap-2 transition-colors ${
              met ? 'text-emerald-600' : 'text-slate-500'
            }`}
          >
            <span
              className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] shrink-0 ${
                met ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
              }`}
              aria-hidden="true"
            >
              {met ? <i className="fas fa-check" /> : <i className="fas fa-circle text-[5px]" />}
            </span>
            <span>{r.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
