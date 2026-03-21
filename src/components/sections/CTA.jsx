import React from 'react';
import PropTypes from 'prop-types';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';

const CTA = ({ onConsultationClick, onContactClick }) => (
  <section className="px-6 py-20">
    <div className="container mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="rounded-3xl border border-gold-400/30 bg-gradient-to-r from-gold-400/20 to-yellow-500/20 p-12 text-center backdrop-blur-md"
      >
        <h2 className="mb-6 text-4xl font-bold text-white">
          Pr&ecirc;t &agrave; cadrer vos prochaines d&eacute;cisions financi&egrave;res ?
        </h2>
        <p className="mx-auto mb-8 max-w-2xl text-xl text-white/80">
          &Eacute;changez avec Oceanic Conseils pour valider vos hypoth&egrave;ses, vos priorit&eacute;s
          et les limites des simulations avant toute d&eacute;cision engageante.
        </p>
        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <Button
            onClick={onConsultationClick}
            size="lg"
            className="bg-gradient-to-r from-gold-400 to-yellow-500 px-8 py-4 text-lg text-white hover:from-gold-500 hover:to-yellow-600"
          >
            Consultation Gratuite
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <Button
            onClick={onContactClick}
            variant="outline"
            size="lg"
            className="border-white/30 px-8 py-4 text-lg text-white hover:bg-white/10"
          >
            Nous Contacter
          </Button>
        </div>
      </motion.div>
    </div>
  </section>
);

CTA.propTypes = {
  onConsultationClick: PropTypes.func.isRequired,
  onContactClick: PropTypes.func.isRequired,
};

export default CTA;
