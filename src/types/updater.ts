export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string | null;
  releaseName?: string;
  htmlUrl?: string;
}

export interface UpdateProgress {
  bytesPerSecond: number;
  percent: number;
  transferred: number;
  total: number;
}

export interface UpdaterState {
  status: UpdateStatus;
  currentVersion: string;
  updateInfo: UpdateInfo | null;
  progress: UpdateProgress | null;
  error: string | null;
  isDev: boolean;
}
