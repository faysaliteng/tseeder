/**
 * Virtual folder system — persisted in localStorage.
 * Folders are client-side groupings; jobs can be assigned to a folder.
 */
import { useState, useCallback, useEffect } from "react";

const FOLDERS_KEY = "virtual_folders";
const JOB_FOLDER_MAP_KEY = "job_folder_map";

export interface VirtualFolder {
  id: string;
  name: string;
  parentId: string | null; // null = root
  createdAt: string;
}

function generateId() {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 10);
}

function loadFolders(): VirtualFolder[] {
  try {
    return JSON.parse(localStorage.getItem(FOLDERS_KEY) ?? "[]");
  } catch { return []; }
}

function saveFolders(folders: VirtualFolder[]) {
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
}

function loadJobFolderMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(JOB_FOLDER_MAP_KEY) ?? "{}");
  } catch { return {}; }
}

function saveJobFolderMap(map: Record<string, string>) {
  localStorage.setItem(JOB_FOLDER_MAP_KEY, JSON.stringify(map));
}

export function useVirtualFolders() {
  const [folders, setFolders] = useState<VirtualFolder[]>(loadFolders);
  const [jobFolderMap, setJobFolderMap] = useState<Record<string, string>>(loadJobFolderMap);

  useEffect(() => { saveFolders(folders); }, [folders]);
  useEffect(() => { saveJobFolderMap(jobFolderMap); }, [jobFolderMap]);

  const createFolder = useCallback((name: string, parentId: string | null = null): VirtualFolder => {
    const folder: VirtualFolder = {
      id: generateId(),
      name: name.trim(),
      parentId,
      createdAt: new Date().toISOString(),
    };
    setFolders(prev => [...prev, folder]);
    return folder;
  }, []);

  const renameFolder = useCallback((id: string, newName: string) => {
    setFolders(prev => prev.map(f => f.id === id ? { ...f, name: newName.trim() } : f));
  }, []);

  const deleteFolder = useCallback((id: string) => {
    // Remove folder and unassign any jobs in it
    setFolders(prev => prev.filter(f => f.id !== id));
    setJobFolderMap(prev => {
      const next = { ...prev };
      for (const [jobId, folderId] of Object.entries(next)) {
        if (folderId === id) delete next[jobId];
      }
      return next;
    });
  }, []);

  const moveJobToFolder = useCallback((jobId: string, folderId: string | null) => {
    setJobFolderMap(prev => {
      const next = { ...prev };
      if (folderId) next[jobId] = folderId;
      else delete next[jobId];
      return next;
    });
  }, []);

  const getFoldersInParent = useCallback((parentId: string | null) => {
    return folders.filter(f => f.parentId === parentId);
  }, [folders]);

  const getJobFolder = useCallback((jobId: string): string | null => {
    return jobFolderMap[jobId] ?? null;
  }, [jobFolderMap]);

  return {
    folders,
    jobFolderMap,
    createFolder,
    renameFolder,
    deleteFolder,
    moveJobToFolder,
    getFoldersInParent,
    getJobFolder,
  };
}
