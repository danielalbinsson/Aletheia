import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AgentModel } from "../model";
import {
  fetchProject,
  fetchManifest,
  initProject as apiInitProject,
  buildProject as apiBuildProject,
  isProjectApiAvailable,
  saveProject as apiSaveProject,
  fetchWorkspaces,
  scanWorkspaces as apiScanWorkspaces,
  pickWorkspaceFolder as apiPickWorkspaceFolder,
  setActiveWorkspace as apiSetActiveWorkspace,
  type WorkspacesResponse,
} from "../api/projectClient";
import type { EveBuildResult } from "../server/eveBuild";
import { parseAgent } from "../parser/eveAdapter";
import { applyManifest, type ManifestFacts } from "../parser/manifestAdapter";
import { loadRawProject, type RawProject } from "../parser/loadProject";
import {
  rebuildAgentTs,
  validateProject,
  type ValidationIssue,
} from "../serializer/eveSerializer";

interface ProjectStoreValue {
  project: RawProject | null;
  model: AgentModel | null;
  /** True when `model`'s trust facts come from a built agent's eve manifest. */
  verified: boolean;
  apiAvailable: boolean;
  loading: boolean;
  draft: RawProject | null;
  dirty: boolean;
  draftModel: AgentModel | null;
  validationIssues: ValidationIssue[];
  error: string | null;
  statusMessage: string | null;
  loadDraft: () => void;
  setDraftFile: (path: string, content: string) => void;
  setDraft: (raw: RawProject) => void;
  discardDraft: () => void;
  saveDraft: () => Promise<void>;
  initProjectOnDisk: (raw: RawProject) => Promise<void>;
  buildProject: () => Promise<EveBuildResult>;
  clearStatus: () => void;
  refreshProject: () => Promise<void>;
  /** Discovered agents + which is being inspected (null until loaded). */
  workspaces: WorkspacesResponse | null;
  /** True when inspecting an agent other than the working/boot project. */
  inspectingOther: boolean;
  scanWorkspaceRoot: (root: string) => Promise<void>;
  /** Open the native OS folder picker and scan the chosen folder. */
  pickWorkspaceFolder: () => Promise<void>;
  selectWorkspace: (path: string) => Promise<void>;
}

const ProjectStoreContext = createContext<ProjectStoreValue | null>(null);

export function ProjectStoreProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<RawProject | null>(() => loadRawProject());
  const [manifestFacts, setManifestFacts] = useState<ManifestFacts | null>(null);
  const [apiAvailable, setApiAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [draft, setDraftState] = useState<RawProject | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [draftModel, setDraftModel] = useState<AgentModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspacesResponse | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The source-parsed model is the narrative base (intro, motif, theme). When a
  // built agent's manifest is available, overlay its verified trust facts.
  const model = useMemo(() => {
    if (!project) return null;
    const base = parseAgent(project);
    return manifestFacts ? applyManifest(base, manifestFacts) : base;
  }, [project, manifestFacts]);

  const verified = manifestFacts !== null;

  const dirty = useMemo(() => {
    if (!draft) return false;
    return JSON.stringify(draft) !== savedSnapshot;
  }, [draft, savedSnapshot]);

  const validationIssues = useMemo(
    () => (draft ? validateProject(draft) : []),
    [draft]
  );

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
        // Best-effort: a missing/unbuilt manifest just leaves the source model.
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

  useEffect(() => {
    if (!draft) {
      setDraftModel(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      try {
        setDraftModel(parseAgent(draft));
      } catch {
        setDraftModel(null);
      }
    }, 150);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [draft]);

  const loadDraft = useCallback(() => {
    if (!project) return;
    const rebuilt = rebuildAgentTs(project);
    setDraftState(rebuilt);
    setSavedSnapshot(JSON.stringify(rebuilt));
    setError(null);
  }, [project]);

  const setDraft = useCallback((raw: RawProject) => {
    const rebuilt = rebuildAgentTs(raw);
    setDraftState(rebuilt);
    setSavedSnapshot(JSON.stringify(rebuilt));
  }, []);

  const setDraftFile = useCallback((path: string, content: string) => {
    setDraftState((prev) => {
      if (!prev) return prev;
      const files = { ...prev.files, [path]: content };
      const next: RawProject = { id: prev.id, files };
      if (path !== "agent.ts") {
        return rebuildAgentTs(next);
      }
      return rebuildAgentTs(next);
    });
  }, []);

  const discardDraft = useCallback(() => {
    if (!draft || !savedSnapshot) {
      setDraftState(null);
      return;
    }
    setDraftState(JSON.parse(savedSnapshot) as RawProject);
    setError(null);
  }, [draft, savedSnapshot]);

  const saveDraft = useCallback(async () => {
    if (!draft) return;
    if (!apiAvailable) {
      setError("Saving requires dev server (pnpm dev)");
      return;
    }
    const issues = validateProject(draft);
    if (issues.length) {
      setError(issues.map((i) => `${i.path}: ${i.message}`).join("; "));
      return;
    }
    setError(null);
    try {
      const saved = await apiSaveProject(rebuildAgentTs(draft));
      const rebuilt = rebuildAgentTs(saved);
      setProject(rebuilt);
      setDraftState(rebuilt);
      setSavedSnapshot(JSON.stringify(rebuilt));
      setStatusMessage("Saved to agent/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }, [draft, apiAvailable]);

  const initProjectOnDisk = useCallback(
    async (raw: RawProject) => {
      if (!apiAvailable) {
        setError("Initializing requires dev server (pnpm dev)");
        return;
      }
      setError(null);
      try {
        const created = await apiInitProject(rebuildAgentTs(raw));
        const rebuilt = rebuildAgentTs(created);
        setProject(rebuilt);
        setDraftState(rebuilt);
        setSavedSnapshot(JSON.stringify(rebuilt));
        setStatusMessage("Initialized agent/");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Init failed");
        throw err;
      }
    },
    [apiAvailable]
  );

  const buildProject = useCallback(async () => {
    if (!apiAvailable) {
      throw new Error("Build requires dev server (pnpm dev)");
    }
    setError(null);
    const result = await apiBuildProject();
    if (result.ok) {
      setStatusMessage("eve build succeeded");
    } else {
      setError(
        result.diagnostics
          .filter((d) => d.severity === "error")
          .map((d) => `${d.sourcePath ?? "project"}: ${d.message}`)
          .join("; ") || "eve build failed"
      );
    }
    return result;
  }, [apiAvailable]);

  const clearStatus = useCallback(() => setStatusMessage(null), []);

  const inspectingOther =
    workspaces !== null && workspaces.activePath !== workspaces.defaultPath;

  const value: ProjectStoreValue = {
    project,
    model,
    verified,
    apiAvailable,
    loading,
    draft,
    dirty,
    draftModel,
    validationIssues,
    error,
    statusMessage,
    loadDraft,
    setDraftFile,
    setDraft,
    discardDraft,
    saveDraft,
    initProjectOnDisk,
    buildProject,
    clearStatus,
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
