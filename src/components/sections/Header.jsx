import React from 'react';
import PropTypes from 'prop-types';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';

const Header = ({ onConsultationClick }) => {
  return (
    <motion.header
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky top-0 z-10 border-b border-white/20 bg-white/10 backdrop-blur-md"
    >
      <nav className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <motion.div whileHover={{ scale: 1.05 }}>
            <Link to="/" className="flex items-center space-x-3">
              <div className="flex h-12 w-12 items-center justify-center">
                <img
                  src="https://storage.googleapis.com/hostinger-horizons-assets-prod/b727d054-1078-49e9-b578-fe3a7f228875/20119d4f61b3079b66426299117ab748.jpg"
                  alt="Oceanic Conseils Sarl Logo"
                  className="rounded-lg object-contain"
                />
              </div>
              <span className="text-xl font-bold text-white md:text-2xl">SIKA</span>
            </Link>
          </motion.div>

          <div className="hidden items-center space-x-8 md:flex">
            <a href="/#services" className="text-white/80 transition-colors hover:text-white">
              Services
            </a>
            <a href="/#calculators" className="text-white/80 transition-colors hover:text-white">
              Calculateurs
            </a>
            <a href="/#testimonials" className="text-white/80 transition-colors hover:text-white">
              T&eacute;moignages
            </a>
            <Link to="/assistant" className="text-white/80 transition-colors hover:text-white">
              Assistant
            </Link>
            <Button
              onClick={onConsultationClick}
              className="bg-gradient-to-r from-gold-400 to-yellow-500 text-white hover:from-gold-500 hover:to-yellow-600"
            >
              Consultation Gratuite
            </Button>
          </div>
        </div>
      </nav>
    </motion.header>
  );
};

Header.propTypes = {
  onConsultationClick: PropTypes.func.isRequired,
};

export default Header;
