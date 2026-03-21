import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from '@/components/shared/Layout';
import HomePage from '@/pages/HomePage';
import LegalPage from '@/pages/LegalPage';
import GuidesPage from '@/pages/GuidesPage';
import AssistantPage from '@/pages/AssistantPage';
import NotFoundPage from '@/pages/NotFoundPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="/assistant" element={<AssistantPage />} />
        <Route path="/mentions-legales" element={<LegalPage />} />
        <Route path="/guides" element={<GuidesPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
