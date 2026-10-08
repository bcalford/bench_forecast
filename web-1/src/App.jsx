import { useEffect, useRef, useState } from "react";
import Home from "./pages/Home.jsx";
import CaseResult from "./pages/CaseResult.jsx";
import Reasoning from "./pages/Reasoning.jsx";
import Scorecard from "./pages/Scorecard.jsx";
import NewCase from "./pages/NewCase.jsx";
import Method from "./pages/Method.jsx";
import { Masthead, Footer } from "./components/Chrome.jsx";

const DemoRun = ({ focus }) => <CaseResult run sample={focus === "sample"} />;
const views = { home: Home, case: CaseResult, reader: Reasoning, scorecard: Scorecard, new: NewCase, run: DemoRun, method: Method };

// Only "#/<view>[/<focus>]" hashes are routes; plain anchors (#j-roberts) stay on the current view.
function routeFromHash() {
  const m = window.location.hash.match(/^#\/(\w+)(?:\/(\w+))?/);
  return m && views[m[1]] ? { view: m[1], focus: m[2] ?? null } : null;
}

export default function App() {
  const [route, setRoute] = useState(() => routeFromHash() ?? { view: "home", focus: null });

  useEffect(() => {
    const onHash = () => {
      const next = routeFromHash();
      if (!next) return;
      setRoute(next);
      if (!next.focus) window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // After an in-app navigation, move focus to the new page so keyboard and screen-reader users start there.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const main = document.getElementById("main");
    if (!main) return;
    main.setAttribute("tabindex", "-1");
    main.focus({ preventScroll: true });
  }, [route]);

  const Page = views[route.view];
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Masthead view={route.view} />
      <Page key={`${route.view}/${route.focus ?? ""}`} focus={route.focus} />
      <Footer />
    </>
  );
}
