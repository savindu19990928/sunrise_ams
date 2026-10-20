import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { UpdaterState } from '../types/updater';

interface UpdateContextValue {
  state: UpdaterState;
  checking: boolean;
  downloading: boolean;
  autoCheckEnabled: boolean;
  setAutoCheckEnabled: (enabled: boolean) => void;
  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
}

const defaultState: UpdaterState = {
  status: 'idle',
  currentVersion: '0.0.1',
  updateInfo: null,
  progress: null,
  error: null,
  isDev: false,
};

const UpdateContext = createContext<UpdateContextValue | null>(null);

const AUTO_CHECK_KEY = 'sunrise_ams_auto_update_check';

export function UpdateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<UpdaterState>(defaultState);
  const [checking, setChecking] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [autoCheckEnabled, setAutoCheckEnabledState] = useState<boolean>(() => {
    const saved = localStorage.getItem(AUTO_CHECK_KEY);
    return saved !== null ? saved === 'true' : true;
  });

  const lastNotifiedVersionRef = useRef<string | null>(null);

  const setAutoCheckEnabled = (enabled: boolean) => {
    setAutoCheckEnabledState(enabled);
    localStorage.setItem(AUTO_CHECK_KEY, String(enabled));
  };

  // Sync initial status and listen for updates
  useEffect(() => {
    if (!window.electronAPI) {
      return;
    }

    // Get current version and initial status
    window.electronAPI.getUpdateStatus().then((initialStatus) => {
      if (initialStatus) {
        setState(initialStatus);
      }
    }).catch(() => {});

    // Listen to updater status changes
    const cleanup = window.electronAPI.onUpdateStatus((updatedState) => {
      setState(updatedState);
      setChecking(updatedState.status === 'checking');
      setDownloading(updatedState.status === 'downloading');

      // Toast notification when update is available
      if (updatedState.status === 'available' && updatedState.updateInfo) {
        const version = updatedState.updateInfo.version;
        if (lastNotifiedVersionRef.current !== version) {
          lastNotifiedVersionRef.current = version;
          toast.info(`Update Available: v${version}`, {
            description: `A newer version of Sunrise AMS is available. You can update from Settings.`,
            duration: 8000,
            action: {
              label: 'Open Settings',
              onClick: () => {
                window.location.hash = '#/settings';
              },
            },
          });
        }
      }

      // Toast notification when update is downloaded and ready to install
      if (updatedState.status === 'downloaded' && updatedState.updateInfo) {
        toast.success(`Update Ready to Install!`, {
          description: `Version v${updatedState.updateInfo.version} has been downloaded. Restart the application to finish installing.`,
          duration: 10000,
          action: {
            label: 'Restart Now',
            onClick: () => {
              window.electronAPI?.installUpdate();
            },
          },
        });
      }

      // Toast notification when an error occurs during an update attempt
      if (updatedState.status === 'error' && updatedState.error) {
        // Only toast if not idle
        console.warn('[UpdateContext] Update error:', updatedState.error);
      }
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  const checkForUpdates = useCallback(async () => {
    if (!window.electronAPI) {
      toast.error('Desktop integration not found', {
        description: 'Auto-updater is only available within the desktop application.',
      });
      return;
    }

    setChecking(true);
    try {
      const res = await window.electronAPI.checkForUpdates();
      if (!res.success && res.error) {
        toast.error('Check failed', {
          description: res.error,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error('Failed to check for updates', { description: msg });
    } finally {
      setChecking(false);
    }
  }, []);

  const downloadUpdate = useCallback(async () => {
    if (!window.electronAPI) return;
    setDownloading(true);
    try {
      const res = await window.electronAPI.downloadUpdate();
      if (!res.success) {
        if (res.message) {
          toast.info('Notice', { description: res.message });
        } else if (res.error) {
          toast.error('Download failed', { description: res.error });
        }
        setDownloading(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Download error';
      toast.error('Failed to download update', { description: msg });
      setDownloading(false);
    }
  }, []);

  const installUpdate = useCallback(async () => {
    if (!window.electronAPI) return;
    try {
      await window.electronAPI.installUpdate();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Install error';
      toast.error('Failed to restart and install', { description: msg });
    }
  }, []);

  return (
    <UpdateContext.Provider
      value={{
        state,
        checking,
        downloading,
        autoCheckEnabled,
        setAutoCheckEnabled,
        checkForUpdates,
        downloadUpdate,
        installUpdate,
      }}
    >
      {children}
    </UpdateContext.Provider>
  );
}

export function useUpdater(): UpdateContextValue {
  const context = useContext(UpdateContext);
  if (!context) {
    throw new Error('useUpdater must be used within an UpdateProvider');
  }
  return context;
}
