import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  loginUser,
  registerAuthUser,
  requestPasswordReset,
  resetPassword,
  getClassGroups,
  updateMyAcademicProfile,
} from '../api';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [authMode, setAuthMode] = useState('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [courseName, setCourseName] = useState('');
  const [studyYear, setStudyYear] = useState('');
  const [unitCode, setUnitCode] = useState('');
  const [classGroup, setClassGroup] = useState('');
  const [courseSearch, setCourseSearch] = useState('');
  const [unitSearch, setUnitSearch] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [classGroups, setClassGroups] = useState([]);
  const [pendingToken, setPendingToken] = useState('');
  const [pendingUser, setPendingUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const isSignup = authMode === 'signup';
  const isForgot = authMode === 'forgot';
  const isReset = authMode === 'reset';
  const isCompleteProfile = authMode === 'completeProfile';

  const isStudentEmail = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized.endsWith('@strathmore.edu')) {
      return false;
    }

    return normalized.split('@')[0].includes('.');
  };

  const isSupervisorEmail = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized.endsWith('@strathmore.edu')) {
      return false;
    }

    return !normalized.split('@')[0].includes('.');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccess('');
    setError('');
    setLoading(true);

    if (isSignup && !name.trim()) {
      setError('Please enter your full name');
      setLoading(false);
      return;
    }

    if (!isCompleteProfile && !email.includes('@')) {
      setError('Please enter a valid email address');
      setLoading(false);
      return;
    }

    if (isCompleteProfile) {
      const chosenGroup = classGroups.find((group) => Number(group.groupID) === Number(selectedGroupId));
      const payload = chosenGroup
        ? { groupID: Number(chosenGroup.groupID) }
        : {
            courseName: courseName.trim(),
            studyYear: Number(studyYear),
            unitCode: unitCode.trim().toUpperCase(),
            classGroup: classGroup.trim(),
          };

      if (!chosenGroup && (!payload.courseName || !payload.studyYear || !payload.classGroup || !payload.unitCode)) {
        setError('Please fill in course, year, unit code, and class group.');
        setLoading(false);
        return;
      }

      try {
        const res = await updateMyAcademicProfile(payload, pendingToken);
        const mergedUser = {
          ...pendingUser,
          ...(res.user || {}),
          role: res.user?.role || pendingUser?.role,
        };
        login(mergedUser, pendingToken);
        navigate('/dashboard');
      } catch (submitError) {
        setError(submitError.message || 'Could not save your academic profile.');
      }

      setLoading(false);
      return;
    }

    if (isForgot) {
      try {
        const res = await requestPasswordReset({ email });
        setSuccess(res.message || 'Reset code generated. Check your in-app notifications.');
        setAuthMode('reset');
      } catch (submitError) {
        setError(submitError.message || 'Could not start password reset.');
      }

      setLoading(false);
      return;
    }

    if (isReset) {
      if (!resetToken.trim()) {
        setError('Reset code is required');
        setLoading(false);
        return;
      }

      if (!/^\d{4}$/.test(resetToken.trim())) {
        setError('Reset code must be exactly 4 digits');
        setLoading(false);
        return;
      }

      if (newPassword.length < 6) {
        setError('New password must be at least 6 characters');
        setLoading(false);
        return;
      }

      if (newPassword !== confirmNewPassword) {
        setError('New passwords do not match');
        setLoading(false);
        return;
      }

      try {
        const code = resetToken.trim();
        const res = await resetPassword({ email, code, token: code, newPassword });
        setSuccess(res.message || 'Password reset successful. You can now sign in.');
        setAuthMode('signin');
        setResetToken('');
        setNewPassword('');
        setConfirmNewPassword('');
        setPassword('');
      } catch (submitError) {
        setError(submitError.message || 'Could not reset password.');
      }

      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    if (isSignup && password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (isSignup && !isStudentEmail(email) && !isSupervisorEmail(email)) {
      setError(
        'Use a Strathmore email: student first.second@strathmore.edu or supervisor nodot@strathmore.edu'
      );
      setLoading(false);
      return;
    }

    try {
      if (isSignup) {
        await registerAuthUser({
          name: name.trim(),
          email,
          password,
          courseName: courseName.trim() || null,
          studyYear: studyYear ? Number(studyYear) : null,
          unitCode: unitCode.trim().toUpperCase() || null,
          classGroup: classGroup.trim() || null,
        });

        setSuccess('Account created successfully. You can now sign in.');
        setAuthMode('signin');
        setConfirmPassword('');
      } else {
        const res = await loginUser({ email, password });
        if (res.token) {
          login(res.user, res.token);

          if (!res.user.profileComplete && res.user.role === 'Member') {
            navigate('/profile-setup');
          } else {
            navigate('/dashboard');
          }
        } else {
          setError(res.message || 'Invalid email or password');
        }
      }
    } catch (submitError) {
      setError(
        submitError.message ||
          (isSignup
            ? 'Could not create account. Check password policy (1 uppercase + 1 number) and try again.'
            : 'Cannot connect to server. Make sure the backend is running.')
      );
    }

    setLoading(false);
  };

  const toggleMode = () => {
    setAuthMode((prev) => (prev === 'signup' ? 'signin' : 'signup'));
    setError('');
    setSuccess('');
    setPassword('');
    setConfirmPassword('');
    setCourseName('');
    setStudyYear('');
    setUnitCode('');
    setClassGroup('');
    setCourseSearch('');
    setUnitSearch('');
    setSelectedGroupId('');
  };

  const switchToForgot = () => {
    setAuthMode('forgot');
    setError('');
    setSuccess('');
    setPassword('');
    setConfirmPassword('');
  };

  const switchToSignin = () => {
    setAuthMode('signin');
    setError('');
    setSuccess('');
    setResetToken('');
    setNewPassword('');
    setConfirmNewPassword('');
    setPendingToken('');
    setPendingUser(null);
    setClassGroups([]);
    setCourseName('');
    setStudyYear('');
    setUnitCode('');
    setClassGroup('');
    setCourseSearch('');
    setUnitSearch('');
    setSelectedGroupId('');
  };

  return (
    <div className="login-page">
      <div className="login-bg-circle login-bg-circle-1" />
      <div className="login-bg-circle login-bg-circle-2" />

      <div className="login-container">
        <div className="login-left">
          <div className="login-brand">
            <img src="/logo_sidebar.jpeg" alt="Taskify logo" className="login-brand-logo" />
            <h1>Taskify</h1>
          </div>
          <h2>
            Track. Collaborate.
            <br />
            Contribute.
          </h2>
          <p>
            A web-based group work monitoring system for Strathmore University. Every contribution
            counts.
          </p>
          <div className="login-features">
            <div className="login-feature">
              <span className="feature-icon">01</span>
              <span>Real-time contribution tracking</span>
            </div>
            <div className="login-feature">
              <span className="feature-icon">02</span>
              <span>Anonymous peer reviews</span>
            </div>
            <div className="login-feature">
              <span className="feature-icon">03</span>
              <span>Automatic loafing detection</span>
            </div>
            <div className="login-feature">
              <span className="feature-icon">04</span>
              <span>Exportable PDF reports</span>
            </div>
          </div>
        </div>

        <div className="login-right">
          <div className="login-box">
            <div className="login-box-header">
              <h3>
                {isSignup
                  ? 'Create account'
                  : isForgot
                    ? 'Forgot password'
                    : isReset
                      ? 'Reset password'
                      : isCompleteProfile
                        ? 'Complete profile'
                      : 'Welcome back'}
              </h3>
              <p>
                {isSignup
                  ? 'Sign up to start tracking your project contributions'
                  : isForgot
                    ? 'Request a 4-digit password reset code using your email'
                    : isReset
                      ? 'Enter your 4-digit reset code and set a new password'
                      : isCompleteProfile
                        ? 'Tell us your course, year, and class group so supervisors can allocate correctly'
                      : 'Sign in to your Taskify account'}
              </p>
            </div>

            {success && (
              <div className="alert-banner alert-success">
                <span>+</span> {success}
              </div>
            )}

            {error && (
              <div className="alert-banner alert-danger">
                <span>!</span> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} autoComplete="off">
              {isCompleteProfile && (
                <>
                  <div className="form-group">
                    <label className="form-label">Search Course</label>
                    <input
                      className="form-control"
                      type="text"
                      value={courseSearch}
                      onChange={async (e) => {
                        const value = e.target.value;
                        setCourseSearch(value);
                        try {
                          const groups = await getClassGroups(pendingToken, {
                            courseName: value,
                            unitCode: unitSearch,
                          });
                          setClassGroups(groups);
                        } catch (_error) {
                          setClassGroups([]);
                        }
                      }}
                      placeholder="e.g. BBIT"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Search Unit Code</label>
                    <input
                      className="form-control"
                      type="text"
                      value={unitSearch}
                      onChange={async (e) => {
                        const value = e.target.value.toUpperCase();
                        setUnitSearch(value);
                        try {
                          const groups = await getClassGroups(pendingToken, {
                            courseName: courseSearch,
                            unitCode: value,
                          });
                          setClassGroups(groups);
                        } catch (_error) {
                          setClassGroups([]);
                        }
                      }}
                      placeholder="e.g. BIT2105"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Choose Matching Unit Group</label>
                    <select
                      className="form-control"
                      value={selectedGroupId}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSelectedGroupId(value);

                        const selected = classGroups.find(
                          (group) => Number(group.groupID) === Number(value)
                        );

                        if (selected) {
                          setCourseName(selected.courseName || '');
                          setStudyYear(selected.studyYear ? String(selected.studyYear) : '');
                          setUnitCode(selected.unitCode || '');
                          setClassGroup(selected.classGroup || '');
                        }
                      }}
                    >
                      <option value="">Choose from lecturer-created unit groups</option>
                      {classGroups.map((group) => (
                        <option key={group.groupID} value={group.groupID}>
                          {group.groupName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Course Name</label>
                    <input
                      className="form-control"
                      type="text"
                      value={courseName}
                      onChange={(e) => setCourseName(e.target.value)}
                      placeholder="e.g. BBIT"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Year</label>
                    <input
                      className="form-control"
                      type="number"
                      min="1"
                      max="8"
                      value={studyYear}
                      onChange={(e) => setStudyYear(e.target.value)}
                      placeholder="e.g. 2"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Unit Code</label>
                    <input
                      className="form-control"
                      type="text"
                      value={unitCode}
                      onChange={(e) => setUnitCode(e.target.value.toUpperCase())}
                      placeholder="e.g. BIT2105"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Class Group</label>
                    <input
                      className="form-control"
                      type="text"
                      value={classGroup}
                      onChange={(e) => setClassGroup(e.target.value)}
                      placeholder="e.g. Group B"
                      required
                    />
                  </div>
                </>
              )}

              {isSignup && (
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    className="form-control"
                    type="text"
                    placeholder="Your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              )}

              {isSignup && (
                <div className="page-sub" style={{ marginBottom: '10px' }}>
                  Role is auto-assigned from email format: student first.second@strathmore.edu and
                  supervisor no dot, for example bmonda@strathmore.edu
                </div>
              )}

              {!isCompleteProfile && (
                <div className="form-group">
                <label className="form-label">Email Address</label>
                <div className="input-wrap">
                  <span className="input-icon">@</span>
                  <input
                    className="form-control input-with-icon"
                    type="email"
                    placeholder="you@strathmore.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                </div>
              )}

              {!isForgot && !isReset && !isCompleteProfile && (
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <div className="input-wrap">
                    <span className="input-icon">*</span>
                    <input
                      className="form-control input-with-icon"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="show-password-btn"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
              )}

              {isSignup && (
                <div className="form-group">
                  <label className="form-label">Confirm Password</label>
                  <input
                    className="form-control"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              )}

              {isSignup && (
                <>
                  <div className="form-group">
                    <label className="form-label">Course Name (Student)</label>
                    <input
                      className="form-control"
                      type="text"
                      value={courseName}
                      onChange={(e) => setCourseName(e.target.value)}
                      placeholder="e.g. BBIT"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Year (Student)</label>
                    <input
                      className="form-control"
                      type="number"
                      min="1"
                      max="8"
                      value={studyYear}
                      onChange={(e) => setStudyYear(e.target.value)}
                      placeholder="e.g. 2"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Class Group (Student)</label>
                    <input
                      className="form-control"
                      type="text"
                      value={classGroup}
                      onChange={(e) => setClassGroup(e.target.value)}
                      placeholder="e.g. Group A"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Unit Code (Student)</label>
                    <input
                      className="form-control"
                      type="text"
                      value={unitCode}
                      onChange={(e) => setUnitCode(e.target.value.toUpperCase())}
                      placeholder="e.g. BIT2105"
                    />
                  </div>
                </>
              )}

              {isReset && (
                <>
                  <div className="form-group">
                    <label className="form-label">4-Digit Reset Code</label>
                    <input
                      className="form-control"
                      type="text"
                      placeholder="Enter your 4-digit code"
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">New Password</label>
                    <input
                      className="form-control"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Confirm New Password</label>
                    <input
                      className="form-control"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Re-enter new password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}

              <button className="btn btn-primary login-submit-btn" type="submit" disabled={loading}>
                {loading
                  ? <span className="spinner" />
                  : isSignup
                    ? 'Create Account'
                    : isForgot
                        ? 'Send Reset Code'
                      : isReset
                        ? 'Reset Password'
                          : isCompleteProfile
                            ? 'Save Profile & Continue'
                        : 'Sign In to Taskify'}
              </button>
            </form>

              {!isSignup && !isForgot && !isReset && !isCompleteProfile && (
              <div className="auth-switch-row" style={{ marginTop: '8px' }}>
                <button type="button" className="auth-switch-btn" onClick={switchToForgot}>
                  Forgot your password?
                </button>
              </div>
            )}

              {(isForgot || isReset || isCompleteProfile) && (
              <div className="auth-switch-row">
                <button type="button" className="auth-switch-btn" onClick={switchToSignin}>
                  Back to sign in
                </button>
              </div>
            )}

              {!isCompleteProfile && (
                <div className="auth-switch-row">
                  <span>{isSignup ? 'Already have an account?' : "Don't have an account?"}</span>
                  <button type="button" className="auth-switch-btn" onClick={toggleMode}>
                    {isSignup ? 'Sign in' : 'Sign up'}
                  </button>
                </div>
              )}

            <div className="auth-switch-row">
              <button type="button" className="auth-switch-btn" onClick={() => navigate('/')}>
                Back to homepage
              </button>
            </div>

            <div className="login-footer">
              <p>Strathmore University</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
