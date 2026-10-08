import { createFileRoute, Link } from '@tanstack/react-router';
import { Check, ClipboardCheck, FileCheck2, MessageCircle, ShieldCheck, Smartphone, X } from 'lucide-react';
import { ReviewCTA } from '@/components/review-cta';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import hero from '@/assets/tutela-hero.jpg';

const title = 'Tutela clara — Revisa tu tutela de salud antes de presentarla';
const description = 'Revisión orientativa por WhatsApp para identificar qué le falta a tu tutela de salud contra una EPS en Colombia.';
export const Route = createFileRoute('/')({ head: () => ({ meta: [{ title }, { name: 'description', content: description }, { property: 'og:title', content: title }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }), component: Index });

const checks = [
  'Que quede claro quién presenta la tutela y contra qué entidad.',
  'Que los hechos estén explicados de forma ordenada.',
  'Que se identifique qué derecho se está vulnerando (salud, vida, etc.).',
  'Que haya soportes: orden médica, negación de la EPS, otros documentos.',
  'Que la tutela sea el camino adecuado en tu caso.',
];
const faqs = [
  ['¿Cuesta algo?', 'Sí, la revisión tiene un costo. Te informaremos el valor antes de comenzar para que decidas si quieres continuar.'],
  ['¿Por qué debo crear una cuenta?', 'Para identificar tu revisión y mantener tu información protegida. Solo te pedimos tu celular o tu cuenta de Google.'],
  ['¿Quién ve mi información?', 'Solo usamos tu celular o correo para identificar tu cuenta, y el texto de tu tutela únicamente para hacer la revisión. No lo compartimos con terceros.'],
  ['¿Sirve si todavía no he escrito mi tutela?', 'No. Necesitas tener una tutela ya redactada, aunque sea un borrador. Revisamos ese texto y te indicamos qué puedes corregir.'],
  ['¿Reemplaza a un abogado?', 'No. Es una revisión orientativa de requisitos. Si tu caso es complejo, te recomendamos consultar a un abogado.'],
];

function Index() {
  return <main>
    <section className="hero" aria-labelledby="hero-title">
      <img className="hero-photo" src={hero} width={1600} height={1008} fetchPriority="high" alt="Una mujer revisa sus documentos con su celular a mano." />
      <div className="content-width hero-content"><div className="hero-copy">
        <p className="eyebrow"><ShieldCheck size={20} aria-hidden="true" /> Tu derecho a la salud, con más claridad</p>
        <h1 id="hero-title">Antes de presentar tu tutela, revisa que no le falte nada</h1>
        <p className="hero-description">Envíanos tu tutela por WhatsApp y te decimos qué puntos le faltan o están débiles, para que los corrijas antes de entregarla al juzgado.</p>
        <ReviewCTA />
        <p className="cta-note">Crea tu cuenta en un minuto. Es una revisión orientativa, no reemplaza a un abogado.</p>
      </div></div>
    </section>
    <section className="section problem centered"><div className="content-width">
      <h2>Una tutela con errores puede retrasarte o ser devuelta</h2>
      <p>Cuando tu EPS te niega o demora un servicio de salud, la tutela es una herramienta válida. Pero si falta información clave, el juez puede pedirte corregirla o rechazarla, y mientras tanto tu tratamiento sigue esperando.</p>
    </div></section>
    <section className="section"><div className="content-width">
      <div className="centered"><p className="section-kicker">Sencillo, paso a paso</p><h2>Cómo funciona</h2></div>
      <div className="steps">
        {[{ icon: Smartphone, title: 'Crea tu cuenta', text: 'Con tu celular o Google, en menos de un minuto.' }, { icon: MessageCircle, title: 'Escríbenos por WhatsApp', text: 'Desde tu cuenta, abre el chat con un clic y envía el texto de tu tutela.' }, { icon: FileCheck2, title: 'Recibe la revisión', text: 'Te indicamos qué puntos cumple, cuáles no y qué corregir.' }].map((step, i) => <div className="step" key={step.title}><div className="step-icon"><step.icon size={28} strokeWidth={1.7} aria-hidden="true" /></div><p className="step-number">Paso {i + 1}</p><h3>{step.title}</h3><p>{step.text}</p></div>)}
      </div><div className="steps-action"><ReviewCTA /></div>
    </div></section>
    <section className="section review-section"><div className="content-width review-layout">
      <div><ClipboardCheck className="review-heading-icon" strokeWidth={1.3} aria-hidden="true" /><h2>Qué revisamos</h2><p className="intro">Los puntos clave para presentar una tutela más clara y completa.</p></div>
      <div><ul className="check-list">{checks.map(text => <li key={text}><Check aria-hidden="true" /><span>{text}</span></li>)}</ul><p className="legal-note">La revisión se basa en el Decreto 2591 de 1991 y en jurisprudencia de la Corte Constitucional.</p></div>
    </div></section>
    <section className="section"><div className="content-width"><div className="narrow">
      <p className="section-kicker">Con transparencia</p><h2>Qué debes saber antes de usarlo</h2>
      <ul className="transparency-list">{['No redactamos la tutela por ti: tú sigues siendo quien la escribe y la firma.', 'No garantizamos que el juez falle a tu favor.', 'No reemplazamos a un abogado. Si tu caso es complejo, consulta uno.'].map(text => <li key={text}><X size={20} aria-hidden="true" /><span>{text}</span></li>)}</ul>
      <div className="privacy-note"><ShieldCheck size={26} strokeWidth={1.6} aria-hidden="true" /><div><p>Tus datos de salud son sensibles: al registrarte solo guardamos tu celular o correo para identificar tu cuenta. El contenido de tu tutela se usa únicamente para la revisión y no se comparte con terceros.</p><p className="mt-4"><Link to="/politica-de-datos" className="text-link">Política de tratamiento de datos</Link></p></div></div>
    </div></div></section>
    <section className="section faq-section"><div className="content-width"><div className="narrow"><h2>Preguntas frecuentes</h2><Accordion type="single" collapsible>{faqs.map(([question, answer], i) => <AccordionItem key={question} value={`faq-${i}`}><AccordionTrigger className="faq-trigger">{question}</AccordionTrigger><AccordionContent className="faq-content">{answer}</AccordionContent></AccordionItem>)}</Accordion></div></div></section>
    <section className="section final-section centered"><div className="content-width"><h2>Revisa tu tutela antes de presentarla</h2><ReviewCTA /></div></section>
  </main>;
}
