const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { pool } = require('../config/db');

const ROOM_WORK_DIR = path.resolve(__dirname, '..', 'uploads', 'room-work');
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.txt', '.png', '.jpg', '.jpeg', '.csv', '.zip']);
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/png',
  'image/jpeg',
  'text/csv',
  'application/zip',
  'application/x-zip-compressed',
]);

if (!fs.existsSync(ROOM_WORK_DIR)) {
  fs.mkdirSync(ROOM_WORK_DIR, { recursive: true });
}

const roomWorkStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, ROOM_WORK_DIR),
  filename: (_req, file, cb) => {
    const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safeOriginal}`);
  },
});

const uploadRoomWorkFile = multer({
  storage: roomWorkStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
});

const uploadRoomFinalFile = multer({
  storage: roomWorkStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const isAllowedExtension = ALLOWED_EXTENSIONS.has(extension);
    const isAllowedMimeType = ALLOWED_MIME_TYPES.has(String(file.mimetype || '').toLowerCase());

    if (!isAllowedExtension || !isAllowedMimeType) {
      return cb(new Error('Unsupported file type. Upload PDF, DOC, DOCX, TXT, PNG, JPG, CSV, or ZIP files only.'));
    }

    return cb(null, true);
  },
});

// Normalizes numeric route/query/body inputs and rejects non-positive values.
const parsePositiveInt = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

// Parses comma-separated group list into normalized unique uppercase group codes.
const parseAvailableGroups = (value) => {
  return String(value || '')
    .split(',')
    .map((group) => group.trim().toUpperCase())
    .filter(Boolean)
    .filter((group, index, arr) => arr.indexOf(group) === index);
};

// Role helper used for supervisor-specific access and behavior branches.
const isSupervisor = (role) => role === 'Supervisor';

// Loads minimal room metadata required for access checks and course/year matching.
const getRoomById = async (roomId) => {
  const [rows] = await pool.query(
    `SELECT roomID, supervisorID, availableGroups, courseName, yearOfStudy
     FROM unit_rooms
     WHERE roomID = ?
     LIMIT 1`,
    [roomId]
  );

  return rows[0] || null;
};

// Verifies that a user is currently enrolled as a member of a room.
const isRoomMember = async (roomId, userId) => {
  const [rows] = await pool.query(
    `SELECT membershipID FROM room_members WHERE roomID = ? AND userID = ? LIMIT 1`,
    [roomId, userId]
  );

  return rows.length > 0;
};

// Central room-level authorization check used by chat/work/slot endpoints.
const canAccessRoomWorkspace = async ({ roomId, userId, role }) => {
  const room = await getRoomById(roomId);
  if (!room) {
    return { allowed: false, room: null, reason: 'not_found' };
  }

  if (isSupervisor(role) && Number(room.supervisorID) === Number(userId)) {
    return { allowed: true, room, reason: 'owner' };
  }

  const member = await isRoomMember(roomId, userId);
  if (member) {
    return { allowed: true, room, reason: 'member' };
  }

  return { allowed: false, room, reason: 'forbidden' };
};

// Returns the student's active slot in a room (if any).
const getSlotMembership = async (roomId, userId) => {
  const [rows] = await pool.query(
    `SELECT sm.slotID, s.slotLabel
     FROM room_slot_members sm
     JOIN room_group_slots s ON s.slotID = sm.slotID
     WHERE sm.roomID = ? AND sm.userID = ?
     LIMIT 1`,
    [roomId, userId]
  );

  return rows[0] || null;
};

// Checks whether a user belongs to a specific slot in a room.
const getSlotMembershipBySlot = async (roomId, slotId, userId) => {
  const [rows] = await pool.query(
    `SELECT slotMemberID
     FROM room_slot_members
     WHERE roomID = ? AND slotID = ? AND userID = ?
     LIMIT 1`,
    [roomId, slotId, userId]
  );

  return rows.length > 0;
};

// Resolves the effective slot context: supervisors choose slotId, students use selected membership.
const resolveSlotContext = async ({ roomId, userId, role, requestedSlotId }) => {
  const access = await canAccessRoomWorkspace({ roomId, userId, role });
  if (!access.allowed) {
    return { ok: false, reason: access.reason, room: access.room, slot: null };
  }

  if (isSupervisor(role) && Number(access.room.supervisorID) === Number(userId)) {
    if (!requestedSlotId) {
      return { ok: false, reason: 'slot_required', room: access.room, slot: null };
    }

    const [slots] = await pool.query(
      `SELECT slotID, slotLabel
       FROM room_group_slots
       WHERE roomID = ? AND slotID = ?
       LIMIT 1`,
      [roomId, requestedSlotId]
    );

    if (slots.length === 0) {
      return { ok: false, reason: 'slot_not_found', room: access.room, slot: null };
    }

    return { ok: true, room: access.room, slot: slots[0] };
  }

  const membership = await getSlotMembership(roomId, userId);
  if (!membership) {
    return { ok: false, reason: 'slot_not_selected', room: access.room, slot: null };
  }

  return { ok: true, room: access.room, slot: membership };
};

// Converts word count into bounded contribution score for tracker and loafing calculations.
const scoreParagraphContribution = (wordCount) => {
  const scaled = Math.round(wordCount / 35);
  return Math.max(1, Math.min(20, scaled));
};

const listRooms = async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const course = String(req.query.course || '').trim();
    const year = parsePositiveInt(req.query.year);

    const whereClauses = [];
    const params = [];

    if (search) {
      whereClauses.push('(r.unitCode LIKE ? OR r.unitName LIKE ? OR r.courseName LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (course) {
      whereClauses.push('r.courseName LIKE ?');
      params.push(`%${course}%`);
    }

    if (year) {
      whereClauses.push('r.yearOfStudy = ?');
      params.push(year);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT r.roomID, r.supervisorID, r.unitCode, r.unitName, r.courseName, r.yearOfStudy,
              r.availableGroups, r.createdAt,
              s.name AS supervisorName,
              COUNT(rm.membershipID) AS memberCount
       FROM unit_rooms r
       JOIN users s ON s.userID = r.supervisorID
       LEFT JOIN room_members rm ON rm.roomID = r.roomID
       ${whereSql}
       GROUP BY r.roomID
       ORDER BY r.createdAt DESC`,
      params
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load rooms', error: error.message });
  }
};

const getMyRooms = async (req, res) => {
  try {
    if (!isSupervisor(req.user?.role)) {
      return res.status(403).json({ message: 'Supervisor role is required' });
    }

    const supervisorId = Number(req.user.userID);

    const [rows] = await pool.query(
      `SELECT r.roomID, r.supervisorID, r.unitCode, r.unitName, r.courseName, r.yearOfStudy,
              r.availableGroups, r.createdAt,
              COUNT(rm.membershipID) AS memberCount
       FROM unit_rooms r
       LEFT JOIN room_members rm ON rm.roomID = r.roomID
       WHERE r.supervisorID = ?
       GROUP BY r.roomID
       ORDER BY r.createdAt DESC`,
      [supervisorId]
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load your rooms', error: error.message });
  }
};

const getJoinedRooms = async (req, res) => {
  try {
    const userId = Number(req.user.userID);

    const [rows] = await pool.query(
      `SELECT r.roomID, r.supervisorID, r.unitCode, r.unitName, r.courseName, r.yearOfStudy,
              r.availableGroups, r.createdAt,
              rm.classGroup, rm.classGroup AS myGroup, rm.joinedAt,
              s.name AS supervisorName,
              counts.memberCount
       FROM room_members rm
       JOIN unit_rooms r ON r.roomID = rm.roomID
       JOIN users s ON s.userID = r.supervisorID
       LEFT JOIN (
         SELECT roomID, COUNT(*) AS memberCount
         FROM room_members
         GROUP BY roomID
       ) counts ON counts.roomID = r.roomID
       WHERE rm.userID = ?
       ORDER BY rm.joinedAt DESC`,
      [userId]
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load joined rooms', error: error.message });
  }
};

const getRoom = async (req, res) => {
  try {
    const roomId = parsePositiveInt(req.params.id);
    if (!roomId) {
      return res.status(400).json({ message: 'Invalid room ID' });
    }

    const userId = Number(req.user.userID);
    const role = req.user.role;

    const [rows] = await pool.query(
      `SELECT r.roomID, r.supervisorID, r.unitCode, r.unitName, r.courseName, r.yearOfStudy,
              r.availableGroups, r.createdAt,
              s.name AS supervisorName,
              COUNT(rm.membershipID) AS memberCount
       FROM unit_rooms r
       JOIN users s ON s.userID = r.supervisorID
       LEFT JOIN room_members rm ON rm.roomID = r.roomID
       WHERE r.roomID = ?
       GROUP BY r.roomID
       LIMIT 1`,
      [roomId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const room = rows[0];

    if (!isSupervisor(role)) {
      const [membership] = await pool.query(
        `SELECT membershipID FROM room_members WHERE roomID = ? AND userID = ? LIMIT 1`,
        [roomId, userId]
      );

      if (membership.length === 0) {
        return res.status(403).json({ message: 'You are not allowed to view this room' });
      }
    }

    return res.json(room);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load room', error: error.message });
  }
};

const createRoom = async (req, res) => {
  try {
    if (!isSupervisor(req.user?.role)) {
      return res.status(403).json({ message: 'Supervisor role is required' });
    }

    const supervisorId = Number(req.user.userID);
    const unitCode = String(req.body.unitCode || '').trim().toUpperCase();
    const unitName = String(req.body.unitName || '').trim();
    const courseName = String(req.body.courseName || '').trim();
    const yearOfStudy = parsePositiveInt(req.body.yearOfStudy);
    const availableGroups = parseAvailableGroups(req.body.availableGroups).join(',');

    if (!unitCode || !unitName || !courseName || !yearOfStudy || !availableGroups) {
      return res.status(400).json({
        message: 'unitCode, unitName, courseName, yearOfStudy, and availableGroups are required',
      });
    }

    const [result] = await pool.query(
      `INSERT INTO unit_rooms (supervisorID, unitCode, unitName, courseName, yearOfStudy, availableGroups)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [supervisorId, unitCode, unitName, courseName, yearOfStudy, availableGroups]
    );

    return res.status(201).json({ roomID: Number(result.insertId), message: 'Room created' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create room', error: error.message });
  }
};

const joinRoom = async (req, res) => {
  try {
    const userId = Number(req.user.userID);
    const role = req.user.role;

    if (isSupervisor(role)) {
      return res.status(400).json({ message: 'Supervisors do not join rooms as members' });
    }

    const roomId = parsePositiveInt(req.body.roomID);
    const classGroup = String(req.body.classGroup || '').trim().toUpperCase();

    if (!roomId || !classGroup) {
      return res.status(400).json({ message: 'roomID and classGroup are required' });
    }

    const room = await getRoomById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (Number(room.supervisorID) === Number(userId)) {
      return res.status(400).json({ message: 'You cannot join a room you created' });
    }

    const allowedGroups = parseAvailableGroups(room.availableGroups);

    if (!allowedGroups.includes(classGroup)) {
      return res.status(400).json({ message: 'Selected group is not available for this room' });
    }

    const [users] = await pool.query(
      `SELECT classGroup,
              COALESCE(NULLIF(TRIM(course), ''), NULLIF(TRIM(courseName), '')) AS userCourse,
              COALESCE(yearOfStudy, studyYear) AS userYear
       FROM users
       WHERE userID = ?
       LIMIT 1`,
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userGroup = String(users[0].classGroup || '').trim().toUpperCase();
    if (userGroup && userGroup !== classGroup) {
      return res.status(400).json({
        message: `You can only join as your assigned class group (${userGroup})`,
      });
    }

    const userCourse = String(users[0].userCourse || '').trim().toLowerCase();
    const roomCourse = String(room.courseName || '').trim().toLowerCase();
    const userYear = Number(users[0].userYear || 0);
    const roomYear = Number(room.yearOfStudy || 0);

    if (!userCourse || !userYear) {
      return res.status(400).json({
        message: 'Complete your profile with course and year before joining a unit room',
      });
    }

    if (userCourse !== roomCourse || userYear !== roomYear) {
      return res.status(400).json({
        message: `You can only join rooms for your unit (${room.courseName}, Year ${room.yearOfStudy})`,
      });
    }

    await pool.query(
      `INSERT INTO room_members (roomID, userID, classGroup)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE classGroup = VALUES(classGroup)`,
      [roomId, userId, classGroup]
    );

    return res.status(201).json({ message: 'Joined room successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to join room', error: error.message });
  }
};

const leaveRoom = async (req, res) => {
  try {
    const roomId = parsePositiveInt(req.params.id);
    if (!roomId) {
      return res.status(400).json({ message: 'Invalid room ID' });
    }

    const userId = Number(req.user.userID);

    await pool.query(
      `DELETE FROM room_members WHERE roomID = ? AND userID = ?`,
      [roomId, userId]
    );

    return res.json({ message: 'Left room successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to leave room', error: error.message });
  }
};

const deleteRoom = async (req, res) => {
  try {
    if (!isSupervisor(req.user?.role)) {
      return res.status(403).json({ message: 'Supervisor role is required' });
    }

    const roomId = parsePositiveInt(req.params.id);
    if (!roomId) {
      return res.status(400).json({ message: 'Invalid room ID' });
    }

    const supervisorId = Number(req.user.userID);

    const [owned] = await pool.query(
      `SELECT roomID FROM unit_rooms WHERE roomID = ? AND supervisorID = ? LIMIT 1`,
      [roomId, supervisorId]
    );

    if (owned.length === 0) {
      return res.status(403).json({ message: 'You can only delete rooms you created' });
    }

    await pool.query(`DELETE FROM unit_rooms WHERE roomID = ?`, [roomId]);

    return res.json({ message: 'Room deleted' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete room', error: error.message });
  }
};

const getMembersByGroup = async (req, res) => {
  try {
    if (!isSupervisor(req.user?.role)) {
      return res.status(403).json({ message: 'Supervisor role is required' });
    }

    const roomId = parsePositiveInt(req.params.id);
    const classGroup = String(req.params.group || '').trim().toUpperCase();

    if (!roomId || !classGroup) {
      return res.status(400).json({ message: 'Invalid room ID or class group' });
    }

    const supervisorId = Number(req.user.userID);

    const [owned] = await pool.query(
      `SELECT roomID FROM unit_rooms WHERE roomID = ? AND supervisorID = ? LIMIT 1`,
      [roomId, supervisorId]
    );

    if (owned.length === 0) {
      return res.status(403).json({ message: 'You can only view members for rooms you created' });
    }

    const [rows] = await pool.query(
      `SELECT u.userID, u.name, u.email, rm.classGroup, rm.joinedAt
       FROM room_members rm
       JOIN users u ON u.userID = rm.userID
       WHERE rm.roomID = ? AND rm.classGroup = ?
       ORDER BY u.name ASC`,
      [roomId, classGroup]
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load room members', error: error.message });
  }
};

const listRoomMessages = async (req, res) => {
  try {
    const roomId = parsePositiveInt(req.params.id);
    if (!roomId) {
      return res.status(400).json({ message: 'Invalid room ID' });
    }

    const userId = Number(req.user.userID);
    const role = req.user.role;
    const access = await canAccessRoomWorkspace({ roomId, userId, role });

    if (!access.allowed) {
      if (access.reason === 'not_found') return res.status(404).json({ message: 'Room not found' });
      return res.status(403).json({ message: 'You are not allowed to access this room' });
    }

    const [rows] = await pool.query(
      `SELECT m.messageID, m.roomID, m.userID, m.message, m.sentAt, u.name, u.role
       FROM room_messages m
       JOIN users u ON u.userID = m.userID
       WHERE m.roomID = ?
       ORDER BY m.sentAt ASC`,
      [roomId]
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load room messages', error: error.message });
  }
};

const sendRoomMessage = async (req, res) => {
  try {
    const roomId = parsePositiveInt(req.params.id);
    if (!roomId) {
      return res.status(400).json({ message: 'Invalid room ID' });
    }

    const userId = Number(req.user.userID);
    const role = req.user.role;
    const access = await canAccessRoomWorkspace({ roomId, userId, role });

    if (!access.allowed) {
      if (access.reason === 'not_found') return res.status(404).json({ message: 'Room not found' });
      return res.status(403).json({ message: 'You are not allowed to access this room' });
    }

    const message = String(req.body.message || '').trim();
    if (!message) {
      return res.status(400).json({ message: 'Message cannot be empty' });
    }

    if (message.length > 3000) {
      return res.status(400).json({ message: 'Message is too long' });
    }

    const [result] = await pool.query(
      `INSERT INTO room_messages (roomID, userID, message) VALUES (?, ?, ?)`,
      [roomId, userId, message]
    );

    return res.status(201).json({ messageID: Number(result.insertId), message: 'Message sent' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to send room message', error: error.message });
  }
};

// Returns all slots in a room, members per slot, and the caller's selected slot (mySlotID).
const listRoomSlots = async (req, res) => {
  try {
    const roomId = parsePositiveInt(req.params.id);
    if (!roomId) {
      return res.status(400).json({ message: 'Invalid room ID' });
    }

    const userId = Number(req.user.userID);
    const role = req.user.role;
    const access = await canAccessRoomWorkspace({ roomId, userId, role });

    if (!access.allowed) {
      if (access.reason === 'not_found') return res.status(404).json({ message: 'Room not found' });
      return res.status(403).json({ message: 'You are not allowed to access this room' });
    }

    const [slots] = await pool.query(
      `SELECT s.slotID, s.roomID, s.slotLabel, s.createdAt,
              COUNT(sm.slotMemberID) AS memberCount
       FROM room_group_slots s
       LEFT JOIN room_slot_members sm ON sm.slotID = s.slotID
       WHERE s.roomID = ?
       GROUP BY s.slotID
       ORDER BY s.slotID ASC`,
      [roomId]
    );

    const [members] = await pool.query(
      `SELECT sm.slotID, sm.userID, sm.joinedAt, u.name, u.email
       FROM room_slot_members sm
       JOIN users u ON u.userID = sm.userID
       JOIN unit_rooms r ON r.roomID = sm.roomID
       WHERE sm.roomID = ?
         AND LOWER(TRIM(COALESCE(NULLIF(u.course, ''), NULLIF(u.courseName, '')))) = LOWER(TRIM(r.courseName))
         AND COALESCE(u.yearOfStudy, u.studyYear) = r.yearOfStudy
       ORDER BY sm.joinedAt ASC`,
      [roomId]
    );

    const memberMap = members.reduce((acc, item) => {
      if (!acc[item.slotID]) acc[item.slotID] = [];
      acc[item.slotID].push(item);
      return acc;
    }, {});

    const [mine] = await pool.query(
      `SELECT slotID FROM room_slot_members WHERE roomID = ? AND userID = ? LIMIT 1`,
      [roomId, userId]
    );

    const mySlotID = mine.length > 0 ? Number(mine[0].slotID) : null;

    return res.json({
      slots: slots.map((slot) => ({
        ...slot,
        members: memberMap[slot.slotID] || [],
      })),
      mySlotID,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load room slots', error: error.message });
  }
};

const createRoomSlots = async (req, res) => {
  try {
    const roomId = parsePositiveInt(req.params.id);
    if (!roomId) {
      return res.status(400).json({ message: 'Invalid room ID' });
    }

    const userId = Number(req.user.userID);
    const role = req.user.role;
    const room = await getRoomById(roomId);

    if (!room) return res.status(404).json({ message: 'Room not found' });
    if (!isSupervisor(role) || Number(room.supervisorID) !== Number(userId)) {
      return res.status(403).json({ message: 'Only the room creator can manage slots' });
    }

    const count = parsePositiveInt(req.body.count);
    if (!count || count > 20) {
      return res.status(400).json({ message: 'count must be between 1 and 20' });
    }

    await pool.query(`DELETE FROM room_slot_members WHERE roomID = ?`, [roomId]);
    await pool.query(`DELETE FROM room_group_slots WHERE roomID = ?`, [roomId]);

    for (let index = 1; index <= count; index += 1) {
      await pool.query(
        `INSERT INTO room_group_slots (roomID, slotLabel, createdBy) VALUES (?, ?, ?)`,
        [roomId, `Group Slot ${index}`, userId]
      );
    }

    return res.status(201).json({ message: 'Group slots created', count });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create room slots', error: error.message });
  }
};

// Selects one slot for a student in a room by replacing any previous slot membership.
const joinRoomSlot = async (req, res) => {
  try {
    const roomId = parsePositiveInt(req.params.id);
    const slotId = parsePositiveInt(req.params.slotId);
    if (!roomId || !slotId) {
      return res.status(400).json({ message: 'Invalid room or slot ID' });
    }

    const userId = Number(req.user.userID);
    const role = req.user.role;

    if (isSupervisor(role)) {
      return res.status(400).json({ message: 'Supervisors cannot join group slots' });
    }

    const access = await canAccessRoomWorkspace({ roomId, userId, role });
    if (!access.allowed) {
      if (access.reason === 'not_found') return res.status(404).json({ message: 'Room not found' });
      return res.status(403).json({ message: 'Join the room first before selecting a slot' });
    }

    const [slotRows] = await pool.query(
      `SELECT slotID FROM room_group_slots WHERE slotID = ? AND roomID = ? LIMIT 1`,
      [slotId, roomId]
    );

    if (slotRows.length === 0) {
      return res.status(404).json({ message: 'Slot not found for this room' });
    }

    await pool.query(`DELETE FROM room_slot_members WHERE roomID = ? AND userID = ?`, [roomId, userId]);

    await pool.query(
      `INSERT INTO room_slot_members (slotID, roomID, userID) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE slotID = VALUES(slotID)`,
      [slotId, roomId, userId]
    );

    return res.json({ message: 'Slot selected successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to join slot', error: error.message });
  }
};

const leaveRoomSlot = async (req, res) => {
  try {
    const roomId = parsePositiveInt(req.params.id);
    const slotId = parsePositiveInt(req.params.slotId);
    if (!roomId || !slotId) {
      return res.status(400).json({ message: 'Invalid room or slot ID' });
    }

    const userId = Number(req.user.userID);
    await pool.query(
      `DELETE FROM room_slot_members WHERE roomID = ? AND slotID = ? AND userID = ?`,
      [roomId, slotId, userId]
    );

    return res.json({ message: 'Slot left successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to leave slot', error: error.message });
  }
};

// Loads the active slot workspace payload: slot chat, progress paragraphs, final files, and contribution summary.
const getRoomSlotWorkspace = async (req, res) => {
  try {
    const roomId = parsePositiveInt(req.params.id);
    const slotId = parsePositiveInt(req.query.slotId);
    if (!roomId) {
      return res.status(400).json({ message: 'Invalid room ID' });
    }

    const userId = Number(req.user.userID);
    const role = req.user.role;
    const context = await resolveSlotContext({
      roomId,
      userId,
      role,
      requestedSlotId: slotId,
    });

    if (!context.ok) {
      if (context.reason === 'not_found') return res.status(404).json({ message: 'Room not found' });
      if (context.reason === 'slot_required') {
        return res.status(400).json({ message: 'slotId query parameter is required for supervisors' });
      }
      if (context.reason === 'slot_not_found') return res.status(404).json({ message: 'Slot not found for this room' });
      if (context.reason === 'slot_not_selected') {
        return res.status(409).json({ message: 'Select a slot first to access slot workspace' });
      }
      return res.status(403).json({ message: 'You are not allowed to access this room' });
    }

    const activeSlotId = Number(context.slot.slotID);

    const [messages, paragraphs, finalFiles, contributionSummary] = await Promise.all([
      pool.query(
        `SELECT sm.messageID, sm.roomID, sm.slotID, sm.userID, sm.message, sm.sentAt,
                u.name, u.role
         FROM room_slot_messages sm
         JOIN users u ON u.userID = sm.userID
         WHERE sm.roomID = ? AND sm.slotID = ?
         ORDER BY sm.sentAt ASC`,
        [roomId, activeSlotId]
      ),
      pool.query(
        `SELECT p.paragraphID, p.roomID, p.slotID, p.userID, p.content, p.wordCount,
                p.contributionScore, p.submittedAt, u.name
         FROM room_slot_paragraphs p
         JOIN users u ON u.userID = p.userID
         WHERE p.roomID = ? AND p.slotID = ?
         ORDER BY p.submittedAt DESC`,
        [roomId, activeSlotId]
      ),
      pool.query(
        `SELECT f.finalFileID, f.roomID, f.slotID, f.uploadedBy, f.title, f.notes,
                f.fileName, f.uploadedAt, f.markStatus, f.markerComment,
                u.name AS uploadedByName
         FROM room_slot_final_files f
         JOIN users u ON u.userID = f.uploadedBy
         WHERE f.roomID = ? AND f.slotID = ?
         ORDER BY f.uploadedAt DESC`,
        [roomId, activeSlotId]
      ),
      pool.query(
        `SELECT sm.userID,
                u.name,
                COUNT(p.paragraphID) AS paragraphCount,
                COALESCE(SUM(p.wordCount), 0) AS totalWords,
                COALESCE(SUM(p.contributionScore), 0) AS totalContributionScore
         FROM room_slot_members sm
         JOIN users u ON u.userID = sm.userID
         JOIN unit_rooms r ON r.roomID = sm.roomID
         LEFT JOIN room_slot_paragraphs p
           ON p.roomID = sm.roomID
          AND p.slotID = sm.slotID
          AND p.userID = sm.userID
         WHERE sm.roomID = ?
           AND sm.slotID = ?
           AND LOWER(TRIM(COALESCE(NULLIF(u.course, ''), NULLIF(u.courseName, '')))) = LOWER(TRIM(r.courseName))
           AND COALESCE(u.yearOfStudy, u.studyYear) = r.yearOfStudy
         GROUP BY sm.userID, u.name
         ORDER BY totalContributionScore DESC, totalWords DESC, u.name ASC`,
        [roomId, activeSlotId]
      ),
    ]);

    return res.json({
      slot: { slotID: activeSlotId, slotLabel: context.slot.slotLabel },
      messages: messages[0],
      paragraphs: paragraphs[0],
      finalFiles: finalFiles[0],
      contributionSummary: contributionSummary[0],
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load slot workspace', error: error.message });
  }
};

const sendRoomSlotMessage = async (req, res) => {
  try {
    const roomId = parsePositiveInt(req.params.id);
    if (!roomId) {
      return res.status(400).json({ message: 'Invalid room ID' });
    }

    const userId = Number(req.user.userID);
    const role = req.user.role;
    const context = await resolveSlotContext({
      roomId,
      userId,
      role,
      requestedSlotId: parsePositiveInt(req.body.slotId),
    });

    if (!context.ok) {
      if (context.reason === 'not_found') return res.status(404).json({ message: 'Room not found' });
      if (context.reason === 'slot_not_selected') {
        return res.status(409).json({ message: 'Select a slot first before sending slot messages' });
      }
      return res.status(403).json({ message: 'You are not allowed to send slot messages' });
    }

    const message = String(req.body.message || '').trim();
    if (!message) {
      return res.status(400).json({ message: 'Message cannot be empty' });
    }

    if (message.length > 3000) {
      return res.status(400).json({ message: 'Message is too long' });
    }

    const [result] = await pool.query(
      `INSERT INTO room_slot_messages (roomID, slotID, userID, message)
       VALUES (?, ?, ?, ?)`,
      [roomId, context.slot.slotID, userId, message]
    );

    return res.status(201).json({ messageID: Number(result.insertId), message: 'Slot message sent' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to send slot message', error: error.message });
  }
};

// Stores paragraph progress and computes contribution score used by tracker/loafing calculations.
const submitRoomSlotParagraph = async (req, res) => {
  try {
    const roomId = parsePositiveInt(req.params.id);
    if (!roomId) {
      return res.status(400).json({ message: 'Invalid room ID' });
    }

    const userId = Number(req.user.userID);
    const role = req.user.role;
    if (isSupervisor(role)) {
      return res.status(400).json({ message: 'Only students can submit paragraph work' });
    }

    const context = await resolveSlotContext({ roomId, userId, role, requestedSlotId: null });
    if (!context.ok) {
      if (context.reason === 'not_found') return res.status(404).json({ message: 'Room not found' });
      if (context.reason === 'slot_not_selected') {
        return res.status(409).json({ message: 'Select a slot first before submitting paragraph work' });
      }
      return res.status(403).json({ message: 'You are not allowed to submit slot work' });
    }

    const content = String(req.body.content ?? '');

    const words = content.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const contributionScore = scoreParagraphContribution(wordCount);

    const [result] = await pool.query(
      `INSERT INTO room_slot_paragraphs (roomID, slotID, userID, content, wordCount, contributionScore)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [roomId, context.slot.slotID, userId, content, wordCount, contributionScore]
    );

    return res.status(201).json({
      paragraphID: Number(result.insertId),
      wordCount,
      contributionScore,
      message: 'Paragraph work submitted and added to contribution tracker',
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to submit paragraph work', error: error.message });
  }
};

// Stores student final assignment uploads tied to room and selected slot for supervisor marking.
const uploadRoomSlotFinalFile = async (req, res) => {
  try {
    const roomId = parsePositiveInt(req.params.id);
    if (!roomId) {
      return res.status(400).json({ message: 'Invalid room ID' });
    }

    const userId = Number(req.user.userID);
    const role = req.user.role;
    if (isSupervisor(role)) {
      return res.status(400).json({ message: 'Only students can upload final slot work files' });
    }

    const context = await resolveSlotContext({ roomId, userId, role, requestedSlotId: null });
    if (!context.ok) {
      if (context.reason === 'not_found') return res.status(404).json({ message: 'Room not found' });
      if (context.reason === 'slot_not_selected') {
        return res.status(409).json({ message: 'Select a slot first before uploading final work' });
      }
      return res.status(403).json({ message: 'You are not allowed to upload final slot work' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Final work file is required' });
    }

    const title = String(req.body.title || '').trim() || req.file.originalname;
    const notes = String(req.body.notes || '').trim() || null;

    const [result] = await pool.query(
      `INSERT INTO room_slot_final_files (roomID, slotID, uploadedBy, title, notes, fileName, filePath)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [roomId, context.slot.slotID, userId, title, notes, req.file.originalname, req.file.path]
    );

    return res.status(201).json({ finalFileID: Number(result.insertId), message: 'Final work uploaded and ready for marking' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to upload final slot work', error: error.message });
  }
};

// Lists all final files submitted across slots in a room (used by supervisor review UI).
const listRoomSlotFinalFiles = async (req, res) => {
  try {
    const roomId = parsePositiveInt(req.params.id);
    if (!roomId) {
      return res.status(400).json({ message: 'Invalid room ID' });
    }

    const userId = Number(req.user.userID);
    const role = req.user.role;
    const access = await canAccessRoomWorkspace({ roomId, userId, role });

    if (!access.allowed) {
      if (access.reason === 'not_found') return res.status(404).json({ message: 'Room not found' });
      return res.status(403).json({ message: 'You are not allowed to access this room' });
    }

    const [rows] = await pool.query(
      `SELECT f.finalFileID, f.roomID, f.slotID, f.uploadedBy, f.title, f.notes, f.fileName,
              f.uploadedAt, f.markStatus, f.markerComment,
              s.slotLabel, u.name AS uploadedByName, marker.name AS markedByName
       FROM room_slot_final_files f
       JOIN room_group_slots s ON s.slotID = f.slotID
       JOIN users u ON u.userID = f.uploadedBy
       LEFT JOIN users marker ON marker.userID = f.markedBy
       WHERE f.roomID = ?
       ORDER BY f.uploadedAt DESC`,
      [roomId]
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load final slot files', error: error.message });
  }
};

// Downloads one final slot submission file after room-access validation.
const downloadRoomSlotFinalFile = async (req, res) => {
  try {
    const roomId = parsePositiveInt(req.params.id);
    const finalFileId = parsePositiveInt(req.params.finalFileId);
    if (!roomId || !finalFileId) {
      return res.status(400).json({ message: 'Invalid room or final file ID' });
    }

    const userId = Number(req.user.userID);
    const role = req.user.role;
    const access = await canAccessRoomWorkspace({ roomId, userId, role });

    if (!access.allowed) {
      if (access.reason === 'not_found') return res.status(404).json({ message: 'Room not found' });
      return res.status(403).json({ message: 'You are not allowed to access this room' });
    }

    const [rows] = await pool.query(
      `SELECT finalFileID, fileName, filePath
       FROM room_slot_final_files
       WHERE roomID = ? AND finalFileID = ?
       LIMIT 1`,
      [roomId, finalFileId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Final work file not found' });
    }

    const record = rows[0];
    const absolutePath = path.resolve(record.filePath);
    if (!absolutePath.startsWith(ROOM_WORK_DIR) || !fs.existsSync(absolutePath)) {
      return res.status(404).json({ message: 'Final work file not found' });
    }

    return res.download(absolutePath, record.fileName || path.basename(absolutePath));
  } catch (error) {
    return res.status(500).json({ message: 'Failed to download final slot work', error: error.message });
  }
};

const markRoomSlotFinalFile = async (req, res) => {
  try {
    const roomId = parsePositiveInt(req.params.id);
    const finalFileId = parsePositiveInt(req.params.finalFileId);
    if (!roomId || !finalFileId) {
      return res.status(400).json({ message: 'Invalid room or final file ID' });
    }

    const userId = Number(req.user.userID);
    const role = req.user.role;
    const room = await getRoomById(roomId);

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (!isSupervisor(role) || Number(room.supervisorID) !== Number(userId)) {
      return res.status(403).json({ message: 'Only the room supervisor can mark final slot submissions' });
    }

    const markerComment = String(req.body.markerComment || '').trim() || null;
    const markStatus = 'Marked';

    const [result] = await pool.query(
      `UPDATE room_slot_final_files
       SET markStatus = ?, markerComment = ?, markedBy = ?, markedAt = NOW()
       WHERE roomID = ? AND finalFileID = ?`,
      [markStatus, markerComment, userId, roomId, finalFileId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Final slot file not found' });
    }

    return res.json({ message: 'Final slot submission marked successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to mark final slot submission', error: error.message });
  }
};

// Returns peer reviews scoped to room+slot; students use their own slot, supervisors pass slotId.
const listRoomSlotPeerReviews = async (req, res) => {
  try {
    const roomId = parsePositiveInt(req.params.id);
    if (!roomId) {
      return res.status(400).json({ message: 'Invalid room ID' });
    }

    const userId = Number(req.user.userID);
    const role = req.user.role;
    const requestedSlotId = parsePositiveInt(req.query.slotId);
    const slotContext = await resolveSlotContext({
      roomId,
      userId,
      role,
      requestedSlotId,
    });

    if (!slotContext.ok) {
      if (slotContext.reason === 'not_found') {
        return res.status(404).json({ message: 'Room not found' });
      }

      if (slotContext.reason === 'forbidden') {
        return res.status(403).json({ message: 'You are not allowed to access this room' });
      }

      if (slotContext.reason === 'slot_required') {
        return res.status(400).json({ message: 'slotId is required for supervisor review view' });
      }

      if (slotContext.reason === 'slot_not_found') {
        return res.status(404).json({ message: 'Selected slot was not found for this room' });
      }

      return res.status(409).json({ message: 'Select a slot first to access peer reviews' });
    }

    const [rows] = await pool.query(
      `SELECT r.slotReviewID, r.roomID, r.slotID, r.reviewerID, r.reviewedUserID,
              r.rating, r.comment, r.submittedAt,
              reviewer.name AS reviewerName,
              reviewed.name AS reviewedName
       FROM room_slot_peer_reviews r
       JOIN users reviewer ON reviewer.userID = r.reviewerID
       JOIN users reviewed ON reviewed.userID = r.reviewedUserID
       WHERE r.roomID = ? AND r.slotID = ?
       ORDER BY r.submittedAt DESC`,
      [roomId, Number(slotContext.slot.slotID)]
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load slot peer reviews', error: error.message });
  }
};

// Inserts one peer review with strict same-slot checks and duplicate/self-review protection.
const submitRoomSlotPeerReview = async (req, res) => {
  try {
    const roomId = parsePositiveInt(req.params.id);
    if (!roomId) {
      return res.status(400).json({ message: 'Invalid room ID' });
    }

    const reviewerID = Number(req.user.userID);
    const role = req.user.role;
    if (isSupervisor(role)) {
      return res.status(400).json({ message: 'Supervisors do not submit slot peer reviews' });
    }

    const reviewedUserID = parsePositiveInt(req.body.reviewedUserID);
    const rating = Number(req.body.rating);
    const comment = String(req.body.comment || '').trim() || null;

    if (!reviewedUserID || Number.isNaN(rating)) {
      return res.status(400).json({ message: 'reviewedUserID and rating are required' });
    }

    if (reviewerID === reviewedUserID) {
      return res.status(400).json({ message: 'You cannot review yourself' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'rating must be between 1 and 5' });
    }

    const mySlot = await getSlotMembership(roomId, reviewerID);
    if (!mySlot) {
      return res.status(409).json({ message: 'Select a slot first before submitting peer review' });
    }

    const sameSlot = await getSlotMembershipBySlot(roomId, Number(mySlot.slotID), reviewedUserID);
    if (!sameSlot) {
      return res.status(400).json({ message: 'You can only review members in your selected slot' });
    }

    const [existing] = await pool.query(
      `SELECT slotReviewID
       FROM room_slot_peer_reviews
       WHERE roomID = ? AND slotID = ? AND reviewerID = ? AND reviewedUserID = ?
       LIMIT 1`,
      [roomId, Number(mySlot.slotID), reviewerID, reviewedUserID]
    );

    if (existing.length > 0) {
      return res.status(409).json({ message: 'You have already reviewed this member for this slot' });
    }

    const [result] = await pool.query(
      `INSERT INTO room_slot_peer_reviews (roomID, slotID, reviewerID, reviewedUserID, rating, comment)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [roomId, Number(mySlot.slotID), reviewerID, reviewedUserID, rating, comment]
    );

    return res.status(201).json({ slotReviewID: Number(result.insertId), message: 'Peer review submitted' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to submit slot peer review', error: error.message });
  }
};

const listRoomWork = async (req, res) => {
  try {
    const roomId = parsePositiveInt(req.params.id);
    if (!roomId) {
      return res.status(400).json({ message: 'Invalid room ID' });
    }

    const userId = Number(req.user.userID);
    const role = req.user.role;
    const access = await canAccessRoomWorkspace({ roomId, userId, role });

    if (!access.allowed) {
      if (access.reason === 'not_found') return res.status(404).json({ message: 'Room not found' });
      return res.status(403).json({ message: 'You are not allowed to access this room' });
    }

    const [rows] = await pool.query(
      `SELECT w.workID, w.roomID, w.uploadedBy, w.title, w.description, w.fileName, w.uploadedAt,
              u.name AS uploadedByName
       FROM room_work_items w
       JOIN users u ON u.userID = w.uploadedBy
       WHERE w.roomID = ?
       ORDER BY w.uploadedAt DESC`,
      [roomId]
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load room work', error: error.message });
  }
};

const uploadRoomWork = async (req, res) => {
  try {
    const roomId = parsePositiveInt(req.params.id);
    if (!roomId) {
      return res.status(400).json({ message: 'Invalid room ID' });
    }

    const userId = Number(req.user.userID);
    const role = req.user.role;
    const room = await getRoomById(roomId);

    if (!room) return res.status(404).json({ message: 'Room not found' });
    if (!isSupervisor(role) || Number(room.supervisorID) !== Number(userId)) {
      return res.status(403).json({ message: 'Only the room creator can upload group work' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'File is required' });
    }

    const title = String(req.body.title || '').trim() || req.file.originalname;
    const description = String(req.body.description || '').trim() || null;

    const [result] = await pool.query(
      `INSERT INTO room_work_items (roomID, uploadedBy, title, description, fileName, filePath)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [roomId, userId, title, description, req.file.originalname, req.file.path]
    );

    return res.status(201).json({ workID: Number(result.insertId), message: 'Group work uploaded' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to upload room work', error: error.message });
  }
};

const downloadRoomWork = async (req, res) => {
  try {
    const roomId = parsePositiveInt(req.params.id);
    const workId = parsePositiveInt(req.params.workId);
    if (!roomId || !workId) {
      return res.status(400).json({ message: 'Invalid room or work ID' });
    }

    const userId = Number(req.user.userID);
    const role = req.user.role;
    const access = await canAccessRoomWorkspace({ roomId, userId, role });

    if (!access.allowed) {
      if (access.reason === 'not_found') return res.status(404).json({ message: 'Room not found' });
      return res.status(403).json({ message: 'You are not allowed to access this room' });
    }

    const [rows] = await pool.query(
      `SELECT workID, fileName, filePath FROM room_work_items WHERE workID = ? AND roomID = ? LIMIT 1`,
      [workId, roomId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Work file not found' });
    }

    const record = rows[0];
    const absolutePath = path.resolve(record.filePath);
    if (!absolutePath.startsWith(ROOM_WORK_DIR) || !fs.existsSync(absolutePath)) {
      return res.status(404).json({ message: 'Work file not found' });
    }

    return res.download(absolutePath, record.fileName || path.basename(absolutePath));
  } catch (error) {
    return res.status(500).json({ message: 'Failed to download room work', error: error.message });
  }
};

module.exports = {
  uploadRoomWorkFile,
  uploadRoomFinalFile,
  listRooms,
  getMyRooms,
  getJoinedRooms,
  getRoom,
  createRoom,
  joinRoom,
  leaveRoom,
  deleteRoom,
  getMembersByGroup,
  listRoomMessages,
  sendRoomMessage,
  listRoomSlots,
  createRoomSlots,
  joinRoomSlot,
  leaveRoomSlot,
  getRoomSlotWorkspace,
  sendRoomSlotMessage,
  submitRoomSlotParagraph,
  uploadRoomSlotFinalFile,
  listRoomSlotFinalFiles,
  downloadRoomSlotFinalFile,
  markRoomSlotFinalFile,
  listRoomSlotPeerReviews,
  submitRoomSlotPeerReview,
  listRoomWork,
  uploadRoomWork,
  downloadRoomWork,
};
