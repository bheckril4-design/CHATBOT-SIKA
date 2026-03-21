import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ArrowLeft, BarChart, Bot, DollarSign } from 'lucide-react';
import { motion } from 'framer-motion';

const guides = [
  {
    icon: BarChart,
    title: 'Utiliser les Calculateurs',
    description:
      "Rendez-vous dans la section Calculateurs de la page d'accueil. Choisissez le type de calcul, s\u00e9lectionnez votre devise, entrez vos informations et obtenez vos projections.",
  },
  {
    icon: DollarSign,
    title: 'Explorer nos Services',
    description:
      "La section Services pr\u00e9sente un aper\u00e7u de notre expertise. Cliquez sur En savoir plus pour \u00eatre redirig\u00e9 vers le site principal d'Oceanic Conseils.",
  },
  {
    icon: Bot,
    title: 'Discuter avec SIKA',
    description:
      "Cliquez sur l'ic\u00f4ne de chat en bas \u00e0 droite ou ouvrez la page /assistant pour discuter avec SIKA sur l'\u00e9pargne, le budget, le cr\u00e9dit et les bases de l'investissement.",
  },
];

const GuidesPage = () => (
  <div className="px-6 py-20">
    <Helmet>
      <title>Guides - SIKA</title>
      <meta name="description" content="Apprenez \u00e0 utiliser les fonctionnalit\u00e9s de SIKA." />
    </Helmet>
    <div className="container mx-auto max-w-4xl">
      <Link
        to="/"
        className="mb-8 inline-flex items-center text-gold-400 transition-colors hover:text-gold-300"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Retour &agrave; l&apos;accueil
      </Link>
      <h1 className="mb-4 text-4xl font-bold text-white lg:text-5xl">Guides d&apos;Utilisation</h1>
      <p className="mb-12 text-xl text-white/70">
        D&eacute;couvrez comment tirer le meilleur parti de notre plateforme.
      </p>

      <div className="space-y-8">
        {guides.map((guide, index) => (
          <motion.div
            key={guide.title}
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: index * 0.2 }}
            className="flex items-start space-x-6 rounded-xl border border-white/20 bg-white/10 p-6"
          >
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-yellow-500">
              <guide.icon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="mb-2 text-2xl font-bold text-white">{guide.title}</h2>
              <p className="text-white/80">{guide.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </div>
);

export default GuidesPage;
