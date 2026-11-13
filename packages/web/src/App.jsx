import React, { useEffect, useState } from "react";
import { TongProvider } from "./lib/tong.jsx";
import { Shell } from "./components/Shell.jsx";
import Landing from "./pages/Landing.jsx";
import Connect from "./pages/Connect.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Apps from "./pages/Apps.jsx";
import Act from "./pages/Act.jsx";
import CrossChain from "./pages/CrossChain.jsx";
import Activity from "./pages/Activity.jsx";
import Permissions from "./pages/Permissions.jsx";
import Developers from "./pages/Developers.jsx";

const PAGES = {
  "#/app": [Dashboard, "Account", "Your NEAR identity, from the wallet you already have"],
  "#/app/apps": [Apps, "Apps", "NEAR apps you can use with your wallet"],
  "#/app/act": [Act, "Act on NEAR", "Sign one action. Your NEAR account does exactly that."],
  "#/app/sign": [CrossChain, "Cross-chain", "Sign for Ethereum with NEAR Chain Signatures"],
  "#/app/activity": [Activity, "Activity", "Every action, with its receipt"],
  "#/app/permissions": [Permissions, "Permissions", "What Tong is allowed to do, read live from the contract"],
  "#/app/developers": [Developers, "Developers", "Add wallet sign-in to your NEAR app"],
};

function useRoute() {
  const get = () => (location.hash || "#/").split("?")[0];
  const [route, setRoute] = useState(get);
  useEffect(() => {
    const on = () => {
      setRoute(get());
      const h = location.hash;
      if (h && !h.startsWith("#/")) requestAnimationFrame(() => document.getElementById(h.slice(1))?.scrollIntoView({ behavior: "smooth" }));
      else window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

function Router() {
  const route = useRoute();
  if (route === "#/connect") return <Connect />;
  const page = PAGES[route];
  if (page) {
    const [Page, title, subtitle] = page;
    return (
      <Shell route={route} title={title} subtitle={subtitle}>
        <Page />
      </Shell>
    );
  }
  if (route.startsWith("#/app")) {
    return (
      <Shell route={route} title="Not found">
        <div className="card need">
          <h2>That page doesn't exist</h2>
          <a className="btn btn-dark" href="#/app">
            Back to your account
          </a>
        </div>
      </Shell>
    );
  }
  return <Landing />;
}

export default function App() {
  return (
    <TongProvider>
      <Router />
    </TongProvider>
  );
}
