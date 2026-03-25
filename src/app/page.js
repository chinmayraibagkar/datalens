'use client';

import AppShell from '@/components/Layout/AppShell';
import ChatInterface from '@/components/Chat/ChatInterface';

export default function HomePage() {
  return (
    <AppShell>
      <ChatInterface />
    </AppShell>
  );
}
