import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./App.jsx";
import "./index.css";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ContentProvider } from "./context/ContentContext.jsx";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <HelmetProvider>
        <BrowserRouter>
          <AuthProvider>
            <ContentProvider>
              <App />
            </ContentProvider>
          </AuthProvider>
        </BrowserRouter>
      </HelmetProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>
);