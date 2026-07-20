import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AgentModel } from "../model";
import {
  fetchProject,
  fetchManifest,
  isProjectApiAvailable,
  fetchWorkspaces,
  scanWorkspaces as apiScanWorkspaces,
  pickWorkspaceFolder as apiPickWorkspaceFolder,
  setActiveWorkspace as apiSetActiveWorkspace,
  type WorkspacesResponse,
} from "../api/projectClient";
import { parseAgent } from "../parser/eveAdapter";
import { applyManifest, type ManifestFacts } from "../parser/manifestAdapter";
import { loadRawProject, type RawProject } from "../parser/loadProject";

interface ProjectStoreValue {
  project: RawProject | null;
  model: AgentModel | null;
  /** True when `model`'s trust facts come from a built agent's eve manifest. */
  verified: boolean;
  apiAvailable: boolean;
  loading: boolean;
  error: string | null;
  refreshProject: () => Promise<void>;
  /** Discovered agents + which is being inspected (null until loaded). */
  workspaces: WorkspacesResponse | null;
  /** True when inspecting an agent other than the default/boot one. */
  inspectingOther: boolean;
  scanWorkspaceRoot: (root: string) => Promise<void>;
  pickWorkspaceFolder: () => Promise<void>;
  selectWorkspace: (path: string) => Promise<void>;
}

const ProjectStoreContext = createContext<ProjectStoreValue | null>(null);

export function ProjectStoreProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<RawProject | null>(() => loadRawProject());
  const [manifestFacts, setManifestFacts] = useState<ManifestFacts | null>(null);
  const [apiAvailable, setApiAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspacesResponse | null>(null);

  // The source-parsed model is the narrative base (intro, motif, theme). When a
  // built agent's manifest is available, overlay its verified trust facts.
  const model = useMemo(() => {
    if (!project) return null;
    const base = parseAgent(project);
    return manifestFacts ? applyManifest(base, manifestFacts) : base;
  }, [project, manifestFacts]);

  const verified = manifestFacts !== null;

  const refreshProject = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const available = await isProjectApiAvailable();
      setApiAvailable(available);
      if (available) {
        const fetched = await fetchProject();
        setProject(fetched ?? loadRawProject());
        // Overlay verified facts from the built agent's manifest, if any.
        try {
          const manifest = await fetchManifest();
          setManifestFacts(manifest.built && manifest.facts ? manifest.facts : null);
        } catch {
          setManifestFacts(null);
        }
      } else {
        setProject(loadRawProject());
        setManifestFacts(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load project");
      setProject(loadRawProject());
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWorkspaces = useCallback(async () => {
    try {
      setWorkspaces(await fetchWorkspaces());
    } catch {
      setWorkspaces(null);
    }
  }, []);

  const scanWorkspaceRoot = useCallback(async (root: string) => {
    setError(null);
    try {
      setWorkspaces(await apiScanWorkspaces(root));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    }
  }, []);

  const pickWorkspaceFolder = useCallback(async () => {
    setError(null);
    try {
      const result = await apiPickWorkspaceFolder();
      if ("canceled" in result) return;
      setWorkspaces(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Folder picker failed");
    }
  }, []);

  const selectWorkspace = useCallback(
    async (targetPath: string) => {
      setError(null);
      try {
        await apiSetActiveWorkspace(targetPath);
        await refreshProject();
        await loadWorkspaces();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not switch workspace");
      }
    },
    [refreshProject, loadWorkspaces]
  );

  useEffect(() => {
    void (async () => {
      await refreshProject();
      if (await isProjectApiAvailable()) await loadWorkspaces();
    })();
  }, [refreshProject, loadWorkspaces]);

  const inspectingOther =
    workspaces !== null && workspaces.activePath !== workspaces.defaultPath;

  const value: ProjectStoreValue = {
    project,
    model,
    verified,
    apiAvailable,
    loading,
    error,
    refreshProject,
    workspaces,
    inspectingOther,
    scanWorkspaceRoot,
    pickWorkspaceFolder,
    selectWorkspace,
  };

  return (
    <ProjectStoreContext.Provider value={value}>{children}</ProjectStoreContext.Provider>
  );
}

export function useProjectStore(): ProjectStoreValue {
  const ctx = useContext(ProjectStoreContext);
  if (!ctx) throw new Error("useProjectStore must be used within ProjectStoreProvider");
  return ctx;
}
