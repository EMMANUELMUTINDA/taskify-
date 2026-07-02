import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getProjects, getUsers, getProjectMembers, submitReview, getReviews } from '../api';
import Sidebar from '../components/Sidebar';

export default function PeerReview() {
  const { token, user, isAdmin: isSupervisor } = useAuth();
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [form, setForm] = useState({ reviewedUserID: '', rating: 0, comment: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const hasProjects = projects.length > 0;
  const hasReviewTargets = users.length > 0;

  useEffect(() => {
    let isMounted = true;

    getProjects(token)
      .then((data) => {
        if (!isMounted) {
          return;
        }

        setProjects(data);
        if (data.length > 0) {
          setSelectedProject(String(data[0].projectID));
        }
      })
      .catch(() => {
        if (isMounted) {
          setProjects([]);
          setSelectedProject('');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token, user?.userID]);

  useEffect(() => {
    let isMounted = true;

    if (!selectedProject) {
      setUsers([]);
      setForm((prev) => ({ ...prev, reviewedUserID: '' }));
      return () => {
        isMounted = false;
      };
    }

    getProjectMembers(selectedProject, token)
      .then((data) => {
        if (!isMounted) {
          return;
        }

        const filtered = data.filter((u) => Number(u.userID) !== Number(user?.userID));
        setUsers(filtered);
        setForm((prev) => ({
          ...prev,
          reviewedUserID: filtered.some((u) => String(u.userID) === String(prev.reviewedUserID))
            ? prev.reviewedUserID
            : '',
        }));
      })
      .catch(async () => {
        try {
          const allUsers = await getUsers(token);
          if (!isMounted) {
            return;
          }

          const filtered = allUsers.filter((u) => Number(u.userID) !== Number(user?.userID));
          setUsers(filtered);
        } catch (_error) {
          if (isMounted) {
            setUsers([]);
          }
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedProject, token, user?.userID]);

  useEffect(() => {
    let isMounted = true;

    if (selectedProject) {
      getReviews(selectedProject, token)
        .then((data) => {
          if (!isMounted) {
            return;
          }

          const visible = isSupervisor
            ? data
            : data.filter((r) => Number(r.reviewedUserID) === Number(user?.userID));
          setReviews(visible);
        })
        .catch(() => {
          if (isMounted) {
            setReviews([]);
          }
        });
    }

    return () => {
      isMounted = false;
    };
  }, [selectedProject, token, isSupervisor, user?.userID]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');

    if (!form.rating) {
      setError('Please select a star rating');
      return;
    }

    if (!form.reviewedUserID) {
      setError('Please select a member to review');
      return;
    }

    try {
      const res = await submitReview(
        {
          ...form,
          projectID: selectedProject,
          reviewerID: user?.userID || null,
        },
        token
      );

      if (res.message === 'Peer review submitted') {
        setMsg('Review submitted successfully');
        setForm({ reviewedUserID: '', rating: 0, comment: '' });

        const refreshed = await getReviews(selectedProject, token);
        const visible = isSupervisor
          ? refreshed
          : refreshed.filter((r) => Number(r.reviewedUserID) === Number(user?.userID));
        setReviews(visible);
      } else {
        setError(res.message || 'Error submitting review');
      }
    } catch (submitError) {
      setError(submitError.message || 'Could not submit review');
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <div>
            <div className="page-title">Peer Review</div>
            <div className="page-sub">Rate your group members anonymously</div>
          </div>
          <select
            className="form-control"
            style={{ width: '220px' }}
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            disabled={!hasProjects}
          >
            {!hasProjects && <option value="">No projects available</option>}
            {projects.map((p) => (
              <option key={p.projectID} value={p.projectID}>
                {p.title}
              </option>
            ))}
          </select>
        </div>

        <div className="review-grid">
          <div className="card">
            <div className="card-title">Submit Review</div>
            <p className="review-note">
              Your identity is anonymous. Ratings are only visible to supervisors.
            </p>

            {msg && <div className="alert-banner alert-success">Success: {msg}</div>}
            {error && <div className="alert-banner alert-danger">Warning: {error}</div>}
            {!hasProjects && (
              <div className="alert-banner alert-warning">
                You are not assigned to any project yet. Join a project to use peer review.
              </div>
            )}
            {hasProjects && !hasReviewTargets && (
              <div className="alert-banner alert-warning">
                No teammates found in this project to review yet.
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Select Member *</label>
                <select
                  className="form-control"
                  value={form.reviewedUserID}
                  onChange={(e) => setForm({ ...form, reviewedUserID: e.target.value })}
                  disabled={!hasProjects || !hasReviewTargets}
                  required
                >
                  <option value="">Choose a member</option>
                  {users.map((u) => (
                    <option key={u.userID} value={u.userID}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Rating *</label>
                <div className="star-rating">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={`star ${form.rating >= star ? 'filled' : ''}`}
                      onClick={() => setForm({ ...form, rating: star })}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <div className="rating-helper">
                  {form.rating === 1
                    ? 'Poor'
                    : form.rating === 2
                      ? 'Below Average'
                      : form.rating === 3
                        ? 'Average'
                        : form.rating === 4
                          ? 'Good'
                          : form.rating === 5
                            ? 'Excellent'
                            : 'Click to rate'}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Comment (optional)</label>
                <textarea
                  className="form-control"
                  rows="3"
                  placeholder="Describe this member's contribution..."
                  value={form.comment}
                  onChange={(e) => setForm({ ...form, comment: e.target.value })}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary full-width"
                disabled={!hasProjects || !hasReviewTargets}
              >
                Submit Review
              </button>
            </form>
          </div>

          <div className="card">
            <div className="card-title">
              {isSupervisor ? 'All Reviews for this Project' : 'Reviews You Have Received'}
            </div>
            {reviews.length === 0 ? (
              <p className="empty-text">No reviews yet for this project.</p>
            ) : (
              reviews.map((r) => (
                <div key={`${r.reviewID || 'review'}-${r.submittedAt}`} className="review-row">
                  {isSupervisor && (
                    <div className="reviewed-name">
                      {r.reviewedName || `User #${r.reviewedUserID}`}
                    </div>
                  )}
                  <div className="review-stars">
                    {'★'.repeat(Number(r.rating || 0))}
                    {'☆'.repeat(5 - Number(r.rating || 0))}
                  </div>
                  {r.comment && <div className="review-comment">{r.comment}</div>}
                  <div className="review-date">
                    {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : '-'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
