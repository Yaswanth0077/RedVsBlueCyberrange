import React, { useState } from 'react';

function Login({ onLogin }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (res.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                onLogin(data.user);
            } else {
                setError(data.error || 'Login failed');
            }
        } catch (err) {
            setError('Server connection error. Ensure backend is running.');
        }
    };

    return (
        <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-dark)' }}>
            <div className="card" style={{ padding: 40, width: 400, maxWidth: '90%' }}>
                <h2 style={{ textAlign: 'center', marginBottom: 20 }}>Red vs Blue Login</h2>
                {error && <div style={{ color: 'var(--red-primary)', marginBottom: 15, fontSize: 14 }}>{error}</div>}
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: 15 }}>
                        <label style={{ display: 'block', marginBottom: 5 }}>Username</label>
                        <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="log-search" style={{ width: '100%' }} />
                    </div>
                    <div style={{ marginBottom: 25 }}>
                        <label style={{ display: 'block', marginBottom: 5 }}>Password</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="log-search" style={{ width: '100%' }} />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Login</button>
                </form>
                <div style={{ marginTop: 20, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                    <p style={{ marginBottom: 4 }}>Example accounts:</p>
                    <strong>admin</strong> / <strong>admin123</strong><br />
                    <strong>redteam</strong> / <strong>red123</strong><br />
                    <strong>blueteam</strong> / <strong>blue123</strong>
                </div>
            </div>
        </div>
    );
}

export default Login;
