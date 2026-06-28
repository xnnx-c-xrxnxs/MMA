'use client';
import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_MONITORING_API_URL ?? 'http://localhost:8080';

interface EnvInfo {
  environment: string;
  projectName: string;
  awsAccountId: string;
  namePrefix: string;
}

const DEFAULT: EnvInfo = {
  environment: 'dev',
  projectName: 'mma',
  awsAccountId: 'unknown',
  namePrefix: 'mma-dev',
};

let cached: EnvInfo | null = null;

export function useEnvInfo(): EnvInfo {
  const [info, setInfo] = useState<EnvInfo>(cached ?? DEFAULT);

  useEffect(() => {
    if (cached) return;
    fetch(`${API_BASE}/api/env-info`)
      .then((res) => res.json())
      .then((data: Omit<EnvInfo, 'namePrefix'>) => {
        const resolved: EnvInfo = {
          ...data,
          namePrefix: `${data.projectName}-${data.environment}`,
        };
        cached = resolved;
        setInfo(resolved);
      })
      .catch(() => {/* use defaults */});
  }, []);

  return info;
}
