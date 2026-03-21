import React from 'react';
import PropTypes from 'prop-types';
import { AnimatePresence, motion } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';

const adContent = {
  type: 'image',
  title: 'Demandez une d\u00e9monstration SIKA',
  description:
    "\u00c9changez avec Oceanic Conseils pour cadrer vos objectifs, vos contraintes et les hypoth\u00e8ses \u00e0 valider avant une d\u00e9cision financi\u00e8re.",
  imageUrl:
    'https://images.unsplash.com/photo-1665686306574-1ace09918530?q=80&w=2070&auto=format&fit=crop',
  videoUrl: '',
  ctaText: 'Parler \u00e0 un conseiller',
  ctaLink: 'https://oceanicconseils.com/contact/',
};

const AdPopup = ({ isOpen, onClose }) => (
  <AnimatePresence>
    {isOpen && (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-lg border-gold-400/30 bg-slate-800/80 p-0 text-white backdrop-blur-md">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {adContent.type === 'image' && adContent.imageUrl && (
              <img
                src={adContent.imageUrl}
                alt={adContent.title}
                className="h-64 w-full rounded-t-lg object-cover"
              />
            )}
            {adContent.type === 'video' && adContent.videoUrl && (
              <div className="aspect-video">
                <iframe
                  className="h-full w-full rounded-t-lg"
                  src={adContent.videoUrl}
                  title={adContent.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
            <div className="p-8 text-center">
              <h3 className="mb-4 text-3xl font-bold text-gold-400">{adContent.title}</h3>
              <p className="mb-6 text-white/80">{adContent.description}</p>
              <Button
                asChild
                size="lg"
                className="bg-gradient-to-r from-gold-400 to-yellow-500 font-semibold text-white hover:from-gold-500 hover:to-yellow-600"
              >
                <a href={adContent.ctaLink} target="_blank" rel="noopener noreferrer">
                  {adContent.ctaText}
                </a>
              </Button>
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>
    )}
  </AnimatePresence>
);

AdPopup.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default AdPopup;
