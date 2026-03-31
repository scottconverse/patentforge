import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import DisclaimerModal from './components/DisclaimerModal';
import ProjectList from './pages/ProjectList';
import ProjectDetail from './pages/ProjectDetail';
import Settings from './pages/Settings';

export default function App() {
  return (
    <>
      <DisclaimerModal />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<ProjectList />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
