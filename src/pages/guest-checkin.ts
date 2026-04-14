import { checkInSignup } from "../admin/guest-intel";
import { getSupabaseClient } from "../lib/supabase";

function esc(v: string): string {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

export async function initGuestCheckinPage(): Promise<void> {
  const root = document.getElementById("guest-checkin-root");
  if (!root) return;
  const supabase = getSupabaseClient();
  const signupId = new URLSearchParams(window.location.search).get("signup") ?? "";
  if (!supabase) {
    root.innerHTML = `<div class="admin-card"><p>Supabase is not configured.</p></div>`;
    return;
  }
  if (!signupId) {
    root.innerHTML = `<div class="admin-card"><p>Missing signup token.</p></div>`;
    return;
  }

  root.innerHTML = `
    <div class="admin-card">
      <form class="admin-form" id="guest-checkin-form">
        <div class="cc-field"><label>Age (optional)</label><input name="age" type="number" min="16" max="90" /></div>
        <div class="cc-field"><label>Gender (optional)</label><input name="gender" placeholder="female / male / non-binary / prefer not to say" /></div>
        <button class="cc-btn cc-btn--gold" type="submit">Check in</button>
      </form>
      <div class="admin-flash" id="guest-checkin-flash"></div>
    </div>
  `;

  const flash = (msg: string, bad = false) => {
    const el = root.querySelector("#guest-checkin-flash");
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle("admin-flash--error", bad);
  };

  root.querySelector("#guest-checkin-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const ageRaw = String(fd.get("age") || "").trim();
    const gender = String(fd.get("gender") || "").trim();
    const age = ageRaw ? Number(ageRaw) : null;
    void (async () => {
      const r = await checkInSignup(
        supabase,
        signupId,
        "self",
        age && Number.isFinite(age) ? age : null,
        gender || null,
      );
      if (!r.ok) {
        flash(`Check-in failed: ${esc(r.message)}`, true);
        return;
      }
      flash("Checked in successfully. Have a great night.");
    })();
  });
}
