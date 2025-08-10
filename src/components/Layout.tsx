import { ReactNode } from 'react';
import Header from './Header';
import Footer from './Footer';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main id="main-content" className="flex-1" role="main" aria-label="主要内容">
        {children}
      </main>
      <Footer />
    </div>
  );
}