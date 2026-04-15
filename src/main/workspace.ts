import { initChrome } from "../chrome";
import { initWorkspacePage } from "../pages/workspace";
import "../styles/pages/admin.css";

initChrome("admin");
void initWorkspacePage();
