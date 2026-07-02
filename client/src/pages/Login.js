import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser, registerAuthUser, requestPasswordReset, resetPassword } from '../api';
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
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const isSignup = authMode === 'signup';
  const isForgot = authMode === 'forgot';
  const isReset = authMode === 'reset';

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

    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      setLoading(false);
      return;
    }

    if (isForgot) {
      try {
        const res = await requestPasswordReset({ email });
        setSuccess(`${res.message}${res.resetToken ? ` Token: ${res.resetToken}` : ''}`);
        setAuthMode('reset');
      } catch (submitError) {
        setError(submitError.message || 'Could not start password reset.');
      }

      setLoading(false);
      return;
    }

    if (isReset) {
      if (!resetToken.trim()) {
        setError('Reset token is required');
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
        const res = await resetPassword({ token: resetToken.trim(), newPassword });
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
        });

        setSuccess('Account created successfully. You can now sign in.');
        setAuthMode('signin');
        setConfirmPassword('');
      } else {
        const res = await loginUser({ email, password });
        if (res.token) {
          login(res.user, res.token);
          navigate('/dashboard');
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
  };

  return (
    <div className="login-page">
      <div className="login-bg-circle login-bg-circle-1" />
      <div className="login-bg-circle login-bg-circle-2" />

      <div className="login-container">
        <div className="login-left">
          <div className="login-brand">
            <div className="login-brand-icon">T</div>
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
                      : 'Welcome back'}
              </h3>
              <p>
                {isSignup
                  ? 'Sign up to start tracking your project contributions'
                  : isForgot
                    ? 'Request a password reset token using your email'
                    : isReset
                      ? 'Enter your reset token and set a new password'
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

              {!isForgot && !isReset && (
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

              {isReset && (
                <>
                  <div className="form-group">
                    <label className="form-label">Reset Token</label>
                    <input
                      className="form-control"
                      type="text"
                      placeholder="Paste your reset token"
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
                      ? 'Generate Reset Token'
                      : isReset
                        ? 'Reset Password'
                        : 'Sign In to Taskify'}
              </button>
            </form>

            {!isSignup && !isForgot && !isReset && (
              <div className="auth-switch-row" style={{ marginTop: '8px' }}>
                <button type="button" className="auth-switch-btn" onClick={switchToForgot}>
                  Forgot your password?
                </button>
              </div>
            )}

            {(isForgot || isReset) && (
              <div className="auth-switch-row">
                <button type="button" className="auth-switch-btn" onClick={switchToSignin}>
                  Back to sign in
                </button>
              </div>
            )}

            <div className="auth-switch-row">
              <span>{isSignup ? 'Already have an account?' : "Don't have an account?"}</span>
              <button type="button" className="auth-switch-btn" onClick={toggleMode}>
                {isSignup ? 'Sign in' : 'Sign up'}
              </button>
            </div>

            <div className="auth-switch-row">
              <button type="button" className="auth-switch-btn" onClick={() => navigate('/')}>
                Back to homepage
              </button>
            </div>

            <div className="login-footer">
              <p>Strathmore University - School of Computing and Engineering Sciences</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
