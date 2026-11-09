import { useEffect, useRef, useState } from "react";
import "./styles.css";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");
const NAV = [
  ["home", "Home"], ["capabilities", "Capabilities"], ["workflow", "Workflow"],
  ["analyzer", "Analyzer"], ["architecture", "Architecture"], ["technology", "Tech stack"],
  ["outcomes", "Outcomes"], ["team", "Team"],
];
const FEATURES = [
  { id: "analyze", number: "01", name: "Repository intelligence", short: "See the architecture, technologies and important files behind a codebase.", endpoint: "/analyze", icon: "⌘", detailLabel: "GET THE BIG PICTURE", details: ["Repository identity, primary language and public activity", "Top-level folders and file distribution", "Important modules and an AI-written architecture overview"], takeaway: "Start here to understand what the project is, how it is organised and where its core logic lives." },
  { id: "docs", number: "02", name: "Documentation review", short: "Find what the README explains well and what a new developer still needs.", endpoint: "/docs", icon: "▤", detailLabel: "MAKE KNOWLEDGE EASIER TO FIND", details: ["README length and documentation-file inventory", "Missing setup, usage or contribution guidance", "Practical recommendations for clearer project docs"], takeaway: "Useful when a team wants contributors to understand and use a project faster." },
  { id: "impact", number: "03", name: "Change impact", short: "Trace recent code changes and see which areas may need extra testing.", endpoint: "/impact", icon: "↗", detailLabel: "FOLLOW THE CHANGE", details: ["Recent commit messages and affected files", "Added and removed lines for inspected changes", "AI observations about scope, risk and what to test"], takeaway: "Helps reviewers move from a commit list to a clearer view of possible consequences." },
  { id: "firstpr", number: "04", name: "First contribution guide", short: "Turn an unfamiliar codebase into approachable starting points for contributors.", endpoint: "/firstpr", icon: "✳", detailLabel: "MAKE THE FIRST STEP CLEAR", details: ["Beginner-friendly contribution opportunities", "Relevant files and why they matter", "Context to help a newcomer choose a sensible first task"], takeaway: "A friendly on-ramp for students and developers making their first open-source contribution." },
  { id: "drift", number: "05", name: "Code drift signals", short: "Spot places where the codebase may have moved on from its documentation.", endpoint: "/drift", icon: "⌁", detailLabel: "NOTICE WHAT HAS CHANGED", details: ["Recent structural changes visible in commit history", "Potential gaps between current code and README guidance", "Evidence-led observations, with uncertainty called out"], takeaway: "Helps maintainers notice when project documentation may need to catch up with the code." },
];
const TABS = [
  ["overview", "Overview", "/analyze"], ["docs", "Documentation", "/docs"],
  ["impact", "Impact", "/impact"], ["firstpr", "First PR", "/firstpr"], ["drift", "Code Drift", "/drift"],
];
const STEPS = [
  ["01", "Connect", "Paste a public GitHub repository URL."],
  ["02", "Retrieve", "RepoMind reads repository metadata, files and selected commit history."],
  ["03", "Understand", "Groq models turn repository context into structured technical insights."],
  ["04", "Explore", "Review five focused reports and reuse saved results during your expo."],
];
const TECH = [
  ["Frontend", "React 18", "Vite 5", "JSX", "Plain CSS", "SVG visualizations"],
  ["Backend", "Python 3.10+", "FastAPI", "Uvicorn", "HTTPX", "python-dotenv"],
  ["AI & data", "Groq API", "GPT-OSS-120B", "GPT-OSS-20B backup", "GitHub REST API"],
  ["Developer tools", "Git", "GitHub", "npm", "pip", "Python virtual environment"],
];
const COS = [
  "Apply engineering and problem-solving concepts to understand complex software repositories.",
  "Design and develop a full-stack web application using modern frontend and backend technologies.",
  "Integrate external APIs and generative AI services to produce repository insights.",
  "Test, evaluate, document and demonstrate a functional web-based software solution.",
];
const POS = [["PO1", "Engineering knowledge"], ["PO2", "Problem analysis"], ["PO3", "Design and development"], ["PO5", "Modern tool usage"], ["PO9", "Individual and teamwork"], ["PO10", "Communication"]];
const MAP = [[3, 2, 0, 0, 0, 0], [3, 2, 3, 3, 2, 0], [0, 2, 2, 3, 0, 0], [0, 0, 2, 2, 2, 3]];
const TEAM = [
  ["AS", "Arsheen Syeda", "160624733069"],
  ["AM", "Aruba Maheen", "160624733070"],
  ["RF", "Rida Fatima", "160624733116"],
];
const DEMO_URL = "https://github.com/pallets/flask";

function Reveal({ children, className = "" }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { threshold: 0.12 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`reveal ${visible ? "is-visible" : ""} ${className}`}>{children}</div>;
}

function inlineMarkdown(value) {
  const pieces = String(value).split(/(\*\*.*?\*\*|`[^`]+`|\*[^*]+\*)/g);
  return pieces.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    return part;
  });
}

function MarkdownReport({ text }) {
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  const blocks = [];
  let list = [];
  let listType = "ul";
  let code = null;
  const flushList = () => {
    if (list.length) { blocks.push({ type: listType, items: list }); list = []; }
  };
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      flushList();
      if (code === null) code = [];
      else { blocks.push({ type: "code", value: code.join("\n") }); code = null; }
      return;
    }
    if (code !== null) { code.push(line); return; }
    if (!trimmed) { flushList(); return; }
    if (/^[-*_]{3,}$/.test(trimmed)) { flushList(); blocks.push({ type: "hr" }); return; }
    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) { flushList(); blocks.push({ type: "heading", level: Math.min(heading[1].length, 4), value: heading[2] }); return; }
    const bullet = trimmed.match(/^[-*+]\s+(.+)$/);
    if (bullet) { if (list.length && listType !== "ul") flushList(); listType = "ul"; list.push(bullet[1]); return; }
    const ordered = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (ordered) { if (list.length && listType !== "ol") flushList(); listType = "ol"; list.push(ordered[1]); return; }
    if (trimmed.startsWith(">")) { flushList(); blocks.push({ type: "quote", value: trimmed.replace(/^>\s?/, "") }); return; }
    flushList();
    blocks.push({ type: "paragraph", value: trimmed });
  });
  flushList();
  if (code !== null) blocks.push({ type: "code", value: code.join("\n") });
  return <div className="markdown-report">{blocks.map((block, index) => {
    if (block.type === "heading") {
      const Tag = block.level <= 2 ? "h3" : "h4";
      return <Tag key={index}>{inlineMarkdown(block.value)}</Tag>;
    }
    if (block.type === "ul" || block.type === "ol") {
      const Tag = block.type;
      return <Tag key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{inlineMarkdown(item)}</li>)}</Tag>;
    }
    if (block.type === "code") return <pre key={index}><code>{block.value}</code></pre>;
    if (block.type === "quote") return <blockquote key={index}>{inlineMarkdown(block.value)}</blockquote>;
    if (block.type === "hr") return <hr key={index}/>;
    return <p key={index}>{inlineMarkdown(block.value)}</p>;
  })}</div>;
}

function formatNumber(value) {
  return typeof value === "number" ? value.toLocaleString("en-IN") : (value || "—");
}

function CacheBadge({ cache }) {
  if (!cache) return null;
  const isCached = cache.hit;
  const minutes = Math.max(0, Math.floor((cache.age_seconds || 0) / 60));
  return <span className={`cache-badge ${isCached ? "cached" : "live"}`}><i/>{isCached ? `CACHED${minutes ? ` · ${minutes}m old` : " · saved"}` : "LIVE RESULT · SAVED"}</span>;
}

function Analyzer() {
  const [input, setInput] = useState("");
  const [repo, setRepo] = useState("");
  const [active, setActive] = useState("overview");
  const [results, setResults] = useState({});
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState({});
  const [preparing, setPreparing] = useState(false);
  const [prepareMessage, setPrepareMessage] = useState("");
  const [copied, setCopied] = useState(false);

  async function loadReport(key, targetRepo, refresh = false) {
    const tab = TABS.find(([id]) => id === key);
    if (!tab) return null;
    setBusy((current) => ({ ...current, [key]: true }));
    setErrors((current) => ({ ...current, [key]: "" }));
    try {
      const response = await fetch(`${API_BASE}${tab[2]}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ url: targetRepo, refresh }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || `Request failed (${response.status})`);
      setResults((current) => ({ ...current, [key]: data }));
      setErrors((current) => ({ ...current, [key]: "" }));
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error while contacting RepoMind.";
      setErrors((current) => ({ ...current, [key]: message }));
      return null;
    } finally {
      setBusy((current) => ({ ...current, [key]: false }));
    }
  }

  function submit(event) {
    event.preventDefault();
    const value = input.trim();
    if (!value) return;
    setRepo(value);
    setResults({});
    setErrors({});
    setActive("overview");
    loadReport("overview", value, false);
  }

  function chooseTab(key) {
    setActive(key);
    if (repo && !results[key] && !busy[key]) loadReport(key, repo, false);
  }

  function useDemo() {
    setInput(DEMO_URL);
    setRepo("");
    setResults({});
    setErrors({});
    setPrepareMessage("Sample repository selected. Click Analyze Repository to load its saved or live analysis.");
  }

  async function prepareDemoPack() {
    const target = repo || input.trim();
    if (!target) { setPrepareMessage("Enter a GitHub repository URL first."); return; }
    setPreparing(true);
    setPrepareMessage("Preparing five reports. Existing cached reports are reused; only missing reports require AI requests.");
    const keys = TABS.map(([key]) => key);
    let completed = 0;
    for (const key of keys) {
      const result = await loadReport(key, target, false);
      if (result) completed += 1;
    }
    setRepo(target);
    setPreparing(false);
    setPrepareMessage(`${completed} of 5 reports ready. You can now replay them during your expo.`);
  }

  function downloadReport() {
    const report = results[active];
    if (!report) return;
    const title = TABS.find(([key]) => key === active)?.[1] || "RepoMind Report";
    const body = [
      `# RepoMind — ${title}`,
      `Repository: ${repo}`,
      `Generated: ${new Date().toLocaleString()}`,
      `Source: ${report._cache?.hit ? "Saved cache" : "Live analysis"}`,
      "",
      report.stats ? `## Repository statistics\n${JSON.stringify(report.stats, null, 2)}\n` : "",
      report.analysis?.text || "No AI report text available.",
      report.doc_files ? `\n## Documentation files\n${report.doc_files.join("\n")}` : "",
    ].filter(Boolean).join("\n");
    const blob = new Blob([body], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `repomind-${active}-report.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function copyReport() {
    const report = results[active];
    if (!report?.analysis?.text) return;
    try {
      await navigator.clipboard.writeText(report.analysis.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { setCopied(false); }
  }

  const current = results[active];
  const currentError = errors[active];
  const currentBusy = !!busy[active];
  const stats = results.overview?.stats;
  const directories = stats?.directories ? Object.entries(stats.directories).slice(0, 8) : [];
  const maxFiles = Math.max(1, ...directories.map(([, count]) => count));
  const currentTitle = TABS.find(([key]) => key === active)?.[1] || "Analysis";

  return <div className="analyzer-shell">
    <div className="analyzer-topline">
      <div><span className="eyebrow">LIVE REPOSITORY INTELLIGENCE</span><h3>Analyze a codebase</h3><p>Connect a public GitHub repository. Explore five focused reports, powered by your RepoMind backend.</p></div>
      <div className="api-state"><span className="api-pulse"/> API workspace <b>Ready to analyze</b></div>
    </div>
    <div className="analyzer-card">
      <form onSubmit={submit} className="repo-form">
        <label className="repo-input-wrap"><span className="github-mark">⌘</span><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="https://github.com/owner/repository" aria-label="GitHub repository URL" required/></label>
        <button className="button button-primary" type="submit" disabled={currentBusy}>{currentBusy ? "Analyzing…" : "Analyze repository"}<span>↗</span></button>
      </form>
      <div className="analyzer-utility-row">
        <button className="text-action" type="button" onClick={useDemo}>Use verified sample <span>pallets/flask</span></button>
        <span className="utility-separator"/>
        <button className="text-action" type="button" disabled={preparing} onClick={prepareDemoPack}>{preparing ? "Preparing reports…" : "Prepare expo demo pack"}</button>
      </div>
      {prepareMessage && <div className="prepare-message" role="status">{prepareMessage}</div>}
      {repo && <>
        <div className="repo-context"><span className="repo-context-icon">◈</span><div><strong>{repo.replace("https://github.com/", "")}</strong><small>Public GitHub repository</small></div><span className="repo-live-label">● Connected</span></div>
        <div className="report-tabs" role="tablist" aria-label="Repository reports">
          {TABS.map(([key, label, endpoint]) => <button key={key} type="button" role="tab" aria-selected={active === key} className={active === key ? "active" : ""} onClick={() => chooseTab(key)}><span>{String(TABS.findIndex(([id]) => id === key) + 1).padStart(2, "0")}</span>{label}</button>)}
        </div>
        <div className="report-panel" key={active}>
          <div className="report-heading"><div><span className="eyebrow">REPOSITORY REPORT</span><h4>{currentTitle}</h4></div><div className="report-actions">{current && <CacheBadge cache={current._cache}/>}<button type="button" className="icon-button" onClick={downloadReport} disabled={!current} title="Download Markdown report">↓ Export</button><button type="button" className="icon-button" onClick={copyReport} disabled={!current?.analysis?.text}>{copied ? "Copied" : "Copy"}</button></div></div>
          {currentBusy && <div className="loading-state"><div className="loading-orbit"><i/><i/><i/></div><div><strong>Reading the repository</strong><span>Retrieving project context and generating insights…</span></div></div>}
          {currentError && <div className="error-state"><span className="error-symbol">!</span><div><strong>We couldn't complete this report</strong><p>{currentError}</p><div className="error-actions"><button type="button" className="button button-small" onClick={() => loadReport(active, repo, false)}>Retry / use saved report</button><button type="button" className="text-action" onClick={() => loadReport(active, repo, true)}>Force fresh analysis</button></div></div></div>}
          {!currentBusy && !currentError && !current && <div className="empty-report"><div className="empty-orb">✧</div><strong>Your {currentTitle.toLowerCase()} report is ready to generate</strong><span>Select Analyze Repository to begin, or choose a previously cached report.</span></div>}
          {!currentBusy && current && <>
            {active === "overview" && stats && <div className="overview-metrics">
              <div className="metric-card"><span>Files discovered</span><strong>{formatNumber(stats.files)}</strong><small>Repository file inventory</small></div>
              <div className="metric-card"><span>Primary language</span><strong>{stats.language || "—"}</strong><small>Detected by GitHub</small></div>
              <div className="metric-card"><span>GitHub stars</span><strong>{formatNumber(stats.stars)}</strong><small>Public repository signal</small></div>
            </div>}
            {active === "overview" && directories.length > 0 && <div className="directory-card"><div className="subsection-heading"><div><span className="eyebrow">CODEBASE MAP</span><h5>Top-level directory distribution</h5></div><span>{directories.length} groups</span></div><div className="directory-bars">{directories.map(([name, count]) => <div className="directory-row" key={name}><span>{name}</span><div className="directory-track"><i style={{ width: `${Math.max(4, (count / maxFiles) * 100)}%` }}/></div><b>{count}</b></div>)}</div></div>}
            {active === "docs" && <div className="docs-summary"><div><span>README length</span><strong>{formatNumber(current.readme_chars)} <small>characters</small></strong></div><div><span>Documentation files</span><strong>{formatNumber(current.doc_files?.length || 0)}</strong></div></div>}
            {(active === "impact" || active === "drift") && Array.isArray(current.commits) && <div className="commit-list"><div className="subsection-heading"><div><span className="eyebrow">RECENT REPOSITORY ACTIVITY</span><h5>{current.commits.length} commits inspected</h5></div></div>{current.commits.map((commit) => <details className="commit-item" key={commit.sha}><summary><span className="commit-sha">{commit.sha}</span><span>{commit.message}</span><small>{commit.files?.length || 0} changed files</small></summary><div className="changed-files">{commit.files?.map((file) => <div className="changed-file" key={file.file}><code>{file.file}</code><span className="additions">+{file["+"]}</span><span className="deletions">−{file["-"]}</span></div>)}</div></details>)}</div>}
            {current.analysis?.text && <div className="ai-report"><div className="ai-report-header"><div className="ai-mark">✦</div><div><span className="eyebrow">GENERATED INSIGHT</span><strong>RepoMind AI analysis</strong><small>Model: {current.analysis.model || "Groq"}</small></div></div><MarkdownReport text={current.analysis.text}/></div>}
            {active === "docs" && current.doc_files?.length > 0 && <div className="doc-files"><h5>Documentation files found</h5>{current.doc_files.slice(0, 12).map((file) => <code key={file}>{file}</code>)}</div>}
          </>}
        </div>
      </>}
      {!repo && <div className="analyzer-empty-hint"><div className="hint-icon">⌁</div><div><strong>Start with a repository URL</strong><span>Try the verified Flask sample or paste a public GitHub repository above.</span></div><span className="hint-arrow">↗</span></div>}
    </div>
    <div className="analyzer-footnote"><span>◉</span> Reports are generated from repository data. Saved results are labelled as cached; live analysis uses your configured APIs.</div>
  </div>;
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [expandedFeature, setExpandedFeature] = useState("analyze");
  return <>
    <div className="ambient-bg" aria-hidden="true"/>
    <header className="site-header">
      <a href="#home" className="brand"><span className="brand-symbol">R</span><span>repo<span>mind</span><small>REPOSITORY INTELLIGENCE</small></span></a>
      <button className="mobile-menu" type="button" aria-label="Toggle navigation" onClick={() => setMenuOpen((value) => !value)}>{menuOpen ? "×" : "☰"}</button>
      <nav className={menuOpen ? "nav-open" : ""}>{NAV.map(([id, label]) => <a href={`#${id}`} key={id} onClick={() => setMenuOpen(false)}>{label}</a>)}<a className="nav-cta" href="#analyzer" onClick={() => setMenuOpen(false)}>Launch workspace <span>↗</span></a></nav>
    </header>
    <main>
      <section className="hero-section" id="home">
        <div className="hero-copy">
          <div className="event-label"><i/> WT EXPO 2026 <span>/</span> AI DEVELOPER INTELLIGENCE</div>
          <h1>Code, <span>decoded.</span></h1>
          <p className="hero-description">Explore the story behind any public GitHub repository — its structure, documentation, changes and contribution paths — in one clear, AI-powered workspace.</p>
          <div className="hero-actions"><a className="button button-primary" href="#analyzer">Explore a repository <span>↗</span></a><a className="button button-quiet" href="#capabilities">See how it works <span>↓</span></a></div>
          <div className="hero-trust"><div className="trust-avatars"><i>R</i><i>AI</i><i>⌘</i></div><span>Built for developers, maintainers and new contributors</span></div>
        </div>
        <div className="hero-visual" aria-label="RepoMind product preview">
          <div className="visual-glow"/>
          <div className="visual-window">
            <div className="window-top"><div className="window-dots"><i/><i/><i/></div><span>REPO ANALYSIS / OVERVIEW</span><b>● LIVE</b></div>
            <div className="visual-repo"><div className="repo-avatar">⌘</div><div><strong>pallets / flask</strong><small>Python · Public repository</small></div><span className="visual-verified">✓</span></div>
            <div className="visual-stats"><div><small>FILES</small><strong>236</strong></div><div><small>LANGUAGE</small><strong>Python</strong></div><div><small>REPORTS</small><strong>05</strong></div></div>
            <div className="visual-section-title"><span>Repository structure</span><small>TOP DIRECTORIES</small></div>
            {[ ["docs", 88], ["tests", 66], ["examples", 46], ["src", 29] ].map(([name, width]) => <div className="visual-bar" key={name}><span>{name}</span><div><i style={{ width: `${width}%` }}/></div></div>)}
            <div className="visual-ai"><span>✦</span><div><b>AI insight</b><small>Architecture and key modules mapped into one readable report.</small></div><i>↗</i></div>
          </div>
          <div className="floating-chip chip-one"><span>✦</span> AI-powered insights</div>
          <div className="floating-chip chip-two"><span>◉</span> Five analysis views</div>
        </div>
        <div className="hero-bottomline"><span>01 / REPOSITORY INTELLIGENCE</span><span>DESIGNED FOR EXPLORATION <i>↘</i></span></div>
      </section>

      <section className="proof-strip" aria-label="Project highlights"><div><strong>05</strong><span>Focused analysis reports</span></div><div><strong>AI</strong><span>Groq-powered insights</span></div><div><strong>API</strong><span>GitHub repository data</span></div><div><strong>24h</strong><span>Local report cache</span></div></section>

      <section id="capabilities" className="content-section">
        <div className="section-heading"><div><span className="eyebrow">WHAT REPOMIND DOES</span><h2>One repository.<br/><em>Five ways to understand it.</em></h2></div><p>Move beyond a wall of files. RepoMind organizes repository signals into focused reports that are easier to explore, explain and present.</p></div>
        <div className="feature-grid">{FEATURES.map((feature) => {
          const expanded = expandedFeature === feature.id;
          return <Reveal key={feature.id}><article className={`feature-card feature-${feature.id} ${expanded ? "expanded" : ""}`}>
            <button className="feature-card-trigger" type="button" aria-expanded={expanded} aria-controls={`feature-detail-${feature.id}`} onClick={() => setExpandedFeature(expanded ? null : feature.id)}>
              <div className="feature-card-top"><span className="feature-number">{feature.number}</span><span className="feature-icon">{feature.icon}</span></div>
              <h3>{feature.name}</h3><p>{feature.short}</p>
              <span className="feature-toggle-label">{expanded ? "Close details" : "Explore this capability"}<b>{expanded ? "−" : "+"}</b></span>
            </button>
            {expanded && <div className="feature-detail" id={`feature-detail-${feature.id}`}>
              <span className="feature-detail-label">{feature.detailLabel}</span>
              <ul>{feature.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>
              <p>{feature.takeaway}</p>
              <a href="#analyzer">Open the analyzer <span>↗</span></a>
            </div>}
          </article></Reveal>;
        })}</div>
      </section>

      <section id="workflow" className="content-section workflow-section">
        <div className="section-heading"><div><span className="eyebrow">SIMPLE BY DESIGN</span><h2>From repository URL<br/><em>to clear insight.</em></h2></div><p>A practical workflow that turns public repository information into an understandable technical overview.</p></div>
        <div className="workflow-grid">{STEPS.map(([number, title, description], index) => <Reveal key={number}><div className="workflow-card"><span>{number}</span><div className="workflow-line"/><h3>{title}</h3><p>{description}</p>{index === 3 && <small>Results can be reused from the local cache.</small>}</div></Reveal>)}</div>
      </section>

      <section id="analyzer" className="analyzer-section">
        <div className="section-heading analyzer-section-heading"><div><span className="eyebrow">THE REPOMIND WORKSPACE</span><h2>Explore a repository.<br/><em>Understand what matters.</em></h2></div><p>Start with a public GitHub URL. Generate the overview, then move through the other four analysis views.</p></div>
        <Analyzer/>
      </section>

      <section id="architecture" className="content-section architecture-section">
        <div className="section-heading"><div><span className="eyebrow">UNDER THE HOOD</span><h2>A focused pipeline.<br/><em>Connected intelligence.</em></h2></div><p>RepoMind combines repository retrieval, backend processing and AI-generated explanations in a clear application flow.</p></div>
        <div className="architecture-flow"><div className="architecture-node"><span>01</span><b>Developer</b><small>Public GitHub URL</small></div><i>↓</i><div className="architecture-node"><span>02</span><b>React frontend</b><small>React 18 · Vite 5 · CSS</small></div><i>↓</i><div className="architecture-node active-node"><span>03</span><b>FastAPI backend</b><small>Python · HTTPX · Uvicorn</small></div><i>↓</i><div className="architecture-split"><div className="architecture-node"><span>04A</span><b>GitHub API</b><small>Metadata · Files · Commits</small></div><div className="architecture-node"><span>04B</span><b>Groq AI</b><small>GPT-OSS models</small></div></div><i>↓</i><div className="architecture-node final-node"><span>05</span><b>RepoMind reports</b><small>Structured insights · Saved cache · Dashboard</small></div></div>
      </section>

      <section id="technology" className="content-section technology-section">
        <div className="section-heading"><div><span className="eyebrow">BUILT WITH MODERN TOOLS</span><h2>The technology<br/><em>behind the intelligence.</em></h2></div><p>A lightweight, practical stack built around a React interface, Python API and hosted AI inference.</p></div>
        <div className="tech-grid">{TECH.map(([group, ...items], index) => <Reveal key={group}><article className="tech-card"><span className="tech-index">0{index + 1}</span><h3>{group}</h3><div className="tech-pills">{items.map((item) => <span key={item}>{item}</span>)}</div></article></Reveal>)}</div>
      </section>

      <section id="outcomes" className="content-section outcomes-section">
        <div className="section-heading"><div><span className="eyebrow">ACADEMIC ALIGNMENT</span><h2>Learning outcomes.<br/><em>Engineering in practice.</em></h2></div><p>Project-demonstrated outcomes for the WT Expo presentation. Final mapping should be aligned with the faculty-approved course syllabus.</p></div>
        <div className="outcome-layout"><div className="outcome-list">{COS.map((outcome, index) => <div className="outcome-item" key={outcome}><span>CO0{index + 1}</span><p>{outcome}</p></div>)}</div><div className="mapping-card"><div className="mapping-heading"><h3>CO–PO mapping</h3><span>Illustrative strength</span></div><div className="mapping-table-wrap"><table className="mapping-table"><thead><tr><th>CO</th>{POS.map(([po]) => <th key={po}>{po}</th>)}</tr></thead><tbody>{MAP.map((row, index) => <tr key={index}><th>CO{index + 1}</th>{row.map((value, cell) => <td key={cell}><span className={`map-value level-${value}`}>{value || "—"}</span></td>)}</tr>)}</tbody></table></div><div className="mapping-legend"><span><i className="level-3"/> High</span><span><i className="level-2"/> Medium</span><span><i className="level-1"/> Low</span></div></div></div>
        <div className="po-grid">{POS.map(([code, name]) => <div className="po-card" key={code}><span>{code}</span><strong>{name}</strong></div>)}</div>
      </section>

      <section id="team" className="content-section team-section">
        <div className="section-heading"><div><span className="eyebrow">THE PEOPLE BEHIND THE PROJECT</span><h2>Built as a team.<br/><em>Presented with purpose.</em></h2></div><p>RepoMind is developed as a Web Technologies project for the 2026 exhibition.</p></div>
        <div className="team-meta"><div><span>INSTITUTION</span><strong>Stanley Women's Engineering College</strong><small>Osmania University · B.E. Computer Science & Engineering</small></div><div><span>FACULTY MENTOR</span><strong>Ms. Bazila Wahaj</strong><small>Project mentor</small></div></div>
        <div className="team-grid">{TEAM.map(([initials, name, roll]) => <article className="team-card" key={roll}><div className="team-avatar">{initials}</div><div><span className="eyebrow">STUDENT DEVELOPER</span><h3>{name}</h3><code>{roll}</code></div><span className="team-arrow">↗</span></article>)}</div>
      </section>

      <section className="closing-section"><div><span className="eyebrow">WT EXPO 2026</span><h2>Make every repository<br/><em>easier to understand.</em></h2><p>RepoMind brings code structure, change context and AI explanations into one clear workspace.</p><a className="button button-primary" href="#analyzer">Launch RepoMind <span>↗</span></a></div><div className="closing-orbit"><div className="orbit orbit-a"/><div className="orbit orbit-b"/><div className="orbit-core">R<span>✦</span></div></div></section>
    </main>
    <footer className="site-footer"><a href="#home" className="brand"><span className="brand-symbol">R</span><span>repo<span>mind</span><small>REPOSITORY INTELLIGENCE</small></span></a><p>WT EXPO 2026 · Stanley Women's Engineering College · Osmania University</p><a href="#home">Back to top ↑</a></footer>
  </>;
}
