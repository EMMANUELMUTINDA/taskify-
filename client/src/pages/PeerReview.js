import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getMyRooms,
  getJoinedRooms,
  getRoomSlots,
  getRoomSlotPeerReviews,
  submitRoomSlotPeerReview,
} from '../api';
import Sidebar from '../components/Sidebar';

export default function PeerReview() {
  const { token, user } = useAuth();
  const isSupervisor = user?.role === 'Supervisor';
  const [rooms, setRooms] = useState([]);
  const [roomSlots, setRoomSlots] = useState([]);
  const [slotMembers, setSlotMembers] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [slotLabel, setSlotLabel] = useState('');
  const [form, setForm] = useState({ reviewedUserID: '', rating: 0, comment: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const hasRooms = rooms.length > 0;
  const hasReviewTargets = slotMembers.length > 0;

  useEffect(() => {
    let isMounted = true;

    const fetchRooms = isSupervisor ? getMyRooms : getJoinedRooms;

    fetchRooms(token)
      .then(async (data) => {
        if (!isMounted) {
          return;
        }

        setRooms(data);
        if (data.length > 0) {
          if (isSupervisor) {
            setSelectedRoom(String(data[0].roomID));
            return;
          }

          // Prefer a room where the current student already selected a slot.
          const slotStates = await Promise.all(
            data.map(async (room) => {
              try {
                const slotData = await getRoomSlots(room.roomID, token);
                return {
                  roomID: room.roomID,
                  hasSlot: Number(slotData?.mySlotID || 0) > 0,
                };
              } catch (_error) {
                return { roomID: room.roomID, hasSlot: false };
              }
            })
          );

          if (!isMounted) {
            return;
          }

          const preferredRoom = slotStates.find((item) => item.hasSlot);
          setSelectedRoom(String(preferredRoom?.roomID || data[0].roomID));
        }
      })
      .catch(() => {
        if (isMounted) {
          setRooms([]);
          setSelectedRoom('');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token, user?.userID, isSupervisor]);

  useEffect(() => {
    let isMounted = true;

    if (!selectedRoom) {
      setRoomSlots([]);
      setSlotMembers([]);
      setReviews([]);
      setSelectedSlotId('');
      setSlotLabel('');
      setForm((prev) => ({ ...prev, reviewedUserID: '' }));
      return () => {
        isMounted = false;
      };
    }

    getRoomSlots(selectedRoom, token)
      .then(async (slotData) => {
        if (!isMounted) {
          return;
        }

        const slots = slotData?.slots || [];
        setRoomSlots(slots);

        if (isSupervisor) {
          let preferredSlotId = '';
          setSelectedSlotId((prevSlotId) => {
            const nextSlotId = slots.some((slot) => String(slot.slotID) === String(prevSlotId))
              ? String(prevSlotId)
              : slots[0]
                ? String(slots[0].slotID)
                : '';
            preferredSlotId = nextSlotId;
            return nextSlotId;
          });

          const selectedSlot = slots.find((slot) => String(slot.slotID) === String(preferredSlotId));
          setSlotLabel(selectedSlot?.slotLabel || '');

          setSlotMembers([]);
          setForm((prev) => ({ ...prev, reviewedUserID: '' }));

          if (!preferredSlotId) {
            setReviews([]);
          }

          return;
        }

        const mySlot = (slotData?.slots || []).find(
          (slot) => Number(slot.slotID) === Number(slotData?.mySlotID)
        );
        const peers = (mySlot?.members || []).filter(
          (member) => Number(member.userID) !== Number(user?.userID)
        );

        setSlotMembers(peers);
        setSlotLabel(mySlot?.slotLabel || '');
        setForm((prev) => ({
          ...prev,
          reviewedUserID: peers.some((member) => String(member.userID) === String(prev.reviewedUserID))
            ? prev.reviewedUserID
            : '',
        }));
        setSelectedSlotId(mySlot?.slotID ? String(mySlot.slotID) : '');

        const nextReviews = await getRoomSlotPeerReviews(selectedRoom, token);
        if (!isMounted) {
          return;
        }

        setReviews(nextReviews.filter((r) => Number(r.reviewedUserID) === Number(user?.userID)));
      })
      .catch(() => {
        if (isMounted) {
          setRoomSlots([]);
          setSlotMembers([]);
          setReviews([]);
          setSelectedSlotId('');
          setSlotLabel('');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedRoom, token, user?.userID, isSupervisor]);

  useEffect(() => {
    let isMounted = true;

    if (!isSupervisor) {
      return () => {
        isMounted = false;
      };
    }

    if (!selectedRoom || !selectedSlotId) {
      setReviews([]);
      setSlotLabel('');
      return () => {
        isMounted = false;
      };
    }

    const activeSlot = roomSlots.find((slot) => String(slot.slotID) === String(selectedSlotId));
    setSlotLabel(activeSlot?.slotLabel || '');

    getRoomSlotPeerReviews(selectedRoom, token, selectedSlotId)
      .then((rows) => {
        if (isMounted) {
          setReviews(rows);
        }
      })
      .catch(() => {
        if (isMounted) {
          setReviews([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedRoom, selectedSlotId, token, isSupervisor, roomSlots]);

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
      const res = await submitRoomSlotPeerReview(
        selectedRoom,
        {
          reviewedUserID: form.reviewedUserID,
          rating: form.rating,
          comment: form.comment,
        },
        token
      );

      if (res.message === 'Peer review submitted') {
        setMsg('Review submitted successfully');
        setForm({ reviewedUserID: '', rating: 0, comment: '' });

        const refreshed = await getRoomSlotPeerReviews(selectedRoom, token);
        setReviews(refreshed.filter((r) => Number(r.reviewedUserID) === Number(user?.userID)));
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
            <div className="page-sub">
              {isSupervisor
                ? 'Select a unit room and slot to view peer reviews'
                : 'Select a unit room and review members in your current slot only'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <select
              className="form-control"
              style={{ width: '280px' }}
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              disabled={!hasRooms}
            >
              {!hasRooms && <option value="">No available unit rooms</option>}
              {rooms.map((r) => (
                <option key={r.roomID} value={r.roomID}>
                  {r.unitCode} - {r.unitName}
                </option>
              ))}
            </select>

            {isSupervisor && (
              <select
                className="form-control"
                style={{ width: '220px' }}
                value={selectedSlotId}
                onChange={(e) => setSelectedSlotId(e.target.value)}
                disabled={!selectedRoom || roomSlots.length === 0}
              >
                {roomSlots.length === 0 && <option value="">No slots</option>}
                {roomSlots.map((slot) => (
                  <option key={slot.slotID} value={slot.slotID}>
                    {slot.slotLabel}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {isSupervisor ? (
          <div className="card">
            <div className="card-title">Slot Peer Reviews</div>
            {!hasRooms && (
              <div className="alert-banner alert-warning">You have not created any unit rooms yet.</div>
            )}
            {hasRooms && !selectedSlotId && (
              <div className="alert-banner alert-warning">Create/select a slot to view reviews.</div>
            )}
            {slotLabel && (
              <div className="page-sub" style={{ marginBottom: '10px' }}>
                Viewing slot: {slotLabel}
              </div>
            )}

            {reviews.length === 0 ? (
              <p className="empty-text">No reviews yet for this slot.</p>
            ) : (
              reviews.map((r) => (
                <div key={`${r.slotReviewID || 'review'}-${r.submittedAt}`} className="review-row">
                  <div className="reviewed-name">
                    {r.reviewedName || `User #${r.reviewedUserID}`}
                  </div>
                  <div className="page-sub">Reviewed by: {r.reviewerName || `User #${r.reviewerID}`}</div>
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
        ) : (
          <div className="review-grid">
            <div className="card">
              <div className="card-title">Submit Review</div>
              <p className="review-note">
                Your identity is anonymous to peers. You can only review members in your selected slot.
              </p>

              {msg && <div className="alert-banner alert-success">Success: {msg}</div>}
              {error && <div className="alert-banner alert-danger">Warning: {error}</div>}
              {!hasRooms && (
                <div className="alert-banner alert-warning">
                  Join a unit room first to use peer review.
                </div>
              )}
              {hasRooms && !slotLabel && (
                <div className="alert-banner alert-warning">
                  Select a slot in Room Workspace first, then return here.
                </div>
              )}
              {hasRooms && slotLabel && !hasReviewTargets && (
                <div className="alert-banner alert-warning">
                  No peers found in your slot ({slotLabel}) to review yet.
                </div>
              )}

              {slotLabel && (
                <div className="page-sub" style={{ marginBottom: '10px' }}>
                  Current slot: {slotLabel}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label">Select Member *</label>
                  <select
                    className="form-control"
                    value={form.reviewedUserID}
                    onChange={(e) => setForm({ ...form, reviewedUserID: e.target.value })}
                    disabled={!hasRooms || !hasReviewTargets}
                    required
                  >
                    <option value="">Choose a member</option>
                    {slotMembers.map((u) => (
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
                  disabled={!hasRooms || !hasReviewTargets}
                >
                  Submit Review
                </button>
              </form>
            </div>

            <div className="card">
              <div className="card-title">Reviews You Have Received (Current Slot)</div>
              {reviews.length === 0 ? (
                <p className="empty-text">No reviews yet for this slot.</p>
              ) : (
                reviews.map((r) => (
                  <div key={`${r.slotReviewID || 'review'}-${r.submittedAt}`} className="review-row">
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
        )}
      </div>
    </div>
  );
}
