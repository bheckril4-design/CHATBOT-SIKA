import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageSquare, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';

import AssistantConsole from '@/components/chatbot/AssistantConsole';
import { Button } from '@/components/ui/button';

const Chatbot = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (location.pathname === '/assistant') {
      setIsOpen(false);
    }
  }, [location.pathname]);

  if (location.pathname === '/assistant') {
    return null;
  }

  return (
    <>
      <motion.div
        className="fixed bottom-8 right-8 z-50"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.8, duration: 0.45 }}
      >
        <Button
          onClick={() => setIsOpen((prev) => !prev)}
          className="h-16 w-16 rounded-full bg-gradient-to-r from-gold-400 to-yellow-500 shadow-lg hover:from-gold-500 hover:to-yellow-600"
          aria-label={isOpen ? 'Fermer SIKA' : 'Ouvrir SIKA'}
        >
          {isOpen ? <X className="h-8 w-8 text-white" /> : <MessageSquare className="h-8 w-8 text-white" />}
        </Button>
      </motion.div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.92 }}
            transition={{ duration: 0.22 }}
            className="fixed bottom-28 right-4 z-50 md:right-8"
          >
            <AssistantConsole variant="widget" showFullscreenLink />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Chatbot;
