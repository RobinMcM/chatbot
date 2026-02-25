import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function LandingPage() {
  const [chatModes, setChatModes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/chat-modes')
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data?.chat_modes) ? data.chat_modes : [];
        setChatModes(list);
      })
      .catch(() => setChatModes([]))
      .finally(() => setLoading(false));
  }, []);

  const displayName = (m) => (m && typeof m === 'object' && m.displayName) ? m.displayName : (m?.id ?? m);

  return (
    <div className="landing-page">
      <header className="landing-page__header">
        <div className="landing-page__container">
          <h1 className="landing-page__logo">Advisory</h1>
          <nav className="landing-page__nav">
            <a href="#services" className="landing-page__nav-link">Services</a>
            <a href="#tools" className="landing-page__nav-link">Tools</a>
            <a href="#contact" className="landing-page__nav-link">Contact</a>
          </nav>
        </div>
      </header>

      <main>
        <section className="landing-page__hero">
          <div className="landing-page__container">
            <h2 className="landing-page__hero-title">Trusted advice for your business</h2>
            <p className="landing-page__hero-subline">
              Expert accountancy, audit, tax and advisory support to help you make confident decisions.
            </p>
          </div>
        </section>

        <section id="services" className="landing-page__section">
          <div className="landing-page__container">
            <h3 className="landing-page__section-title">Our services</h3>
            <ul className="landing-page__services">
              <li>Audit and assurance</li>
              <li>Tax planning and compliance</li>
              <li>Advisory and consulting</li>
              <li>Risk and compliance</li>
            </ul>
          </div>
        </section>

        <section className="landing-page__section landing-page__section--alt">
          <div className="landing-page__container">
            <h3 className="landing-page__section-title">What we stand for</h3>
            <ul className="landing-page__values">
              <li>Integrity and independence</li>
              <li>Clear, practical advice</li>
              <li>Client-focused partnership</li>
            </ul>
          </div>
        </section>

        <section id="tools" className="landing-page__section">
          <div className="landing-page__container">
            <h3 className="landing-page__section-title">Advisory tools</h3>
            <p className="landing-page__section-intro">
              Start a conversation on a topic below to get guidance.
            </p>
            {loading ? (
              <p className="landing-page__tools-loading">Loading…</p>
            ) : chatModes.length > 0 ? (
              <div className="landing-page__tools">
                {chatModes.map((m) => {
                  const id = typeof m === 'object' && m != null ? m.id : m;
                  const name = displayName(m);
                  return (
                    <Link key={id} to={`/${id}`} className="landing-page__tool-card">
                      {name}
                    </Link>
                  );
                })}
                <Link to="/view" className="landing-page__tool-card">View Chats</Link>
              </div>
            ) : (
              <p className="landing-page__tools-empty">No topics available.</p>
            )}
          </div>
        </section>

        <footer id="contact" className="landing-page__footer">
          <div className="landing-page__container">
            <p className="landing-page__footer-text">Get in touch</p>
            <p className="landing-page__footer-contact">
              For enquiries, please contact your usual adviser or use your preferred channel.
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
