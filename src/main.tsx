import React from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { ProjectStoreProvider } from "./store/ProjectStore";
import { HomePage } from "./pages/HomePage";
import { PortraitPage } from "./pages/PortraitPage";
import { CapabilityReviewPage } from "./pages/CapabilityReviewPage";
import { ManifestoPage } from "./pages/ManifestoPage";
import { GalleryPage } from "./pages/GalleryPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import "./styles.css";

// Vite's BASE_URL is `/` locally and `/aletheia/` on the Vercel showcase build.
const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;

const router = createBrowserRouter(
  [
    { path: "/", element: <HomePage /> },
    { path: "/portrait", element: <PortraitPage /> },
    { path: "/review", element: <CapabilityReviewPage /> },
    { path: "/manifesto", element: <ManifestoPage /> },
    { path: "/gallery", element: <GalleryPage /> },
    { path: "/privacy", element: <PrivacyPage /> },
  ],
  basename ? { basename } : undefined
);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ProjectStoreProvider>
      <RouterProvider router={router} />
    </ProjectStoreProvider>
  </React.StrictMode>
);
