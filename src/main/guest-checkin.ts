import { initChrome } from "../chrome";
import { initGuestCheckinPage } from "../pages/guest-checkin";
import "../styles/pages/admin.css";

initChrome("enquiry");
void initGuestCheckinPage();
