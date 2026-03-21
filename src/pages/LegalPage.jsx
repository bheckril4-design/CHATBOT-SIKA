import React from 'react';
import { Helmet } from 'react-helmet';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const LegalPage = () => (
  <div className="px-6 py-20">
    <Helmet>
      <title>Mentions l&eacute;gales - SIKA</title>
      <meta name="description" content="Consultez les mentions l&eacute;gales de SIKA." />
    </Helmet>
    <div className="container mx-auto max-w-4xl">
      <Link
        to="/"
        className="mb-8 inline-flex items-center text-gold-400 transition-colors hover:text-gold-300"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Retour &agrave; l&apos;accueil
      </Link>
      <h1 className="mb-8 text-4xl font-bold text-white lg:text-5xl">Mentions l&eacute;gales</h1>
      <div className="prose prose-invert prose-lg max-w-none space-y-6 text-white/80">
        <p>
          Conform&eacute;ment aux dispositions des articles 6-III et 19 de la loi
          num&eacute;ro 2004-575 du 21 juin 2004 pour la confiance dans l&apos;&eacute;conomie num&eacute;rique,
          les pr&eacute;sentes mentions l&eacute;gales sont port&eacute;es &agrave; la connaissance des
          utilisateurs du site SIKA.
        </p>

        <h2 className="pt-4 text-2xl font-bold text-white">&Eacute;diteur du site</h2>
        <p>
          Le site SIKA est &eacute;dit&eacute; par Oceanic Conseils Sarl, dont le si&egrave;ge social
          est situ&eacute; &agrave; Agla les pyl&ocirc;nes, Cotonou B&eacute;nin.
        </p>
        <p>Num&eacute;ros de t&eacute;l&eacute;phone : +229 0197392580 / +212 660693839</p>
        <p>Adresse e-mail : contact@oceanicconseils.com</p>

        <h2 className="pt-4 text-2xl font-bold text-white">H&eacute;bergeur</h2>
        <p>
          Le site est h&eacute;berg&eacute; par Hostinger International Ltd., 61 Lordou
          Vironos Street, 6023 Larnaca, Chypre.
        </p>

        <h2 className="pt-4 text-2xl font-bold text-white">Acc&egrave;s au site</h2>
        <p>
          Le site est accessible 7j/7 et 24h/24, sauf interruption programm&eacute;e ou
          n&eacute;cessaire &agrave; la maintenance.
        </p>

        <h2 className="pt-4 text-2xl font-bold text-white">Propri&eacute;t&eacute; intellectuelle</h2>
        <p>
          Toute reproduction, diffusion, commercialisation ou modification de
          tout ou partie du site SIKA sans autorisation est interdite et pourra
          donner lieu &agrave; des poursuites.
        </p>
      </div>
    </div>
  </div>
);

export default LegalPage;
