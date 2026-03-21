import React from 'react';
import { Outlet } from 'react-router-dom';

import Chatbot from '@/components/chatbot/Chatbot';
import Footer from '@/components/sections/Footer';
import Header from '@/components/sections/Header';
import { Toaster } from '@/components/ui/toaster';
import { openExternalUrl } from '@/lib/navigation';
import { toast } from '@/components/ui/use-toast';

const Layout = () => {
  const handleConsultationClick = () => {
    openExternalUrl('https://oceanicconseils.com/contact/');
  };

  const handleFeatureClick = (featureName) => {
    if (featureName === 'portfolio') {
      openExternalUrl('https://oceanicconseils.com/services/');
      return;
    }

    if (featureName === 'contact') {
      openExternalUrl('https://oceanicconseils.com/contact/');
      return;
    }

    if (featureName === 'simulator' || featureName === 'calculators') {
      const calculatorSection = document.getElementById('calculators');
      if (calculatorSection) {
        calculatorSection.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    toast({
      title: 'Fonctionnalit\u00e9 en d\u00e9veloppement',
      description: `La fonctionnalit\u00e9 "${featureName}" n'est pas encore disponible.`,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 text-white">
      <Header onConsultationClick={handleConsultationClick} />
      <main>
        <Outlet />
      </main>
      <Footer onFeatureClick={handleFeatureClick} />
      <Chatbot />
      <Toaster />
    </div>
  );
};

export default Layout;
