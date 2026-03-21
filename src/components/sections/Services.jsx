import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, PieChart, Shield, Target, TrendingUp } from 'lucide-react';

const servicesData = [
  {
    icon: Target,
    title: 'Planification de Retraite',
    description: 'Optimisez votre \u00e9pargne retraite avec des strat\u00e9gies personnalis\u00e9es.',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    icon: TrendingUp,
    title: 'Investissement Intelligent',
    description: 'Diversifiez votre portefeuille avec des conseils d\u2019experts.',
    color: 'from-green-500 to-emerald-500',
  },
  {
    icon: Shield,
    title: 'Gestion des Risques',
    description: 'Prot\u00e9gez votre patrimoine avec des solutions adapt\u00e9es.',
    color: 'from-purple-500 to-violet-500',
  },
  {
    icon: PieChart,
    title: 'Analyse Patrimoniale',
    description: '\u00c9valuez et optimisez la r\u00e9partition de vos actifs.',
    color: 'from-orange-500 to-red-500',
  },
];

const Services = () => (
  <section id="services" className="bg-white/5 px-6 py-20 backdrop-blur-sm">
    <div className="container mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-16 text-center"
      >
        <h2 className="mb-6 text-4xl font-bold text-white">Nos Services Sp&eacute;cialis&eacute;s</h2>
        <p className="mx-auto max-w-3xl text-xl text-white/70">
          Des solutions financi&egrave;res sur mesure pour vos objectifs uniques.
        </p>
      </motion.div>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
        {servicesData.map((service, index) => (
          <motion.a
            key={service.title}
            href="https://oceanicconseils.com/services/"
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.05, y: -10 }}
            className="group block cursor-pointer"
          >
            <div className="h-full rounded-2xl border border-white/20 bg-white/10 p-8 backdrop-blur-md transition-all duration-300 hover:bg-white/15">
              <div
                className={`mb-6 flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-r ${service.color} transition-transform group-hover:scale-110`}
              >
                <service.icon className="h-8 w-8 text-white" />
              </div>
              <h3 className="mb-4 text-xl font-bold text-white">{service.title}</h3>
              <p className="mb-6 text-white/70">{service.description}</p>
              <div className="flex items-center text-gold-400 transition-colors group-hover:text-gold-300">
                <span className="font-semibold">En savoir plus</span>
                <ChevronRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </motion.a>
        ))}
      </div>
    </div>
  </section>
);

export default Services;
