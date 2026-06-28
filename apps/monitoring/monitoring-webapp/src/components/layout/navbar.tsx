'use client';
import Link from 'next/link';
import { useAuth } from '../../lib/auth-provider';
import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_MONITORING_API_URL ?? 'http://localhost:8080';

interface EnvInfo {
  environment: string;
  projectName: string;
  awsAccountId: string;
}

export function Navbar() {
  const { isAuthenticated, clearToken } = useAuth();
  const [envInfo, setEnvInfo] = useState<EnvInfo | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/env-info`)
      .then((res) => res.json())
      .then((data: EnvInfo) => setEnvInfo(data))
      .catch(() => {/* ignore — label simply won't render */});
  }, []);

  const envColor: Record<string, string> = {
    dev: '#3fb950',
    staging: '#d29922',
    prod: '#f85149',
    preview: '#bc8cff',
  };
  const badgeBg = envInfo ? (envColor[envInfo.environment] ?? '#58a6ff') : '#58a6ff';

  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1.5rem', background: '#161b22', borderBottom: '1px solid #30363d' }}>
      <Link href="/" style={{ fontWeight: 700, color: '#58a6ff', textDecoration: 'none' }}>Monitoring</Link>
      <Link href="/services">Services</Link>
      <Link href="/traces">Traces</Link>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        {envInfo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{
              padding: '0.15rem 0.5rem',
              borderRadius: '4px',
              background: badgeBg,
              color: '#fff',
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              {envInfo.environment}
            </span>
            <span style={{ fontSize: '0.75rem', color: '#8b949e' }}>
              {envInfo.projectName} · {envInfo.awsAccountId !== 'unknown' ? envInfo.awsAccountId : 'local'}
            </span>
          </div>
        )}
        {isAuthenticated && (
          <button onClick={clearToken} style={{ marginLeft: '0.5rem', padding: '0.2rem 0.6rem', background: 'transparent', border: '1px solid #30363d', color: '#8b949e', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>
            Sign out
          </button>
        )}
      </div>
    </nav>
  );
}
