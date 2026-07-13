import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { getJoinedRooms, getMyRooms } from '../api';
import { useAuth } from '../context/AuthContext';
import '../styles/home.css';

export default function Home() {
  const navigate = useNavigate();
  const rollRef = useRef(null);
  const { token, user, logout } = useAuth();
  const [allocatedRooms, setAllocatedRooms] = useState([]);
  const isStudentView = user?.role === 'Member' || user?.role === 'GroupLeader';

  useEffect(() => {
    document.title = 'Taskify - Who actually did the work';
  }, []);

  useEffect(() => {
    let mounted = true;

    const hydrateAllocations = async () => {
      if (!token) {
        if (mounted) {
          setAllocatedRooms([]);
        }
        return;
      }

      try {
        const rooms = isStudentView ? await getJoinedRooms(token) : await getMyRooms(token);
        if (mounted) {
          setAllocatedRooms(rooms);
        }
      } catch (_error) {
        if (mounted) {
          setAllocatedRooms([]);
        }
      }
    };

    hydrateAllocations();

    return () => {
      mounted = false;
    };
  }, [token, isStudentView]);

  const rollCall = [
    { name: 'A. Wanjiru', task: 'API integration', status: 'done' },
    { name: 'B. Otieno', task: 'Literature review', status: 'done' },
    { name: 'C. Mwangi', task: 'Database schema', status: 'progress' },
    { name: 'D. Njoroge', task: 'UI wireframes', status: 'flag' },
    { name: 'E. Achieng', task: 'Peer review summary', status: 'done' },
    { name: 'F. Kiplagat', task: 'Testing report', status: 'progress' },
  ];

  return (
    <div className="home">
      <header className="home-nav">
        <div className="home-nav-inner">
          <div className="home-brand">
            <img src="/logo_sidebar.jpeg" alt="Taskify logo" className="brand-logo" />
            <span className="brand-word">Taskify</span>
          </div>
          <nav className="home-nav-links">
            <a href="#how">How it works</a>
            <a href="#ledger">The ledger</a>
            <a href="#trust">Why it is fair</a>
          </nav>
          {!user ? (
            <div className="home-nav-actions">
              <button className="ghost-btn" onClick={() => navigate('/login')}>Sign in</button>
              <button className="solid-btn" onClick={() => navigate('/login')}>Get started</button>
            </div>
          ) : (
            <div className="home-nav-actions">
              <button className="ghost-btn" onClick={() => navigate('/dashboard')}>Dashboard</button>
              <button
                className="solid-btn"
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      {user && (
        <section style={{ padding: '16px 20px 0' }}>
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-title">My Allocation Status</div>
            <div className="page-sub" style={{ marginBottom: '8px' }}>
              Group: {user.groupName || 'Not set yet'}
            </div>
            <div className="page-sub" style={{ marginBottom: '10px' }}>
              {isStudentView ? 'Rooms allocated' : 'Rooms created'}: {allocatedRooms.length}
            </div>
            {allocatedRooms.length > 0 ? (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {allocatedRooms.slice(0, 6).map((room) => (
                  <span key={room.roomID} className="badge badge-blue">
                    {room.unitCode} - {room.unitName}
                  </span>
                ))}
              </div>
            ) : (
              <div className="alert-banner alert-warning" style={{ marginBottom: 0 }}>
                {isStudentView
                  ? 'You are logged in, but no room has been allocated to your account yet.'
                  : 'You are logged in, but you have not created any rooms yet.'}
              </div>
            )}
            <div style={{ marginTop: '12px' }}>
              <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
                Open Dashboard
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="hero" id="ledger">
        <div className="hero-paper" />
        <div className="hero-inner">
          <div className="hero-left">
            <p className="hero-eyebrow">For Strathmore group projects</p>
            <h1 className="hero-title">
              Every group has
              <br />
              <span className="hero-strike">one person</span>
              <br />
              who did the work.
            </h1>
            <p className="hero-sub">
              Taskify keeps the receipts. Tasks, edits, and peer ratings are logged the moment
              they happen so when grading time comes, nobody has to guess who carried the project.
            </p>
            <div className="hero-actions">
              {!user ? (
                <button className="solid-btn lg" onClick={() => navigate('/login')}>
                  Start a project
                </button>
              ) : (
                <button className="solid-btn lg" onClick={() => navigate('/dashboard')}>
                  Open dashboard
                </button>
              )}
              <a href="#ledger" className="text-link">See the ledger</a>
            </div>
          </div>

          <div className="hero-right">
            <div className="ledger-card" ref={rollRef}>
              <div className="ledger-head">
                <span>WEB APP REDESIGN - GROUP 4</span>
                <span className="ledger-live">* live</span>
              </div>
              <div className="ledger-rows">
                {rollCall.map((r, i) => (
                  <div className={`ledger-row status-${r.status}`} key={i}>
                    <span className="ledger-tick">
                      {r.status === 'done' ? 'OK' : r.status === 'flag' ? '!' : '...'}
                    </span>
                    <span className="ledger-name">{r.name}</span>
                    <span className="ledger-task">{r.task}</span>
                    <span className="ledger-status">{r.status}</span>
                  </div>
                ))}
              </div>
              <div className="ledger-foot">4 of 6 contributing, 1 flagged for review</div>
            </div>
          </div>
        </div>
      </section>

      <section className="how" id="how">
        <div className="how-inner">
          <h2 className="section-title">Three things happen automatically.</h2>
          <div className="how-grid">
            <div className="how-item">
              <div className="how-mark">Tracked</div>
              <h3>Every task, timestamped</h3>
              <p>
                When a member updates a task, that update is logged against their name, not the
                group. No more "we all worked on it."
              </p>
            </div>
            <div className="how-item">
              <div className="how-mark">Rated</div>
              <h3>Peers weigh in, quietly</h3>
              <p>
                The group leader rates contribution anonymously. Supervisors see the pattern,
                not who said what.
              </p>
            </div>
            <div className="how-item">
              <div className="how-mark">Flagged</div>
              <h3>Loafing gets noticed</h3>
              <p>
                If someone's score drops below the line, their supervisor hears about it before
                the deadline, not after.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="trust" id="trust">
        <div className="trust-inner">
          <div className="trust-text">
            <h2 className="section-title light">
              This is not surveillance.
              <br />
              It is a paper trail.
            </h2>
            <p>
              Taskify does not watch your screen or count keystrokes. It records what you submit,
              when you submit it, and what your group leader rated, the same evidence a fair grader
              would want to see anyway.
            </p>
            <ul className="trust-list">
              <li>Passwords hashed, never stored in plain text</li>
              <li>Peer ratings are anonymous to the people being rated</li>
              <li>Only supervisors see the full contribution breakdown</li>
            </ul>
          </div>
          <div className="trust-quote">
            <p>"I finally had proof I did 80% of the work, not just a feeling."</p>
          </div>
        </div>
      </section>

      <section className="cta">
        <h2>Stop wondering who did what.</h2>
        <button className="solid-btn lg" onClick={() => navigate('/login')}>
          Create your first project
        </button>
      </section>

      <footer className="home-footer">
        <span>Taskify - Built for Strathmore University</span>
      </footer>
    </div>
  );
}
