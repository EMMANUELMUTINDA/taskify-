const resolveApiBase = () => { // resolves API base URL by environment.
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }

  if (typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname;

    if (host === 'localhost' || host === '127.0.0.1') {
      return `http://${host}:5000/api`;
    }

    return `${window.location.origin}/api`;
  }

  return 'http://localhost:5000/api';
};

const API_BASE = resolveApiBase();
const LOCAL_REVIEW_KEY = 'taskify-peer-reviews';

async function request(path, token, options = {}) { // requests an operation for request.
  const method = options.method || 'GET';
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    let message = `API request failed: ${response.status}`;

    try {
      const data = await response.json();
      if (data?.message) {
        message = data.message;
      }
    } catch (_error) {
      // Keep fallback message when response body is not JSON.
    }

    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

export async function getProjects(token) { // fetches data for get projects.
  return request('/projects', token);
}

export async function createProject(payload, token) { // creates data for create project.
  return request('/projects', token, {
    method: 'POST',
    body: payload,
  });
}

export async function addProjectMember(projectId, payload, token) { // handles API workflow for add project member.
  return request(`/projects/${projectId}/members`, token, {
    method: 'POST',
    body: payload,
  });
}

export async function allocateGroupToProject(projectId, payload, token) { // handles API workflow for allocate group to project.
  return request(`/projects/${projectId}/allocate-group`, token, {
    method: 'POST',
    body: payload,
  });
}

export async function getProjectMembers(projectId, token) { // fetches data for get project members.
  return request(`/projects/${projectId}/members`, token);
}

export async function getProjectOverview(projectId, token) { // fetches data for get project overview.
  return request(`/analytics/projects/${projectId}/overview`, token);
}

export async function downloadProjectReportPdf(projectId, token) { // downloads file payload for download project report pdf.
  const response = await fetch(`${API_BASE}/analytics/projects/${projectId}/report/pdf`, {
    method: 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    let message = `API request failed: ${response.status}`;

    try {
      const data = await response.json();
      if (data?.message) {
        message = data.message;
      }
    } catch (_error) {
      // Keep fallback message when response body is not JSON.
    }

    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get('content-disposition') || '';
  return { blob, contentDisposition };
}

function readLocalReviews() { // reads cached peer reviews from local storage.
  try {
    const raw = localStorage.getItem(LOCAL_REVIEW_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_error) {
    return [];
  }
}

function writeLocalReviews(reviews) { // writes peer review cache to local storage.
  localStorage.setItem(LOCAL_REVIEW_KEY, JSON.stringify(reviews));
}

export async function getDashboard(projectId, token) { // fetches data for get dashboard.
  const members = await request(`/projects/${projectId}/members`, token);

  const result = await Promise.all(
    members.map(async (member) => {
      try {
        const analytics = await request(
          `/analytics/projects/${projectId}/members/${member.userID}`,
          token
        );

        return {
          userID: member.userID,
          name: member.name,
          totalScore: analytics.score,
          lastActive: analytics.lastActiveAt,
          totalTasks: 0,
          completedTasks: 0,
        };
      } catch (_error) {
        return {
          userID: member.userID,
          name: member.name,
          totalScore: 0,
          lastActive: null,
          totalTasks: 0,
          completedTasks: 0,
        };
      }
    })
  );

  return result;
}

export async function getUsers(token) { // fetches data for get users.
  try {
    return await request('/users', token);
  } catch (_error) {
    const projects = await getProjects(token);
    const membersById = new Map();

    await Promise.all(
      projects.map(async (project) => {
        try {
          const members = await request(`/projects/${project.projectID}/members`, token);
          members.forEach((member) => {
            membersById.set(Number(member.userID), {
              userID: Number(member.userID),
              name: member.name,
              email: member.email,
              role: member.role,
            });
          });
        } catch (_innerError) {
          // Ignore member fetch errors for individual projects.
        }
      })
    );

    return Array.from(membersById.values());
  }
}

export async function getReviews(projectId, token) { // fetches data for get reviews.
  try {
    return await request(`/reviews?projectId=${projectId}`, token);
  } catch (_error) {
    return readLocalReviews().filter((review) => Number(review.projectID) === Number(projectId));
  }
}

export async function submitReview(payload, token) { // handles API workflow for submit review.
  try {
    return await request('/reviews', token, {
      method: 'POST',
      body: payload,
    });
  } catch (_error) {
    const localReviews = readLocalReviews();
    const record = {
      reviewID: Date.now(),
      reviewerID: payload.reviewerID ? Number(payload.reviewerID) : null,
      reviewedUserID: Number(payload.reviewedUserID),
      projectID: Number(payload.projectID),
      rating: Number(payload.rating),
      comment: payload.comment || '',
      submittedAt: new Date().toISOString(),
    };

    localReviews.unshift(record);
    writeLocalReviews(localReviews);
    return { message: 'Peer review submitted' };
  }
}

export async function getAlerts(token) { // fetches data for get alerts.
  return request('/alerts', token);
}

export async function resolveAlert(alertId, token) { // handles API workflow for resolve alert.
  return request(`/alerts/${alertId}/resolve`, token, {
    method: 'PATCH',
  });
}

export async function registerUser(payload, token) { // registers data for register user.
  return request('/users/register', token, {
    method: 'POST',
    body: payload,
  });
}

export async function getClassGroups(token, filters = {}) { // fetches data for get class groups.
  const params = new URLSearchParams();

  if (filters.courseName) params.set('courseName', filters.courseName);
  if (filters.unitCode) params.set('unitCode', filters.unitCode);
  if (filters.classGroup) params.set('classGroup', filters.classGroup);
  if (filters.studyYear) params.set('studyYear', String(filters.studyYear));

  const suffix = params.toString() ? `?${params.toString()}` : '';
  return request(`/users/class-groups${suffix}`, token);
}

export async function createClassGroup(payload, token) { // creates data for create class group.
  return request('/users/class-groups', token, {
    method: 'POST',
    body: payload,
  });
}

export async function updateMyAcademicProfile(payload, token) { // updates data for update my academic profile.
  return request('/users/me/academic-profile', token, {
    method: 'PATCH',
    body: payload,
  });
}

export async function updateProfile(payload, token) { // updates data for update profile.
  return request('/profile', token, {
    method: 'PUT',
    body: payload,
  });
}

export async function createRoom(payload, token) { // creates data for create room.
  return request('/rooms', token, {
    method: 'POST',
    body: payload,
  });
}

export async function getRooms(params = {}, token) { // fetches data for get rooms.
  const query = new URLSearchParams(params).toString();
  const suffix = query ? `?${query}` : '';
  return request(`/rooms${suffix}`, token);
}

export async function getMyRooms(token) { // fetches data for get my rooms.
  return request('/rooms/mine', token);
}

export async function getJoinedRooms(token) { // fetches data for get joined rooms.
  return request('/rooms/joined', token);
}

export async function getRoom(id, token) { // fetches data for get room.
  return request(`/rooms/${id}`, token);
}

export async function joinRoom(payload, token) { // submits a join action for join room.
  return request('/rooms/join', token, {
    method: 'POST',
    body: payload,
  });
}

export async function leaveRoom(id, token) { // submits a leave action for leave room.
  return request(`/rooms/${id}/leave`, token, {
    method: 'DELETE',
  });
}

export async function deleteRoom(id, token) { // deletes data for delete room.
  return request(`/rooms/${id}`, token, {
    method: 'DELETE',
  });
}

export async function getMembersByGroup(id, group, token) { // fetches data for get members by group.
  const encodedGroup = encodeURIComponent(group);
  return request(`/rooms/${id}/group/${encodedGroup}`, token);
}

export async function getRoomMessages(id, token) { // fetches data for get room messages.
  return request(`/rooms/${id}/messages`, token);
}

export async function sendRoomMessage(id, payload, token) { // sends data for send room message.
  return request(`/rooms/${id}/messages`, token, {
    method: 'POST',
    body: payload,
  });
}

export async function getRoomSlots(id, token) { // fetches data for get room slots.
  // Includes slots and mySlotID to drive slot-gated UI behavior on the client.
  return request(`/rooms/${id}/slots`, token);
}

export async function createRoomSlots(id, payload, token) { // creates data for create room slots.
  return request(`/rooms/${id}/slots`, token, {
    method: 'POST',
    body: payload,
  });
}

export async function joinRoomSlot(id, slotId, token) { // submits a join action for join room slot.
  return request(`/rooms/${id}/slots/${slotId}/join`, token, {
    method: 'POST',
  });
}

export async function leaveRoomSlot(id, slotId, token) { // submits a leave action for leave room slot.
  return request(`/rooms/${id}/slots/${slotId}/leave`, token, {
    method: 'DELETE',
  });
}

export async function getRoomSlotWorkspace(id, token, slotId) { // fetches data for get room slot workspace.
  // Returns slot-scoped chat/progress/final files/contribution summary in one payload.
  const suffix = slotId ? `?slotId=${encodeURIComponent(slotId)}` : '';
  return request(`/rooms/${id}/slot-workspace${suffix}`, token);
}

export async function sendRoomSlotMessage(id, payload, token) { // sends data for send room slot message.
  return request(`/rooms/${id}/slot-chat`, token, {
    method: 'POST',
    body: payload,
  });
}

export async function submitRoomSlotParagraph(id, payload, token) { // creates data for submit room slot paragraph.
  // Persists paragraph progress; backend computes contribution score for analytics/alerts.
  return request(`/rooms/${id}/slot-paragraphs`, token, {
    method: 'POST',
    body: payload,
  });
}

export async function getRoomSlotFinalFiles(id, token) { // fetches data for get room slot final files.
  // Used by supervisors to view all slot submissions for the selected room.
  return request(`/rooms/${id}/slot-final-files`, token);
}

export async function uploadRoomSlotFinalFile(id, formData, token) { // uploads file payload for upload room slot final file.
  // Student final assignment upload endpoint; multipart form with file + metadata.
  const response = await fetch(`${API_BASE}/rooms/${id}/slot-final-files`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!response.ok) {
    let message = `API request failed: ${response.status}`;

    try {
      const data = await response.json();
      if (data?.message) {
        message = data.message;
      }
    } catch (_error) {
      // Keep fallback message when response body is not JSON.
    }

    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

export async function downloadRoomSlotFinalFile(id, finalFileId, token) { // downloads file payload for download room slot final file.
  const response = await fetch(`${API_BASE}/rooms/${id}/slot-final-files/${finalFileId}/download`, {
    method: 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    let message = `API request failed: ${response.status}`;

    try {
      const data = await response.json();
      if (data?.message) {
        message = data.message;
      }
    } catch (_error) {
      // Keep fallback message when response body is not JSON.
    }

    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return {
    blob: await response.blob(),
    contentDisposition: response.headers.get('content-disposition') || '',
  };
}

export async function markRoomSlotFinalFile(id, finalFileId, payload, token) { // updates data for mark room slot final file.
  return request(`/rooms/${id}/slot-final-files/${finalFileId}/mark`, token, {
    method: 'PATCH',
    body: payload,
  });
}

export async function getRoomSlotPeerReviews(id, token, slotId) { // fetches data for get room slot peer reviews.
  // slotId is optional and used for supervisor slot filtering.
  const suffix = slotId ? `?slotId=${encodeURIComponent(slotId)}` : '';
  return request(`/rooms/${id}/slot-peer-reviews${suffix}`, token);
}

export async function submitRoomSlotPeerReview(id, payload, token) { // creates data for submit room slot peer review.
  // Student peer review submission; backend enforces same-slot and uniqueness rules.
  return request(`/rooms/${id}/slot-peer-reviews`, token, {
    method: 'POST',
    body: payload,
  });
}

export async function getRoomWork(id, token) { // fetches data for get room work.
  return request(`/rooms/${id}/work`, token);
}

export async function uploadRoomWork(id, formData, token) { // uploads file payload for upload room work.
  const response = await fetch(`${API_BASE}/rooms/${id}/work`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!response.ok) {
    let message = `API request failed: ${response.status}`;

    try {
      const data = await response.json();
      if (data?.message) {
        message = data.message;
      }
    } catch (_error) {
      // Keep fallback message when response body is not JSON.
    }

    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

export async function downloadRoomWork(id, workId, token) { // downloads file payload for download room work.
  const response = await fetch(`${API_BASE}/rooms/${id}/work/${workId}/download`, {
    method: 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    let message = `API request failed: ${response.status}`;

    try {
      const data = await response.json();
      if (data?.message) {
        message = data.message;
      }
    } catch (_error) {
      // Keep fallback message when response body is not JSON.
    }

    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return {
    blob: await response.blob(),
    contentDisposition: response.headers.get('content-disposition') || '',
  };
}

export async function getTasks(projectId, token) { // fetches data for get tasks.
  return request(`/tasks?projectId=${projectId}`, token);
}

export async function createTask(payload, token) { // creates data for create task.
  return request('/tasks', token, {
    method: 'POST',
    body: payload,
  });
}

export async function updateTaskStatus(taskId, payload, token) { // updates data for update task status.
  return request(`/tasks/${taskId}/status`, token, {
    method: 'PATCH',
    body: payload,
  });
}

export async function loginUser(payload) { // authenticates credentials for login user.
  return request('/auth/login', undefined, {
    method: 'POST',
    body: payload,
  });
}

export async function registerAuthUser(payload) { // registers data for register auth user.
  return request('/auth/register', undefined, {
    method: 'POST',
    body: payload,
  });
}

export async function requestPasswordReset(payload) { // requests an operation for request password reset.
  return request('/auth/forgot-password', undefined, {
    method: 'POST',
    body: payload,
  });
}

export async function resetPassword(payload) { // handles API workflow for reset password.
  // Payload must include email + code + newPassword for user-scoped reset verification.
  return request('/auth/reset-password', undefined, {
    method: 'POST',
    body: payload,
  });
}

export async function getMyNotifications(token) { // fetches data for get my notifications.
  return request('/auth/notifications', token);
}

export async function markNotificationRead(notificationId, token) { // updates data for mark notification read.
  return request(`/auth/notifications/${notificationId}/read`, token, {
    method: 'PATCH',
  });
}

export async function getAssignments(projectId, token) { // fetches data for get assignments.
  return request(`/collab/projects/${projectId}/assignments`, token);
}

export async function uploadAssignment(projectId, formData, token) { // uploads file payload for upload assignment.
  const response = await fetch(`${API_BASE}/collab/projects/${projectId}/assignments`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!response.ok) {
    let message = `API request failed: ${response.status}`;

    try {
      const data = await response.json();
      if (data?.message) {
        message = data.message;
      }
    } catch (_error) {
      // Keep fallback message when response body is not JSON.
    }

    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

export async function getProjectMessages(projectId, token) { // fetches data for get project messages.
  return request(`/collab/projects/${projectId}/messages`, token);
}

export async function sendProjectMessage(projectId, payload, token) { // sends data for send project message.
  return request(`/collab/projects/${projectId}/messages`, token, {
    method: 'POST',
    body: payload,
  });
}

export async function downloadAssignmentFile(projectId, assignmentId, token) { // downloads file payload for download assignment file.
  const response = await fetch(
    `${API_BASE}/collab/projects/${projectId}/assignments/${assignmentId}/download`,
    {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }
  );

  if (!response.ok) {
    let message = `API request failed: ${response.status}`;

    try {
      const data = await response.json();
      if (data?.message) {
        message = data.message;
      }
    } catch (_error) {
      // Keep fallback message when response body is not JSON.
    }

    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return {
    blob: await response.blob(),
    contentDisposition: response.headers.get('content-disposition') || '',
  };
}
