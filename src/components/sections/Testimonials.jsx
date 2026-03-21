import React from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

const testimonials = [
  {
    quote:
      "Gr\u00e2ce \u00e0 leurs conseils, j'ai pu optimiser mes investissements et pr\u00e9parer sereinement ma retraite.",
    name: 'Juste E.',
    role: 'Entrepreneur',
  },
  {
    quote:
      "Une approche personnalis\u00e9e qui m'a permis de r\u00e9duire mes imp\u00f4ts tout en augmentant mon patrimoine.",
    name: 'Emeko D.',
    role: 'Cadre Sup\u00e9rieur',
  },
  {
    quote:
      "Des conseils clairs et pr\u00e9cis qui ont transform\u00e9 ma vision de la gestion financi\u00e8re.",
    name: 'Nabilath K.',
    role: 'M\u00e9decin',
  },
];

const Testimonials = () => (
  <section
    id="testimonials"
    className="scroll-mt-24 bg-[linear-gradient(180deg,rgba(70,92,168,0.96),rgba(55,74,148,0.96))] px-6 py-24"
  >
    <div className="container mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-14 text-center"
      >
        <p className="mb-3 text-sm uppercase tracking-[0.35em] text-cyan-200/75">
          T&eacute;moignages
        </p>
        <h2 className="mb-5 text-4xl font-bold text-white md:text-5xl">
          Ce que nos clients disent
        </h2>
        <p className="mx-auto max-w-3xl text-lg leading-8 text-white/72 md:text-xl">
          Des retours d&apos;exp&eacute;rience concrets sur la qualit&eacute; de l&apos;accompagnement
          et la clart&eacute; des conseils.
        </p>
      </motion.div>

      <div className="grid gap-8 lg:grid-cols-3">
        {testimonials.map((testimonial, index) => (
          <motion.article
            key={testimonial.name}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 }}
            className="rounded-[28px] border border-white/18 bg-white/8 p-10 shadow-[0_22px_60px_rgba(21,34,87,0.22)] backdrop-blur-sm"
          >
            <div className="mb-8 flex items-center gap-1 text-yellow-300">
              {Array.from({ length: 5 }).map((_, starIndex) => (
                <Star
                  key={`${testimonial.name}-${starIndex}`}
                  className="h-7 w-7 fill-current"
                />
              ))}
            </div>

            <blockquote className="min-h-[176px] text-[22px] font-medium italic leading-[1.8] text-white/86">
              &quot;{testimonial.quote}&quot;
            </blockquote>

            <div className="mt-10">
              <p className="text-[22px] font-bold text-white">{testimonial.name}</p>
              <p className="mt-2 text-[18px] text-white/58">{testimonial.role}</p>
            </div>
          </motion.article>
        ))}
      </div>
    </div>
  </section>
);

export default Testimonials;
