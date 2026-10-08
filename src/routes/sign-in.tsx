import { createFileRoute } from '@tanstack/react-router';
import { AuthScreen } from '@/components/auth-screen';
const title = 'Ingresa a tu cuenta — TuTelaGanas';
const description = 'Ingresa para continuar con la revisión orientativa de tu tutela de salud por WhatsApp.';
export const Route = createFileRoute('/sign-in')({ head: () => ({ meta: [{ title }, { name: 'description', content: description }, { property: 'og:title', content: title }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }), component: () => <AuthScreen mode="sign-in" /> });