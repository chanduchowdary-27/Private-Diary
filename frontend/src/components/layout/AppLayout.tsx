import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

interface AppLayoutProps {
  isLocked: boolean;
  onLock: () => void;
  onSignOut?: () => void;
}

export default function AppLayout({ isLocked, onLock, onSignOut }: AppLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar isLocked={isLocked} onLock={onLock} onSignOut={onSignOut} />
      <main
        className="flex-1 overflow-y-auto pt-16 lg:pt-0"
        id="main-content"
      >
        <Outlet />
      </main>
    </div>
  );
}
