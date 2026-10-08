import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ReviewCTA() {
  return <Button asChild variant="review"><Link to="/sign-up">Revisar mi tutela <ArrowRight aria-hidden="true" /></Link></Button>;
}