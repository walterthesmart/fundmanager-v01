'use client';

import { useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';

export default function ConnectQuickBooks() {
  const { user, isLoaded } = useUser();
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkConnection() {
      if (!isLoaded || !user) return;
      const res = await fetch('/api/quickbooks/data');
      if (res.status === 400) {
        // Not connected
        setIsConnected(false);
      } else if (res.ok) {
        setIsConnected(true);
      }
      setLoading(false);
    }
    checkConnection();
  }, [isLoaded, user]);

  if (loading) return <div>Loading...</div>;
  if (isConnected) return null; // Hide button if already connected

  return (
    <a href="/api/quickbooks/connect">
      <button className="bg-teal-600 text-white px-4 py-2 rounded">
        Connect QuickBooks
      </button>
    </a>
  );
}