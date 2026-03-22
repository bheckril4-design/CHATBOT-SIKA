import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Calculator,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { motion } from 'framer-motion';

const quickStartSteps = [
  {
    icon: MessageSquare,
    title: 'Commencer par une question simple',
    description:
      "Ouvrez le widget en bas à droite ou la page Assistant, puis posez une question concrète sur votre budget, votre épargne ou votre crédit.",
    note: "Exemple : J'ai 20 000 XOF par mois à mettre de côté. Par quoi commencer ?",
  },
  {
    icon: Calculator,
    title: 'Vérifier avec un simulateur',
    description:
      "Passez ensuite dans la section Calculateurs pour transformer la recommandation en chiffres : retraite, investissement ou mensualité de crédit.",
    note: "Entrez vos montants, la durée, le taux et, si besoin, la fiscalité et l'inflation.",
  },
  {
    icon: ShieldCheck,
    title: 'Valider avant décision',
    description:
      "Utilisez SIKA comme outil d'aide à la décision, puis confirmez les hypothèses importantes avant tout engagement financier réel.",
    note: 'Les frais, la fiscalité produit-spécifique et les conditions bancaires peuvent modifier le résultat final.',
  },
];

const usageCards = [
  {
    icon: Bot,
    title: 'Assistant SIKA',
    description:
      "Le chat texte est en ligne. Il répond sur l'épargne, le budget, le crédit, la retraite et les bases de l'investissement.",
    bullets: [
      'Posez une question courte et précise.',
      'Ajoutez un montant, une durée ou un objectif quand vous en avez.',
      "Relancez avec Demande-moi 3 options ou Donne-moi un plan d'action.",
    ],
  },
  {
    icon: Calculator,
    title: 'Calculateurs',
    description:
      "Les simulateurs utilisent l'API SIKA pour garder une logique de calcul cohérente entre le site et le backend.",
    bullets: [
      'Projection retraite avec épargne mensuelle, fiscalité et inflation.',
      "Projection d'investissement avec hypothèse de rendement.",
      'Mensualité de crédit avec assurance emprunteur.',
    ],
  },
  {
    icon: Volume2,
    title: 'État des fonctionnalités',
    description:
      "La version actuelle est optimisée pour le texte et les calculs. La voix et certaines intégrations finance avancées arrivent dans une phase suivante.",
    bullets: [
      'Chat texte : actif',
      'API de calcul : active',
      'Voix : prochaine phase',
    ],
  },
];

const examplePrompts = [
  "J'ai 40 000 XOF par mois, comment constituer une épargne de sécurité ?",
  'Quel effort mensuel faut-il pour atteindre mon objectif retraite ?',
  "Aide-moi à comparer un placement prudent sur 2 ans et un profil plus dynamique sur 5 ans.",
  'Simule une mensualité de crédit immobilier avec assurance incluse.',
];

const bestPractices = [
  'Saisissez des montants réalistes et des taux cohérents avec votre contexte.',
  'Utilisez les simulateurs pour comparer plusieurs scénarios, pas pour retenir un seul chiffre.',
  "Vérifiez toujours la durée, le taux et la fiscalité avant d'interpréter un résultat.",
  'Pour une décision engageante, faites confirmer les hypothèses par un conseiller ou votre établissement financier.',
];

const GuidesPage = () => (
  <div className="px-6 py-16 lg:px-8 lg:py-20">
    <Helmet>
      <title>Guide d&apos;utilisation - SIKA</title>
      <meta
        name="description"
        content="Guide d'utilisation de SIKA : assistant, calculateurs, bonnes pratiques et parcours de prise en main."
      />
    </Helmet>

    <div className="mx-auto max-w-6xl">
      <Link
        to="/"
        className="mb-8 inline-flex items-center gap-2 text-gold-400 transition-colors hover:text-gold-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour à l&apos;accueil
      </Link>

      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/8 p-8 backdrop-blur md:p-12"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(103,232,249,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.15),transparent_24%)]" />
        <div className="relative">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
            <Sparkles className="h-4 w-4" />
            Guide d&apos;utilisation
          </div>

          <h1 className="max-w-4xl text-4xl font-bold leading-tight text-white md:text-5xl lg:text-6xl">
            Utiliser SIKA de façon simple, fiable et utile
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-white/75 md:text-xl">
            Cette page vous guide pas à pas pour bien utiliser l&apos;assistant, comprendre les
            simulateurs et vérifier les hypothèses importantes avant de prendre une décision.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              to="/assistant"
              className="inline-flex items-center gap-2 rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition-transform hover:-translate-y-0.5"
            >
              Ouvrir l&apos;assistant
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Voir la page d&apos;accueil
            </Link>
          </div>
        </div>
      </motion.section>

      <section className="mt-14">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-200/80">
            Parcours recommandé
          </p>
          <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">
            Commencer en 3 étapes
          </h2>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {quickStartSteps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.12 }}
              className="rounded-3xl border border-white/10 bg-slate-950/25 p-6"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300 to-blue-500 text-slate-950">
                <step.icon className="h-6 w-6" />
              </div>
              <div className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-cyan-200/70">
                Étape {index + 1}
              </div>
              <h3 className="text-2xl font-bold text-white">{step.title}</h3>
              <p className="mt-3 text-base leading-7 text-white/75">{step.description}</p>
              <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-white/70">
                {step.note}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mt-14 grid gap-6 lg:grid-cols-3">
        {usageCards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 + index * 0.1 }}
            className="rounded-3xl border border-white/10 bg-white/6 p-6"
          >
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950">
              <card.icon className="h-6 w-6" />
            </div>
            <h3 className="text-2xl font-bold text-white">{card.title}</h3>
            <p className="mt-3 text-base leading-7 text-white/75">{card.description}</p>
            <ul className="mt-5 space-y-3">
              {card.bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-3 text-sm leading-6 text-white/80">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan-200" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </section>

      <section className="mt-14 grid gap-6 lg:grid-cols-[1.15fr,0.85fr]">
        <div className="rounded-3xl border border-white/10 bg-slate-950/25 p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-200/80">
            Exemples utiles
          </p>
          <h2 className="mt-3 text-3xl font-bold text-white">Questions qui marchent bien</h2>
          <div className="mt-6 grid gap-4">
            {examplePrompts.map((prompt) => (
              <div
                key={prompt}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm leading-6 text-white/85"
              >
                {prompt}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/6 p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-200/80">
            Bonnes pratiques
          </p>
          <h2 className="mt-3 text-3xl font-bold text-white">Avant de décider</h2>
          <div className="mt-6 space-y-4">
            {bestPractices.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-white/10 bg-slate-950/25 px-5 py-4 text-sm leading-6 text-white/80"
              >
                {item}
              </div>
            ))}
          </div>
          <a
            href="https://oceanicconseils.com/contact/"
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 transition-colors hover:text-cyan-100"
          >
            Demander un accompagnement
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </section>
    </div>
  </div>
);

export default GuidesPage;
