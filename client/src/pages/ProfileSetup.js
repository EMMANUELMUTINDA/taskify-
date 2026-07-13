import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from '../api';

const COURSES = [
  'Bachelor of Business Information Technology (BBIT)',
  'Bachelor of Science in Computer Science (BSc CS)',
  'Bachelor of Science in Software Engineering (BSc SE)',
  'Bachelor of Science in Information Technology (BSc IT)',
  'Bachelor of Commerce (BCom)',
  'Bachelor of Laws (LLB)',
];

const GROUPS = ['A', 'B', 'C', 'D', 'E'];

export default function ProfileSetup() {
  const { user, token, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    course: '',
    yearOfStudy: '',
    classGroup: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!form.course || !form.yearOfStudy || !form.classGroup) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      const result = await updateProfile(form, token);

      if (result.message === 'Profile updated') {
        const updatedUser = { ...user, ...form, profileComplete: 1 };
        login(updatedUser, token);
        navigate('/units');
      } else {
        setError(result.message || 'Something went wrong');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F5F0EB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '20px',
          padding: '40px',
          width: '100%',
          maxWidth: '480px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.1)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <svg width="60" height="60" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <rect width="120" height="120" rx="28" fill="#F5F0EB" />
            <rect x="18" y="18" width="84" height="84" rx="20" fill="none" stroke="#8B8FD4" strokeWidth="5" />
            <polyline
              points="36,60 52,76 84,44"
              fill="none"
              stroke="#8B8FD4"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="104" cy="16" r="9" fill="#9B8EC4" />
          </svg>
          <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#2D2D3A', marginTop: '12px' }}>
            Complete your profile
          </h2>
          <p style={{ color: '#718096', fontSize: '13px', marginTop: '6px' }}>
            Hi {user?.name}! Tell us about your studies so supervisors can find you.
          </p>
        </div>

        {error && (
          <div
            style={{
              background: '#FFF5F5',
              border: '1px solid #FED7D7',
              color: '#9B2C2C',
              padding: '12px 16px',
              borderRadius: '10px',
              fontSize: '13px',
              marginBottom: '20px',
            }}
          >
            Warning: {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '18px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '700',
                color: '#2D2D3A',
                marginBottom: '7px',
                letterSpacing: '0.3px',
              }}
            >
              Your Course / Programme *
            </label>
            <select
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1.5px solid #E2E8F0',
                borderRadius: '10px',
                fontSize: '13px',
                color: '#2D2D3A',
                background: 'white',
                cursor: 'pointer',
              }}
              value={form.course}
              onChange={(event) => setForm({ ...form, course: event.target.value })}
              required
            >
              <option value="">Select your course</option>
              {COURSES.map((course) => (
                <option key={course} value={course}>
                  {course}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '18px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '700',
                color: '#2D2D3A',
                marginBottom: '7px',
              }}
            >
              Year of Study *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px' }}>
              {[1, 2, 3, 4].map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => setForm({ ...form, yearOfStudy: year })}
                  style={{
                    padding: '12px',
                    border: form.yearOfStudy === year ? '2px solid #8B8FD4' : '1.5px solid #E2E8F0',
                    borderRadius: '10px',
                    background: form.yearOfStudy === year ? '#F0EFFF' : 'white',
                    color: form.yearOfStudy === year ? '#6C63FF' : '#2D2D3A',
                    fontWeight: form.yearOfStudy === year ? '700' : '500',
                    cursor: 'pointer',
                    fontSize: '14px',
                    transition: 'all 0.15s',
                  }}
                >
                  Year {year}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '28px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '700',
                color: '#2D2D3A',
                marginBottom: '7px',
              }}
            >
              Class Group *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '10px' }}>
              {GROUPS.map((group) => (
                <button
                  key={group}
                  type="button"
                  onClick={() => setForm({ ...form, classGroup: group })}
                  style={{
                    padding: '12px',
                    border: form.classGroup === group ? '2px solid #9B8EC4' : '1.5px solid #E2E8F0',
                    borderRadius: '10px',
                    background: form.classGroup === group ? '#F5F0FF' : 'white',
                    color: form.classGroup === group ? '#9B8EC4' : '#2D2D3A',
                    fontWeight: form.classGroup === group ? '700' : '500',
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

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '13px',
              background: 'linear-gradient(135deg, #8B8FD4, #9B8EC4)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Saving...' : 'Complete Profile ->'}
          </button>
        </form>
      </div>
    </div>
  );
}
