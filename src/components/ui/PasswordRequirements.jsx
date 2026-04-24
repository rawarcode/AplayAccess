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

// 5-segment strength bar above the checklist. Bands:
//   0-2 rules met → Weak (rose)
//   3-4           → Medium (amber)
//   5             → Strong (emerald)
// Hidden until the user starts typing so the empty field doesn't
// scream red before they've done anything.
function StrengthBar({ value }) {
  const metCount = RULES.filter(r => r.test(value)).length;
  if (!value) return null;
  const band = metCount >= 5 ? 'strong' : metCount >= 3 ? 'medium' : 'weak';
  const label = { weak: 'Weak', medium: 'Medium', strong: 'Strong' }[band];
  const segmentColor = { weak: 'bg-rose-500', medium: 'bg-amber-500', strong: 'bg-emerald-500' }[band];
  const labelColor   = { weak: 'text-rose-600', medium: 'text-amber-600', strong: 'text-emerald-600' }[band];
  return (
    <div className="mt-2" aria-label={`Password strength: ${label}`}>
      <div className="flex items-center gap-2">
        <div className="flex-1 flex gap-1" role="progressbar" aria-valuenow={metCount} aria-valuemin={0} aria-valuemax={RULES.length}>
          {RULES.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i < metCount ? segmentColor : 'bg-slate-200'
              }`}
            />
          ))}
        </div>
        <span className={`text-[11px] font-semibold tabular-nums ${labelColor}`}>
          {label}
        </span>
      </div>
    </div>
  );
}

export default function PasswordRequirements({ value, className = '' }) {
  return (
    <div className={className}>
      <StrengthBar value={value} />
      <ul
        className="mt-2 space-y-1 text-xs"
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
    </div>
  );
}
