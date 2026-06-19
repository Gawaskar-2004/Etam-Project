import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/context/AuthContext';
import { RouteGuard } from '@/components/common/RouteGuard';
import { NotificationProvider } from '@/context/NotificationContext';
import routes from './routes';

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <NotificationProvider>
          <RouteGuard>
            <div className="flex flex-col min-h-screen">
              <main className="flex-grow">
                <Routes>
                  {routes.map((route, index) => (
                    <Route key={index} path={route.path} element={route.element} />
                  ))}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
            </div>
            <Toaster />
          </RouteGuard>
        </NotificationProvider>
      </AuthProvider>
    </Router>
  );
};

export default App;