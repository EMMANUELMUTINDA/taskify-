import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getRooms,
  getJoinedRooms,
  joinRoom,
  leaveRoom,
} from '../api';
import Sidebar from '../components/Sidebar';

export default function Units() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [joinedRooms, setJoinedRooms] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [joiningRoom, setJoiningRoom] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('browse');

  const loadRooms = useCallback((q = '') => {
    const params = {};
    if (q) params.search = q;
    if (user?.course) params.course = user.course;
    if (user?.yearOfStudy) params.year = user.yearOfStudy;

    getRooms(params, token)
      .then(setRooms)
      .catch(() => setRooms([]));
  }, [token, user?.course, user?.yearOfStudy]);

  useEffect(() => {
    loadRooms();
    getJoinedRooms(token)
      .then(setJoinedRooms)
      .catch(() => setJoinedRooms([]));
  }, [loadRooms, token]);

  const handleSearch = (event) => {
    setSearch(event.target.value);
    loadRooms(event.target.value);
  };

  const handleJoin = async () => {
    if (!selectedGroup) {
      setError('Please select your group');
      return;
    }

    try {
      setError('');
      const res = await joinRoom({ roomID: joiningRoom.roomID, classGroup: selectedGroup }, token);
      if (res.message === 'Joined room successfully') {
        setMsg(`Joined ${joiningRoom.unitCode} - Group ${selectedGroup}`);
        setJoiningRoom(null);
        setSelectedGroup('');
        const refreshedJoined = await getJoinedRooms(token);
        setJoinedRooms(refreshedJoined);
        loadRooms(search);
      } else {
        setError(res.message || 'Unable to join room');
      }
    } catch (joinError) {
      setError(joinError.message || 'Unable to join room');
    }
  };

  const handleLeave = async (roomID) => {
    if (!window.confirm('Leave this unit room?')) return;

    try {
      await leaveRoom(roomID, token);
      const refreshedJoined = await getJoinedRooms(token);
      setJoinedRooms(refreshedJoined);
      loadRooms(search);
    } catch (leaveError) {
      setError(leaveError.message || 'Unable to leave room');
    }
  };


  const isJoined = (roomID) => joinedRooms.some((room) => Number(room.roomID) === Number(roomID));

  const validGroups = joiningRoom
    ? String(joiningRoom.availableGroups || '')
        .split(',')
        .map((group) => group.trim())
        .filter(Boolean)
    : [];

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <div>
            <div className="page-title">Unit Rooms</div>
            <div className="page-sub">Search and join your unit rooms to get started</div>
          </div>
        </div>

        {user?.course && (
          <div
            style={{
              background: 'linear-gradient(135deg, #F5F0FF, #EEF2FF)',
              border: '1px solid #C7D2FE',
              borderRadius: '12px',
              padding: '14px 20px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div style={{ fontSize: '24px' }}>🎓</div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '13px', color: '#3730A3' }}>{user.course}</div>
              <div style={{ fontSize: '12px', color: '#6366F1' }}>
                Year {user.yearOfStudy} · Group {user.classGroup}
              </div>
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <span
                style={{
                  background: '#6366F1',
                  color: 'white',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '600',
                }}
              >
                {joinedRooms.length} unit{joinedRooms.length !== 1 ? 's' : ''} joined
              </span>
            </div>
          </div>
        )}

        {msg && (
          <div
            style={{
              background: '#E6FFED',
              border: '1px solid #C6F6D5',
              color: '#276749',
              padding: '12px 16px',
              borderRadius: '10px',
              marginBottom: '16px',
              fontSize: '13px',
            }}
          >
            {msg}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            gap: '4px',
            background: '#F0F4F8',
            borderRadius: '10px',
            padding: '4px',
            marginBottom: '20px',
            width: 'fit-content',
          }}
        >
          {['browse', 'joined'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '8px 20px',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                background: activeTab === tab ? 'white' : 'transparent',
                color: activeTab === tab ? '#2D2D3A' : '#718096',
                boxShadow: activeTab === tab ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s',
                textTransform: 'capitalize',
              }}
            >
              {tab === 'browse' ? 'Browse Units' : `My Units (${joinedRooms.length})`}
            </button>
          ))}
        </div>

        {activeTab === 'browse' && (
          <>
            <div style={{ marginBottom: '20px', position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '16px',
                }}
              >
                🔎
              </span>
              <input
                style={{
                  width: '100%',
                  padding: '11px 14px 11px 42px',
                  border: '1.5px solid #E2E8F0',
                  borderRadius: '12px',
                  fontSize: '14px',
                  color: '#2D2D3A',
                  background: 'white',
                  outline: 'none',
                }}
                placeholder="Search by unit code, unit name or course..."
                value={search}
                onChange={handleSearch}
              />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '16px',
              }}
            >
              {rooms.map((room) => (
                <div
                  key={room.roomID}
                  style={{
                    background: 'white',
                    borderRadius: '14px',
                    padding: '20px',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
                    border: isJoined(room.roomID) ? '2px solid #8B8FD4' : '1px solid #E2E8F0',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div
                      style={{
                        background: 'linear-gradient(135deg, #8B8FD4, #9B8EC4)',
                        color: 'white',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '700',
                        letterSpacing: '0.5px',
                      }}
                    >
                      {room.unitCode}
                    </div>
                    {isJoined(room.roomID) && (
                      <span
                        style={{
                          background: '#E6FFED',
                          color: '#276749',
                          padding: '4px 10px',
                          borderRadius: '20px',
                          fontSize: '11px',
                          fontWeight: '700',
                        }}
                      >
                        Joined
                      </span>
                    )}
                  </div>

                  <div style={{ fontWeight: '700', fontSize: '15px', color: '#2D2D3A', marginBottom: '4px' }}>
                    {room.unitName}
                  </div>
                  <div style={{ fontSize: '12px', color: '#718096', marginBottom: '12px' }}>{room.courseName}</div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
                    <span
                      style={{
                        background: '#EEF2FF',
                        color: '#4338CA',
                        padding: '3px 10px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: '600',
                      }}
                    >
                      Year {room.yearOfStudy}
                    </span>
                    <span
                      style={{
                        background: '#F0FFF4',
                        color: '#276749',
                        padding: '3px 10px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: '600',
                      }}
                    >
                      {room.memberCount} students
                    </span>
                    <span
                      style={{
                        background: '#FFF5F5',
                        color: '#9B2C2C',
                        padding: '3px 10px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: '600',
                      }}
                    >
                      {room.supervisorName}
                    </span>
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '11px', color: '#718096', marginBottom: '6px', fontWeight: '600' }}>
                      AVAILABLE GROUPS
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {String(room.availableGroups || '')
                        .split(',')
                        .map((group) => group.trim())
                        .filter(Boolean)
                        .map((group) => (
                          <span
                            key={group}
                            style={{
                              width: '28px',
                              height: '28px',
                              background: '#F5F0FF',
                              color: '#8B8FD4',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '700',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {group}
                          </span>
                        ))}
                    </div>
                  </div>

                  {isJoined(room.roomID) ? (
                    <button
                      onClick={() => handleLeave(room.roomID)}
                      style={{
                        width: '100%',
                        padding: '9px',
                        background: 'transparent',
                        color: '#E74C3C',
                        border: '1.5px solid #FED7D7',
                        borderRadius: '10px',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      Leave Room
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setJoiningRoom(room);
                        setError('');
                        setSelectedGroup('');
                      }}
                      style={{
                        width: '100%',
                        padding: '9px',
                        background: 'linear-gradient(135deg, #8B8FD4, #9B8EC4)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      Join Room
                    </button>
                  )}
                </div>
              ))}

              {rooms.length === 0 && (
                <div
                  style={{
                    gridColumn: '1/-1',
                    textAlign: 'center',
                    padding: '64px 32px',
                    color: '#718096',
                  }}
                >
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔎</div>
                  <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '8px' }}>No unit rooms found</div>
                  <div style={{ fontSize: '13px' }}>Try searching by unit code or name</div>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'joined' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '16px',
            }}
          >
            {joinedRooms.map((room) => (
              <div
                key={room.roomID}
                style={{
                  background: 'white',
                  borderRadius: '14px',
                  padding: '20px',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
                  border: '2px solid #8B8FD4',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div
                    style={{
                      background: 'linear-gradient(135deg, #8B8FD4, #9B8EC4)',
                      color: 'white',
                      padding: '5px 12px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '700',
                    }}
                  >
                    {room.unitCode}
                  </div>
                  <span
                    style={{
                      background: '#F5F0FF',
                      color: '#8B8FD4',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '700',
                    }}
                  >
                    Group {room.myGroup}
                  </span>
                </div>
                <div style={{ fontWeight: '700', fontSize: '15px', color: '#2D2D3A', marginBottom: '4px' }}>
                  {room.unitName}
                </div>
                <div style={{ fontSize: '12px', color: '#718096', marginBottom: '8px' }}>
                  {room.courseName} · Year {room.yearOfStudy}
                </div>
                <div style={{ fontSize: '12px', color: '#718096' }}>{room.supervisorName}</div>
                <div style={{ fontSize: '11px', color: '#A0AEC0', marginTop: '6px' }}>
                  Joined {new Date(room.joinedAt).toLocaleDateString()}
                </div>
                <button
                  onClick={() => navigate('/room-workspace')}
                  style={{
                    marginTop: '10px',
                    width: '100%',
                    padding: '9px',
                    background: 'linear-gradient(135deg, #8B8FD4, #9B8EC4)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  Open in Room Workspace
                </button>
              </div>
            ))}
            {joinedRooms.length === 0 && (
              <div
                style={{
                  gridColumn: '1/-1',
                  textAlign: 'center',
                  padding: '64px',
                  color: '#718096',
                }}
              >
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📚</div>
                <div style={{ fontWeight: '700' }}>No units joined yet</div>
                <div style={{ fontSize: '13px', marginTop: '8px' }}>
                  Browse and join unit rooms from the Browse tab
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {joiningRoom && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '20px',
              padding: '32px',
              width: '100%',
              maxWidth: '400px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '40px', marginBottom: '8px' }}>🎓</div>
              <div style={{ fontWeight: '700', fontSize: '18px', color: '#2D2D3A' }}>
                Join {joiningRoom.unitCode}
              </div>
              <div style={{ fontSize: '13px', color: '#718096', marginTop: '4px' }}>{joiningRoom.unitName}</div>
            </div>

            {error && (
              <div
                style={{
                  background: '#FFF5F5',
                  border: '1px solid #FED7D7',
                  color: '#9B2C2C',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  marginBottom: '16px',
                }}
              >
                {error}
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#2D2D3A', marginBottom: '10px' }}>
                Select your class group *
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                {validGroups.map((group) => (
                  <button
                    key={group}
                    onClick={() => setSelectedGroup(group)}
                    style={{
                      padding: '14px 8px',
                      border: selectedGroup === group ? '2px solid #8B8FD4' : '1.5px solid #E2E8F0',
                      borderRadius: '10px',
                      background: selectedGroup === group ? '#F5F0FF' : 'white',
                      color: selectedGroup === group ? '#6C63FF' : '#2D2D3A',
                      fontWeight: selectedGroup === group ? '800' : '600',
                      cursor: 'pointer',
                      fontSize: '16px',
                      transition: 'all 0.15s',
                    }}
                  >
                    {group}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setJoiningRoom(null)}
                style={{
                  flex: 1,
                  padding: '11px',
                  background: 'transparent',
                  border: '1.5px solid #E2E8F0',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  color: '#718096',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleJoin}
                style={{
                  flex: 2,
                  padding: '11px',
                  background: 'linear-gradient(135deg, #8B8FD4, #9B8EC4)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                Confirm Join
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
