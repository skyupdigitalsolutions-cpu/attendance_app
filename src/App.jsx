import { AppProvider, useApp, useRoute } from "./lib/app";
import { ToastProvider } from "./components/ui";
import { Header, Tabs } from "./components/Shell";
import Login from "./pages/Login";
import Today from "./pages/Today";
import People from "./pages/People";
import Employee from "./pages/Employee";
import Leave from "./pages/Leave";
import Reports from "./pages/Reports";
import Ids from "./pages/Ids";
import Settings from "./pages/Settings";

function Screens() {
  const { me } = useApp();
  const { page, arg } = useRoute();
  if (!me) return <Login />;
  const Page = { people: People, leave: Leave, reports: Reports, ids: Ids, settings: Settings }[page];
  return (
    <>
      <Header />
      <Tabs page={page} />
      {/* key: a fresh page (and fresh state) per screen and per signed-in admin */}
      <main key={`${me._id}-${page}-${arg || ""}`} className="mx-auto max-w-6xl px-3 pt-3 pb-10 sm:px-4">
        {page === "employee" && arg ? <Employee id={arg} /> : Page ? <Page /> : <Today />}
      </main>
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppProvider>
        <Screens />
      </AppProvider>
    </ToastProvider>
  );
}
