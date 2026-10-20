import React from 'react';
import {
  CheckCircle2Icon,
  DownloadCloudIcon,
  ExternalLinkIcon,
  InfoIcon,
  MonitorIcon,
  MoonIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SparklesIcon,
  SunIcon,
  TagIcon,
  XCircleIcon,
} from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { useUpdater } from '../contexts/UpdateContext';
import { useTheme } from '../contexts/ThemeContext';
import { Badge, BadgeTone } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';

export function Settings() {
  const {
    state,
    checking,
    downloading,
    autoCheckEnabled,
    setAutoCheckEnabled,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
  } = useUpdater();

  const { theme, systemIsDark, setTheme } = useTheme();

  const handleOpenGitHub = (e: React.MouseEvent) => {
    e.preventDefault();
    const url = 'https://github.com/savindu19990928/sunrise_ams/releases';
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const getStatusBadge = (): { tone: BadgeTone; label: string; icon: React.ReactNode } => {
    if (checking || state.status === 'checking') {
      return {
        tone: 'brand',
        label: 'Checking for updates…',
        icon: <RefreshCwIcon className="h-3 w-3 animate-spin" />,
      };
    }
    if (downloading || state.status === 'downloading') {
      return {
        tone: 'brand',
        label: `Downloading (${state.progress?.percent ?? 0}%)`,
        icon: <DownloadCloudIcon className="h-3 w-3 animate-bounce" />,
      };
    }
    if (state.status === 'downloaded') {
      return {
        tone: 'success',
        label: 'Ready to Install',
        icon: <SparklesIcon className="h-3 w-3 text-success-600" />,
      };
    }
    if (state.status === 'available') {
      return {
        tone: 'warn',
        label: `Update Available: v${state.updateInfo?.version ?? 'New'}`,
        icon: <DownloadCloudIcon className="h-3 w-3 text-warn-600" />,
      };
    }
    if (state.status === 'not-available') {
      return {
        tone: 'success',
        label: 'Up to Date',
        icon: <CheckCircle2Icon className="h-3 w-3 text-success-600" />,
      };
    }
    if (state.status === 'error') {
      return {
        tone: 'danger',
        label: 'Check Failed',
        icon: <XCircleIcon className="h-3 w-3 text-danger-600" />,
      };
    }
    return {
      tone: 'neutral',
      label: 'Idle',
      icon: <InfoIcon className="h-3 w-3 text-ink-muted" />,
    };
  };

  const statusBadge = getStatusBadge();

  // Format bytes helper
  const formatBytes = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="System Settings"
        description="Manage software updates, preferences, and system environment information."
      />

      {/* Software Updates Section */}
      <Card>
        <CardHeader
          title="Software Updates"
          description="Check for new releases from GitHub, download installers, and manage automatic update checks."
          actions={
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCwIcon}
              loading={checking || state.status === 'checking'}
              disabled={downloading || state.status === 'downloading'}
              onClick={checkForUpdates}
            >
              Check for Updates
            </Button>
          }
        />
        <CardBody className="space-y-6">
          {/* Version and Status Overview Banner */}
          <div className="flex flex-col gap-4 rounded-xl border border-line bg-canvas p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex items-start gap-3.5">
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                <TagIcon className="h-5 w-5" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-ink">
                    Sunrise AMS v{state.currentVersion}
                  </h3>
                  <Badge tone={statusBadge.tone} className="gap-1.5 py-1">
                    {statusBadge.icon}
                    {statusBadge.label}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-ink-muted">
                  {state.status === 'available'
                    ? `A new version (v${state.updateInfo?.version}) is available for download.`
                    : state.status === 'downloaded'
                      ? 'The update package has been downloaded. Restart the application to apply changes.'
                      : state.status === 'not-available'
                        ? 'You are running the latest version available from the GitHub release channel.'
                        : state.status === 'error'
                          ? state.error || 'Unable to check for updates. Please check your internet connection.'
                          : 'Checks for published updates from the official public GitHub repository.'}
                </p>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 sm:self-center">
              {state.status === 'available' && (
                <Button
                  variant="primary"
                  size="md"
                  icon={DownloadCloudIcon}
                  loading={downloading}
                  onClick={downloadUpdate}
                >
                  Download Update
                </Button>
              )}
              {state.status === 'downloaded' && (
                <Button
                  variant="primary"
                  size="md"
                  icon={RotateCcwIcon}
                  onClick={installUpdate}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  Restart & Install
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                icon={ExternalLinkIcon}
                onClick={handleOpenGitHub}
              >
                Releases on GitHub
              </Button>
            </div>
          </div>

          {/* Download Progress Bar */}
          {(downloading || state.status === 'downloading') && (
            <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-brand-900">
                  Downloading update… {state.progress?.percent ?? 0}%
                </span>
                <span className="text-xs text-brand-700">
                  {formatBytes(state.progress?.transferred ?? 0)} of{' '}
                  {formatBytes(state.progress?.total ?? 0)}
                  {state.progress?.bytesPerSecond
                    ? ` (${formatBytes(state.progress.bytesPerSecond)}/s)`
                    : ''}
                </span>
              </div>
              <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-brand-200">
                <div
                  className="h-full rounded-full bg-brand-600 transition-all duration-300 ease-out"
                  style={{ width: `${Math.min(100, Math.max(0, state.progress?.percent ?? 0))}%` }}
                />
              </div>
            </div>
          )}

          {/* Release Notes display if available */}
          {state.updateInfo && (state.status === 'available' || state.status === 'downloaded') && (
            <div className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <span className="text-sm font-semibold text-ink">
                  {state.updateInfo.releaseName || `Release v${state.updateInfo.version}`}
                </span>
                {state.updateInfo.releaseDate && (
                  <span className="text-xs text-ink-muted">
                    Published: {new Date(state.updateInfo.releaseDate).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  Release Notes
                </p>
                <div className="mt-1.5 max-h-48 overflow-y-auto whitespace-pre-line rounded-lg bg-canvas p-3 text-xs text-ink">
                  {state.updateInfo.releaseNotes || 'No release notes provided for this release.'}
                </div>
              </div>
            </div>
          )}

          {/* Update Settings Switches */}
          <div className="space-y-4 border-t border-line pt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
              Preferences
            </h4>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-ink">
                  Check for updates automatically on startup
                </p>
                <p className="text-xs text-ink-muted">
                  When enabled, Sunrise AMS will automatically check GitHub for newer versions when
                  the app launches and notify you if an update is found.
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={autoCheckEnabled}
                  onChange={(e) => setAutoCheckEnabled(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="h-6 w-11 rounded-full bg-line peer-checked:bg-brand-600 peer-focus:outline-none after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full" />
              </label>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Appearance & Theme Section */}
      <Card>
        <CardHeader
          title="Appearance & Theme"
          description="Personalize the visual appearance of the application. System Default follows your operating system mode, with light mode as the fallback option."
        />
        <CardBody className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* System Default Option */}
            <button
              type="button"
              onClick={() => setTheme('system')}
              className={twMerge(
                'group relative flex flex-col items-start rounded-xl border p-4 text-left transition-all duration-150',
                theme === 'system'
                  ? 'border-brand-600 bg-brand-50/50 ring-2 ring-brand-500/20'
                  : 'border-line bg-canvas hover:border-ink-soft/40 hover:bg-surface'
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span
                  className={twMerge(
                    'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
                    theme === 'system'
                      ? 'bg-brand-600 text-white'
                      : 'bg-surface text-ink-muted group-hover:text-ink'
                  )}
                >
                  <MonitorIcon className="h-4 w-4" />
                </span>
                {theme === 'system' && (
                  <Badge tone="brand" className="text-[10px] py-0.5">
                    Active
                  </Badge>
                )}
              </div>
              <div className="mt-3">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-semibold text-ink">System Default</h4>
                  <span className="rounded bg-line/60 px-1.5 py-0.5 text-[10px] font-medium text-ink-muted">
                    Auto
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-muted leading-relaxed">
                  Automatically syncs with your OS theme ({systemIsDark ? 'currently Dark' : 'currently Light'}).
                </p>
              </div>
            </button>

            {/* Light Mode Option */}
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={twMerge(
                'group relative flex flex-col items-start rounded-xl border p-4 text-left transition-all duration-150',
                theme === 'light'
                  ? 'border-brand-600 bg-brand-50/50 ring-2 ring-brand-500/20'
                  : 'border-line bg-canvas hover:border-ink-soft/40 hover:bg-surface'
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span
                  className={twMerge(
                    'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
                    theme === 'light'
                      ? 'bg-brand-600 text-white'
                      : 'bg-surface text-ink-muted group-hover:text-ink'
                  )}
                >
                  <SunIcon className="h-4 w-4 text-warn-500" />
                </span>
                {theme === 'light' && (
                  <Badge tone="brand" className="text-[10px] py-0.5">
                    Active
                  </Badge>
                )}
              </div>
              <div className="mt-3">
                <h4 className="text-sm font-semibold text-ink">Light Mode</h4>
                <p className="mt-1 text-xs text-ink-muted leading-relaxed">
                  Clean, bright interface designed for well-lit environments and daytime work.
                </p>
              </div>
            </button>

            {/* Dark Mode Option */}
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={twMerge(
                'group relative flex flex-col items-start rounded-xl border p-4 text-left transition-all duration-150',
                theme === 'dark'
                  ? 'border-brand-600 bg-brand-50/50 ring-2 ring-brand-500/20'
                  : 'border-line bg-canvas hover:border-ink-soft/40 hover:bg-surface'
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span
                  className={twMerge(
                    'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
                    theme === 'dark'
                      ? 'bg-brand-600 text-white'
                      : 'bg-surface text-ink-muted group-hover:text-ink'
                  )}
                >
                  <MoonIcon className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                </span>
                {theme === 'dark' && (
                  <Badge tone="brand" className="text-[10px] py-0.5">
                    Active
                  </Badge>
                )}
              </div>
              <div className="mt-3">
                <h4 className="text-sm font-semibold text-ink">Dark Mode</h4>
                <p className="mt-1 text-xs text-ink-muted leading-relaxed">
                  Deep slate surfaces and dimmed contrast to reduce eye strain in low light.
                </p>
              </div>
            </button>
          </div>

          {/* Info note about System Mode and fallback */}
          <div className="flex items-start gap-3 rounded-xl border border-line bg-canvas p-3.5 text-xs text-ink-muted">
            <InfoIcon className="mt-0.5 h-4 w-4 flex-none text-brand-600" />
            <div className="leading-relaxed">
              <span className="font-semibold text-ink">System theme detection & fallback: </span>
              When <strong className="text-ink">System Default</strong> is selected, Sunrise AMS automatically matches your OS theme (currently detected as <strong className="text-ink">{systemIsDark ? 'Dark mode' : 'Light mode'}</strong>). If your operating system appearance cannot be recognized, <strong className="text-ink">Light mode</strong> is used as the safe fallback option.
            </div>
          </div>
        </CardBody>
      </Card>

      {/* System Information */}
      <Card>
        <CardHeader
          title="System Information"
          description="Hardware, runtime platform, and application identifier."
        />
        <CardBody>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-lg border border-line bg-canvas p-3">
              <dt className="text-xs text-ink-muted">Application</dt>
              <dd className="mt-1 text-sm font-semibold text-ink">Sunrise AMS</dd>
            </div>
            <div className="rounded-lg border border-line bg-canvas p-3">
              <dt className="text-xs text-ink-muted">Version</dt>
              <dd className="mt-1 text-sm font-semibold text-ink">v{state.currentVersion}</dd>
            </div>
            <div className="rounded-lg border border-line bg-canvas p-3">
              <dt className="text-xs text-ink-muted">Author</dt>
              <dd className="mt-1 text-sm font-semibold text-ink">Devrious</dd>
            </div>
            <div className="rounded-lg border border-line bg-canvas p-3">
              <dt className="text-xs text-ink-muted">Target Platform</dt>
              <dd className="mt-1 text-sm font-semibold text-ink">Windows (x64 / x86)</dd>
            </div>
            <div className="rounded-lg border border-line bg-canvas p-3">
              <dt className="text-xs text-ink-muted">Package ID</dt>
              <dd className="mt-1 truncate text-sm font-semibold text-ink">com.sunrise.ams</dd>
            </div>
          </dl>
        </CardBody>
      </Card>
    </div>
  );
}
