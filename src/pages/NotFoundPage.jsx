import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';

const NotFoundPage = () => (
  <div className="flex min-h-[calc(100vh-200px)] items-center justify-center px-6 text-center">
    <Helmet>
      <title>Page non trouv&eacute;e - SIKA</title>
    </Helmet>
    <div>
      <AlertTriangle className="mx-auto mb-6 h-24 w-24 text-yellow-400" />
      <h1 className="mb-4 text-6xl font-bold text-white">404</h1>
      <p className="mb-8 text-2xl text-white/80">
        Oups ! La page que vous cherchez n&apos;existe pas.
      </p>
      <Button className="bg-gradient-to-r from-gold-400 to-yellow-500 text-white hover:from-gold-500 hover:to-yellow-600" asChild>
        <Link to="/">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour &agrave; l&apos;accueil
        </Link>
      </Button>
    </div>
  </div>
);

export default NotFoundPage;
