import React from 'react';
import { Helmet } from 'react-helmet';

import AssistantConsole from '@/components/chatbot/AssistantConsole';

const AssistantPage = () => {
  return (
    <>
      <Helmet>
        <title>Assistant SIKA | Oceanic Conseils</title>
        <meta
          name="description"
          content="Discutez avec SIKA, l'assistant financier intelligent d'Oceanic Conseils."
        />
      </Helmet>

      <section className="container mx-auto px-6 py-10 md:py-14">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 text-center">
            <p className="mb-3 text-sm uppercase tracking-[0.35em] text-cyan-300/80">
              SIKA
            </p>
            <h1 className="text-3xl font-bold text-white md:text-5xl">
              Votre assistant financier en ligne
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/70 md:text-lg">
              Posez vos questions sur l&apos;&eacute;pargne, le budget, le cr&eacute;dit et les bases
              de l&apos;investissement. La version texte est d&eacute;j&agrave; op&eacute;rationnelle, avec
              une base pr&ecirc;te pour la voix et les langues locales.
            </p>
          </div>

          <AssistantConsole variant="page" />
        </div>
      </section>
    </>
  );
};

export default AssistantPage;
