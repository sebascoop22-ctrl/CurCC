import { getSupabaseClient } from "../lib/supabase";
import { resolveSignedInRole, type AppRole } from "../lib/session-role";
import { notifyPromoterRequestSubmitted } from "../lib/promoter-request-edge";

function escapeHtml(v: string): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function roleDestination(role: AppRole): string {
  if (role === "promoter") return "/portal";
  return "/portal";
}

export async function initAccountPage(): Promise<void> {
  const root = document.getElementById("account-root");
  if (!root) return;
  const supabase = getSupabaseClient();
  if (!supabase) {
    root.innerHTML = `<div class="admin-card"><p class="admin-flash admin-flash--error">Supabase is not configured.</p></div>`;
    return;
  }

  function getInitialMode(): "signin" | "signup" {
    const raw = new URLSearchParams(window.location.search).get("mode") || "";
    return raw.toLowerCase() === "signup" ? "signup" : "signin";
  }

  async function resolveRole(): Promise<AppRole | null> {
    const state = await resolveSignedInRole(supabase);
    return state.role;
  }

  async function render(): Promise<void> {
    const role = await resolveRole();
    if (role) {
      root.innerHTML = `
        <div class="admin-card">
          <h3>Signed in</h3>
          <p class="admin-note">Role: <strong>${escapeHtml(role)}</strong></p>
          <div class="admin-actions">
            <a class="cc-btn cc-btn--gold" href="${escapeHtml(roleDestination(role))}">Continue to portal</a>
            <button type="button" class="cc-btn cc-btn--ghost" id="account-signout">Sign out</button>
          </div>
        </div>
      `;
      root.querySelector("#account-signout")?.addEventListener("click", () => {
        void supabase.auth.signOut().then(() => render());
      });
      return;
    }

    root.innerHTML = `
      <div class="admin-card admin-login-card">
        <div class="admin-actions" style="margin-bottom:0.75rem">
          <button type="button" class="cc-btn cc-btn--ghost" id="account-mode-signin">Sign in</button>
          <button type="button" class="cc-btn cc-btn--ghost" id="account-mode-signup">Promoter sign up</button>
        </div>
        <form class="admin-login-form" id="account-login-form">
          <div class="cc-field">
            <label for="account-email">Email</label>
            <input id="account-email" name="email" type="email" autocomplete="username" required />
          </div>
          <div class="cc-field">
            <label for="account-password">Password</label>
            <input id="account-password" name="password" type="password" autocomplete="current-password" required />
          </div>
          <button class="cc-btn cc-btn--gold" type="submit">Sign in</button>
        </form>
        <form class="admin-login-form" id="account-signup-form" hidden>
          <div class="cc-field">
            <label for="account-signup-name">Full name</label>
            <input id="account-signup-name" name="fullName" type="text" autocomplete="name" required />
          </div>
          <div class="cc-field">
            <label for="account-signup-email">Email</label>
            <input id="account-signup-email" name="email" type="email" autocomplete="email" required />
          </div>
          <button class="cc-btn cc-btn--gold" type="submit">Submit promoter signup request</button>
        </form>
        <p class="admin-flash admin-flash--error" id="account-error" hidden></p>
        <p class="admin-note" id="account-signup-note" hidden>
          Requests are reviewed by our team. If approved, you will receive access details by email.
        </p>
      </div>
    `;
    const signInForm = root.querySelector("#account-login-form") as HTMLFormElement | null;
    const signUpForm = root.querySelector("#account-signup-form") as HTMLFormElement | null;
    const errEl = root.querySelector("#account-error") as HTMLElement | null;
    const signUpNote = root.querySelector("#account-signup-note") as HTMLElement | null;
    const signInBtn = root.querySelector("#account-mode-signin") as HTMLButtonElement | null;
    const signUpBtn = root.querySelector("#account-mode-signup") as HTMLButtonElement | null;

    function showError(message: string): void {
      if (!errEl) return;
      errEl.textContent = message;
      errEl.hidden = false;
      errEl.style.color = "";
    }

    function showSuccess(message: string): void {
      if (!errEl) return;
      errEl.textContent = message;
      errEl.hidden = false;
      errEl.style.color = "var(--cc-ok)";
    }

    function clearMessage(): void {
      if (!errEl) return;
      errEl.hidden = true;
      errEl.textContent = "";
      errEl.style.color = "";
    }

    function setMode(mode: "signin" | "signup"): void {
      const isSignUp = mode === "signup";
      if (signInForm) signInForm.hidden = isSignUp;
      if (signUpForm) signUpForm.hidden = !isSignUp;
      if (signUpNote) signUpNote.hidden = !isSignUp;
      if (signInBtn) signInBtn.disabled = !isSignUp;
      if (signUpBtn) signUpBtn.disabled = isSignUp;
      const next = new URL(window.location.href);
      if (isSignUp) next.searchParams.set("mode", "signup");
      else next.searchParams.delete("mode");
      window.history.replaceState({}, "", `${next.pathname}${next.search}${next.hash}`);
      clearMessage();
    }

    setMode(getInitialMode());
    signInBtn?.addEventListener("click", () => setMode("signin"));
    signUpBtn?.addEventListener("click", () => setMode("signup"));

    signInForm?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const form = ev.target as HTMLFormElement;
      const fd = new FormData(form);
      const email = String(fd.get("email") || "")
        .trim()
        .toLowerCase();
      const password = String(fd.get("password") || "");
      clearMessage();
      void (async () => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          showError(error.message);
          return;
        }
        const role = await resolveRole();
        if (!role) {
          showError("Your account has no assigned portal role.");
          return;
        }
        window.location.href = roleDestination(role);
      })();
    });

    signUpForm?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const form = ev.target as HTMLFormElement;
      const fd = new FormData(form);
      const fullName = String(fd.get("fullName") || "").trim();
      const email = String(fd.get("email") || "")
        .trim()
        .toLowerCase();
      clearMessage();
      void (async () => {
        if (!fullName || !email) {
          showError("Please enter your name and email.");
          return;
        }
        const id = crypto.randomUUID();
        const { error } = await supabase.from("promoter_signup_requests").insert({
          id,
          full_name: fullName,
          email,
          status: "pending",
        });
        if (error) {
          showError(error.message);
          return;
        }
        const key =
          (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
          (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
          "";
        let emailed = false;
        if (key) {
          const n = await notifyPromoterRequestSubmitted(key, id);
          emailed = n.ok;
        }
        showSuccess(
          emailed
            ? "Request received. Check your email for confirmation."
            : "Request received and queued for review. Confirmation email could not be sent right now.",
        );
        form.reset();
      })();
    });
  }

  supabase.auth.onAuthStateChange((_event, _session) => {
    void render();
  });
  await render();
}
