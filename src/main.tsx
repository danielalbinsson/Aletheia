import React from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { ProjectStoreProvider } from "./store/ProjectStore";
import { PortraitPage } from "./pages/PortraitPage";
import { CapabilityReviewPage } from "./pages/CapabilityReviewPage";
import "./styles.css";

const router = createBrowserRouter([
  { path: "/", element: <PortraitPage /> },
  { path: "/review", element: <CapabilityReviewPage /> },
]);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ProjectStoreProvider>
      <RouterProvider router={router} />
    </ProjectStoreProvider>
  </React.StrictMode>
);
