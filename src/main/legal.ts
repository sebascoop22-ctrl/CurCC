import { initChrome } from "../chrome";

const path = window.location.pathname.replace(/\/$/, "");
const leaf = path.split("/").pop() ?? "";
const page = leaf === "privacy" || leaf === "privacy.html" ? "privacy" : "terms";
initChrome(page);
