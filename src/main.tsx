import React from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { ProjectStoreProvider } from "./store/ProjectStore";
import { PortraitPage } from "./pages/PortraitPage";
import { CapabilityReviewPage } from "./pages/CapabilityReviewPage";
import { ManifestoPage } from "./pages/ManifestoPage";
import "./styles.css";

const router = createBrowserRouter([
  { path: "/", element: <PortraitPage /> },
  { path: "/review", element: <CapabilityReviewPage /> },
  { path: "/manifesto", element: <ManifestoPage /> },
]);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ProjectStoreProvider>
      <RouterProvider router={router} />
    </ProjectStoreProvider>
  </React.StrictMode>
);
