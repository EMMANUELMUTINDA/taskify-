const resolveApiBase = () => {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }

  if (typeof window !== 'undefined' && window.location?.hostname) {
    return `http://${window.location.hostname}:5000/api`;
  }

  return 'http://localhost:5000/api';
};

const API_BASE = resolveApiBase();
const LOCAL_REVIEW_KEY = 'taskify-peer-reviews';

async function request(path, token, options = {}) {
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

export async function getProjects(token) {
  return request('/projects', token);
}

export async function createProject(payload, token) {
  return request('/projects', token, {
    method: 'POST',
    body: payload,
  });
}

export async function addProjectMember(projectId, payload, token) {
  return request(`/projects/${projectId}/members`, token, {
    method: 'POST',
    body: payload,
  });
}

export async function getProjectMembers(projectId, token) {
  return request(`/projects/${projectId}/members`, token);
}

export async function getProjectOverview(projectId, token) {
  return request(`/analytics/projects/${projectId}/overview`, token);
}

function readLocalReviews() {
  try {
    const raw = localStorage.getItem(LOCAL_REVIEW_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_error) {
    return [];
  }
}

function writeLocalReviews(reviews) {
  localStorage.setItem(LOCAL_REVIEW_KEY, JSON.stringify(reviews));
}

export async function getDashboard(projectId, token) {
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

export async function getUsers(token) {
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

export async function getReviews(projectId, token) {
  try {
    return await request(`/reviews?projectId=${projectId}`, token);
  } catch (_error) {
    return readLocalReviews().filter((review) => Number(review.projectID) === Number(projectId));
  }
}

export async function submitReview(payload, token) {
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

export async function getAlerts(token) {
  return request('/alerts', token);
}

export async function resolveAlert(alertId, token) {
  return request(`/alerts/${alertId}/resolve`, token, {
    method: 'PATCH',
  });
}

export async function registerUser(payload, token) {
  return request('/users/register', token, {
    method: 'POST',
    body: payload,
  });
}

export async function getTasks(projectId, token) {
  return request(`/tasks?projectId=${projectId}`, token);
}

export async function createTask(payload, token) {
  return request('/tasks', token, {
    method: 'POST',
    body: payload,
  });
}

export async function updateTaskStatus(taskId, payload, token) {
  return request(`/tasks/${taskId}/status`, token, {
    method: 'PATCH',
    body: payload,
  });
}

export async function loginUser(payload) {
  return request('/auth/login', undefined, {
    method: 'POST',
    body: payload,
  });
}

export async function registerAuthUser(payload) {
  return request('/auth/register', undefined, {
    method: 'POST',
    body: payload,
  });
}

export async function requestPasswordReset(payload) {
  return request('/auth/forgot-password', undefined, {
    method: 'POST',
    body: payload,
  });
}

export async function resetPassword(payload) {
  return request('/auth/reset-password', undefined, {
    method: 'POST',
    body: payload,
  });
}

export async function getAssignments(projectId, token) {
  return request(`/collab/projects/${projectId}/assignments`, token);
}

export async function uploadAssignment(projectId, formData, token) {
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

export async function getProjectMessages(projectId, token) {
  return request(`/collab/projects/${projectId}/messages`, token);
}

export async function sendProjectMessage(projectId, payload, token) {
  return request(`/collab/projects/${projectId}/messages`, token, {
    method: 'POST',
    body: payload,
  });
}

export async function downloadAssignmentFile(projectId, assignmentId, token) {
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
