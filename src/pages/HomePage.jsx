import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';

import CTA from '@/components/sections/CTA';
import Calculators from '@/components/sections/Calculators';
import Hero from '@/components/sections/Hero';
import Services from '@/components/sections/Services';
import Testimonials from '@/components/sections/Testimonials';
import AdPopup from '@/components/shared/AdPopup';
import { openExternalUrl } from '@/lib/navigation';
import { toast } from '@/components/ui/use-toast';

const HomePage = () => {
  const [isAdPopupOpen, setIsAdPopupOpen] = useState(false);

  useEffect(() => {
    if (window.sessionStorage.getItem('sika_ad_popup_seen') === 'true') {
      return undefined;
    }

    const timer = setTimeout(() => {
      setIsAdPopupOpen(true);
      window.sessionStorage.setItem('sika_ad_popup_seen', 'true');
    }, 12000);

    return () => clearTimeout(timer);
  }, []);

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

    toast({
      title: 'Fonctionnalit\u00e9 en d\u00e9veloppement',
      description: `La fonctionnalit\u00e9 "${featureName}" n'est pas encore disponible.`,
    });
  };

  return (
    <>
      <Helmet>
        <title>SIKA - Conseils Financiers Sp\u00e9cialis\u00e9s</title>
        <meta
          name="description"
          content="Optimisez votre patrimoine avec des conseils financiers personnalis\u00e9s, des calculateurs et un assistant intelligent."
        />
      </Helmet>

      <Hero
        onConsultationClick={handleConsultationClick}
        onPortfolioClick={() => handleFeatureClick('portfolio')}
      />
      <Services />
      <Calculators />
      <Testimonials />
      <CTA
        onConsultationClick={handleConsultationClick}
        onContactClick={() => handleFeatureClick('contact')}
      />
      <AdPopup
        isOpen={isAdPopupOpen}
        onClose={() => {
          window.sessionStorage.setItem('sika_ad_popup_seen', 'true');
          setIsAdPopupOpen(false);
        }}
      />
    </>
  );
};

export default HomePage;
