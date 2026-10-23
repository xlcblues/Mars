import { useState } from "react";
import { TitleBar } from "./components/TitleBar";
import { Sidebar } from "./components/Sidebar";
import { TodayView } from "./features/today/TodayView";
import { PlaceholderView } from "./features/PlaceholderView";
import type { ViewId } from "./lib/navigation";
import "./styles/app.css";
import "./styles/today.css";

function App() {
  const [view, setView] = useState<ViewId>("today");

  return (
    <div className="app-shell">
      <TitleBar view={view} />
      <div className="app-body">
        <Sidebar active={view} onSelect={setView} />
        <main className="app-main">
          {view === "today" ? (
            <TodayView />
          ) : (
            <PlaceholderView view={view} onBackToToday={() => setView("today")} />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
