import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getJoinedRooms,
  getRoomSlots,
  joinRoomSlot,
  leaveRoomSlot,
  getRoomSlotWorkspace,
  sendRoomSlotMessage,
  submitRoomSlotParagraph,
  uploadRoomSlotFinalFile,
  downloadRoomSlotFinalFile,
} from '../api';
import Sidebar from '../components/Sidebar';

const EMPTY_SLOT_WORKSPACE = {
  slot: null,
  messages: [],
  paragraphs: [],
  finalFiles: [],
  contributionSummary: [],
};

export default function RoomWorkspace() {
  const { token } = useAuth();
  const [joinedRooms, setJoinedRooms] = useState([]);
  const [workspaceRoom, setWorkspaceRoom] = useState(null);
  const [workspaceTab, setWorkspaceTab] = useState('chat');
  const [workspaceSlots, setWorkspaceSlots] = useState({ slots: [], mySlotID: null });
  const [slotWorkspace, setSlotWorkspace] = useState(EMPTY_SLOT_WORKSPACE);
  const [slotMessage, setSlotMessage] = useState('');
  const [paragraphContent, setParagraphContent] = useState('');
  const [finalTitle, setFinalTitle] = useState('');
  const [finalNotes, setFinalNotes] = useState('');
  const [finalFile, setFinalFile] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getJoinedRooms(token)
      .then(setJoinedRooms)
      .catch(() => setJoinedRooms([]));
  }, [token]);

  // Bootstraps slot map and active slot workspace payload for the chosen room.
  const loadWorkspace = useCallback(async (room) => {
    if (!room) {
      return;
    }

    try {
      const slots = await getRoomSlots(room.roomID, token);
      setWorkspaceSlots(slots || { slots: [], mySlotID: null });

      try {
        const slotData = await getRoomSlotWorkspace(room.roomID, token);
        setSlotWorkspace(slotData || EMPTY_SLOT_WORKSPACE);
      } catch (slotError) {
        if (slotError.status === 409) {
          setSlotWorkspace(EMPTY_SLOT_WORKSPACE);
        } else {
          throw slotError;
        }
      }
    } catch (workspaceError) {
      setError(workspaceError.message || 'Unable to load room workspace');
    }
  }, [token]);

  const openWorkspace = async (room) => {
    setWorkspaceRoom(room);
    setWorkspaceTab('chat');
    setSlotMessage('');
    setParagraphContent('');
    setFinalTitle('');
    setFinalNotes('');
    setFinalFile(null);
    await loadWorkspace(room);
  };

  // Selects a slot and refreshes all slot-scoped workspace data.
  const handleJoinSlot = async (slotID) => {
    if (!workspaceRoom) return;

    try {
      await joinRoomSlot(workspaceRoom.roomID, slotID, token);
      const refreshedSlots = await getRoomSlots(workspaceRoom.roomID, token);
      setWorkspaceSlots(refreshedSlots || { slots: [], mySlotID: null });
      const refreshedSlotWorkspace = await getRoomSlotWorkspace(workspaceRoom.roomID, token);
      setSlotWorkspace(refreshedSlotWorkspace || EMPTY_SLOT_WORKSPACE);
      setWorkspaceTab('chat');
      setMsg('Group slot selected successfully');
    } catch (workspaceError) {
      setError(workspaceError.message || 'Unable to join slot');
    }
  };

  const handleLeaveSlot = async (slotID) => {
    if (!workspaceRoom) return;

    try {
      await leaveRoomSlot(workspaceRoom.roomID, slotID, token);
      const refreshedSlots = await getRoomSlots(workspaceRoom.roomID, token);
      setWorkspaceSlots(refreshedSlots || { slots: [], mySlotID: null });
      setSlotWorkspace(EMPTY_SLOT_WORKSPACE);
      setWorkspaceTab('slots');
      setMsg('You left the selected slot');
    } catch (workspaceError) {
      setError(workspaceError.message || 'Unable to leave slot');
    }
  };

  const handleSendWorkspaceMessage = async () => {
    if (!workspaceRoom || !slotMessage.trim()) return;

    try {
      await sendRoomSlotMessage(workspaceRoom.roomID, { message: slotMessage.trim() }, token);
      setSlotMessage('');
      const refreshed = await getRoomSlotWorkspace(workspaceRoom.roomID, token);
      setSlotWorkspace(refreshed || EMPTY_SLOT_WORKSPACE);
    } catch (workspaceError) {
      setError(workspaceError.message || 'Unable to send message');
    }
  };

  // Sends progress text that contributes to slot contribution tracking.
  const handleSubmitParagraph = async () => {
    if (!workspaceRoom || !paragraphContent.trim()) return;

    try {
      await submitRoomSlotParagraph(workspaceRoom.roomID, { content: paragraphContent.trim() }, token);
      setParagraphContent('');
      const refreshed = await getRoomSlotWorkspace(workspaceRoom.roomID, token);
      setSlotWorkspace(refreshed || EMPTY_SLOT_WORKSPACE);
      setMsg('Progress uploaded and contribution tracker updated');
    } catch (workspaceError) {
      setError(workspaceError.message || 'Unable to submit progress');
    }
  };

  // Uploads final assignment file for supervisor review/marking.
  const handleUploadFinalFile = async (event) => {
    event.preventDefault();
    if (!workspaceRoom || !finalFile) {
      setError('Choose a file to upload');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('finalFile', finalFile);
      formData.append('title', finalTitle.trim() || finalFile.name);
      formData.append('notes', finalNotes.trim());
      await uploadRoomSlotFinalFile(workspaceRoom.roomID, formData, token);

      setFinalTitle('');
      setFinalNotes('');
      setFinalFile(null);

      const refreshed = await getRoomSlotWorkspace(workspaceRoom.roomID, token);
      setSlotWorkspace(refreshed || EMPTY_SLOT_WORKSPACE);
      setMsg('Assignment uploaded and ready for supervisor marking');
    } catch (workspaceError) {
      setError(workspaceError.message || 'Unable to upload assignment');
    }
  };

  const handleDownloadWork = async (finalFileID, fallbackName) => {
    if (!workspaceRoom) return;

    try {
      const { blob, contentDisposition } = await downloadRoomSlotFinalFile(
        workspaceRoom.roomID,
        finalFileID,
        token
      );
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
    } catch (workspaceError) {
      setError(workspaceError.message || 'Unable to download file');
    }
  };

  const totalSlotContributionScore = (slotWorkspace.contributionSummary || []).reduce(
    (sum, entry) => sum + Number(entry.totalContributionScore || 0),
    0
  );

  const selectedSlotMembers = slotWorkspace.slot
    ? (workspaceSlots.slots || []).find(
        (slot) => Number(slot.slotID) === Number(slotWorkspace.slot.slotID)
      )?.members || []
    : [];

  const contributionRows = selectedSlotMembers.map((member) => {
    const matchingEntry = (slotWorkspace.contributionSummary || []).find(
      (entry) => Number(entry.userID) === Number(member.userID)
    );
    const score = Number(matchingEntry?.totalContributionScore || 0);
    const percentage = totalSlotContributionScore > 0
      ? (score / totalSlotContributionScore) * 100
      : 0;

    return {
      userID: member.userID,
      name: member.name,
      paragraphCount: Number(matchingEntry?.paragraphCount || 0),
      totalWords: Number(matchingEntry?.totalWords || 0),
      percentage,
    };
  });

  const loafingMembers = contributionRows.filter((row) => row.percentage < 30);

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <div>
            <div className="page-title">Room Workspace</div>
            <div className="page-sub">Open your group room and work inside your selected slot.</div>
          </div>
        </div>

        {msg && (
          <div style={{ background: '#E6FFED', border: '1px solid #C6F6D5', color: '#276749', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', fontSize: '13px' }}>
            {msg}
          </div>
        )}

        {error && (
          <div style={{ background: '#FFF5F5', border: '1px solid #FED7D7', color: '#9B2C2C', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {joinedRooms.map((room) => (
            <div
              key={room.roomID}
              onClick={() => openWorkspace(room)}
              style={{
                background: 'white',
                borderRadius: '14px',
                padding: '20px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
                border: workspaceRoom?.roomID === room.roomID ? '2px solid #8B8FD4' : '1px solid #E2E8F0',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ background: 'linear-gradient(135deg, #8B8FD4, #9B8EC4)', color: 'white', padding: '5px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: '700' }}>
                  {room.unitCode}
                </div>
                <span style={{ background: '#F5F0FF', color: '#8B8FD4', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>
                  Group {room.myGroup}
                </span>
              </div>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#2D2D3A', marginBottom: '4px' }}>{room.unitName}</div>
              <div style={{ fontSize: '12px', color: '#718096', marginBottom: '8px' }}>{room.courseName} · Year {room.yearOfStudy}</div>
              <div style={{ fontSize: '12px', color: '#718096' }}>{room.supervisorName}</div>
            </div>
          ))}
        </div>

        {joinedRooms.length === 0 && (
          <div style={{ textAlign: 'center', padding: '64px', color: '#718096' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📚</div>
            <div style={{ fontWeight: '700' }}>No units joined yet</div>
            <div style={{ fontSize: '13px', marginTop: '8px' }}>Join a unit room first from Unit Rooms.</div>
          </div>
        )}

        {workspaceRoom && (
          <div style={{ marginTop: '18px', background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div>
                <div style={{ fontWeight: '700', fontSize: '16px', color: '#2D2D3A' }}>{workspaceRoom.unitCode} - {workspaceRoom.unitName}</div>
                <div style={{ fontSize: '12px', color: '#718096' }}>Room workspace</div>
              </div>
              <button
                onClick={() => setWorkspaceRoom(null)}
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer', fontSize: '12px' }}
              >
                Close
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              {['chat', 'slots', 'work'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setWorkspaceTab(tab)}
                  style={{
                    padding: '7px 14px',
                    border: workspaceTab === tab ? '2px solid #8B8FD4' : '1.5px solid #E2E8F0',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '700',
                    background: workspaceTab === tab ? '#F5F0FF' : 'white',
                    color: workspaceTab === tab ? '#8B8FD4' : '#718096',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {workspaceTab === 'chat' && (
              <div>
                {!slotWorkspace.slot ? (
                  <div style={{ color: '#718096', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
                    Choose a slot first to unlock the slot chat workspace.
                  </div>
                ) : (
                  <>
                    <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '8px', padding: '8px 10px', marginBottom: '10px', fontSize: '12px', color: '#4338CA', fontWeight: '700' }}>
                      Active Slot Workspace: {slotWorkspace.slot.slotLabel}
                    </div>
                    <div style={{ maxHeight: '240px', overflowY: 'auto', marginBottom: '10px' }}>
                      {slotWorkspace.messages.length === 0 ? (
                        <div style={{ color: '#718096', fontSize: '13px', textAlign: 'center', padding: '20px' }}>No messages yet.</div>
                      ) : (
                        slotWorkspace.messages.map((item) => (
                          <div key={item.messageID} style={{ padding: '8px 0', borderBottom: '1px solid #EDF2F7' }}>
                            <div style={{ fontWeight: '700', fontSize: '12px' }}>{item.name}</div>
                            <div style={{ fontSize: '13px' }}>{item.message}</div>
                          </div>
                        ))
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        value={slotMessage}
                        onChange={(event) => setSlotMessage(event.target.value)}
                        placeholder="Type your message"
                        style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1.5px solid #E2E8F0' }}
                      />
                      <button
                        onClick={handleSendWorkspaceMessage}
                        style={{ padding: '10px 14px', borderRadius: '8px', border: 'none', background: '#8B8FD4', color: 'white', fontWeight: '700' }}
                      >
                        Send
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {workspaceTab === 'slots' && (
              <div>
                {(workspaceSlots.slots || []).map((slot) => {
                  const isMine = Number(workspaceSlots.mySlotID) === Number(slot.slotID);
                  return (
                    <div key={slot.slotID} style={{ padding: '10px 0', borderBottom: '1px solid #EDF2F7' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '13px' }}>{slot.slotLabel}</div>
                          <div style={{ fontSize: '12px', color: '#718096' }}>
                            {(slot.members || []).length > 0
                              ? slot.members.map((member) => member.name).join(', ')
                              : 'No members yet'}
                          </div>
                        </div>
                        {isMine ? (
                          <button
                            onClick={() => handleLeaveSlot(slot.slotID)}
                            style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid #FED7D7', background: 'white', color: '#E74C3C', fontWeight: '700' }}
                          >
                            Leave Slot
                          </button>
                        ) : (
                          <button
                            onClick={() => handleJoinSlot(slot.slotID)}
                            style={{ padding: '7px 10px', borderRadius: '8px', border: 'none', background: '#8B8FD4', color: 'white', fontWeight: '700' }}
                          >
                            Choose Slot
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {workspaceTab === 'work' && (
              <div>
                {!slotWorkspace.slot ? (
                  <div style={{ color: '#718096', fontSize: '13px' }}>
                    Choose a slot first to submit progress and upload assignments.
                  </div>
                ) : (
                  <>
                    <form
                      onSubmit={handleUploadFinalFile}
                      style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px', marginBottom: '12px' }}
                    >
                      <div style={{ fontWeight: '700', fontSize: '13px', marginBottom: '8px' }}>Upload Assignments</div>
                      <div style={{ display: 'grid', gap: '8px' }}>
                        <label style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>Work Title</label>
                        <input
                          value={finalTitle}
                          onChange={(event) => setFinalTitle(event.target.value)}
                          placeholder="Final work title"
                          style={{ padding: '8px', borderRadius: '8px', border: '1.5px solid #E2E8F0' }}
                        />
                        <label style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>Description</label>
                        <textarea
                          value={finalNotes}
                          onChange={(event) => setFinalNotes(event.target.value)}
                          placeholder="Briefly describe what was completed in this upload."
                          style={{ minHeight: '70px', padding: '8px', borderRadius: '8px', border: '1.5px solid #E2E8F0' }}
                        />
                        <label style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>Upload File</label>
                        <input type="file" onChange={(event) => setFinalFile(event.target.files?.[0] || null)} required />
                      </div>
                      <button
                        type="submit"
                        style={{ marginTop: '8px', padding: '8px 12px', borderRadius: '8px', border: 'none', background: '#2D6A4F', color: 'white', fontWeight: '700' }}
                      >
                        Upload Assignment
                      </button>
                    </form>

                    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
                      <div style={{ fontWeight: '700', fontSize: '13px', marginBottom: '8px' }}>Upload Progress</div>
                      <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '8px' }}>Upload your progress update for this room.</div>
                      <textarea
                        value={paragraphContent}
                        onChange={(event) => setParagraphContent(event.target.value)}
                        placeholder="Type your progress update..."
                        style={{ width: '100%', minHeight: '90px', padding: '9px', borderRadius: '8px', border: '1.5px solid #E2E8F0' }}
                      />
                      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '6px' }}>Current length: {paragraphContent.trim().length} characters</div>
                      <button
                        onClick={handleSubmitParagraph}
                        style={{ marginTop: '8px', padding: '8px 12px', borderRadius: '8px', border: 'none', background: '#8B8FD4', color: 'white', fontWeight: '700' }}
                      >
                        Upload Progress
                      </button>
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontWeight: '700', fontSize: '13px', marginBottom: '6px' }}>
                        Contribution Tracker ({slotWorkspace.slot?.slotLabel || 'Selected Slot'})
                      </div>
                      {contributionRows.length === 0 ? (
                        <div style={{ color: '#718096', fontSize: '12px' }}>No paragraph contributions yet.</div>
                      ) : (
                        contributionRows.map((entry) => {
                          return (
                            <div key={entry.userID} style={{ padding: '7px 0', borderBottom: '1px solid #EDF2F7', fontSize: '12px' }}>
                              <strong>{entry.name}</strong> · {entry.paragraphCount} paragraphs · {entry.totalWords} words · {entry.percentage.toFixed(1)}%
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontWeight: '700', fontSize: '13px', marginBottom: '6px' }}>
                        Loafing Alerts ({workspaceRoom.unitCode} · {slotWorkspace.slot?.slotLabel || 'No slot'})
                      </div>
                      {contributionRows.length === 0 ? (
                        <div style={{ color: '#718096', fontSize: '12px' }}>
                          Pick a slot and start uploading progress to generate loafing alerts.
                        </div>
                      ) : totalSlotContributionScore === 0 ? (
                        <div style={{ color: '#718096', fontSize: '12px' }}>
                          No progress scored yet for this slot.
                        </div>
                      ) : loafingMembers.length === 0 ? (
                        <div style={{ color: '#166534', fontSize: '12px' }}>
                          No loafing alerts. All slot members are at or above 30% contribution.
                        </div>
                      ) : (
                        loafingMembers.map((member) => (
                          <div key={`loafing-${member.userID}`} className="loafing-alert">
                            <div className="loafing-icon">⚠️</div>
                            <div>
                              <div className="loafing-title">{member.name} is below slot threshold</div>
                              <div className="loafing-text">
                                {member.percentage.toFixed(1)}% contribution in {workspaceRoom.unitCode} · {slotWorkspace.slot?.slotLabel}. Threshold: 30%.
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div>
                      <div style={{ fontWeight: '700', fontSize: '13px', marginBottom: '6px' }}>Uploaded Assignments</div>
                      {slotWorkspace.finalFiles.length === 0 ? (
                        <div style={{ color: '#718096', fontSize: '12px' }}>No assignments uploaded yet.</div>
                      ) : (
                        slotWorkspace.finalFiles.map((item) => (
                          <div key={item.finalFileID} style={{ padding: '10px 0', borderBottom: '1px solid #EDF2F7' }}>
                            <div style={{ fontWeight: '700', fontSize: '13px' }}>{item.title}</div>
                            <div style={{ fontSize: '12px', color: '#718096' }}>{item.notes || item.fileName} · {item.uploadedByName}</div>
                            <button
                              onClick={() => handleDownloadWork(item.finalFileID, item.fileName)}
                              style={{ marginTop: '6px', padding: '7px 10px', borderRadius: '8px', border: '1px solid #CBD5E0', background: 'white' }}
                            >
                              Download
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
