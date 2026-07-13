const express = require('express');
const { chatRateLimit, uploadRateLimit, reviewRateLimit } = require('../middleware/rateLimit.middleware');
const {
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
} = require('../controllers/rooms.controller');

const router = express.Router();

router.get('/', listRooms);
router.get('/mine', getMyRooms);
router.get('/joined', getJoinedRooms);
router.get('/:id/messages', listRoomMessages);
router.post('/:id/messages', chatRateLimit, sendRoomMessage);
router.get('/:id/slots', listRoomSlots);
router.post('/:id/slots', createRoomSlots);
router.post('/:id/slots/:slotId/join', joinRoomSlot);
router.delete('/:id/slots/:slotId/leave', leaveRoomSlot);
router.get('/:id/slot-workspace', getRoomSlotWorkspace);
router.post('/:id/slot-chat', chatRateLimit, sendRoomSlotMessage);
router.post('/:id/slot-paragraphs', submitRoomSlotParagraph);
router.get('/:id/slot-final-files', listRoomSlotFinalFiles);
router.post('/:id/slot-final-files', uploadRateLimit, uploadRoomFinalFile.single('finalFile'), uploadRoomSlotFinalFile);
router.get('/:id/slot-final-files/:finalFileId/download', downloadRoomSlotFinalFile);
router.patch('/:id/slot-final-files/:finalFileId/mark', markRoomSlotFinalFile);
router.get('/:id/slot-peer-reviews', listRoomSlotPeerReviews);
router.post('/:id/slot-peer-reviews', reviewRateLimit, submitRoomSlotPeerReview);
router.get('/:id/work', listRoomWork);
router.post('/:id/work', uploadRateLimit, uploadRoomWorkFile.single('workFile'), uploadRoomWork);
router.get('/:id/work/:workId/download', downloadRoomWork);
router.get('/:id', getRoom);
router.post('/', createRoom);
router.post('/join', joinRoom);
router.delete('/:id/leave', leaveRoom);
router.delete('/:id', deleteRoom);
router.get('/:id/group/:group', getMembersByGroup);

router.use((error, _req, res, next) => {
  if (error instanceof Error && error.name === 'MulterError') {
    return res.status(400).json({ message: error.message || 'Invalid upload request' });
  }

  return next(error);
});

module.exports = router;
