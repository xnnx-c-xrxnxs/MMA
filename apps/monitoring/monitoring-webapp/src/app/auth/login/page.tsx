'use client';
export default function LoginPage() {
  const apiBase = process.env.NEXT_PUBLIC_MONITORING_API_URL ?? 'http://localhost:8080';
  return (
    <div style={{ textAlign: 'center', marginTop: '4rem' }}>
      <h1>Monitoring Dashboard</h1>
      <p>Sign in with your GitHub account to continue.</p>
      <a href={`${apiBase}/api/auth/github`} style={{ display: 'inline-block', padding: '0.75rem 1.5rem', background: '#238636', color: '#fff', borderRadius: '6px', textDecoration: 'none' }}>
        Sign in with GitHub
      </a>
    </div>
  );
}
