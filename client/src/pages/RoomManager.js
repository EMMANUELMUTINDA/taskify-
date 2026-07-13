import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getMyRooms,
  createRoom,
  deleteRoom,
  getMembersByGroup,
  getRoomMessages,
  sendRoomMessage,
  getRoomSlots,
  createRoomSlots,
  getRoomWork,
  uploadRoomWork,
  downloadRoomWork,
  getRoomSlotFinalFiles,
  downloadRoomSlotFinalFile,
  markRoomSlotFinalFile,
} from '../api';
import Sidebar from '../components/Sidebar';

const COURSES = [
  'Bachelor of Business Information Technology (BBIT)',
  'Bachelor of Science in Computer Science (BSc CS)',
  'Bachelor of Science in Software Engineering (BSc SE)',
  'Bachelor of Science in Information Technology (BSc IT)',
  'Bachelor of Commerce (BCom)',
  'Bachelor of Laws (LLB)',
];

const ALL_GROUPS = ['A', 'B', 'C', 'D', 'E'];

export default function RoomManager() {
  const { token } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState('members');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [groupMembers, setGroupMembers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [slotCount, setSlotCount] = useState(4);
  const [slotsPayload, setSlotsPayload] = useState({ slots: [], mySlotID: null });
  const [workItems, setWorkItems] = useState([]);
  const [slotFinalFiles, setSlotFinalFiles] = useState([]);
  const [workTitle, setWorkTitle] = useState('');
  const [workDescription, setWorkDescription] = useState('');
  const [workFile, setWorkFile] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    unitCode: '',
    unitName: '',
    courseName: '',
    yearOfStudy: '',
    availableGroups: [],
  });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const loadRooms = useCallback(async () => {
    try {
      const data = await getMyRooms(token);
      setRooms(data);
    } catch (err) {
      setError(err.message || 'Failed to load rooms');
      setRooms([]);
    }
  }, [token]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    const loadMembers = async () => {
      if (!selectedRoom || !selectedGroup || activeWorkspaceTab !== 'members') {
        return;
      }

      try {
        const members = await getMembersByGroup(selectedRoom.roomID, selectedGroup, token);
        setGroupMembers(members);
      } catch (err) {
        setError(err.message || 'Failed to load group members');
        setGroupMembers([]);
      }
    };

    loadMembers();
  }, [selectedRoom, selectedGroup, token, activeWorkspaceTab]);

  // Loads supervisor workspace data: room chat, slot structure, group work, and slot final submissions.
  const loadWorkspace = useCallback(async () => {
    if (!selectedRoom) {
      return;
    }

    try {
      const [roomMessages, roomSlots, roomWork] = await Promise.all([
        getRoomMessages(selectedRoom.roomID, token),
        getRoomSlots(selectedRoom.roomID, token),
        getRoomWork(selectedRoom.roomID, token),
      ]);

      const finalFiles = await getRoomSlotFinalFiles(selectedRoom.roomID, token);

      setMessages(roomMessages);
      setSlotsPayload(roomSlots || { slots: [], mySlotID: null });
      setWorkItems(roomWork || []);
      setSlotFinalFiles(finalFiles || []);
    } catch (err) {
      setError(err.message || 'Failed to load room workspace');
    }
  }, [selectedRoom, token]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const toggleGroup = (group) => {
    setForm((prev) => ({
      ...prev,
      availableGroups: prev.availableGroups.includes(group)
        ? prev.availableGroups.filter((value) => value !== group)
        : [...prev.availableGroups, group],
    }));
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setError('');

    if (form.availableGroups.length === 0) {
      setError('Select at least one group');
      return;
    }

    try {
      const res = await createRoom(
        {
          ...form,
          availableGroups: [...form.availableGroups].sort().join(','),
        },
        token
      );

      if (res.roomID || res.message === 'Room created') {
        setMsg('Room created successfully');
        setShowModal(false);
        setForm({
          unitCode: '',
          unitName: '',
          courseName: '',
          yearOfStudy: '',
          availableGroups: [],
        });
        await loadRooms();
      } else {
        setError(res.message || 'Error creating room');
      }
    } catch (err) {
      setError(err.message || 'Error creating room');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this room? All members will be removed.')) {
      return;
    }

    try {
      await deleteRoom(id, token);
      await loadRooms();

      if (selectedRoom?.roomID === id) {
        setSelectedRoom(null);
        setGroupMembers([]);
      }
    } catch (err) {
      setError(err.message || 'Error deleting room');
    }
  };

  const handleSendMessage = async () => {
    const trimmed = newMessage.trim();
    if (!trimmed || !selectedRoom) {
      return;
    }

    try {
      await sendRoomMessage(selectedRoom.roomID, { message: trimmed }, token);
      setNewMessage('');
      const fresh = await getRoomMessages(selectedRoom.roomID, token);
      setMessages(fresh);
    } catch (err) {
      setError(err.message || 'Failed to send message');
    }
  };

  const handleCreateSlots = async () => {
    if (!selectedRoom) {
      return;
    }

    try {
      const count = Number(slotCount);
      if (!Number.isInteger(count) || count <= 0) {
        setError('Slot count must be a positive number');
        return;
      }

      await createRoomSlots(selectedRoom.roomID, { count }, token);
      const freshSlots = await getRoomSlots(selectedRoom.roomID, token);
      setSlotsPayload(freshSlots || { slots: [], mySlotID: null });
      setMsg(`Created ${count} group slots`);
    } catch (err) {
      setError(err.message || 'Failed to create group slots');
    }
  };

  const handleUploadWork = async (event) => {
    event.preventDefault();
    if (!selectedRoom || !workFile) {
      setError('Select a file to upload');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('workFile', workFile);
      formData.append('title', workTitle.trim() || workFile.name);
      formData.append('description', workDescription.trim());
      await uploadRoomWork(selectedRoom.roomID, formData, token);
      setWorkTitle('');
      setWorkDescription('');
      setWorkFile(null);
      const freshWork = await getRoomWork(selectedRoom.roomID, token);
      setWorkItems(freshWork || []);
      setMsg('Group work uploaded');
    } catch (err) {
      setError(err.message || 'Failed to upload group work');
    }
  };

  const handleDownloadWork = async (workId, fallbackName) => {
    if (!selectedRoom) {
      return;
    }

    try {
      const { blob, contentDisposition } = await downloadRoomWork(selectedRoom.roomID, workId, token);
      const nameMatch = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(contentDisposition || '');
      const filename = decodeURIComponent(nameMatch?.[1] || nameMatch?.[2] || fallbackName || 'room-work');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Failed to download file');
    }
  };

  // Downloads a selected final slot submission from the marking queue.
  const handleDownloadFinalSlotWork = async (finalFileID, fallbackName) => {
    if (!selectedRoom) {
      return;
    }

    try {
      const { blob, contentDisposition } = await downloadRoomSlotFinalFile(selectedRoom.roomID, finalFileID, token);
      const nameMatch = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(contentDisposition || '');
      const filename = decodeURIComponent(nameMatch?.[1] || nameMatch?.[2] || fallbackName || 'final-work');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Failed to download final slot file');
    }
  };

  const handleMarkFinalSlotWork = async (finalFileID) => {
    if (!selectedRoom) {
      return;
    }

    const markerComment = window.prompt('Add marking comment (optional):', '') || '';

    try {
      await markRoomSlotFinalFile(
        selectedRoom.roomID,
        finalFileID,
        { markerComment: markerComment.trim() },
        token
      );

      const refreshed = await getRoomSlotFinalFiles(selectedRoom.roomID, token);
      setSlotFinalFiles(refreshed || []);
      setMsg('Final slot submission marked successfully');
    } catch (err) {
      setError(err.message || 'Failed to mark final slot submission');
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <div>
            <div className="page-title">Room Manager</div>
            <div className="page-sub">Create and manage your unit rooms</div>
          </div>
          <button
            onClick={() => {
              setError('');
              setShowModal(true);
            }}
            style={{
              padding: '10px 20px',
              background: 'linear-gradient(135deg, #8B8FD4, #9B8EC4)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
            }}
          >
            + Create Unit Room
          </button>
        </div>

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

        {error && !showModal && (
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '20px' }}>
          <div>
            <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '14px', color: '#2D2D3A' }}>
              Rooms You Created ({rooms.length})
            </div>
            {rooms.length === 0 ? (
              <div
                style={{
                  background: 'white',
                  borderRadius: '14px',
                  padding: '48px',
                  textAlign: 'center',
                  color: '#718096',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
                }}
              >
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏫</div>
                <div style={{ fontWeight: '700' }}>No rooms yet</div>
                <div style={{ fontSize: '12px', marginTop: '8px' }}>Click Create Unit Room to get started</div>
              </div>
            ) : (
              rooms.map((room) => (
                <div
                  key={room.roomID}
                  onClick={() => {
                    setSelectedRoom(room);
                    setSelectedGroup('');
                    setGroupMembers([]);
                    setActiveWorkspaceTab('members');
                  }}
                  style={{
                    background: 'white',
                    borderRadius: '14px',
                    padding: '18px',
                    marginBottom: '12px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
                    border: selectedRoom?.roomID === room.roomID ? '2px solid #8B8FD4' : '1px solid #E2E8F0',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <span
                          style={{
                            background: 'linear-gradient(135deg, #8B8FD4, #9B8EC4)',
                            color: 'white',
                            padding: '4px 10px',
                            borderRadius: '7px',
                            fontSize: '12px',
                            fontWeight: '700',
                          }}
                        >
                          {room.unitCode}
                        </span>
                        <span
                          style={{
                            background: '#F0F4F8',
                            color: '#718096',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                          }}
                        >
                          Year {room.yearOfStudy}
                        </span>
                      </div>
                      <div style={{ fontWeight: '700', fontSize: '14px', color: '#2D2D3A' }}>{room.unitName}</div>
                      <div style={{ fontSize: '12px', color: '#718096', marginTop: '3px' }}>{room.courseName}</div>
                      <div style={{ fontSize: '12px', color: '#8B8FD4', marginTop: '6px', fontWeight: '600' }}>
                        {room.memberCount} students enrolled
                      </div>
                    </div>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDelete(room.roomID);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#E74C3C',
                        cursor: 'pointer',
                        fontSize: '16px',
                        padding: '4px',
                      }}
                    >
                      ×
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                    {String(room.availableGroups || '')
                      .split(',')
                      .map((group) => group.trim())
                      .filter(Boolean)
                      .map((group) => (
                        <span
                          key={group}
                          style={{
                            background: '#F5F0FF',
                            color: '#8B8FD4',
                            width: '26px',
                            height: '26px',
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
              ))
            )}
          </div>

          <div>
            {!selectedRoom ? (
              <div
                style={{
                  background: 'white',
                  borderRadius: '14px',
                  padding: '64px',
                  textAlign: 'center',
                  color: '#718096',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
                }}
              >
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>👥</div>
                <div style={{ fontWeight: '700' }}>Select a room to view members</div>
              </div>
            ) : (
              <div
                style={{
                  background: 'white',
                  borderRadius: '14px',
                  overflow: 'hidden',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
                }}
              >
                <div
                  style={{
                    padding: '18px 20px',
                    background: 'linear-gradient(135deg, #8B8FD4, #9B8EC4)',
                    color: 'white',
                  }}
                >
                  <div style={{ fontWeight: '700', fontSize: '16px' }}>
                    {selectedRoom.unitCode} — {selectedRoom.unitName}
                  </div>
                  <div style={{ fontSize: '12px', opacity: 0.85, marginTop: '3px' }}>
                    {selectedRoom.courseName} · Year {selectedRoom.yearOfStudy}
                  </div>
                </div>

                <div style={{ padding: '12px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', gap: '8px' }}>
                  {[
                    { key: 'members', label: 'Members' },
                    { key: 'chat', label: 'Chat' },
                    { key: 'slots', label: 'Group Slots' },
                    { key: 'work', label: 'Group Work' },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveWorkspaceTab(tab.key)}
                      style={{
                        padding: '7px 14px',
                        border: activeWorkspaceTab === tab.key ? '2px solid #8B8FD4' : '1.5px solid #E2E8F0',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '700',
                        background: activeWorkspaceTab === tab.key ? '#F5F0FF' : 'white',
                        color: activeWorkspaceTab === tab.key ? '#8B8FD4' : '#718096',
                        cursor: 'pointer',
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {activeWorkspaceTab === 'members' && (
                  <>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#718096', marginBottom: '10px' }}>
                    FILTER BY GROUP
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => {
                        setSelectedGroup('');
                        setGroupMembers([]);
                      }}
                      style={{
                        padding: '7px 14px',
                        border: selectedGroup === '' ? '2px solid #8B8FD4' : '1.5px solid #E2E8F0',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '600',
                        background: selectedGroup === '' ? '#F5F0FF' : 'white',
                        color: selectedGroup === '' ? '#8B8FD4' : '#718096',
                        cursor: 'pointer',
                      }}
                    >
                      All
                    </button>
                    {String(selectedRoom.availableGroups || '')
                      .split(',')
                      .map((group) => group.trim())
                      .filter(Boolean)
                      .map((group) => (
                        <button
                          key={group}
                          onClick={() => setSelectedGroup(group)}
                          style={{
                            padding: '7px 14px',
                            border: selectedGroup === group ? '2px solid #8B8FD4' : '1.5px solid #E2E8F0',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '700',
                            background: selectedGroup === group ? '#F5F0FF' : 'white',
                            color: selectedGroup === group ? '#8B8FD4' : '#718096',
                            cursor: 'pointer',
                          }}
                        >
                          Group {group}
                        </button>
                      ))}
                  </div>
                </div>
                  </>
                )}

                <div style={{ padding: '0' }}>
                  {activeWorkspaceTab === 'members' && groupMembers.length === 0 && selectedGroup && (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#718096', fontSize: '13px' }}>
                      No students in Group {selectedGroup} yet.
                    </div>
                  )}
                  {activeWorkspaceTab === 'members' && !selectedGroup && (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#718096', fontSize: '13px' }}>
                      Select a group above to see its members.
                    </div>
                  )}
                  {activeWorkspaceTab === 'members' && groupMembers.map((member, index) => (
                    <div
                      key={member.userID}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        padding: '14px 20px',
                        borderBottom: index < groupMembers.length - 1 ? '1px solid #F0F4F8' : 'none',
                      }}
                    >
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #8B8FD4, #9B8EC4)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontWeight: '700',
                          fontSize: '13px',
                          flexShrink: 0,
                        }}
                      >
                        {String(member.name || '')
                          .split(' ')
                          .map((part) => part[0])
                          .join('')
                          .toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600', fontSize: '13px', color: '#2D2D3A' }}>{member.name}</div>
                        <div style={{ fontSize: '11px', color: '#718096' }}>{member.email}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span
                          style={{
                            background: '#F5F0FF',
                            color: '#8B8FD4',
                            padding: '3px 10px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: '700',
                          }}
                        >
                          Group {member.classGroup}
                        </span>
                        <div style={{ fontSize: '10px', color: '#A0AEC0', marginTop: '4px' }}>
                          Joined {new Date(member.joinedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}

                  {activeWorkspaceTab === 'chat' && (
                    <div style={{ padding: '16px 20px' }}>
                      <div style={{ maxHeight: '280px', overflowY: 'auto', marginBottom: '12px' }}>
                        {messages.length === 0 ? (
                          <div style={{ color: '#718096', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
                            No messages yet.
                          </div>
                        ) : (
                          messages.map((item) => (
                            <div key={item.messageID} style={{ padding: '10px 0', borderBottom: '1px solid #EDF2F7' }}>
                              <div style={{ fontWeight: '700', fontSize: '12px', color: '#2D2D3A' }}>
                                {item.name} <span style={{ color: '#718096', fontWeight: '500' }}>({item.role})</span>
                              </div>
                              <div style={{ fontSize: '13px', color: '#2D2D3A', marginTop: '4px' }}>{item.message}</div>
                            </div>
                          ))
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          value={newMessage}
                          onChange={(event) => setNewMessage(event.target.value)}
                          placeholder="Write a message..."
                          style={{
                            flex: 1,
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: '1.5px solid #E2E8F0',
                            fontSize: '13px',
                          }}
                        />
                        <button
                          onClick={handleSendMessage}
                          style={{
                            padding: '10px 14px',
                            borderRadius: '8px',
                            border: 'none',
                            background: '#8B8FD4',
                            color: 'white',
                            fontWeight: '700',
                            cursor: 'pointer',
                          }}
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  )}

                  {activeWorkspaceTab === 'slots' && (
                    <div style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                        <label style={{ fontSize: '12px', fontWeight: '700', color: '#2D2D3A' }}>Group slots:</label>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={slotCount}
                          onChange={(event) => setSlotCount(event.target.value)}
                          style={{ width: '80px', padding: '8px', borderRadius: '8px', border: '1.5px solid #E2E8F0' }}
                        />
                        <button
                          onClick={handleCreateSlots}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: 'none',
                            background: '#8B8FD4',
                            color: 'white',
                            fontWeight: '700',
                            cursor: 'pointer',
                          }}
                        >
                          Create/Reset Slots
                        </button>
                      </div>

                      {(slotsPayload.slots || []).map((slot) => (
                        <div key={slot.slotID} style={{ padding: '10px 0', borderBottom: '1px solid #EDF2F7' }}>
                          <div style={{ fontWeight: '700', fontSize: '13px', color: '#2D2D3A' }}>
                            {slot.slotLabel} ({slot.memberCount} members)
                          </div>
                          <div style={{ marginTop: '6px', fontSize: '12px', color: '#718096' }}>
                            {(slot.members || []).length > 0
                              ? slot.members.map((member) => member.name).join(', ')
                              : 'No members selected this slot yet.'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeWorkspaceTab === 'work' && (
                    <div style={{ padding: '16px 20px' }}>
                      <form onSubmit={handleUploadWork} style={{ marginBottom: '14px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <input
                            value={workTitle}
                            onChange={(event) => setWorkTitle(event.target.value)}
                            placeholder="Title"
                            style={{ padding: '8px', borderRadius: '8px', border: '1.5px solid #E2E8F0' }}
                          />
                          <input
                            type="file"
                            onChange={(event) => setWorkFile(event.target.files?.[0] || null)}
                            style={{ padding: '6px' }}
                            required
                          />
                        </div>
                        <textarea
                          value={workDescription}
                          onChange={(event) => setWorkDescription(event.target.value)}
                          placeholder="Description (optional)"
                          style={{ width: '100%', marginTop: '8px', padding: '8px', borderRadius: '8px', border: '1.5px solid #E2E8F0', minHeight: '70px' }}
                        />
                        <button
                          type="submit"
                          style={{
                            marginTop: '8px',
                            padding: '9px 14px',
                            borderRadius: '8px',
                            border: 'none',
                            background: '#8B8FD4',
                            color: 'white',
                            fontWeight: '700',
                            cursor: 'pointer',
                          }}
                        >
                          Upload Group Work
                        </button>
                      </form>

                      {workItems.length === 0 ? (
                        <div style={{ color: '#718096', fontSize: '13px' }}>No group work uploaded yet.</div>
                      ) : (
                        workItems.map((item) => (
                          <div key={item.workID} style={{ padding: '10px 0', borderBottom: '1px solid #EDF2F7' }}>
                            <div style={{ fontWeight: '700', fontSize: '13px', color: '#2D2D3A' }}>{item.title}</div>
                            <div style={{ fontSize: '12px', color: '#718096' }}>{item.description || item.fileName}</div>
                            <button
                              onClick={() => handleDownloadWork(item.workID, item.fileName)}
                              style={{
                                marginTop: '6px',
                                padding: '6px 10px',
                                borderRadius: '8px',
                                border: '1px solid #CBD5E0',
                                background: 'white',
                                cursor: 'pointer',
                                fontSize: '12px',
                              }}
                            >
                              Download
                            </button>
                          </div>
                        ))
                      )}

                      <div style={{ marginTop: '16px' }}>
                        {/* Supervisor marking queue for files uploaded by students from different slots. */}
                        <div style={{ fontWeight: '700', fontSize: '13px', color: '#2D2D3A', marginBottom: '8px' }}>
                          Final Slot Submissions (Ready for Marking)
                        </div>
                        {slotFinalFiles.length === 0 ? (
                          <div style={{ color: '#718096', fontSize: '13px' }}>No final slot files submitted yet.</div>
                        ) : (
                          slotFinalFiles.map((item) => (
                            <div key={item.finalFileID} style={{ padding: '10px 0', borderBottom: '1px solid #EDF2F7' }}>
                              <div style={{ fontWeight: '700', fontSize: '13px', color: '#2D2D3A' }}>
                                {item.title}
                              </div>
                              <div style={{ fontSize: '12px', color: '#718096' }}>
                                {item.slotLabel} · {item.uploadedByName} · {item.notes || item.fileName}
                              </div>
                              <div style={{ fontSize: '12px', color: '#4A5568', marginTop: '4px' }}>
                                Status: {item.markStatus || 'Submitted'}
                                {item.markedByName ? ` · Marked by ${item.markedByName}` : ''}
                                {item.markerComment ? ` · ${item.markerComment}` : ''}
                              </div>
                              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                              <button
                                onClick={() => handleDownloadFinalSlotWork(item.finalFileID, item.fileName)}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '8px',
                                  border: '1px solid #CBD5E0',
                                  background: 'white',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                }}
                              >
                                Download Final File
                              </button>
                              <button
                                onClick={() => handleMarkFinalSlotWork(item.finalFileID)}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '8px',
                                  border: 'none',
                                  background: '#2F855A',
                                  color: 'white',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  fontWeight: '700',
                                }}
                              >
                                Mark Submission
                              </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {showModal && (
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
                maxWidth: '500px',
                boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ fontWeight: '700', fontSize: '18px', color: '#2D2D3A' }}>Create Unit Room</div>
                <button
                  onClick={() => setShowModal(false)}
                  style={{
                    background: '#F0F4F8',
                    border: 'none',
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '18px',
                    color: '#718096',
                  }}
                >
                  ×
                </button>
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

              <form onSubmit={handleCreate}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: '#2D2D3A',
                        marginBottom: '6px',
                      }}
                    >
                      Unit Code *
                    </label>
                    <input
                      style={{
                        width: '100%',
                        padding: '9px 13px',
                        border: '1.5px solid #E2E8F0',
                        borderRadius: '10px',
                        fontSize: '13px',
                      }}
                      placeholder="e.g. IS 4101"
                      value={form.unitCode}
                      onChange={(event) => setForm({ ...form, unitCode: event.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: '#2D2D3A',
                        marginBottom: '6px',
                      }}
                    >
                      Year of Study *
                    </label>
                    <select
                      style={{
                        width: '100%',
                        padding: '9px 13px',
                        border: '1.5px solid #E2E8F0',
                        borderRadius: '10px',
                        fontSize: '13px',
                      }}
                      value={form.yearOfStudy}
                      onChange={(event) => setForm({ ...form, yearOfStudy: event.target.value })}
                      required
                    >
                      <option value="">Select year</option>
                      {[1, 2, 3, 4].map((year) => (
                        <option key={year} value={year}>
                          Year {year}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: '700',
                      color: '#2D2D3A',
                      marginBottom: '6px',
                    }}
                  >
                    Unit Name *
                  </label>
                  <input
                    style={{
                      width: '100%',
                      padding: '9px 13px',
                      border: '1.5px solid #E2E8F0',
                      borderRadius: '10px',
                      fontSize: '13px',
                    }}
                    placeholder="e.g. Information Systems Project"
                    value={form.unitName}
                    onChange={(event) => setForm({ ...form, unitName: event.target.value })}
                    required
                  />
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: '700',
                      color: '#2D2D3A',
                      marginBottom: '6px',
                    }}
                  >
                    Course *
                  </label>
                  <select
                    style={{
                      width: '100%',
                      padding: '9px 13px',
                      border: '1.5px solid #E2E8F0',
                      borderRadius: '10px',
                      fontSize: '13px',
                    }}
                    value={form.courseName}
                    onChange={(event) => setForm({ ...form, courseName: event.target.value })}
                    required
                  >
                    <option value="">Select course</option>
                    {COURSES.map((course) => (
                      <option key={course} value={course}>
                        {course}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: '700',
                      color: '#2D2D3A',
                      marginBottom: '8px',
                    }}
                  >
                    Available Groups * (select all that apply)
                  </label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {ALL_GROUPS.map((group) => (
                      <button
                        key={group}
                        type="button"
                        onClick={() => toggleGroup(group)}
                        style={{
                          width: '48px',
                          height: '48px',
                          border: form.availableGroups.includes(group)
                            ? '2px solid #8B8FD4'
                            : '1.5px solid #E2E8F0',
                          borderRadius: '10px',
                          fontSize: '16px',
                          fontWeight: '700',
                          background: form.availableGroups.includes(group) ? '#F5F0FF' : 'white',
                          color: form.availableGroups.includes(group) ? '#8B8FD4' : '#718096',
                          cursor: 'pointer',
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
                    type="button"
                    onClick={() => setShowModal(false)}
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
                    type="submit"
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
                    Create Room
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
