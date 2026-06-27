import React from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { ProjectStoreProvider } from "./store/ProjectStore";
import { PortraitPage } from "./pages/PortraitPage";
import { InitProject } from "./components/editor/InitProject";
import { ProjectEditor } from "./components/editor/ProjectEditor";
import { RuntimePage } from "./components/editor/RuntimePage";
import { ObservabilityPage } from "./components/observability/ObservabilityPage";
import "./styles.css";

const router = createBrowserRouter([
  { path: "/", element: <PortraitPage /> },
  { path: "/init", element: <InitProject /> },
  { path: "/edit", element: <ProjectEditor /> },
  { path: "/run", element: <RuntimePage /> },
  { path: "/observe", element: <ObservabilityPage /> },
]);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ProjectStoreProvider>
      <RouterProvider router={router} />
    </ProjectStoreProvider>
  </React.StrictMode>
);
