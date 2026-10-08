import { createFileRoute } from '@tanstack/react-router';
import { AuthScreen } from '@/components/auth-screen';
const title = 'Crea tu cuenta — TuTelaGanas';
const description = 'Crea una cuenta sencilla para solicitar la revisión de tu tutela de salud en Colombia.';
export const Route = createFileRoute('/sign-up')({ head: () => ({ meta: [{ title }, { name: 'description', content: description }, { property: 'og:title', content: title }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }), component: () => <AuthScreen mode="sign-up" /> });