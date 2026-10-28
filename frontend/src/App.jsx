
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import "./App.css";

const categories = [
  "All Items",
  "Books",
  "Cycles",
  "Electronics",
  "Accessories",
  "Calculators",
];

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

function getTimeLeft(auctionEndsAt, now) {
  if (now === null) {
    return "Calculating...";
  }

  const remainingMs = new Date(auctionEndsAt).getTime() - now;

  if (remainingMs <= 0) {
    return "Ended";
  }

  const totalMinutes = Math.floor(remainingMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

function AuthModal({ mode, onClose, onModeChange, onAuthenticated }) {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const endpoint = mode === "login" ? "login" : "register";
      const response = await axios.post(`${API_URL}/api/auth/${endpoint}`, form);
      onAuthenticated(response.data.user);
      onClose();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ??
          "Authentication failed. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
        <span className="eyebrow">{mode === "login" ? "WELCOME BACK" : "JOIN CAMPUSBID"}</span>
        <h2 id="auth-title">{mode === "login" ? "Log in to CampusBid" : "Create your account"}</h2>
        <p className="modal-copy">
          {mode === "login"
            ? "Sign in to bid, sell, and manage your campus activity."
            : "Use your student account details to get started."}
        </p>
        <form className="modal-form" onSubmit={handleSubmit}>
          {mode === "register" && (
            <label>
              Name
              <input
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>
          )}
          <label>
            Email
            <input
              required
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </label>
          <label>
            Password
            <input
              required
              minLength={8}
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary modal-submit" disabled={isSubmitting}>
            {isSubmitting ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>
        <button
          className="modal-switch"
          type="button"
          onClick={() => {
            setError("");
            onModeChange(mode === "login" ? "register" : "login");
          }}
        >
          {mode === "login"
            ? "Need an account? Register"
            : "Already have an account? Log in"}
        </button>
      </section>
    </div>
  );
}

function App() {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Items");
  const [sortBy, setSortBy] = useState("ending");
  const [authMode, setAuthMode] = useState(null);
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("campusbid_user"));
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const initialUpdate = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => {
      window.clearTimeout(initialUpdate);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    async function loadListings() {
      try {
        const response = await axios.get(`${API_URL}/api/listings`);
        setItems(
          response.data.data.map((listing) => ({
            ...listing,
            price: listing.currentBid ?? listing.startingPrice,
            bids: listing.bids ?? 0,
            emoji: listing.emoji ?? "📦",
            color: listing.color ?? "lavender",
          }))
        );
      } catch {
        setError("Unable to load marketplace items. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }

    loadListings();
  }, []);

  const filteredItems = useMemo(() => {
    const result = items.filter((item) => {
      const matchesSearch =
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.category.toLowerCase().includes(search.toLowerCase());

      const matchesCategory =
        category === "All Items" || item.category === category;

      return matchesSearch && matchesCategory;
    });

    if (sortBy === "price-low") {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === "price-high") {
      result.sort((a, b) => b.price - a.price);
    } else {
      result.sort(
        (a, b) =>
          new Date(a.auctionEndsAt).getTime() -
          new Date(b.auctionEndsAt).getTime()
      );
    }

    return result;
  }, [items, search, category, sortBy]);

  function handleAuthenticated(nextUser) {
    setUser(nextUser);
    localStorage.setItem("campusbid_user", JSON.stringify(nextUser));
  }

  return (
    <div className="app">
      <header className="navbar">
        <a className="brand" href="#home">
          <span className="brand-icon">C</span>
          Campus<span className="brand-highlight">Bid</span>
        </a>

        <nav className="nav-links">
          <a className="nav-active" href="#home">Home</a>
          <a href="#marketplace">Browse Items</a>
          <a href="#how-it-works">How It Works</a>
        </nav>

        <div className="nav-actions">
          <button className="button button-outline" onClick={() => setAuthMode("login")}>
            + Sell an Item
          </button>
          {user ? (
            <button
              className="button button-primary"
              onClick={() => {
                setUser(null);
                localStorage.removeItem("campusbid_user");
              }}
            >
              Log out
            </button>
          ) : (
            <button className="button button-primary" onClick={() => setAuthMode("login")}>
              Login
            </button>
          )}
        </div>
      </header>

      <main id="home">
        <section className="hero">
          <div className="hero-content">
            <span className="eyebrow">YOUR CAMPUS, YOUR MARKETPLACE</span>
            <h1>
              Great finds.
              <br />
              <span>Better bids.</span>
            </h1>
            <p>
              Buy and sell pre-loved college essentials. Find what you need,
              place your bid, and give useful things a second life.
            </p>

            <div className="hero-actions">
              <a href="#marketplace" className="button button-primary">
                Explore Auctions <span aria-hidden="true">→</span>
              </a>
              <button className="button button-outline" onClick={() => setAuthMode("login")}>
                Start Selling
              </button>
            </div>

            <div className="hero-note">
              <span className="note-icon">✓</span>
              Made for campus communities
            </div>
          </div>

          <div className="hero-visual" aria-label="Campus marketplace illustration">
            <div className="hero-orbit orbit-one" />
            <div className="hero-orbit orbit-two" />
            <div className="hero-product hero-book">📚</div>
            <div className="hero-product hero-cycle">🚲</div>
            <div className="hero-product hero-calc">🧮</div>
            <div className="floating-label">
              <span className="live-dot" />
              Campus deals, happening now
            </div>
            <div className="hero-sticker">BUY SMART.<br />SELL EASY.</div>
          </div>
        </section>

        <section className="stats">
          <div><strong>Student-first</strong><span>Designed for campus life</span></div>
          <div><strong>Open bidding</strong><span>Transparent bid history planned</span></div>
          <div><strong>Second life</strong><span>Reuse more, waste less</span></div>
        </section>

        <section className="marketplace section" id="marketplace">
          <div className="section-heading">
            <div>
              <span className="eyebrow">THE CAMPUS MARKET</span>
              <h2>Discover your next find</h2>
              <p>Explore items listed by your campus community.</p>
            </div>
            <span className="item-count">{filteredItems.length} items</span>
          </div>

          <div className="market-tools">
            <label className="search-box">
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                placeholder="Search books, cycles, electronics..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search auction items"
              />
            </label>

            <label className="sort-control">
              <span>Sort:</span>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="ending">Ending soon</option>
                <option value="price-low">Price: Low to high</option>
                <option value="price-high">Price: High to low</option>
              </select>
            </label>
          </div>

          <div className="category-list" aria-label="Filter by category">
            {categories.map((name) => (
              <button
                key={name}
                className={`category-chip ${category === name ? "selected" : ""}`}
                onClick={() => setCategory(name)}
                aria-pressed={category === name}
              >
                {name}
              </button>
            ))}
          </div>

          <div className="item-grid">
            {isLoading && <p>Loading marketplace items...</p>}

            {!isLoading && error && <p role="alert">{error}</p>}

            {!isLoading &&
              !error &&
              filteredItems.map((item) => (
              <article className="item-card" key={item.id}>
                <div className={`item-image ${item.color}`}>
                  <span className="item-emoji" role="img" aria-label={item.category}>
                    {item.emoji}
                  </span>
                  <span className="condition-badge">{item.condition}</span>
                </div>

                <div className="item-details">
                  <span className="item-category">{item.category}</span>
                  <h3>{item.title}</h3>

                  <div className="item-meta">
                    <span>◷ {getTimeLeft(item.auctionEndsAt, now)}</span>
                    <span>{item.bids} bids</span>
                  </div>

                  <div className="item-footer">
                    <div>
                      <span className="price-label">Current bid</span>
                      <strong className="item-price">
                        ₹{item.price.toLocaleString("en-IN")}
                      </strong>
                    </div>
                    <button className="bid-button" onClick={() => setAuthMode("login")}>
                      View auction →
                    </button>
                  </div>
                </div>
              </article>
              ))}
          </div>

          {!isLoading && !error && filteredItems.length === 0 && (
            <div className="empty-state">
              <span>🔎</span>
              <h3>No matching items</h3>
              <p>Try another search or select a different category.</p>
              <button
                className="button button-outline"
                onClick={() => {
                  setSearch("");
                  setCategory("All Items");
                }}
              >
                Clear filters
              </button>
            </div>
          )}
        </section>

        <section className="how-section section" id="how-it-works">
          <span className="eyebrow">SIMPLE BY DESIGN</span>
          <h2>Your next deal in three steps</h2>
          <div className="how-grid">
            <article><span>01</span><h3>Find an item</h3><p>Browse second-hand essentials listed by fellow students.</p></article>
            <article><span>02</span><h3>Place your bid</h3><p>Follow the auction and make a valid, competitive bid.</p></article>
            <article><span>03</span><h3>Meet and collect</h3><p>Coordinate with the seller and confirm the campus handover.</p></article>
          </div>
        </section>
      </main>

      <footer className="footer">
        <a className="brand" href="#home">
          <span className="brand-icon">C</span>
          Campus<span className="brand-highlight">Bid</span>
        </a>
        <p>A smarter way to exchange essentials on campus.</p>
        <span>CampusBid · Project prototype</span>
      </footer>
      {authMode && (
        <AuthModal
          mode={authMode}
          onClose={() => setAuthMode(null)}
          onModeChange={setAuthMode}
          onAuthenticated={handleAuthenticated}
        />
      )}
    </div>
  );
}

export default App;
