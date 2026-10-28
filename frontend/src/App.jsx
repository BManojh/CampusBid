
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

function App() {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Items");
  const [sortBy, setSortBy] = useState("ending");

  useEffect(() => {
    async function loadListings() {
      try {
        const response = await axios.get("http://localhost:5000/api/listings");
        setItems(
          response.data.data.map((listing) => ({
            ...listing,
            price: listing.currentBid ?? listing.startingPrice,
            bids: listing.bidCount ?? 0,
            timeLeft: listing.timeLeft ?? "Auction time unavailable",
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
      result.sort((a, b) => a.timeLeft.localeCompare(b.timeLeft));
    }

    return result;
  }, [items, search, category, sortBy]);

  function handleSellClick() {
    alert("The Sell an Item form will be added in a later step.");
  }

  function handleBidClick(item) {
    alert(
      `You selected "${item.title}". Login and live bidding will be connected in a later step.`
    );
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
          <button className="button button-outline" onClick={handleSellClick}>
            + Sell an Item
          </button>
          <button
            className="button button-primary"
            onClick={() => alert("Login and registration will be added later.")}
          >
            Login
          </button>
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
              <button className="button button-outline" onClick={handleSellClick}>
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
                  <button
                    className="favorite-button"
                    aria-label={`Save ${item.title}`}
                    onClick={() => alert("Watchlist functionality will be added later.")}
                  >
                    ♡
                  </button>
                </div>

                <div className="item-details">
                  <span className="item-category">{item.category}</span>
                  <h3>{item.title}</h3>

                  <div className="item-meta">
                    <span>◷ {item.timeLeft}</span>
                    <span>{item.bids} bids</span>
                  </div>

                  <div className="item-footer">
                    <div>
                      <span className="price-label">Current bid</span>
                      <strong className="item-price">
                        ₹{item.price.toLocaleString("en-IN")}
                      </strong>
                    </div>
                    <button
                      className="bid-button"
                      onClick={() => handleBidClick(item)}
                    >
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
    </div>
  );
}

export default App;
