'use client';

import Link from 'next/link';
import Image from 'next/image';
import runningImage from '@/images/runningimage.jpg';

/* ── Architectural vertical grid lines ── */
function GridLines() {
  return (
    <div className="fixed inset-0 pointer-events-none z-30" aria-hidden="true">
      <div className="absolute top-0 bottom-0 left-[8.33%]  w-px bg-[#1A1A1A]/[0.07]" />
      <div className="absolute top-0 bottom-0 left-[33.33%] w-px bg-[#1A1A1A]/[0.07]" />
      <div className="absolute top-0 bottom-0 left-[66.66%] w-px bg-[#1A1A1A]/[0.07]" />
      <div className="absolute top-0 bottom-0 right-[8.33%] w-px bg-[#1A1A1A]/[0.07]" />
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="bg-[#F9F8F6] text-[#1A1A1A] min-h-screen overflow-x-hidden">
      <GridLines />

      {/* ─────────────────────────────────────────
          NAVIGATION
      ───────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 md:px-16 h-16 border-b border-[#1A1A1A]/10 bg-[#F9F8F6]/90 backdrop-blur-sm">
        {/* Wordmark */}
        <span className="font-serif text-base tracking-tight select-none">
          PROCESS<span className="text-[#D4AF37]">.</span>
        </span>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-10">
          {['PERFORMANCE', 'METHOD', 'ATHLETES'].map((item) => (
            <span
              key={item}
              className="text-[10px] tracking-[0.22em] text-[#6C6863] hover:text-[#1A1A1A] transition-colors duration-500 cursor-pointer font-medium"
            >
              {item}
            </span>
          ))}
        </div>

        {/* CTA — secondary border button with dark fill on hover */}
        <Link
          href="/login"
          className="relative overflow-hidden group h-9 px-6 flex items-center border border-[#1A1A1A] text-[10px] tracking-[0.22em] font-medium"
        >
          <span className="absolute inset-0 bg-[#1A1A1A] -translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out" />
          <span className="relative z-10 group-hover:text-white transition-colors duration-500">LOG IN</span>
        </Link>
      </nav>


      {/* ─────────────────────────────────────────
          HERO
      ───────────────────────────────────────── */}
      <section className="min-h-screen pt-16 grid grid-cols-1 md:grid-cols-12">

        {/* Left — content anchored to bottom-left */}
        <div className="md:col-span-7 flex flex-col justify-end pb-16 md:pb-28 px-8 md:px-16 pt-28 md:pt-0 relative">

          {/* Overline */}
          <div className="flex items-center gap-4 mb-10 md:mb-14">
            <div className="h-px w-8 md:w-12 bg-[#1A1A1A]" />
            <span className="text-[10px] tracking-[0.3em] text-[#6C6863] uppercase font-medium">
              Est. 2026
            </span>
          </div>

          {/* Headline — massive Playfair with italic gold emphasis */}
          <h1 className="font-serif text-[clamp(3.5rem,9.5vw,8rem)] leading-[0.88] tracking-tight mb-10 md:mb-14">
            <span className="block">Precision</span>
            <span className="block italic text-[#D4AF37]">for the</span>
            <span className="block">Elite.</span>
          </h1>

          {/* Body */}
          <p className="text-base md:text-lg text-[#6C6863] leading-relaxed max-w-sm mb-12 md:mb-16">
            Comprehensive performance analytics built for athletes
            who train with intention. Strength, endurance,
            recovery — unified.
          </p>

          {/* Actions */}
          <div className="flex items-center gap-8">
            {/* Primary — dark fill, gold slide on hover */}
            <Link
              href="/signup"
              className="relative overflow-hidden group h-12 px-10 flex items-center bg-[#1A1A1A] text-white text-[10px] tracking-[0.22em] font-medium shadow-[0_4px_16px_rgba(0,0,0,0.15)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.25)] transition-shadow duration-500"
            >
              <span className="absolute inset-0 bg-[#D4AF37] -translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out" />
              <span className="relative z-10">Begin Training</span>
            </Link>

            {/* Ghost link */}
            <Link
              href="/dashboard"
              className="text-[10px] tracking-[0.22em] text-[#6C6863] hover:text-[#D4AF37] uppercase transition-colors duration-500 font-medium"
            >
              View Platform →
            </Link>
          </div>

          {/* Vertical editorial label */}
          <div
            className="hidden md:block absolute bottom-28 right-4 text-[10px] tracking-[0.35em] text-[#1A1A1A]/20 uppercase font-medium"
            style={{ writingMode: 'vertical-rl' }}
            aria-hidden="true"
          >
            Performance / Vol. 01
          </div>
        </div>

        {/* Right — editorial image block */}
        <div className="md:col-span-5 relative min-h-[70vw] md:min-h-0 overflow-hidden group">
          {/* Photo — grayscale by default, slow colour reveal on hover */}
          <Image
            src={runningImage}
            alt="Elite athlete in motion"
            fill
            priority
            className="object-cover grayscale transition-[filter,transform] duration-[2000ms] ease-out group-hover:grayscale-0 group-hover:scale-105"
          />

          {/* Vignette — darkens bottom so caption is always legible */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0C0C0C]/70 via-transparent to-transparent pointer-events-none" />

          {/* Bottom caption strip */}
          <div className="absolute bottom-8 left-8 right-8 z-10">
            <div className="h-px w-full bg-white/10 mb-4" />
            <div className="flex justify-between items-center">
              <span className="text-[9px] tracking-[0.25em] text-white/35 uppercase font-medium">
                Athlete / Sprint Protocol
              </span>
              <span className="text-[9px] tracking-[0.2em] text-white/35 font-medium">001</span>
            </div>
          </div>

          {/* Decorative inner border — subtle frame */}
          <div className="absolute inset-4 border border-white/[0.06] pointer-events-none z-10" />
        </div>
      </section>


      {/* ─────────────────────────────────────────
          STATS BAR
      ───────────────────────────────────────── */}
      <section
        className="border-t border-b border-[#1A1A1A]/10 grid grid-cols-2 md:grid-cols-4"
        aria-label="Platform statistics"
      >
        {[
          { number: '10K+', label: 'Sessions Logged' },
          { number: '94%',  label: 'Athletes Hit PR'  },
          { number: '3',    label: 'Disciplines'      },
          { number: '52',   label: 'Weeks of Data'    },
        ].map((stat, i) => (
          <div
            key={stat.label}
            className={[
              'py-10 md:py-16 px-8 md:px-12',
              i % 2 === 0 ? 'border-r border-[#1A1A1A]/10' : '',
              i < 2       ? 'border-b md:border-b-0 border-[#1A1A1A]/10' : '',
              i < 3       ? 'md:border-r md:border-[#1A1A1A]/10' : '',
            ].join(' ')}
          >
            <p className="font-serif text-5xl md:text-6xl leading-none tracking-tight text-[#1A1A1A] mb-2">
              {stat.number}
            </p>
            <p className="text-[10px] tracking-[0.28em] text-[#6C6863] uppercase font-medium">
              {stat.label}
            </p>
          </div>
        ))}
      </section>


      {/* ─────────────────────────────────────────
          METHOD — dark section
      ───────────────────────────────────────── */}
      <section className="bg-[#1A1A1A] text-[#F9F8F6] py-24 md:py-36 px-8 md:px-16">
        <div className="max-w-[1400px] mx-auto">

          {/* Section overline */}
          <div className="flex items-center gap-4 mb-16 md:mb-20">
            <div className="h-px w-8 md:w-12 bg-[#F9F8F6]/20" />
            <span className="text-[10px] tracking-[0.3em] text-[#F9F8F6]/35 uppercase font-medium">
              The Method
            </span>
          </div>

          {/* Asymmetric headline + body */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-0 mb-20 md:mb-28">
            <div className="md:col-span-7">
              <h2 className="font-serif text-5xl md:text-7xl leading-[0.9] tracking-tight">
                <span className="block">The science</span>
                <span className="block italic text-[#D4AF37]">of performance,</span>
                <span className="block">simplified.</span>
              </h2>
            </div>
            <div className="md:col-span-4 md:col-start-9 flex items-end">
              <p className="text-base text-[#EBE5DE]/55 leading-relaxed">
                Three disciplines. One platform. Zero compromises.
                Built by athletes, for athletes who understand that
                data is the difference between good and exceptional.
              </p>
            </div>
          </div>

          {/* Feature columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 border-t border-[#F9F8F6]/10">
            {[
              {
                index:       '01',
                title:       'Strength',
                description: 'Log every set, every rep. Track progressive overload across exercises. Identify plateaus before they appear. Your strength curve, rendered precisely.',
              },
              {
                index:       '02',
                title:       'Endurance',
                description: 'Distance, elevation, pace — running and cycling at full depth. Caloric expenditure calculated from your biometrics, not generic estimates.',
              },
              {
                index:       '03',
                title:       'Recovery',
                description: 'Daily readiness scoring. Sleep quality, soreness, motivation — tracked with clinical precision. Know when to push. Know when to rest.',
              },
            ].map((feature, i) => (
              <div
                key={feature.index}
                className={[
                  'pt-10 pb-14 group',
                  i === 0 ? 'md:pr-10' : '',
                  i === 1 ? 'md:px-10 md:border-x border-[#F9F8F6]/10' : '',
                  i === 2 ? 'md:pl-10' : '',
                ].join(' ')}
              >
                <span className="text-[10px] tracking-[0.3em] text-[#D4AF37] uppercase font-medium mb-6 block">
                  {feature.index}
                </span>
                <h3 className="font-serif text-3xl md:text-4xl text-[#F9F8F6] mb-5 transition-all duration-700 group-hover:italic">
                  {feature.title}
                </h3>
                <p className="text-sm text-[#EBE5DE]/45 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ─────────────────────────────────────────
          PULL QUOTE
      ───────────────────────────────────────── */}
      <section className="py-24 md:py-36 px-8 md:px-16 border-b border-[#1A1A1A]/10">
        <div className="max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-12">
          <div className="md:col-span-9 md:col-start-2">
            <div className="h-px w-10 bg-[#D4AF37] mb-12" />
            <blockquote className="font-serif text-4xl md:text-[3.75rem] leading-[1.08] tracking-tight">
              "The margin between good<br className="hidden md:block" />
              {' '}and{' '}
              <em className="text-[#D4AF37] not-italic italic">exceptional</em>
              <br className="hidden md:block" />
              {' '}is measured in detail."
            </blockquote>
            <p className="text-[10px] tracking-[0.28em] text-[#6C6863] uppercase font-medium mt-8">
              The ATHLÈTE Principle
            </p>
          </div>
        </div>
      </section>


      {/* ─────────────────────────────────────────
          PLATFORM PREVIEW — week grid
      ───────────────────────────────────────── */}
      <section className="py-24 md:py-36 px-8 md:px-16">
        <div className="max-w-[1400px] mx-auto">

          {/* Section header */}
          <div className="flex items-center gap-4 mb-16">
            <div className="h-px w-8 md:w-12 bg-[#1A1A1A]" />
            <span className="text-[10px] tracking-[0.3em] text-[#6C6863] uppercase font-medium">
              The Platform
            </span>
          </div>

          {/* Asymmetric intro */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 mb-16 md:mb-20">
            <div className="md:col-span-6">
              <h2 className="font-serif text-4xl md:text-6xl leading-[0.92] tracking-tight">
                <span className="block">Your week,</span>
                <em className="text-[#D4AF37] not-italic italic block">at a glance.</em>
              </h2>
            </div>
            <div className="md:col-span-4 md:col-start-8 flex items-end">
              <p className="text-base text-[#6C6863] leading-relaxed">
                Every session, every discipline, across your full
                training week. Identify gaps. Maintain balance.
                Execute with precision.
              </p>
            </div>
          </div>

          {/* Stylised week grid */}
          <div className="border border-[#1A1A1A]/10">

            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-[#1A1A1A]/10">
              {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day, i) => (
                <div
                  key={day}
                  className={`py-3 px-3 md:px-5 ${i < 6 ? 'border-r border-[#1A1A1A]/10' : ''}`}
                >
                  <span className="text-[9px] tracking-[0.28em] text-[#6C6863] uppercase font-medium">
                    {day}
                  </span>
                </div>
              ))}
            </div>

            {/* Session cells */}
            <div className="grid grid-cols-7">
              {[
                { type: 'strength',  label: 'Squat Day',   detail: '68 min' },
                { type: 'rest',      label: null,           detail: null },
                { type: 'endurance', label: 'Track Run',    detail: '12.4 km' },
                { type: 'strength',  label: 'Upper Body',   detail: '55 min' },
                { type: 'endurance', label: 'Tempo Ride',   detail: '45.2 km' },
                { type: 'rest',      label: null,           detail: null },
                { type: 'today',     label: null,           detail: null },
              ].map((day, i) => (
                <div
                  key={i}
                  className={[
                    'min-h-[100px] md:min-h-[140px] p-3 md:p-5 relative',
                    i < 6 ? 'border-r border-[#1A1A1A]/10' : '',
                    day.type === 'today' ? 'bg-[#1A1A1A]' : '',
                  ].join(' ')}
                >
                  {day.type === 'strength' && (
                    <div className="border-t-2 border-[#1A1A1A] pt-3">
                      <p className="text-[8px] tracking-[0.2em] text-[#6C6863] uppercase mb-1.5 font-medium">
                        Strength
                      </p>
                      <p className="text-xs font-medium text-[#1A1A1A] leading-tight">{day.label}</p>
                      <p className="text-[10px] text-[#6C6863] mt-1">{day.detail}</p>
                    </div>
                  )}
                  {day.type === 'endurance' && (
                    <div className="border-t-2 border-[#D4AF37] pt-3">
                      <p className="text-[8px] tracking-[0.2em] text-[#D4AF37] uppercase mb-1.5 font-medium">
                        Endurance
                      </p>
                      <p className="text-xs font-medium text-[#1A1A1A] leading-tight">{day.label}</p>
                      <p className="text-[10px] text-[#6C6863] mt-1">{day.detail}</p>
                    </div>
                  )}
                  {day.type === 'rest' && (
                    <div className="flex items-end h-full pb-2">
                      <span className="text-[8px] tracking-[0.2em] text-[#1A1A1A]/15 uppercase font-medium">
                        Rest
                      </span>
                    </div>
                  )}
                  {day.type === 'today' && (
                    <div className="flex flex-col items-center justify-center h-full gap-2.5">
                      <div className="w-px h-6 bg-[#D4AF37]/50" />
                      <span className="text-[8px] tracking-[0.25em] text-[#D4AF37]/60 uppercase font-medium">
                        Today
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Caption */}
          <p className="text-[10px] tracking-[0.2em] text-[#6C6863]/60 uppercase font-medium mt-5">
            — Sample training week
          </p>
        </div>
      </section>


      {/* ─────────────────────────────────────────
          FINAL CTA — dark
      ───────────────────────────────────────── */}
      <section className="bg-[#1A1A1A] text-[#F9F8F6] py-32 md:py-48 px-8 md:px-16 text-center relative overflow-hidden">

        {/* Decorative horizontal lines */}
        <div className="absolute top-0 left-0 right-0 h-px bg-[#F9F8F6]/5" />

        <div className="relative z-10 max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-4 mb-14">
            <div className="h-px w-10 bg-[#D4AF37]/30" />
            <span className="text-[10px] tracking-[0.3em] text-[#F9F8F6]/25 uppercase font-medium">
              Ready to Begin
            </span>
            <div className="h-px w-10 bg-[#D4AF37]/30" />
          </div>

          <h2 className="font-serif text-5xl md:text-8xl leading-[0.88] tracking-tight mb-12">
            <span className="block">Train with</span>
            <em className="text-[#D4AF37] not-italic italic block">intention.</em>
          </h2>

          <p className="text-sm md:text-base text-[#EBE5DE]/45 leading-relaxed mb-14 max-w-sm mx-auto">
            Join athletes who track with precision and train without compromise.
          </p>

          {/* CTA — border button, gold fill on hover, text inverts */}
          <Link
            href="/signup"
            className="relative overflow-hidden group inline-flex h-14 px-12 items-center border border-[#F9F8F6]/20 hover:border-[#D4AF37] text-[10px] tracking-[0.22em] font-medium text-[#F9F8F6] transition-colors duration-700"
          >
            <span className="absolute inset-0 bg-[#D4AF37] -translate-x-full group-hover:translate-x-0 transition-transform duration-700 ease-out" />
            <span className="relative z-10 group-hover:text-[#1A1A1A] transition-colors duration-700">
              Access the Platform
            </span>
          </Link>
        </div>
      </section>


      {/* ─────────────────────────────────────────
          FOOTER
      ───────────────────────────────────────── */}
      <footer className="bg-[#1A1A1A] border-t border-[#F9F8F6]/5 px-8 md:px-16 py-8 flex items-center justify-between gap-6">
        <span className="font-serif text-sm text-[#F9F8F6]/35 select-none">
          PROCESS<span className="text-[#D4AF37]/35">.</span>
        </span>
        <p className="text-[9px] tracking-[0.2em] text-[#F9F8F6]/18 uppercase hidden md:block">
          © 2026 — All Rights Reserved
        </p>
        <div className="flex gap-6">
          {['Privacy', 'Terms'].map((item) => (
            <span
              key={item}
              className="text-[9px] tracking-[0.18em] text-[#F9F8F6]/18 uppercase cursor-pointer hover:text-[#F9F8F6]/40 transition-colors duration-500 font-medium"
            >
              {item}
            </span>
          ))}
        </div>
      </footer>
    </div>
  );
}
