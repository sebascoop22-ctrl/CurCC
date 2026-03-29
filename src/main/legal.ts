import { initChrome } from "../chrome";

const path = window.location.pathname;
const page = path.endsWith("privacy.html") ? "privacy" : "terms";
initChrome(page);
