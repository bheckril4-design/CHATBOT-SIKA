import React from 'react';
import PropTypes from 'prop-types';
import { motion } from 'framer-motion';
import { ArrowRight, BookOpen, Shield, TrendingUp, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';

const Hero = ({ onConsultationClick, onPortfolioClick }) => (
  <section className="relative overflow-hidden px-6 py-20">
    <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20" />
    <div className="container relative z-10 mx-auto">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="mb-6 text-5xl font-bold leading-tight text-white lg:text-6xl">
            Maximisez Votre
            <span className="bg-gradient-to-r from-amber-200 via-gold-300 to-yellow-400 bg-clip-text text-transparent [text-shadow:0_10px_30px_rgba(251,191,36,0.2)]">
              {' '}
              Patrimoine
            </span>
          </h1>
          <p className="mb-8 text-xl leading-relaxed text-white/80">
            Structurez vos d&eacute;cisions financi&egrave;res avec des explications prudentes,
            des simulateurs clairs et un accompagnement adapt&eacute; &agrave; votre contexte.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Button
              onClick={onConsultationClick}
              size="lg"
              className="bg-gradient-to-r from-gold-400 to-yellow-500 px-8 py-4 text-lg text-white hover:from-gold-500 hover:to-yellow-600"
            >
              Consultation Gratuite
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              onClick={onPortfolioClick}
              variant="outline"
              size="lg"
              className="border-white/30 px-8 py-4 text-lg text-white hover:bg-white/10"
            >
              Analyser Mon Portfolio
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative"
        >
          <div className="rounded-2xl border border-white/20 bg-white/10 p-8 backdrop-blur-md">
            <div className="grid grid-cols-2 gap-6">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-green-400 to-emerald-500">
                  <TrendingUp className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white">Prudent</h3>
                <p className="text-white/70">Estimations sans promesse de gain</p>
              </div>
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-blue-400 to-cyan-500">
                  <Users className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white">Clair</h3>
                <p className="text-white/70">P&eacute;dagogie pour d&eacute;butants et dirigeants</p>
              </div>
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-purple-400 to-violet-500">
                  <Shield className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white">Cadre</h3>
                <p className="text-white/70">Donn&eacute;es prot&eacute;g&eacute;es et validation humaine recommand&eacute;e</p>
              </div>
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-orange-400 to-red-500">
                  <BookOpen className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white">Accessible</h3>
                <p className="text-white/70">Pens&eacute; pour des usages financiers clairs, utiles et adaptables &agrave; diff&eacute;rents contextes</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  </section>
);

Hero.propTypes = {
  onConsultationClick: PropTypes.func.isRequired,
  onPortfolioClick: PropTypes.func.isRequired,
};

export default Hero;
