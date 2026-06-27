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
  initProject as apiInitProject,
  buildProject as apiBuildProject,
  isProjectApiAvailable,
  saveProject as apiSaveProject,
} from "../api/projectClient";
import type { EveBuildResult } from "../server/eveBuild";
import { parseAgent } from "../parser/eveAdapter";
import { loadRawProject, type RawProject } from "../parser/loadProject";
import {
  rebuildAgentTs,
  validateProject,
  type ValidationIssue,
} from "../serializer/eveSerializer";

interface ProjectStoreValue {
  project: RawProject | null;
  model: AgentModel | null;
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
}

const ProjectStoreContext = createContext<ProjectStoreValue | null>(null);

export function ProjectStoreProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<RawProject | null>(() => loadRawProject());
  const [apiAvailable, setApiAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [draft, setDraftState] = useState<RawProject | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [draftModel, setDraftModel] = useState<AgentModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const model = useMemo(
    () => (project ? parseAgent(project) : null),
    [project]
  );

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
      } else {
        setProject(loadRawProject());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load project");
      setProject(loadRawProject());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshProject();
  }, [refreshProject]);

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

  const value: ProjectStoreValue = {
    project,
    model,
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
