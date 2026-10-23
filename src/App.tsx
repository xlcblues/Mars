import { useEffect, useState } from "react";
import { TitleBar } from "./components/TitleBar";
import { Sidebar } from "./components/Sidebar";
import { TodayView } from "./features/today/TodayView";
import { ProjectsView } from "./features/projects/ProjectsView";
import { EntriesView } from "./features/entries/EntriesView";
import { AnalyticsView } from "./features/analytics/AnalyticsView";
import { PlaceholderView } from "./features/PlaceholderView";
import { EntryModal } from "./components/EntryModal";
import type { Project } from "./lib/api";
import { api, todayDateString } from "./lib/api";
import type { ViewId } from "./lib/navigation";
import "./styles/app.css";
import "./styles/today.css";
import "./styles/features.css";
import "./styles/analytics.css";

function App() {
  const [view, setView] = useState<ViewId>("today");
  const [quickOpen, setQuickOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    let cancelled = false;
    api
      .listProjects(false)
      .then((list) => {
        if (!cancelled) setProjects(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [refreshKey, quickOpen]);

  function bumpRefresh() {
    setRefreshKey((value) => value + 1);
  }

  return (
    <div className="app-shell">
      <TitleBar view={view} />
      <div className="app-body">
        <Sidebar active={view} onSelect={setView} onQuickRecord={() => setQuickOpen(true)} />
        <main className="app-main">
          {view === "today" ? (
            <TodayView refreshKey={refreshKey} onQuickRecord={() => setQuickOpen(true)} />
          ) : view === "projects" ? (
            <ProjectsView />
          ) : view === "entries" ? (
            <EntriesView refreshKey={refreshKey} />
          ) : view === "analytics" ? (
            <AnalyticsView />
          ) : (
            <PlaceholderView view={view} onBackToToday={() => setView("today")} />
          )}
        </main>
      </div>
      {quickOpen && (
        <EntryModal
          projects={projects}
          defaultDate={todayDateString()}
          onClose={() => setQuickOpen(false)}
          onSaved={() => {
            setQuickOpen(false);
            bumpRefresh();
          }}
        />
      )}
    </div>
  );
}

export default App;
