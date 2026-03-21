import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

const Footer = ({ onFeatureClick }) => (
  <footer className="border-t border-white/20 bg-black/20 px-6 py-12 backdrop-blur-md">
    <div className="container mx-auto">
      <div className="grid gap-8 md:grid-cols-4">
        <div>
          <div className="mb-6 flex items-center space-x-3">
            <div className="flex h-12 w-12 items-center justify-center">
              <img
                src="https://storage.googleapis.com/hostinger-horizons-assets-prod/b727d054-1078-49e9-b578-fe3a7f228875/20119d4f61b3079b66426299117ab748.jpg"
                alt="SIKA Logo"
                className="rounded-lg object-contain"
              />
            </div>
            <span className="text-xl font-bold text-white">SIKA</span>
          </div>
          <p className="text-white/70">
            Outils, explications et accompagnement pour pr&eacute;parer des d&eacute;cisions
            financi&egrave;res plus claires et plus prudentes.
          </p>
        </div>

        <div>
          <h3 className="mb-4 font-semibold text-white">Services</h3>
          <ul className="space-y-2 text-white/70">
            <li>
              <a
                href="https://oceanicconseils.com/services/"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-white"
              >
                Planification Retraite
              </a>
            </li>
            <li>
              <a
                href="https://oceanicconseils.com/services/"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-white"
              >
                Investissement
              </a>
            </li>
            <li>
              <a
                href="https://oceanicconseils.com/services/"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-white"
              >
                Assurance
              </a>
            </li>
            <li>
              <a
                href="https://oceanicconseils.com/services/"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-white"
              >
                Optimisation Fiscale
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="mb-4 font-semibold text-white">Ressources</h3>
          <ul className="space-y-2 text-white/70">
            <li>
              <a
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  onFeatureClick('calculators');
                }}
                className="transition-colors hover:text-white"
              >
                Calculateurs
              </a>
            </li>
            <li>
              <Link to="/guides" className="transition-colors hover:text-white">
                Guides
              </Link>
            </li>
            <li>
              <Link to="/assistant" className="transition-colors hover:text-white">
                Assistant
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="mb-4 font-semibold text-white">Contact</h3>
          <ul className="space-y-2 text-white/70">
            <li>Email : contact@oceanicconseils.com</li>
            <li>T&eacute;l. B&eacute;nin : +229 0197392580</li>
            <li>T&eacute;l. Maroc : +212 660693839</li>
            <li>Adresse : Agla les pyl&ocirc;nes, Cotonou B&eacute;nin</li>
          </ul>
        </div>
      </div>

      <div className="mt-8 border-t border-white/20 pt-8 text-center text-white/60">
        <p>&copy; {new Date().getFullYear()} SIKA (Oceanic Conseils Sarl). Tous droits r&eacute;serv&eacute;s.</p>
        <div className="mt-4">
          <Link
            to="/mentions-legales"
            className="text-sm text-white/60 transition-colors hover:text-white"
          >
            Mentions l&eacute;gales
          </Link>
        </div>
      </div>
    </div>
  </footer>
);

Footer.propTypes = {
  onFeatureClick: PropTypes.func.isRequired,
};

export default Footer;
