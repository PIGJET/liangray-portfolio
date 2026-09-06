'use client';

import { useState } from 'react';
import ParticleScene, { type ParticlePalette } from '@/components/particles/ParticleScene';

const palettes: Array<{ id: ParticlePalette; label: string }> = [
  { id: 'pearl', label: 'Pearl' },
  { id: 'ice', label: 'Ice' },
  { id: 'violet', label: 'Violet' },
  { id: 'aurora', label: 'Aurora' },
  { id: 'ember', label: 'Ember' },
];

export default function Home() {
  const [entered, setEntered] = useState(false);
  const [palette, setPalette] = useState<ParticlePalette>('pearl');
  return <main><section className={`hero ${entered ? 'is-entered' : ''}`} id="home">
    <ParticleScene entered={entered} text="LIANGRAY LI" palette={palette} />
    <header className="site-header"><a className="monogram" href="#home" aria-label="Liangray Li, home">LL</a><nav aria-label="Primary navigation"><a href="#projects">Projects</a><a href="#about">About</a><a href="#contact">Contact</a></nav></header>
    <div className="palette-picker" aria-label="Particle color"><span>Color</span><div>{palettes.map((option) => <button key={option.id} type="button" className={palette === option.id ? 'is-active' : ''} data-palette={option.id} onClick={() => setPalette(option.id)} aria-label={`${option.label} particles`} aria-pressed={palette === option.id}><i /><b>{option.label}</b></button>)}</div></div>
    <div className="identity"><p className="eyebrow">Creative developer · Toronto</p><h1>Liangray Li</h1><p className="descriptor">I shape quiet, immersive digital experiences.</p></div>
    <button className="enter-button" onClick={() => setEntered(true)} aria-label="Enter portfolio"><span>Enter</span><span aria-hidden="true">↗</span></button>
    <a className="scroll-cue" href="#projects" aria-label="Scroll to selected projects"><span>Scroll</span><i /></a>
  </section><div className="portfolio-shell">
    <section className="work section" id="projects"><div className="section-intro"><span>01</span><div><p className="kicker">Selected work</p><h2>Projects built at the edge of <em>design & technology.</em></h2></div></div><div className="project-list">
      <article><div className="project-meta"><span>001</span><span>Digital experience</span><span>2026</span></div><h3>Solace</h3><p>An ambient platform for slower thinking, pairing generative environments with focused writing tools.</p><a href="#contact">View case study <span>↗</span></a></article>
      <article><div className="project-meta"><span>002</span><span>Interactive archive</span><span>2025</span></div><h3>Afterimage</h3><p>A living digital archive that turns personal photographs into an explorable landscape of memory.</p><a href="#contact">View case study <span>↗</span></a></article>
      <article><div className="project-meta"><span>003</span><span>Creative direction</span><span>2025</span></div><h3>North / East</h3><p>A restrained identity and commerce experience for objects made slowly and close to home.</p><a href="#contact">View case study <span>↗</span></a></article>
    </div></section>
    <section className="split-section section" id="about"><span className="section-number">02</span><div><p className="kicker">About</p><h2>I make digital work that feels <em>considered, human,</em> and quietly alive.</h2></div><div className="body-copy"><p>I’m Liangray, a creative developer based in Toronto. My practice sits between interaction design, code, and visual systems.</p><p>I care about the details people feel before they notice: rhythm, response, restraint, and the space between things.</p></div></section>
    <section className="split-section section" id="personal"><span className="section-number">03</span><div><p className="kicker">Personal</p><h2>Outside the screen, I’m usually <em>looking closer.</em></h2></div><div className="personal-grid"><span>Street photography</span><span>Long-distance running</span><span>Experimental sound</span><span>Small publications</span></div></section>
    <footer className="contact section" id="contact"><span className="section-number">04</span><p className="kicker">Contact</p><h2>Have something in mind?</h2><a className="email" href="mailto:hello@liangray.com">Let’s make it real <span>↗</span></a><div className="footer-bottom"><span>Liangray Li © 2026</span><div><a href="#">Instagram</a><a href="#">LinkedIn</a><a href="#home">Back to top ↑</a></div></div></footer>
  </div></main>;
}
