import axios from "axios";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";
const api = axios.create({ baseURL: `${API_URL}/api` });

function headers() {
  const token = localStorage.getItem("campusbid_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function DashboardShell({ user, eyebrow, intro, label, accent, children }) {
  return (
    <section className={`dashboard section dashboard-${accent}`} aria-labelledby="dashboard-title">
      <div className="dashboard-heading">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2 id="dashboard-title">Welcome, {user.name}</h2>
          <p>{intro}</p>
        </div>
        <span className="role-badge">{label}</span>
      </div>
      {children}
    </section>
  );
}

function Stat({ value, label }) {
  return <div><strong>{value}</strong><span>{label}</span></div>;
}

function ActivityList({ title, empty, children }) {
  return <div className="dashboard-activity"><h3>{title}</h3>{children || <p className="muted">{empty}</p>}</div>;
}

export function RoleDashboard({ user, onBrowse, onCreateListing }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/dashboard", { headers: headers() }).then(({ data: response }) => setData(response.data)).catch(() => setError("Dashboard data could not be loaded."));
  }, []);

  const role = user.role === "STUDENT" ? "BUYER" : user.role;
  const loading = !data && !error;
  if (role === "ADMIN") {
    return <AdminDashboard user={user} data={data} error={error} loading={loading} onBrowse={onBrowse} />;
  }
  if (role === "SELLER") {
    return <SellerDashboard user={user} data={data} error={error} loading={loading} onBrowse={onBrowse} onCreateListing={onCreateListing} />;
  }
  return <BuyerDashboard user={user} data={data} error={error} loading={loading} onBrowse={onBrowse} />;
}

function BuyerDashboard({ user, data, error, loading, onBrowse }) {
  const bids = data?.bids ?? [];
  const transactions = data?.transactions ?? [];
  return <DashboardShell user={user} eyebrow="BUYER WORKSPACE" intro="Find useful campus essentials, place bids, and follow your wins." label="Buyer" accent="buyer">
    {error && <p className="form-error">{error}</p>}
    <div className="dashboard-summary"><Stat value={loading ? "…" : bids.length} label="Recent bids" /><Stat value={loading ? "…" : transactions.length} label="Purchases & handovers" /><Stat value={loading ? "…" : data?.unreadNotifications ?? 0} label="Unread notifications" /></div>
    <div className="dashboard-grid">
      <DashboardAction icon="⌕" title="Browse auctions" description="Discover books, cycles, and electronics listed by your campus." action="Explore items" onAction={onBrowse} />
      <DashboardAction icon="↗" title="My bids" description="Track your active bids and see when an auction is ending soon." action="View bid history" onAction={onBrowse} />
      <DashboardAction icon="✓" title="Purchases & handover" description="Keep accepted purchases and collection details in one place." action="View transactions" onAction={onBrowse} />
    </div>
    <ActivityList title="Recent bid activity" empty="Your bids will appear here after you participate in an auction.">{bids.map((bid) => <div className="activity-row" key={bid.id}><span>{bid.listing.title}</span><strong>₹{(bid.amountPaise / 100).toLocaleString("en-IN")}</strong><small>{bid.listing.status}</small></div>)}</ActivityList>
  </DashboardShell>;
}

function SellerDashboard({ user, data, error, loading, onBrowse, onCreateListing }) {
  const listings = data?.listings ?? [];
  const transactions = data?.transactions ?? [];
  return <DashboardShell user={user} eyebrow="SELLER WORKSPACE" intro="Turn useful items into value for another student on campus." label="Seller" accent="seller">
    {error && <p className="form-error">{error}</p>}
    <div className="dashboard-summary"><Stat value={loading ? "…" : listings.filter((listing) => listing.status === "OPEN").length} label="Active listings" /><Stat value={loading ? "…" : listings.reduce((sum, listing) => sum + listing._count.bids, 0)} label="Total bids" /><Stat value={loading ? "…" : transactions.length} label="Sales & handovers" /></div>
    <div className="dashboard-grid">
      <DashboardAction icon="+" title="Create a listing" description="Add an item, set a starting price, and open an auction." action="Add an item" onAction={onCreateListing} />
      <DashboardAction icon="◫" title="My listings" description="Manage active auctions and watch incoming bids." action="View listings" onAction={onBrowse} />
      <DashboardAction icon="✓" title="Sales & handovers" description="Review winning bids and coordinate collection." action="View transactions" onAction={onBrowse} />
    </div>
    <ActivityList title="Your listings" empty="You have not created any listings yet.">{listings.slice(0, 5).map((listing) => <div className="activity-row" key={listing.id}><Link to={`/listings/${listing.id}`}>{listing.title}</Link><strong>{listing._count.bids} bids</strong><small>{listing.status}</small></div>)}</ActivityList>
  </DashboardShell>;
}

function AdminDashboard({ user, error, loading, onBrowse }) {
  const [overview, setOverview] = useState(null);
  useEffect(() => { api.get("/admin/overview", { headers: headers() }).then(({ data: response }) => setOverview(response.data)).catch(() => {}); }, []);
  return <DashboardShell user={user} eyebrow="ADMIN CONTROL CENTER" intro="Manage the marketplace responsibly from one place." label="Administrator" accent="admin">
    {error && <p className="form-error">{error}</p>}
    <div className="dashboard-summary"><Stat value={loading || !overview ? "…" : overview.users} label="Users" /><Stat value={loading || !overview ? "…" : overview.openListings} label="Open auctions" /><Stat value={loading || !overview ? "…" : overview.pendingTransactions} label="Pending decisions" /></div>
    <div className="dashboard-grid"><DashboardAction icon="◎" title="User management" description="Review accounts, roles, and account status." action="Open admin console" onAction={onBrowse} /><DashboardAction icon="◫" title="Marketplace oversight" description="Review active listings and moderate exceptional cases." action="Review marketplace" onAction={onBrowse} /><DashboardAction icon="↗" title="Audit activity" description="Review administrative actions and platform events." action="View audit log" onAction={onBrowse} /></div>
    <ActivityList title="Recent administrative activity" empty="No administrative activity recorded.">{overview?.auditLogs?.slice(0, 5).map((log) => <div className="activity-row" key={log.id}><span>{log.action}</span><small>{log.actor.name} · {new Date(log.createdAt).toLocaleString()}</small></div>)}</ActivityList>
  </DashboardShell>;
}

function DashboardAction({ icon, title, description, action, onAction }) {
  return <article className="dashboard-card"><span className="dashboard-card-icon" aria-hidden="true">{icon}</span><h3>{title}</h3><p>{description}</p><button className="button button-outline" onClick={onAction}>{action}</button></article>;
}
