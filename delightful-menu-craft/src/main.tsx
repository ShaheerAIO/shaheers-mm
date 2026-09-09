import { createRoot } from "react-dom/client";
import App from "./App.tsx";
// AIO type stack, self-hosted (no runtime call to Google Fonts)
import "@fontsource/poppins/latin-400.css";
import "@fontsource/poppins/latin-500.css";
import "@fontsource/poppins/latin-600.css";
import "@fontsource/poppins/latin-700.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
