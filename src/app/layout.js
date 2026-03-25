import './globals.css';
import { Providers } from '@/components/Providers';

export const metadata = {
  title: 'DataLens AI — Data Exploration & Analysis Agent',
  description:
    'AI-powered data exploration, analysis, and visualization agent with BigQuery integration and multi-model LLM support.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
