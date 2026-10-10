export interface ElectronAPI {
  platform: string;
  getVersion: () => Promise<string>;
  isPackaged: () => Promise<boolean>;
  isMaximized: () => Promise<boolean>;
  minimize: () => void;
  maximize: () => void;
  close: () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
