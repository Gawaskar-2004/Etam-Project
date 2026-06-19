import type { ReactNode } from 'react';

interface Props { children: ReactNode; }

export function AppWrapper({ children }: Props) {
  return <>{children}</>;
}

export default function PageMeta({ title }: { title?: string }) {
  if (title) document.title = `${title} | ETAM`;
  return null;
}
