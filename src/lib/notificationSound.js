/**
 * Notification chime utility.
 *
 * Uses the Web Audio API to synthesize a short two-tone "dink" — no asset
 * file is required, which keeps the bundle smaller and sidesteps CDN /
 * cache-busting concerns for a 20-kilobyte mp3.
 *
 * Browsers block audio playback until the user has interacted with the
 * page (clicking, typing, tapping). The very first call after page load
 * may therefore silently fail; every call thereafter works. That's fine
 * for our use-case — by the time a new message lands, the user has
 * almost certainly clicked something.
 *
 * Mute state persists in localStorage under MUTE_KEY. Emits a custom
 * window event so multiple mounted components (Messages page + shell
 * bell) stay in sync without a context provider.
 */

const MUTE_KEY      = 'aplaya_message_sound_muted_v1';
const MUTE_EVENT    = 'aplaya:message-sound-mute-changed';

/** @type {AudioContext | null} */
let ctx = null;

// Lazy-init so we don't spin up an AudioContext for users who never
// receive a notification in their session.
function getContext() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  } catch {
    return null;
  }
}

/**
 * Plays a soft two-tone chime: a short note at 880 Hz followed by
 * another at 1320 Hz. Total duration ~280ms. Envelope is a quick
 * attack + exponential decay so it feels like a "dink" rather than
 * a beep.
 *
 * No-op if:
 *   - Web Audio API is unavailable (ancient browser)
 *   - The user has muted the chime via setMessageSoundMuted(true)
 *   - The browser's autoplay policy blocks the context from starting
 *     (returns without error; next interaction will unlock it)
 */
export function playMessageChime() {
  if (isMessageSoundMuted()) return;

  const audio = getContext();
  if (!audio) return;

  // Chrome / Safari may suspend the context until a user gesture.
  // resume() is a promise but we don't await it — if it fails, the
  // tones just don't audibly play and we return silently.
  if (audio.state === 'suspended') {
    audio.resume().catch(() => {});
  }

  const now = audio.currentTime;
  playTone(audio, 880,  now,         0.12);  // first note
  playTone(audio, 1320, now + 0.09,  0.18);  // slightly-later second note
}

function playTone(audio, freq, startAt, duration) {
  const osc  = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, startAt);

  // Soft envelope: attack 15ms, decay over the tone's lifetime.
  // 0.18 peak gain = gentle, not startling. Users on call / in
  // quiet environments shouldn't jump.
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.18, startAt + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  osc.connect(gain).connect(audio.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

/** Read current mute state from localStorage. Defaults to false. */
export function isMessageSoundMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Toggle or set mute. Persists to localStorage and dispatches a
 * window event so other mounted components re-render their toggle
 * UI in lockstep.
 */
export function setMessageSoundMuted(muted) {
  try {
    if (muted) localStorage.setItem(MUTE_KEY, '1');
    else       localStorage.removeItem(MUTE_KEY);
  } catch {}
  window.dispatchEvent(new CustomEvent(MUTE_EVENT, { detail: { muted: !!muted } }));
}

/**
 * Subscribe to mute-state changes. Returns an unsubscribe function.
 * Components use this inside useEffect so their toggle button icon
 * stays synchronized if the preference is flipped in another part
 * of the UI.
 */
export function onMessageSoundMuteChange(callback) {
  const handler = () => callback(isMessageSoundMuted());
  window.addEventListener(MUTE_EVENT, handler);
  // Cross-tab sync: storage event fires in other tabs when MUTE_KEY
  // changes. Hook it so muting in tab A reflects in tab B without a
  // refresh.
  const storageHandler = (e) => {
    if (e.key === MUTE_KEY) callback(isMessageSoundMuted());
  };
  window.addEventListener('storage', storageHandler);
  return () => {
    window.removeEventListener(MUTE_EVENT, handler);
    window.removeEventListener('storage', storageHandler);
  };
}
