import {
  hideFormError,
  showFormError,
  showFormSuccess,
  submitInquiry,
  validateEmail,
} from "../forms";
import "../styles/pages/security.css";

export function initSecurity(): void {
  const form = document.getElementById("security-form") as HTMLFormElement | null;
  const successEl = document.getElementById("security-success");
  const errorEl = document.getElementById("security-error");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const fullName = String(fd.get("full_name") || "").trim();
    const email = String(fd.get("email") || "").trim();
    const phone = String(fd.get("phone") || "").trim();
    const requirements = String(fd.get("requirements") || "").trim();
    let ok = true;
    form.querySelectorAll(".cc-field").forEach((x) => x.classList.remove("cc-field--error"));
    hideFormError(errorEl);
    successEl?.classList.remove("is-visible");
    if (!fullName) ok = false;
    if (!validateEmail(email)) ok = false;
    if (phone.length < 8) ok = false;
    if (!requirements) ok = false;
    if (!ok) {
      if (!fullName) form.querySelector('[name="full_name"]')?.closest(".cc-field")?.classList.add("cc-field--error");
      if (!validateEmail(email)) form.querySelector('[name="email"]')?.closest(".cc-field")?.classList.add("cc-field--error");
      if (phone.length < 8) form.querySelector('[name="phone"]')?.closest(".cc-field")?.classList.add("cc-field--error");
      if (!requirements) form.querySelector('[name="requirements"]')?.closest(".cc-field")?.classList.add("cc-field--error");
      return;
    }
    const btn = form.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement | null;
    btn && (btn.disabled = true);
    void (async () => {
      const result = await submitInquiry(
        { name: fullName, fullName, email, phone, requirements },
        "security_consult",
      );
      btn && (btn.disabled = false);
      if (!result.ok) {
        showFormError(errorEl, result.error ?? "Something went wrong.");
        return;
      }
      showFormSuccess(successEl);
      form.reset();
    })();
  });

  document.getElementById("security-deploy")?.addEventListener("click", () => {
    document.getElementById("security-form")?.scrollIntoView({ behavior: "smooth" });
  });
}
