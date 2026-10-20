import { UpdaterState } from './updater';

export interface ElectronAPI {
  platform: string;
  getVersion: () => Promise<string>;
  isPackaged: () => Promise<boolean>;
  isMaximized: () => Promise<boolean>;
  minimize: () => void;
  maximize: () => void;
  close: () => void;

  checkForUpdates: () => Promise<{ success: boolean; available?: boolean; version?: string; error?: string }>;
  downloadUpdate: () => Promise<{ success: boolean; error?: string; message?: string }>;
  installUpdate: () => Promise<{ success: boolean; error?: string; message?: string }>;
  getUpdateStatus: () => Promise<UpdaterState>;
  onUpdateStatus: (callback: (state: UpdaterState) => void) => () => void;
  openExternal: (url: string) => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
