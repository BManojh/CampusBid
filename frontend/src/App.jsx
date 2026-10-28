import axios from "axios";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { Link, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { RoleDashboard } from "./components/Dashboards";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";
const categories = ["Books", "Cycles", "Electronics", "Accessories", "Calculators"];

const api = axios.create({ baseURL: `${API_URL}/api` });

function effectiveRole(role) {
  return role === "STUDENT" ? "BUYER" : role;
}

function authHeaders() {
  const token = localStorage.getItem("campusbid_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function Countdown({ endsAt }) {
  const [remaining, setRemaining] = useState(() => Math.max(new Date(endsAt).getTime() - Date.now(), 0));
  useEffect(() => {
    const timer = window.setInterval(() => setRemaining(Math.max(new Date(endsAt).getTime() - Date.now(), 0)), 1000);
    return () => window.clearInterval(timer);
  }, [endsAt]);
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return <span className={`countdown ${remaining < 30000 ? "countdown-urgent" : ""}`}>{remaining ? `${days ? `${days}d ` : ""}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` : "Closed"}</span>;
}

function AuthModal({ mode, onClose, onModeChange, onAuthenticated }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "BUYER" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post(`/auth/${mode}`, mode === "login"
        ? { email: form.email, password: form.password }
        : form);
      onAuthenticated({ ...data.user, role: effectiveRole(data.user.role) }, data.token);
      onClose();
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? (
        requestError.response
          ? "Authentication failed. Please try again."
          : "The backend server is unavailable. Start the backend on port 5000 and try again."
      ));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close">×</button>
        <span className="eyebrow">{mode === "login" ? "WELCOME BACK" : "JOIN CAMPUSBID"}</span>
        <h2>{mode === "login" ? "Log in to CampusBid" : "Create your account"}</h2>
        <p className="modal-copy">Buy and sell campus essentials through fixed-deadline auctions.</p>
        <form className="modal-form" onSubmit={submit}>
          {mode === "register" && <label>Name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>}
          {mode === "register" && <label>Account type<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option value="BUYER">Buyer</option><option value="SELLER">Seller</option></select></label>}
          <label>Email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label>Password<input required minLength={8} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary modal-submit" disabled={busy}>{busy ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}</button>
        </form>
        <button className="modal-switch" type="button" onClick={() => { setError(""); onModeChange(mode === "login" ? "register" : "login"); }}>
          {mode === "login" ? "Need an account? Register" : "Already have an account? Log in"}
        </button>
      </section>
    </div>
  );
}

function Marketplace({ user, onLogin }) {
  const [listings, setListings] = useState([]);
  const [filters, setFilters] = useState({ search: "", category: "", condition: "", sort: "ending", page: 1 });
  const [pagination, setPagination] = useState({ pages: 1 });
  const [state, setState] = useState({ loading: true, error: "" });

  useEffect(() => {
    let active = true;
    setState({ loading: true, error: "" });
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
    api.get("/listings", { params }).then(({ data }) => {
      if (active) {
        setListings(data.data);
        setPagination(data.pagination ?? {
          page: filters.page,
          pages: 1,
          total: data.count ?? data.data.length,
        });
        setState({ loading: false, error: "" });
      }
    }).catch(() => active && setState({ loading: false, error: "Unable to load marketplace listings." }));
    return () => { active = false; };
  }, [filters]);

  return (
    <main>
      <section className="hero">
        <div className="hero-content">
          <span className="eyebrow">YOUR CAMPUS, YOUR MARKETPLACE</span>
          <h1>Great finds.<br /><span>Better bids.</span></h1>
          <p>Buy and sell pre-loved college essentials through transparent, manual bidding with fixed auction deadlines.</p>
          <div className="hero-actions"><a href="#marketplace" className="button button-primary">Explore auctions →</a>{(!user || user.role === "SELLER" || user.role === "ADMIN") && <Link className="button button-outline" to={user ? "/listings/new" : "#"} onClick={!user ? onLogin : undefined}>Start selling</Link>}</div>
        </div>
        <div className="hero-visual" aria-label="Campus marketplace illustration"><div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" /><div className="hero-product hero-book">📚</div><div className="hero-product hero-cycle">🚲</div><div className="hero-product hero-calc">🧮</div><div className="floating-label"><span className="live-dot" />Campus deals, happening now</div></div>
      </section>
      <section className="marketplace section" id="marketplace">
        <div className="section-heading"><div><span className="eyebrow">THE CAMPUS MARKET</span><h2>Discover your next find</h2><p>Search live listings from your campus community.</p></div><span className="item-count">{pagination.total ?? 0} items</span></div>
        <div className="market-tools"><label className="search-box"><span>⌕</span><input placeholder="Search title or description..." value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value, page: 1 })} /></label><label className="sort-control"><span>Sort:</span><select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value, page: 1 })}><option value="ending">Ending soon</option><option value="price-low">Price: Low to high</option></select></label></div>
        <div className="category-list"><button className={`category-chip ${!filters.category ? "selected" : ""}`} onClick={() => setFilters({ ...filters, category: "", page: 1 })}>All items</button>{categories.map((category) => <button key={category} className={`category-chip ${filters.category === category ? "selected" : ""}`} onClick={() => setFilters({ ...filters, category, page: 1 })}>{category}</button>)}</div>
        {state.loading && <p>Loading marketplace...</p>}{state.error && <p className="form-error">{state.error}</p>}
        {!state.loading && !state.error && listings.length === 0 && <div className="empty-state"><span>🔎</span><h3>No matching listings</h3><p>Try a different search or category.</p></div>}
        <div className="item-grid">{listings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}</div>
        {pagination.pages > 1 && <div className="pagination"><button className="button button-outline" disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Previous</button><span>Page {filters.page} of {pagination.pages}</span><button className="button button-outline" disabled={filters.page >= pagination.pages} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Next</button></div>}
      </section>
    </main>
  );
}

function ListingCard({ listing }) {
  const image = listing.images?.[0]?.url;
  return <article className="item-card"><div className="item-image lavender">{image ? <img src={image} alt="" /> : <span className="item-emoji">📦</span>}<span className="condition-badge">{listing.condition}</span></div><div className="item-details"><span className="item-category">{listing.category}</span><h3>{listing.title}</h3><div className="item-meta"><span><Countdown endsAt={listing.auctionEndsAt} /></span><span>{listing.bids} bids</span></div><div className="item-footer"><div><span className="price-label">Current bid</span><strong className="item-price">₹{listing.currentBid.toLocaleString("en-IN")}</strong></div><Link className="bid-button" to={`/listings/${listing.id}`}>View auction →</Link></div></div></article>;
}

function ListingDetail({ user, onLogin }) {
  const { listingId } = useParams();
  const [listing, setListing] = useState(null);
  const [bid, setBid] = useState("");
  const [maxBid, setMaxBid] = useState("");
  const [questions, setQuestions] = useState([]);
  const [question, setQuestion] = useState("");
  const [answerDrafts, setAnswerDrafts] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { api.get(`/listings/${listingId}`).then(({ data }) => setListing(data.data)).catch(() => setError("Listing not found.")); }, [listingId]);
  useEffect(() => { api.get(`/listings/${listingId}/questions`).then(({ data }) => setQuestions(data.data)).catch(() => {}); }, [listingId]);
  async function placeAutoBid(event) {
    event.preventDefault();
    if (!user) return onLogin();
    try {
      const { data } = await api.post(`/listings/${listingId}/auto-bid`, { maxAmount: maxBid }, { headers: authHeaders() });
      setMaxBid("");
      setMessage(`Automatic bidding is active up to ₹${data.data.maxAmount.toLocaleString("en-IN")}.`);
      setListing((current) => current ? { ...current, currentBid: data.data.amount, minimumNextBid: data.data.amount + current.minimumIncrement, auctionEndsAt: data.data.auctionEndsAt } : current);
    } catch (requestError) { setError(requestError.response?.data?.message ?? "Automatic bidding could not be enabled."); }
  }
  async function askQuestion(event) {
    event.preventDefault();
    try {
      const { data } = await api.post(`/listings/${listingId}/questions`, { body: question }, { headers: authHeaders() });
      setQuestions((current) => [...current, data.data]);
      setQuestion("");
    } catch (requestError) { setError(requestError.response?.data?.message ?? "Question could not be posted."); }
  }
  async function answerQuestion(id) {
    try {
      const { data } = await api.patch(`/questions/${id}`, { answer: answerDrafts[id] }, { headers: authHeaders() });
      setQuestions((current) => current.map((item) => item.id === id ? data.data : item));
      setAnswerDrafts((current) => ({ ...current, [id]: "" }));
    } catch (requestError) { setError(requestError.response?.data?.message ?? "Answer could not be saved."); }
  }
  useEffect(() => {
    if (!listingId || !user) return undefined;
    const socket = io(API_URL, { auth: { token: localStorage.getItem("campusbid_token") } });
    socket.emit("auction:join", listingId);
    socket.on("auction:bid", (event) => {
      if (event.listingId === listingId) {
        setListing((current) => current ? { ...current, currentBid: event.amount, minimumNextBid: event.amount + current.minimumIncrement, bids: current.bids + 1 } : current);
        if (event.auctionEndsAt) setListing((current) => current ? { ...current, auctionEndsAt: event.auctionEndsAt } : current);
      }
    });
    return () => { socket.emit("auction:leave", listingId); socket.disconnect(); };
  }, [listingId, user]);
  async function placeBid(event) {
    event.preventDefault();
    if (!user) return onLogin();
    try {
      const { data } = await api.post(`/listings/${listingId}/bids`, { amount: bid }, { headers: { ...authHeaders(), "Idempotency-Key": crypto.randomUUID() } });
      setMessage(`Bid accepted at ₹${data.data.amount.toLocaleString("en-IN")}.`);
      setBid("");
      setListing({ ...listing, currentBid: data.data.amount, minimumNextBid: data.data.amount + listing.minimumIncrement, bids: listing.bids + 1 });
    } catch (requestError) { setError(requestError.response?.data?.message ?? "Bid could not be accepted."); }
  }
  if (error) return <main className="section"><p className="form-error">{error}</p></main>;
  if (!listing) return <main className="section"><p>Loading listing...</p></main>;
  const isBuyer = effectiveRole(user?.role) === "BUYER";
  const image = listing.images?.[0]?.url;
  return <main className="detail-page section"><Link to="/">← Back to marketplace</Link><div className="detail-layout"><div><div className="detail-image">{image ? <img src={image} alt={listing.title} /> : "📦"}</div>{listing.images?.length > 1 && <div className="detail-thumbnails">{listing.images.map((item) => <img key={item.id} src={item.url} alt="" />)}</div>}</div><div><span className="eyebrow">{listing.category} · {listing.condition}</span><h1>{listing.title}</h1><p className="detail-description">{listing.description}</p><p>Listed by {listing.seller?.name ?? "Campus seller"}</p><div className="auction-countdown"><span>Time remaining</span><strong><Countdown endsAt={listing.auctionEndsAt} /></strong></div><div className="detail-price"><span>Current highest bid</span><strong>₹{listing.currentBid.toLocaleString("en-IN")}</strong><small>Minimum next bid: ₹{listing.minimumNextBid.toLocaleString("en-IN")}</small></div>{isBuyer ? <><form className="bid-form" onSubmit={placeBid}><input required inputMode="decimal" placeholder={`At least ₹${listing.minimumNextBid}`} value={bid} onChange={(event) => setBid(event.target.value)} /><button className="button button-primary">Place manual bid</button></form><form className="auto-bid-form" onSubmit={placeAutoBid}><label>Set an automatic maximum<input required inputMode="decimal" placeholder="e.g. 1800" value={maxBid} onChange={(event) => setMaxBid(event.target.value)} /></label><button className="button button-outline">Enable auto-bidding</button></form></> : <div className="bid-login-prompt">{user ? "Seller accounts cannot place bids." : "Log in as a buyer to place a manual bid."}</div>}{message && <p className="success-message">{message}</p>}{error && <p className="form-error">{error}</p>}<p className="auction-note">Valid bids in the final 30 seconds extend the auction by 60 seconds.</p></div></div><section className="questions-panel"><div className="section-heading"><div><span className="eyebrow">ASK BEFORE YOU BID</span><h2>Questions & answers</h2><p>Ask about condition, pickup, or anything else relevant to this item.</p></div></div>{user && <form className="question-form" onSubmit={askQuestion}><input required minLength="5" maxLength="500" placeholder="Ask the seller a clear question..." value={question} onChange={(event) => setQuestion(event.target.value)} /><button className="button button-primary">Post question</button></form>}<div className="question-list">{questions.length ? questions.map((item) => <article className="question-card" key={item.id}><strong>{item.author.name}</strong><p>{item.body}</p>{item.answer ? <div className="answer"><b>Seller answer</b><p>{item.answer}</p></div> : listing.seller?.id === user?.id && <div className="answer-form"><input placeholder="Write an answer..." value={answerDrafts[item.id] ?? ""} onChange={(event) => setAnswerDrafts((current) => ({ ...current, [item.id]: event.target.value }))} /><button className="button button-outline" onClick={() => answerQuestion(item.id)}>Answer</button></div>}</article>) : <p className="muted">No questions yet. Be the first to ask.</p>}</div></section></main>;
}

function CreateListing() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: "", description: "", category: categories[0], condition: "Good", startingPrice: "", minimumIncrement: "", auctionEndsAt: "" });
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [error, setError] = useState("");
  function chooseFiles(event) {
    const selected = Array.from(event.target.files ?? []).slice(0, 6);
    setFiles(selected);
    setPreviews(selected.map((file) => URL.createObjectURL(file)));
  }
  async function submit(event) {
    event.preventDefault();
    try {
      let imageUrls = [];
      if (files.length) {
        const upload = new FormData();
        files.forEach((file) => upload.append("images", file));
        const { data } = await api.post("/uploads", upload, { headers: authHeaders() });
        imageUrls = data.data.map((image) => image.url);
      }
      await api.post("/listings", { ...form, imageUrls }, { headers: authHeaders() });
      navigate("/dashboard");
    } catch (requestError) { setError(requestError.response?.data?.message ?? "Listing could not be created."); }
  }
  return <main className="section form-page"><span className="eyebrow">SELLER WORKSPACE</span><h1>Create a listing</h1><p>Give another student a useful second life for your item.</p><form className="listing-form" onSubmit={submit}><label>Title<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label>Description<textarea required minLength={10} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><div className="form-row"><label>Category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label>Condition<select value={form.condition} onChange={(event) => setForm({ ...form, condition: event.target.value })}>{["New", "Like New", "Good", "Fair"].map((condition) => <option key={condition}>{condition}</option>)}</select></label></div><div className="form-row"><label>Starting price (₹)<input required inputMode="decimal" value={form.startingPrice} onChange={(event) => setForm({ ...form, startingPrice: event.target.value })} /></label><label>Minimum increment (₹)<input required inputMode="decimal" value={form.minimumIncrement} onChange={(event) => setForm({ ...form, minimumIncrement: event.target.value })} /></label></div><label>Auction ends<input required type="datetime-local" value={form.auctionEndsAt} onChange={(event) => setForm({ ...form, auctionEndsAt: event.target.value })} /></label><label>Listing images<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={chooseFiles} /><small>{files.length ? `${files.length} image(s) selected` : "Optional: JPEG, PNG, or WebP up to 5 MB each."}</small></label>{previews.length > 0 && <div className="upload-preview-grid">{previews.map((src) => <img key={src} src={src} alt="Selected listing preview" />)}</div>}{error && <p className="form-error">{error}</p>}<button className="button button-primary">Publish listing</button></form></main>;
}

function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState("");
  async function load() {
    try { const { data } = await api.get("/transactions/mine", { headers: authHeaders() }); setTransactions(data.data); } catch { setError("Transactions could not be loaded."); }
  }
  useEffect(() => {
    load();
    const socket = io(API_URL, { auth: { token: localStorage.getItem("campusbid_token") } });
    socket.on("notification:new", load);
    return () => socket.disconnect();
  }, []);
  async function decide(id, decision) {
    try { await api.patch(`/transactions/${id}/decision`, { decision }, { headers: authHeaders() }); load(); } catch (requestError) { setError(requestError.response?.data?.message ?? "Decision could not be saved."); }
  }
  async function confirmHandover(id) {
    try { await api.patch(`/transactions/${id}/handover`, {}, { headers: authHeaders() }); load(); } catch (requestError) { setError(requestError.response?.data?.message ?? "Handover update could not be saved."); }
  }
  return <main className="section"><span className="eyebrow">MARKETPLACE ACTIVITY</span><h1>Transactions & handovers</h1>{error && <p className="form-error">{error}</p>}{transactions.length === 0 ? <div className="empty-state"><span>✓</span><h3>No transactions yet</h3><p>Completed auctions and accepted sales will appear here.</p></div> : <div className="transaction-list">{transactions.map((transaction) => <article className="transaction-card" key={transaction.id}><div><strong>{transaction.listing.title}</strong><p>Status: {transaction.status} · Seller decision: {transaction.sellerDecision}</p></div>{transaction.sellerDecision === "PENDING" && <div className="transaction-actions"><button className="button button-primary" onClick={() => decide(transaction.id, "ACCEPTED")}>Accept</button><button className="button button-outline" onClick={() => decide(transaction.id, "REJECTED")}>Reject</button></div>}{transaction.status === "ACCEPTED" || transaction.status === "HANDOVER_SCHEDULED" ? <button className="button button-outline" onClick={() => confirmHandover(transaction.id)}>Confirm handover</button> : null}</article>)}</div>}</main>;
}

function MyListings() {
  const [listings, setListings] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function load() {
    try {
      const { data } = await api.get("/listings/mine", { headers: authHeaders() });
      setListings(data.data);
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? "Your listings could not be loaded.");
    }
  }
  useEffect(() => { load(); }, []);
  async function cancelListing(id) {
    if (!window.confirm("Cancel this listing?")) return;
    try {
      await api.delete(`/listings/${id}`, { headers: authHeaders() });
      setMessage("Listing cancelled.");
      load();
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? "Listing could not be cancelled.");
    }
  }
  return <main className="section"><div className="section-heading"><div><span className="eyebrow">SELLER WORKSPACE</span><h1>My listings</h1><p>Manage your auctions, review bids, and open each listing to answer questions.</p></div><Link className="button button-primary" to="/listings/new">+ Create listing</Link></div>{error && <p className="form-error">{error}</p>}{message && <p className="success-message">{message}</p>}{listings.length === 0 ? <div className="empty-state"><span>◫</span><h3>No listings yet</h3><p>Create your first campus auction to start selling.</p></div> : <div className="seller-listing-grid">{listings.map((listing) => <article className="seller-listing-card" key={listing.id}>{listing.images?.[0]?.url ? <img src={listing.images[0].url} alt="" /> : <div className="seller-listing-placeholder">📦</div>}<div className="seller-listing-content"><span className="item-category">{listing.category}</span><h3>{listing.title}</h3><p>{listing._count?.bids ?? listing.bids ?? 0} bids · Current ₹{listing.currentBid.toLocaleString("en-IN")}</p><span className={`status-pill status-${listing.status.toLowerCase()}`}>{listing.status}</span><div className="seller-listing-actions"><Link className="button button-outline" to={`/listings/${listing.id}`}>View auction</Link>{listing.status === "OPEN" && (listing._count?.bids ?? listing.bids ?? 0) === 0 && <button className="button button-outline" onClick={() => cancelListing(listing.id)}>Cancel</button>}</div></div></article>)}</div>}</main>;
}

function Profile() {
  const [profile, setProfile] = useState(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => { api.get("/users/me", { headers: authHeaders() }).then(({ data }) => { setProfile(data.data); setName(data.data.name); }); }, []);
  async function save(event) {
    event.preventDefault();
    const { data } = await api.patch("/users/me", { name }, { headers: authHeaders() });
    setProfile(data.data);
    localStorage.setItem("campusbid_user", JSON.stringify(data.data));
    setMessage("Profile updated.");
  }

  return <main className="section form-page"><span className="eyebrow">YOUR ACCOUNT</span><h1>Profile</h1>{profile && <form className="listing-form" onSubmit={save}><label>Name<input value={name} onChange={(event) => setName(event.target.value)} /></label><label>Email<input value={profile.email} readOnly /></label><label>Role<input value={profile.role} readOnly /></label><button className="button button-primary">Save profile</button>{message && <p className="success-message">{message}</p>}</form>}</main>;
}

function SavedSearches() {
  const [searches, setSearches] = useState([]);
  const [form, setForm] = useState({ name: "", query: "", category: "", maxPrice: "" });
  const [error, setError] = useState("");
  async function load() {
    try { const { data } = await api.get("/saved-searches", { headers: authHeaders() }); setSearches(data.data); } catch { setError("Saved searches could not be loaded."); }
  }
  useEffect(() => { load(); }, []);
  async function save(event) {
    event.preventDefault();
    try { await api.post("/saved-searches", form, { headers: authHeaders() }); setForm({ name: "", query: "", category: "", maxPrice: "" }); load(); } catch (requestError) { setError(requestError.response?.data?.message ?? "Saved search could not be created."); }
  }
  async function remove(id) {
    try { await api.delete(`/saved-searches/${id}`, { headers: authHeaders() }); setSearches((current) => current.filter((item) => item.id !== id)); } catch (requestError) { setError(requestError.response?.data?.message ?? "Saved search could not be deleted."); }
  }
  return <main className="section form-page"><span className="eyebrow">NEVER MISS WHAT YOU NEED</span><h1>Saved searches</h1><p>Save a need once and keep it ready for the next matching campus listing.</p><form className="saved-search-form" onSubmit={save}><input required placeholder="Search name, e.g. Scientific calculator" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /><input placeholder="Words to match" value={form.query} onChange={(event) => setForm({ ...form, query: event.target.value })} /><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option value="">Any category</option>{categories.map((category) => <option key={category}>{category}</option>)}</select><input inputMode="decimal" placeholder="Max price ₹" value={form.maxPrice} onChange={(event) => setForm({ ...form, maxPrice: event.target.value })} /><button className="button button-primary">Save search</button></form>{error && <p className="form-error">{error}</p>}<div className="saved-search-list">{searches.map((item) => <article className="saved-search-card" key={item.id}><div><strong>{item.name}</strong><p>{item.query || "Any item"} · {item.category || "Any category"}{item.maxPricePaise ? ` · Up to ₹${(item.maxPricePaise / 100).toLocaleString("en-IN")}` : ""}</p></div><button className="button button-outline" onClick={() => remove(item.id)}>Remove</button></article>)}{!searches.length && <div className="empty-state"><span>⌕</span><h3>No saved searches yet</h3><p>Create one for the things you are waiting to find.</p></div>}</div></main>;
}

function AdminConsole() {
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState("");
  async function load() {
    const { data } = await api.get("/admin/users", { headers: authHeaders() });
    setUsers(data.data);
  }
  useEffect(() => { load().catch(() => setMessage("Admin data could not be loaded.")); }, []);
  async function changeStatus(id, status) {
    try {
      await api.patch(`/admin/users/${id}/status`, { status, reason: "Admin console action" }, { headers: authHeaders() });
      setMessage("Account status updated.");
      load();
    } catch (requestError) { setMessage(requestError.response?.data?.message ?? "Status update failed."); }
  }
  return <main className="section"><span className="eyebrow">ADMINISTRATION</span><h1>Account oversight</h1>{message && <p className="form-error">{message}</p>}<div className="transaction-list">{users.map((account) => <article className="transaction-card" key={account.id}><div><strong>{account.name}</strong><p>{account.email} · {account.role} · {account.accountStatus}</p></div>{account.accountStatus === "ACTIVE" ? <button className="button button-outline" onClick={() => changeStatus(account.id, "SUSPENDED")}>Suspend</button> : <button className="button button-primary" onClick={() => changeStatus(account.id, "ACTIVE")}>Reactivate</button>}</article>)}</div></main>;
}

function Protected({ user, children, roles }) {
  if (!user) return <Navigate to="/" replace />;
  if (roles && !roles.includes(user.role)) return <main className="section"><h1>Access denied</h1><p>This workspace is not available for your account.</p></main>;
  return children;
}

function App() {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = JSON.parse(localStorage.getItem("campusbid_user"));
      return savedUser ? { ...savedUser, role: effectiveRole(savedUser.role) } : null;
    } catch {
      return null;
    }
  });
  const [authMode, setAuthMode] = useState(null);
  const navigate = useNavigate();
  function authenticated(nextUser, token) { const normalizedUser = { ...nextUser, role: effectiveRole(nextUser.role) }; setUser(normalizedUser); localStorage.setItem("campusbid_user", JSON.stringify(normalizedUser)); localStorage.setItem("campusbid_token", token); navigate("/dashboard"); }
  function logout() { setUser(null); localStorage.removeItem("campusbid_user"); localStorage.removeItem("campusbid_token"); navigate("/"); }
  return <div className="app"><header className="navbar"><Link className="brand" to="/"><span className="brand-icon">C</span>Campus<span className="brand-highlight">Bid</span></Link><nav className="nav-links"><Link to="/">Browse items</Link>{user && <Link to="/dashboard">Dashboard</Link>}{user && <Link to="/transactions">Transactions</Link>}{user && <Link to="/notifications">Notifications</Link>}{user?.role === "BUYER" && <Link to="/saved-searches">Saved searches</Link>}{user && <Link to="/profile">Profile</Link>}{user?.role === "ADMIN" && <Link to="/admin">Admin</Link>}</nav><div className="nav-actions">{user ? <><span className="nav-user">{user.name} · {user.role}</span>{(user.role === "SELLER" || user.role === "ADMIN") && <Link className="button button-outline" to="/listings/new">+ Sell an item</Link>}<button className="button button-primary" onClick={logout}>Log out</button></> : <button className="button button-primary" onClick={() => setAuthMode("login")}>Log in</button>}</div></header><Routes><Route path="/" element={<Marketplace user={user} onLogin={() => setAuthMode("login")} />} /><Route path="/listings/:listingId" element={<ListingDetail user={user} onLogin={() => setAuthMode("login")} />} /><Route path="/listings/new" element={<Protected user={user} roles={["SELLER", "ADMIN"]}><CreateListing /></Protected>} /><Route path="/dashboard" element={<Protected user={user}><RoleDashboard user={user} onBrowse={() => navigate("/")} onListings={() => navigate("/my-listings")} onCreateListing={() => navigate("/listings/new")} onTransactions={() => navigate("/transactions")} onNotifications={() => navigate("/notifications")} /></Protected>} /><Route path="/transactions" element={<Protected user={user}><Transactions /></Protected>} /><Route path="/my-listings" element={<Protected user={user} roles={["SELLER", "ADMIN"]}><MyListings /></Protected>} /><Route path="/notifications" element={<Protected user={user}><Notifications /></Protected>} /><Route path="/saved-searches" element={<Protected user={user} roles={["BUYER"]}><SavedSearches /></Protected>} /><Route path="/profile" element={<Protected user={user}><Profile /></Protected>} /><Route path="/admin" element={<Protected user={user} roles={["ADMIN"]}><AdminConsole /></Protected>} /><Route path="*" element={<main className="section"><h1>Page not found</h1><Link to="/">Return to marketplace</Link></main>} /></Routes><footer className="footer"><span>CampusBid · Fixed-deadline campus auctions</span><span>Payments and delivery are coordinated separately by users.</span></footer>{authMode && <AuthModal mode={authMode} onClose={() => setAuthMode(null)} onModeChange={setAuthMode} onAuthenticated={authenticated} />}</div>;
}

function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState("");
  async function load() {
    try {
      const { data } = await api.get("/notifications", { headers: authHeaders() });
      setNotifications(data.data);
    } catch {
      setError("Notifications could not be loaded.");
    }
  }
  useEffect(() => {
    load();
    const socket = io(API_URL, { auth: { token: localStorage.getItem("campusbid_token") } });
    socket.on("notification:new", load);
    return () => socket.disconnect();
  }, []);
  async function markRead(id) {
    try {
      await api.patch(`/notifications/${id}/read`, {}, { headers: authHeaders() });
      setNotifications((current) => current.map((notification) => notification.id === id ? { ...notification, readAt: new Date().toISOString() } : notification));
    } catch { setError("Notification could not be marked as read."); }
  }
  async function markAllRead() {
    try {
      await api.patch("/notifications/read-all", {}, { headers: authHeaders() });
      setNotifications((current) => current.map((notification) => ({ ...notification, readAt: new Date().toISOString() })));
    } catch { setError("Notifications could not be marked as read."); }
  }
  return <main className="section"><div className="section-heading"><div><span className="eyebrow">YOUR ACTIVITY</span><h1>Notifications</h1><p>Private updates for your bids, listings, auctions, and handovers.</p></div>{notifications.some((notification) => !notification.readAt) && <button className="button button-outline" onClick={markAllRead}>Mark all as read</button>}</div>{error && <p className="form-error">{error}</p>}{notifications.length === 0 ? <div className="empty-state"><span>✓</span><h3>You're all caught up</h3><p>Important auction and transaction updates will appear here.</p></div> : <div className="notification-list">{notifications.map((notification) => <article className={`notification ${notification.readAt ? "" : "notification-unread"}`} key={notification.id}><div><strong>{notification.title}</strong><p>{notification.message}</p><small>{new Date(notification.createdAt).toLocaleString()}</small></div>{!notification.readAt && <button className="button button-outline" onClick={() => markRead(notification.id)}>Mark read</button>}</article>)}</div>}</main>;
}

export default App;
