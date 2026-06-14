import React from 'react';
import { Helmet } from 'react-helmet';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const LegalPage = () => (
  <div className="px-6 py-20">
    <Helmet>
      <title>Mentions légales - SIKA</title>
      <meta name="description" content="Consultez les mentions légales de SIKA." />
    </Helmet>
    <div className="container mx-auto max-w-4xl">
      <Link
        to="/"
        className="mb-8 inline-flex items-center text-gold-400 transition-colors hover:text-gold-300"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Retour à l'accueil
      </Link>
      <h1 className="mb-8 text-4xl font-bold text-white lg:text-5xl">Mentions légales</h1>
      <div className="prose prose-invert prose-lg max-w-none space-y-6 text-white/80">
        <p>
          Conformément aux dispositions des articles 6-III et 19 de la loi
          numéro 2004-575 du 21 juin 2004 pour la confiance dans l'économie numérique,
          les présentes mentions légales sont portées à la connaissance des
          utilisateurs du site SIKA.
        </p>

        <h2 className="pt-4 text-2xl font-bold text-white">Éditeur du site</h2>
        <p>
          Le site SIKA est édité par Oceanic Conseils Sarl, dont le siège social
          est situé à Agla les pylônes, Cotonou Bénin.
        </p>
        <p>Numéros de téléphone : +229 0197392580 / +212 660693839</p>
        <p>Adresse e-mail : contact@oceanicconseils.com</p>

        <h2 className="pt-4 text-2xl font-bold text-white">Hébergeur</h2>
        <p>
          Le site est hébergé par Hostinger International Ltd., 61 Lordou
          Vironos Street, 6023 Larnaca, Chypre.
        </p>

        <h2 className="pt-4 text-2xl font-bold text-white">Accès au site</h2>
        <p>
          Le site est accessible 7j/7 et 24h/24, sauf interruption programmée ou
          nécessaire à la maintenance.
        </p>

        <h2 className="pt-4 text-2xl font-bold text-white">Propriété intellectuelle</h2>
        <p>
          Toute reproduction, diffusion, commercialisation ou modification de
          tout ou partie du site SIKA sans autorisation est interdite et pourra
          donner lieu à des poursuites.
        </p>
      </div>
    </div>
  </div>
);

export default LegalPage;
